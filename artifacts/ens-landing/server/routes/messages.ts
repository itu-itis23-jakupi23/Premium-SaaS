import { Router, type Request } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { authenticatedUserFromRequest } from "./auth.js";
import { readJsonStore, writeJsonStore } from "../storage.js";

type Role = "chief" | "pm" | "client";

interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
  company?: string;
}

interface CoreClient {
  id: string;
  name: string;
  company: string;
  contactName: string;
  contactEmail: string;
  pm: string;
  managerId?: string | null;
  projectId?: string | null;
  agency?: string;
}

interface CoreProject {
  id: string;
  name: string;
  client: string;
  pm: string;
  managerId?: string | null;
  agency?: string;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  company?: string;
  agency?: string | null;
}

interface StoredMessage {
  id: string;
  conversationId: string;
  body: string;
  text: string;
  attachments: Array<{ id: string; name: string; size: number; type: string; url?: string }>;
  senderUserId: string;
  read: boolean;
  createdAt: string;
}

interface MessageStore {
  messages: StoredMessage[];
}

interface AttachmentStore {
  attachments: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    dataBase64: string;
    uploadedBy?: string;
    uploadedByRole?: Role;
    createdAt: string;
  }>;
}

const router = Router();
const STORE_KEY = "messages";

const attachmentSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  size: z.number().int().min(0).max(25_000_000),
  type: z.string().trim().min(1).max(120),
  url: z.string().trim().max(1000).optional(),
});

const sendMessageSchema = z.object({
  body: z.string().trim().max(4000).optional().default(""),
  context: z.object({
    projectId: z.string().trim().min(1).max(120).optional(),
    exhibitionId: z.string().trim().max(120).optional(),
    exhibitionName: z.string().trim().max(240).optional(),
  }).optional().default({}),
  attachments: z.array(attachmentSchema).max(8).optional().default([]),
});

const PEOPLE: Actor[] = [
  { id: "demo-chief", name: "Agency Owner", email: "chief@example.com", role: "chief" },
  { id: "demo-pm", name: "Project Manager", email: "pm@example.com", role: "pm" },
  { id: "demo-client", name: "Demo Client", email: "demo.client@example.com", role: "client" },
];

class AuthRequiredError extends Error {
  status = 401;
}

async function actorFromRequest(req: Request): Promise<Actor> {
  const demoAccessEnabled = process.env.ENABLE_DEMO_ACCESS === "true" || process.env.VITE_ENABLE_DEMO_ACCESS === "true";
  const headerUserId = req.header("x-user-id");
  if (process.env.NODE_ENV !== "production" && demoAccessEnabled && headerUserId) {
    const rawRole = String(req.header("x-user-role") || "pm");
    const role = (rawRole === "chief" || rawRole === "client" ? rawRole : "pm") as Role;
    return {
      id: headerUserId,
      role,
      name: decodeURIComponent(String(req.header("x-user-name") || "ENS User")),
      email: String(req.header("x-user-email") || "user@example.com"),
      company: String(req.header("x-user-company") || "ENS Demo Agency"),
    };
  }

  const sessionUser = await authenticatedUserFromRequest(req);
  if (sessionUser) {
    return {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      company: sessionUser.company,
    };
  }
  if (process.env.NODE_ENV === "production" || !demoAccessEnabled) {
    throw new AuthRequiredError("Authentication is required.");
  }
  const rawRole = String(req.header("x-user-role") || "pm");
  const role = (rawRole === "chief" || rawRole === "client" ? rawRole : "pm") as Role;
  const id = String(req.header("x-user-id") || (role === "client" ? "demo-client" : role === "chief" ? "demo-chief" : "demo-pm"));
  const fallback = PEOPLE.find((person) => person.id === id) ?? PEOPLE.find((person) => person.role === role);
  return {
    id,
    role,
    name: decodeURIComponent(String(req.header("x-user-name") || fallback?.name || "ENS User")),
    email: String(req.header("x-user-email") || fallback?.email || "user@example.com"),
    company: String(req.header("x-user-company") || "ENS Demo Agency"),
  };
}

function authErrorResponse(res: { status(code: number): { json(body: unknown): unknown } }, error: unknown) {
  if (error instanceof AuthRequiredError) {
    res.status(error.status).json({ error: "Unauthorized.", message: error.message });
    return true;
  }
  return false;
}

async function contactsFor(actor: Actor) {
  const [coreStore, authStore] = await Promise.all([readCoreStore(), readAuthStore()]);
  const actorCompany = normalizedCompany(actor.company);
  const users = authStore.users.filter((user) => normalizedCompany(user.agency || user.company) === actorCompany);
  const allClients = coreStore.clients;
  const clients = allClients.filter((client) => normalizedCompany(client.agency) === actorCompany);

  if (actor.role === "client") {
    const client = clientForActor(allClients, actor);
    const clientAgency = normalizedCompany(client?.agency || actor.company);
    const clientUsers = authStore.users.filter((user) => normalizedCompany(user.agency || user.company) === clientAgency);
    const clientIdentity = canonicalPersonId(client?.id ?? actor.id);
    const messageStore = await readStore();
    const threadPmContacts = messageStore.messages.flatMap((message) => {
      const [, first, second] = message.conversationId.split(":");
      if (first !== clientIdentity && second !== clientIdentity) return [];
      const otherId = first === clientIdentity ? second : first;
      const user = clientUsers.find((item) => item.id === otherId && item.role === "pm");
      return user ? [user] : [];
    });
    const assignedPm = client?.pm && client.pm !== "Unassigned"
      ? clientUsers.find((user) => (
        user.role === "pm"
        && (user.id === client.managerId || user.name.trim().toLowerCase() === client.pm.trim().toLowerCase())
      ))
      : null;
    return [assignedPm, ...threadPmContacts].filter(Boolean).filter(uniqueContact).map(toContact);
  }
  if (actor.role === "pm") {
    const assignedClients = clients.filter((client) => (
      client.managerId === actor.id || client.pm.trim().toLowerCase() === actor.name.trim().toLowerCase()
    ));
    const chief = users.find((user) => user.role === "chief");
    const realContacts = [
      ...assignedClients.map((client) => ({
        id: client.id,
        name: client.contactName || client.name || client.company,
        email: client.contactEmail,
        role: "client" as Role,
      })),
      chief,
    ];
    return realContacts.filter(Boolean).filter(uniqueContact).map(toContact);
  }
  const staff = users.filter((user) => user.role === "pm");
  const clientContacts = clients.map((client) => ({
    id: client.id,
    name: client.contactName || client.name || client.company,
    email: client.contactEmail,
    role: "client" as Role,
  }));
  return [...staff, ...clientContacts].filter(Boolean).filter(uniqueContact).map(toContact);
}

function conversationIdFor(a: string, b: string, _projectId = "general") {
  const projectId = _projectId.trim() || "general";
  return `conv:${[canonicalPersonId(a), canonicalPersonId(b)].sort().join(":")}:${projectId}`;
}

function canonicalPersonId(id: string) {
  return id;
}

function formatTime(createdAt: string) {
  const delta = Date.now() - new Date(createdAt).getTime();
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.max(1, Math.round(delta / 60_000))}m ago`;
  if (delta < 86_400_000) return `${Math.max(1, Math.round(delta / 3_600_000))}h ago`;
  return new Date(createdAt).toLocaleDateString();
}

function publicAttachment(attachment: StoredMessage["attachments"][number]) {
  return {
    ...attachment,
    url: attachment.url ?? `/platform/messages/attachments/${attachment.id}`,
  };
}

async function canDownloadAttachment(actor: Actor, attachmentId: string) {
  const [messageStore, coreStore] = await Promise.all([readStore(), readCoreStore()]);
  const actorIdentity = canonicalPersonId(contactIdentity(actor, coreStore.clients));
  return messageStore.messages.some((message) =>
    message.conversationId.includes(actorIdentity)
    && message.attachments.some((attachment) => attachment.id === attachmentId)
  );
}

function managerIdFromName(name: string) {
  if (!name || name === "Unassigned") return null;
  return `pm-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "manager"}`;
}

function isAssignedPm(actor: Pick<Actor, "id" | "name" | "role">, managerName: string | null | undefined) {
  if (actor.role !== "pm") return false;
  const assignedName = String(managerName || "").trim();
  if (!assignedName || assignedName === "Unassigned") return false;
  return assignedName.toLowerCase() === actor.name.trim().toLowerCase()
    || managerIdFromName(assignedName) === actor.id;
}

function clientMatchesProject(client: CoreClient | null | undefined, project: CoreProject) {
  if (!client) return false;
  if (client.projectId && client.projectId === project.id) return true;
  const projectClient = project.client.trim().toLowerCase();
  return [client.id, client.name, client.company, client.contactName]
    .filter(Boolean)
    .some((value) => String(value).trim().toLowerCase() === projectClient);
}

async function assignedPmMatchesContact(project: CoreProject, contactId: string, company: string) {
  const assignedName = String(project.pm || "").trim().toLowerCase();
  if (!assignedName || assignedName === "unassigned") return false;
  if (project.managerId && project.managerId === contactId) return true;
  if (managerIdFromName(project.pm) === canonicalPersonId(contactId)) return true;

  const authStore = await readJsonStore<{ users: AuthUser[] }>("auth", { users: [] });
  const companyKey = normalizedCompany(company);
  return authStore.users.some((user) => (
    user.role === "pm"
    && user.id === contactId
    && user.name.trim().toLowerCase() === assignedName
    && normalizedCompany(user.company || user.agency) === companyKey
  ));
}

async function canAccessProjectThread(actor: Actor, contactId: string, projectId: string, coreStore: { clients: CoreClient[]; projects?: CoreProject[] }) {
  if (!projectId || projectId === "general") return true;

  const project = coreStore.projects?.find((item) => item.id === projectId);
  if (!project) return false;

  const actorCompany = normalizedCompany(actor.company);
  const projectAgency = normalizedCompany(project.agency);

  const contactClient = coreStore.clients.find((client) => canonicalPersonId(client.id) === canonicalPersonId(contactId));
  const actorClient = actor.role === "client" ? clientForActor(coreStore.clients, actor) : null;
  const actorClientAgency = normalizedCompany(actorClient?.agency);

  if (actor.role !== "client" && projectAgency !== actorCompany) return false;
  if (actor.role === "client" && actorClientAgency && projectAgency !== actorClientAgency) return false;

  if (actor.role === "chief") {
    return !contactClient || clientMatchesProject(contactClient, project) || isAssignedPm({ ...actor, role: "pm" }, project.pm);
  }

  if (actor.role === "pm") {
    return isAssignedPm(actor, project.pm) && clientMatchesProject(contactClient, project);
  }

  return clientMatchesProject(actorClient, project)
    && await assignedPmMatchesContact(project, contactId, actorCompany);
}

async function readStore(): Promise<MessageStore> {
  return readJsonStore<MessageStore>(STORE_KEY, { messages: [] });
}

async function writeStore(store: MessageStore) {
  await writeJsonStore(STORE_KEY, store);
}

async function readAttachmentStore(): Promise<AttachmentStore> {
  return readJsonStore<AttachmentStore>("message-attachments", { attachments: [] });
}

async function writeAttachmentStore(store: AttachmentStore) {
  await writeJsonStore("message-attachments", store);
}

async function readRequestBuffer(req: Request, maxBytes = 25_000_000) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new Error("Attachment is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function canMessage(actor: Actor, contactId: string) {
  return contactsFor(actor).then((contacts) => {
    const canonicalContact = canonicalPersonId(contactId);
    return contacts.some((contact) => canonicalPersonId(contact.id) === canonicalContact);
  });
}

async function readCoreStore() {
  return readJsonStore<{ clients: CoreClient[]; projects: CoreProject[] }>("core", { clients: [], projects: [] });
}

async function readAuthStore() {
  return readJsonStore<{ users: AuthUser[] }>("auth", { users: [] });
}

function normalizedCompany(value: string | null | undefined) {
  return String(value || "ENS Demo Agency").trim().toLowerCase();
}

function clientForActor(clients: CoreClient[], actor: Actor) {
  const email = actor.email.trim().toLowerCase();
  const matches = clients.filter((client) => client.contactEmail.trim().toLowerCase() === email);
  return matches.find((client) => Boolean(client.projectId))
    ?? matches.find((client) => client.pm && client.pm !== "Unassigned")
    ?? matches[0]
    ?? clients.find((client) => client.id === actor.id)
    ?? null;
}

function contactIdentity(actor: Actor, clients: CoreClient[]) {
  if (actor.role !== "client") return actor.id;
  return clientForActor(clients, actor)?.id ?? actor.id;
}

function uniqueContact<T extends { id: string; email?: string }>(contact: T | null | undefined, index: number, contacts: Array<T | null | undefined>) {
  if (!contact) return false;
  const key = contact.email?.trim().toLowerCase() || contact.id;
  return contacts.findIndex((item) => item && ((item.email?.trim().toLowerCase() || item.id) === key)) === index;
}

function toContact(person: Actor | AuthUser): Actor {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    role: person.role,
    company: "company" in person ? person.company : undefined,
  };
}

function badRequest(res: { status(code: number): { json(body: unknown): unknown } }, error: z.ZodError) {
  return res.status(400).json({
    error: "Invalid request body.",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

router.get("/contacts", async (req, res) => {
  let actor: Actor;
  try {
    actor = await actorFromRequest(req);
  } catch (error) {
    if (authErrorResponse(res, error)) return;
    throw error;
  }
  const store = await readStore();
  const coreStore = await readCoreStore();
  const actorIdentity = contactIdentity(actor, coreStore.clients);
  const contacts = (await contactsFor(actor)).map((contact) => {
    const conversationIds = store.messages
      .filter((message) => message.conversationId.includes(canonicalPersonId(actorIdentity)) && message.conversationId.includes(canonicalPersonId(contact.id)))
      .map((message) => message.conversationId);
    const relevant = store.messages
      .filter((message) => conversationIds.includes(message.conversationId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = relevant[0];
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      role: contact.role,
      lastMessage: latest?.text ?? "No messages yet.",
      lastMessageAt: latest?.createdAt ?? null,
      time: latest ? formatTime(latest.createdAt) : "",
      unread: relevant.filter((message) => message.senderUserId !== canonicalPersonId(actorIdentity) && !message.read).length,
      online: false,
    };
  });
  res.json({ contacts });
});

router.post("/attachments", async (req, res) => {
  let actor: Actor;
  try {
    actor = await actorFromRequest(req);
  } catch (error) {
    if (authErrorResponse(res, error)) return;
    throw error;
  }
  const coreStore = await readCoreStore();
  const actorIdentity = contactIdentity(actor, coreStore.clients);
  const name = decodeURIComponent(String(req.header("x-file-name") || "attachment"));
  let buffer: Buffer;
  try {
    buffer = await readRequestBuffer(req);
  } catch (error) {
    return res.status(413).json({ error: error instanceof Error ? error.message : "Attachment is too large." });
  }
  if (!buffer.length) return res.status(400).json({ error: "Attachment file is empty." });
  const type = String(req.header("content-type") || "application/octet-stream");
  const attachment = {
    id: `att-${Date.now()}-${randomBytes(4).toString("hex")}`,
    name,
    size: buffer.length,
    type,
    dataBase64: buffer.toString("base64"),
    uploadedBy: canonicalPersonId(actorIdentity),
    uploadedByRole: actor.role,
    createdAt: new Date().toISOString(),
  };
  const store = await readAttachmentStore();
  store.attachments.unshift(attachment);
  store.attachments = store.attachments.slice(0, 500);
  await writeAttachmentStore(store);
  res.status(201).json({
    attachment: {
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
      url: `/platform/messages/attachments/${attachment.id}`,
    },
  });
});

router.get("/attachments/:attachmentId", async (req, res) => {
  let actor: Actor;
  try {
    actor = await actorFromRequest(req);
  } catch (error) {
    if (authErrorResponse(res, error)) return;
    throw error;
  }
  const store = await readAttachmentStore();
  const attachment = store.attachments.find((item) => item.id === req.params.attachmentId);
  if (!attachment) return res.status(404).json({ error: "Attachment not found." });
  if (!(await canDownloadAttachment(actor, attachment.id))) return res.status(403).json({ error: "Forbidden." });
  const buffer = Buffer.from(attachment.dataBase64, "base64");
  res.setHeader("content-type", attachment.type || "application/octet-stream");
  res.setHeader("content-length", String(buffer.length));
  res.setHeader("content-disposition", `attachment; filename="${attachment.name.replace(/"/g, "")}"`);
  res.send(buffer);
});

router.get("/:contactId", async (req, res) => {
  let actor: Actor;
  try {
    actor = await actorFromRequest(req);
  } catch (error) {
    if (authErrorResponse(res, error)) return;
    throw error;
  }
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "general";
  const coreStore = await readCoreStore();
  if (projectId === "general") {
    if (!(await canMessage(actor, req.params.contactId))) return res.status(403).json({ error: "Forbidden." });
  } else if (!(await canAccessProjectThread(actor, req.params.contactId, projectId, coreStore))) {
    return res.status(403).json({ error: "Forbidden." });
  }
  const actorIdentity = contactIdentity(actor, coreStore.clients);
  const conversationId = conversationIdFor(actorIdentity, req.params.contactId, projectId);
  const store = await readStore();
  const messages = store.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((message) => ({
      ...message,
      attachments: message.attachments.map(publicAttachment),
      isMe: message.senderUserId === canonicalPersonId(actorIdentity),
      time: formatTime(message.createdAt),
    }));
  res.json({ conversationId, messages });
});

router.post("/:contactId", async (req, res) => {
  let actor: Actor;
  try {
    actor = await actorFromRequest(req);
  } catch (error) {
    if (authErrorResponse(res, error)) return;
    throw error;
  }
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const projectId = parsed.data.context.projectId ?? "general";
  const body = parsed.data.body;
  const attachments = parsed.data.attachments;
  if (!body && !attachments.length) return res.status(400).json({ error: "Message text or attachment is required." });

  const coreStore = await readCoreStore();
  if (projectId === "general") {
    if (!(await canMessage(actor, req.params.contactId))) return res.status(403).json({ error: "Forbidden." });
  } else if (!(await canAccessProjectThread(actor, req.params.contactId, projectId, coreStore))) {
    return res.status(403).json({ error: "Forbidden." });
  }
  const actorIdentity = contactIdentity(actor, coreStore.clients);
  if (attachments.length) {
    const attachmentStore = await readAttachmentStore();
    const allowedAttachmentIds = new Set(
      attachmentStore.attachments
        .filter((attachment) => !attachment.uploadedBy || attachment.uploadedBy === canonicalPersonId(actorIdentity))
        .map((attachment) => attachment.id),
    );
    const missingOrForbidden = attachments.find((attachment) => !allowedAttachmentIds.has(attachment.id));
    if (missingOrForbidden) return res.status(403).json({ error: "Attachment is not available to this sender." });
  }
  const conversationId = conversationIdFor(actorIdentity, req.params.contactId, projectId);
  const now = new Date().toISOString();
  const message: StoredMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    conversationId,
    body,
    text: body,
    attachments,
    senderUserId: canonicalPersonId(actorIdentity),
    read: false,
    createdAt: now,
  };
  const store = await readStore();
  store.messages.push(message);
  await writeStore(store);
  res.status(201).json({ message: { ...message, attachments: message.attachments.map(publicAttachment), isMe: true, time: "Just now" } });
});

export default router;
