import { sql, type SQL } from "drizzle-orm";
import express, { Router } from "express";
import { deliverNotification } from "../lib/notifications";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { decryptMessageBody, decryptMessageBytes, encryptMessageBody, isUndecryptableBody, encryptMessageBytes } from "../lib/messageCrypto";

const router = Router();

router.use("/platform/messages", requireAuth, requireTenant);

router.get("/platform/messages/contacts", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const auth = req.auth!;
  const contacts = await getContacts(auth);
  res.json({ contacts });
});

router.post(
  "/platform/messages/attachments",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  express.raw({ type: "*/*", limit: "10mb" }),
  async (req, res) => {
    const auth = req.auth!;
    const upload = await saveMessageAttachment(auth, {
      bytes: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      fileName: headerValue(req.headers["x-file-name"]),
      contentType: headerValue(req.headers["content-type"]),
    });

    if (!upload.ok) {
      res.status(400).json({ error: { code: "attachment_upload_invalid", message: upload.error } });
      return;
    }

    res.status(201).json({ attachment: publicAttachment(upload.attachment) });
  },
);

router.get("/platform/messages/attachments/:attachmentId", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const auth = req.auth!;
  const attachmentId = paramValue(req.params.attachmentId);
  const metadata = await readAttachmentMetadata(attachmentId, auth.organization.id);

  if (!metadata || metadata.organizationId !== auth.organization.id) {
    res.status(404).json({ error: { code: "attachment_not_found", message: "Attachment was not found." } });
    return;
  }

  const hasAccess = metadata.uploaderUserId === auth.user.id || await canAccessAttachment(auth, metadata.id);
  if (!hasAccess) {
    res.status(404).json({ error: { code: "attachment_not_found", message: "Attachment was not found." } });
    return;
  }

  try {
    const encrypted = await readFile(attachmentStoragePath(metadata.organizationId, metadata.id));
    const bytes = decryptMessageBytes(encrypted);
    res.setHeader("Content-Type", metadata.type);
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.setHeader("Content-Disposition", `attachment; filename="${contentDispositionName(metadata.name)}"`);
    res.send(bytes);
  } catch {
    res.status(404).json({ error: { code: "attachment_not_found", message: "Attachment was not found." } });
  }
});

router.get("/platform/messages/:contactId", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const auth = req.auth!;
  const contactId = paramValue(req.params.contactId);
  if (!isUuid(contactId)) {
    res.status(404).json({ error: { code: "contact_not_found", message: "Contact was not found." } });
    return;
  }
  const scope = await resolveConversationScope(auth, contactId, parseMessageContext(req.query));

  if (!(await canContact(auth, contactId))) {
    res.status(404).json({ error: { code: "contact_not_found", message: "Contact was not found." } });
    return;
  }

  if (!scope.ok) {
    res.status(scope.status).json({ error: { code: scope.code, message: scope.message } });
    return;
  }

  const conversationId = await getOrCreateConversation(auth, contactId, scope.value);
  await markConversationRead(auth, conversationId);
  const messages = await getMessages(auth, conversationId);
  res.json({ conversationId, scope: scope.value, messages });
});

router.post("/platform/messages/:contactId", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const auth = req.auth!;
  const contactId = paramValue(req.params.contactId);
  if (!isUuid(contactId)) {
    res.status(404).json({ error: { code: "contact_not_found", message: "Contact was not found." } });
    return;
  }
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const attachmentInput = parseMessageAttachments(req.body?.attachments);
  const scope = await resolveConversationScope(auth, contactId, parseMessageContext(req.body?.context));

  if (!attachmentInput.ok) {
    res.status(400).json({ error: { code: "invalid_attachments", message: attachmentInput.error } });
    return;
  }

  if (!body && !attachmentInput.attachments.length) {
    res.status(400).json({ error: { code: "message_required", message: "Message cannot be empty." } });
    return;
  }

  if (body.length > 4000) {
    res.status(400).json({ error: { code: "message_too_long", message: "Message is too long." } });
    return;
  }

  const contactRole = await contactRoleFor(auth, contactId);
  if (!contactRole) {
    res.status(404).json({ error: { code: "contact_not_found", message: "Contact was not found." } });
    return;
  }

  if (!scope.ok) {
    res.status(scope.status).json({ error: { code: scope.code, message: scope.message } });
    return;
  }

  const validatedAttachments = await validateMessageAttachments(auth, attachmentInput.attachments);
  if (!validatedAttachments.ok) {
    res.status(400).json({ error: { code: "invalid_attachments", message: validatedAttachments.error } });
    return;
  }

  const conversationId = await getOrCreateConversation(auth, contactId, scope.value);
  const encryptedBody = encryptMessageBody(body || "[Attachment]");
  const [message] = await queryRows<MessageRow>(sql`
    insert into direct_messages (conversation_id, organization_id, sender_user_id, body, attachments)
    values (
      ${conversationId}::uuid,
      ${auth.organization.id}::uuid,
      ${auth.user.id}::uuid,
      ${encryptedBody},
      ${JSON.stringify(validatedAttachments.attachments)}::jsonb
    )
    returning id::text, sender_user_id::text as "senderUserId", body, attachments, read_at::text as "readAt", created_at::text as "createdAt"
  `);

  await db.execute(sql`
    update direct_conversations
    set last_message_at = now(), updated_at = now()
    where id = ${conversationId}::uuid
  `);

  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
    values (
      ${auth.organization.id}::uuid,
      ${auth.user.id}::uuid,
      'message_sent',
      ${`sent message to ${contactId}`},
      ${JSON.stringify({ conversationId, contactId, hasAttachments: validatedAttachments.attachments.length > 0 })}::jsonb
    )
  `);

  await deliverNotification(
    auth.organization.id,
    contactId,
    `New message from ${auth.user.name}`,
    scope.value.isScoped ? `Encrypted message about ${scope.value.exhibitionName}` : "Encrypted message",
    messageInboxForRole(contactRole),
    "system",
  );

  res.status(201).json({ message: toMessage(message, auth.user.id) });
});

interface ContactRow {
  id: string;
  name: string;
  email: string;
  role: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
}

interface MessageRow {
  id: string;
  senderUserId: string;
  body: string;
  attachments: unknown;
  readAt: string | null;
  createdAt: string;
}

interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface StoredMessageAttachment extends MessageAttachment {
  organizationId: string;
  uploaderUserId: string;
  createdAt: string;
}

interface MessageContextInput {
  exhibitionId: string | null;
  exhibitionName: string | null;
  projectId: string | null;
}

interface ConversationScope {
  exhibitionKey: string;
  exhibitionName: string | null;
  projectId: string | null;
  isScoped: boolean;
}

async function queryRows<T>(statement: SQL) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

async function saveMessageAttachment(
  auth: AuthContext,
  input: { bytes: Buffer; fileName: string | null; contentType: string | null },
): Promise<{ ok: true; attachment: StoredMessageAttachment } | { ok: false; error: string }> {
  if (!input.bytes.length) return { ok: false, error: "Attachment file is empty." };
  if (input.bytes.byteLength > 10_000_000) return { ok: false, error: "Attachment size must be 10 MB or less." };

  const name = sanitizeFileName(input.fileName ? decodeHeaderValue(input.fileName) : "attachment");
  if (!name) return { ok: false, error: "Attachment name is required." };

  const type = sanitizeContentType(input.contentType);
  if (!isAllowedAttachmentType(type)) {
    return { ok: false, error: "Attachment file type is not allowed." };
  }

  const attachment: StoredMessageAttachment = {
    id: randomUUID(),
    name,
    size: input.bytes.byteLength,
    type,
    organizationId: auth.organization.id,
    uploaderUserId: auth.user.id,
    createdAt: new Date().toISOString(),
  };

  const directory = attachmentOrganizationDirectory(auth.organization.id);
  await mkdir(directory, { recursive: true });
  await writeFile(attachmentStoragePath(auth.organization.id, attachment.id), encryptMessageBytes(input.bytes));
  await writeFile(attachmentMetadataPath(auth.organization.id, attachment.id), JSON.stringify(attachment, null, 2), "utf8");

  return { ok: true, attachment };
}

async function validateMessageAttachments(
  auth: AuthContext,
  attachments: MessageAttachment[],
): Promise<{ ok: true; attachments: MessageAttachment[] } | { ok: false; error: string }> {
  const validated: MessageAttachment[] = [];

  for (const attachment of attachments) {
    const metadata = await readAttachmentMetadata(attachment.id, auth.organization.id);
    if (!metadata || metadata.organizationId !== auth.organization.id || metadata.uploaderUserId !== auth.user.id) {
      return { ok: false, error: "Attachment was not uploaded by the current user." };
    }
    validated.push(publicAttachment(metadata));
  }

  return { ok: true, attachments: validated };
}

async function canAccessAttachment(auth: AuthContext, attachmentId: string) {
  const rows = await queryRows<{ id: string }>(sql`
    select dm.id::text
    from direct_messages dm
    join direct_conversations dc on dc.id = dm.conversation_id
    where dm.organization_id = ${auth.organization.id}::uuid
      and dm.attachments @> ${JSON.stringify([{ id: attachmentId }])}::jsonb
      and (
        dc.participant_one_user_id = ${auth.user.id}::uuid
        or dc.participant_two_user_id = ${auth.user.id}::uuid
      )
    limit 1
  `);
  return !!rows[0];
}

async function readAttachmentMetadata(attachmentId: string, organizationId: string) {
  if (!isAttachmentId(attachmentId)) return null;
  try {
    const parsed = JSON.parse(await readFile(attachmentMetadataPath(organizationId, attachmentId), "utf8")) as unknown;
    const metadata = normalizeStoredAttachment(parsed);
    return metadata?.id === attachmentId ? metadata : null;
  } catch {
    return null;
  }
}

function normalizeStoredAttachment(value: unknown): StoredMessageAttachment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const id = stringValue(data.id);
  const organizationId = stringValue(data.organizationId);
  const uploaderUserId = stringValue(data.uploaderUserId);
  const name = stringValue(data.name);
  const type = stringValue(data.type) ?? "application/octet-stream";
  const createdAt = stringValue(data.createdAt) ?? new Date().toISOString();
  const size = typeof data.size === "number" ? data.size : typeof data.size === "string" ? Number(data.size) : NaN;

  if (!id || !organizationId || !uploaderUserId || !name || !Number.isFinite(size)) return null;
  return { id, organizationId, uploaderUserId, name, type, size: Math.max(0, Math.round(size)), createdAt };
}

function publicAttachment(attachment: StoredMessageAttachment): MessageAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    size: attachment.size,
    type: attachment.type,
    url: `/platform/messages/attachments/${attachment.id}`,
  };
}

async function getContacts(auth: AuthContext) {
  const roleFilter = sql.join(messageContactRoles(auth.user.role).map((role) => sql`${role}`), sql`, `);
  const projectAccessFilter = messageContactProjectAccessFilter(auth);
  const rows = await queryRows<ContactRow>(sql`
    with contacts as (
      select u.id, u.name, u.email, m.role
      from memberships m
      join users u on u.id = m.user_id
      where m.organization_id = ${auth.organization.id}::uuid
        and m.status::text = 'active'
        and u.id <> ${auth.user.id}::uuid
        and u.deleted_at is null
        and u.disabled_at is null
        and m.role::text in (${roleFilter})
        and (${projectAccessFilter})
    ),
    contact_conversations as (
      select
        c.id as contact_id,
        dc.id as conversation_id,
        dc.last_message_at
      from contacts c
      left join direct_conversations dc on dc.organization_id = ${auth.organization.id}::uuid
        and (
          (dc.participant_one_user_id = ${auth.user.id}::uuid and dc.participant_two_user_id = c.id)
          or (dc.participant_two_user_id = ${auth.user.id}::uuid and dc.participant_one_user_id = c.id)
        )
    ),
    last_messages as (
      select distinct on (dm.conversation_id)
        dm.conversation_id,
        dm.body,
        dm.created_at
      from direct_messages dm
      join contact_conversations cc on cc.conversation_id = dm.conversation_id
      order by dm.conversation_id, dm.created_at desc
    ),
    unread_counts as (
      select dm.conversation_id, count(*)::int as unread
      from direct_messages dm
      join contact_conversations cc on cc.conversation_id = dm.conversation_id
      where dm.sender_user_id <> ${auth.user.id}::uuid
        and dm.read_at is null
      group by dm.conversation_id
    ),
    contact_rollups as (
      select
        cc.contact_id,
        (array_agg(lm.body order by lm.created_at desc nulls last))[1] as body,
        max(coalesce(lm.created_at, cc.last_message_at)) as "lastMessageAt",
        coalesce(sum(uc.unread), 0)::int as unread
      from contact_conversations cc
      left join last_messages lm on lm.conversation_id = cc.conversation_id
      left join unread_counts uc on uc.conversation_id = cc.conversation_id
      group by cc.contact_id
    )
    select
      c.id::text,
      c.name,
      c.email,
      c.role::text as role,
      cr.body as "lastMessage",
      cr."lastMessageAt"::text as "lastMessageAt",
      coalesce(cr.unread, 0)::int as unread
    from contacts c
    left join contact_rollups cr on cr.contact_id = c.id
    order by cr."lastMessageAt" desc nulls last, c.name asc
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    lastMessage: row.lastMessage ? decryptMessageBody(row.lastMessage) : "No messages yet",
    lastMessageAt: row.lastMessageAt,
    time: formatRelative(row.lastMessageAt),
    unread: row.unread,
    online: false,
  }));
}

async function canContact(auth: AuthContext, contactId: string) {
  return !!(await contactRoleFor(auth, contactId));
}

async function contactRoleFor(auth: AuthContext, contactId: string) {
  const roleFilter = sql.join(messageContactRoles(auth.user.role).map((role) => sql`${role}`), sql`, `);
  const projectAccessFilter = messageContactProjectAccessFilter(auth);
  const rows = await queryRows<{ role: string }>(sql`
    select m.role::text as role
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${auth.organization.id}::uuid
      and m.status::text = 'active'
      and u.id = ${contactId}::uuid
      and u.id <> ${auth.user.id}::uuid
      and u.deleted_at is null
      and u.disabled_at is null
      and m.role::text in (${roleFilter})
      and (${projectAccessFilter})
    limit 1
  `);
  return rows[0]?.role ?? null;
}

function messageInboxForRole(role: string) {
  if (role === "client") return "/client/messages";
  if (role === "pm") return "/pm/messages";
  return "/chief/messages";
}

function messageContactRoles(role: string) {
  if (role === "pm") return ["chief", "owner", "admin", "client"];
  if (role === "client") return ["pm"];
  return ["pm", "client"];
}

function messageContactProjectAccessFilter(auth: AuthContext): SQL {
  if (["chief", "owner", "admin"].includes(auth.user.role)) return sql`true`;
  if (auth.user.role === "pm") {
    return sql`
      m.role::text in ('chief', 'owner', 'admin')
      or exists (
        select 1
        from projects p
        left join clients c on c.id = p.client_id
        where p.organization_id = ${auth.organization.id}::uuid
          and p.deleted_at is null
          and (
            p.assigned_pm_user_id = ${auth.user.id}::uuid
            or exists (
              select 1 from project_members pm_self
              where pm_self.project_id = p.id
                and pm_self.user_id = ${auth.user.id}::uuid
            )
          )
          and (
            p.client_id is not null
            and (
              lower(c.contact_email) = lower(u.email)
              or exists (
                select 1 from project_members pm_client
                where pm_client.project_id = p.id
                  and pm_client.user_id = u.id
              )
            )
          )
      )
    `;
  }
  if (auth.user.role === "client") {
    return sql`
      exists (
        select 1
        from projects p
        left join clients c on c.id = p.client_id
        where p.organization_id = ${auth.organization.id}::uuid
          and p.deleted_at is null
          and (
            lower(c.contact_email) = lower(${auth.user.email})
            or exists (
              select 1 from project_members pm_client
              where pm_client.project_id = p.id
                and pm_client.user_id = ${auth.user.id}::uuid
            )
          )
          and (
            p.assigned_pm_user_id = u.id
            or exists (
              select 1 from project_members pm_contact
              where pm_contact.project_id = p.id
                and pm_contact.user_id = u.id
            )
          )
      )
    `;
  }
  return sql`false`;
}

async function resolveConversationScope(auth: AuthContext, contactId: string, input: MessageContextInput) {
  if (!input.exhibitionId && !input.exhibitionName && !input.projectId) {
    return {
      ok: true as const,
      value: { exhibitionKey: "general", exhibitionName: null, projectId: null, isScoped: false },
    };
  }

  const project = input.projectId
    ? await findAuthorizedProjectById(auth, contactId, input.projectId)
    : await findAuthorizedProjectByExhibition(auth, contactId, input.exhibitionId ?? input.exhibitionName);

  if (!project) {
    return {
      ok: false as const,
      status: 404,
      code: "message_scope_denied",
      message: "This conversation is not available for the selected project.",
    };
  }

  const exhibitionName = project.exhibitionName ?? project.name;

  return {
    ok: true as const,
    value: {
      exhibitionKey: scopeKey(exhibitionName),
      exhibitionName,
      projectId: project.id,
      isScoped: true,
    },
  };
}

function projectParticipantFilter(userId: string) {
  return sql`
    p.assigned_pm_user_id = ${userId}::uuid
    or exists (
      select 1
      from project_members member
      where member.project_id = p.id
        and member.user_id = ${userId}::uuid
    )
    or exists (
      select 1
      from clients client
      join users participant on lower(participant.email) = lower(client.contact_email)
      where client.id = p.client_id
        and participant.id = ${userId}::uuid
        and participant.deleted_at is null
    )
  `;
}

function projectConversationAccessFilter(auth: AuthContext, contactId: string) {
  const contactParticipates = projectParticipantFilter(contactId);
  if (["chief", "owner", "admin"].includes(auth.user.role)) return contactParticipates;
  return sql`(${projectParticipantFilter(auth.user.id)}) and (${contactParticipates})`;
}

async function findAuthorizedProjectById(auth: AuthContext, contactId: string, projectId: string) {
  if (!isUuid(projectId)) return null;
  const accessFilter = projectConversationAccessFilter(auth, contactId);
  const rows = await queryRows<{ id: string; name: string; exhibitionName: string | null }>(sql`
    select p.id::text, p.name, p.exhibition_name as "exhibitionName"
    from projects p
    where p.organization_id = ${auth.organization.id}::uuid
      and p.id = ${projectId}::uuid
      and p.deleted_at is null
      and (${accessFilter})
    limit 1
  `);
  return rows[0] ?? null;
}

async function findAuthorizedProjectByExhibition(auth: AuthContext, contactId: string, exhibition: string | null) {
  if (!exhibition) return null;
  const requestedKey = scopeKey(exhibition);
  const accessFilter = projectConversationAccessFilter(auth, contactId);
  const rows = await queryRows<{ id: string; name: string; exhibitionName: string | null }>(sql`
    select p.id::text, p.name, p.exhibition_name as "exhibitionName"
    from projects p
    where p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (${accessFilter})
    order by p.deadline_at nulls last, p.updated_at desc
  `);
  return rows.find((row) => scopeKey(row.exhibitionName ?? row.name) === requestedKey) ?? null;
}

async function getOrCreateConversation(auth: AuthContext, contactId: string, scope: ConversationScope) {
  const [one, two] = [auth.user.id, contactId].sort();
  const existing = await queryRows<{ id: string }>(sql`
    select id::text
    from direct_conversations
    where organization_id = ${auth.organization.id}::uuid
      and participant_one_user_id = ${one}::uuid
      and participant_two_user_id = ${two}::uuid
      and exhibition_key = ${scope.exhibitionKey}
    limit 1
  `);
  if (existing[0]) return existing[0].id;

  const [created] = await queryRows<{ id: string }>(sql`
    insert into direct_conversations (
      organization_id,
      participant_one_user_id,
      participant_two_user_id,
      project_id,
      exhibition_key,
      exhibition_name
    )
    values (
      ${auth.organization.id}::uuid,
      ${one}::uuid,
      ${two}::uuid,
      ${scope.projectId ? sql`${scope.projectId}::uuid` : sql`null`},
      ${scope.exhibitionKey},
      ${scope.exhibitionName}
    )
    on conflict (organization_id, participant_one_user_id, participant_two_user_id, exhibition_key)
    do update set updated_at = direct_conversations.updated_at
    returning id::text
  `);
  return created.id;
}

async function getMessages(auth: AuthContext, conversationId: string) {
  const rows = await queryRows<MessageRow>(sql`
    select id::text, sender_user_id::text as "senderUserId", body, attachments, read_at::text as "readAt", created_at::text as "createdAt"
    from direct_messages
    where organization_id = ${auth.organization.id}::uuid
      and conversation_id = ${conversationId}::uuid
    order by created_at asc
  `);
  return rows.map((row) => toMessage(row, auth.user.id));
}

async function markConversationRead(auth: AuthContext, conversationId: string) {
  await db.execute(sql`
    update direct_messages
    set read_at = now()
    where organization_id = ${auth.organization.id}::uuid
      and conversation_id = ${conversationId}::uuid
      and sender_user_id <> ${auth.user.id}::uuid
      and read_at is null
  `);
}

function toMessage(row: MessageRow, currentUserId: string) {
  const body = decryptMessageBody(row.body);
  const attachments = messageAttachments(row.attachments);
  // Flagged rather than left to look like message text, so the client can show
  // it as what it is: a message that exists but cannot be read back.
  const undecryptable = isUndecryptableBody(body);
  return {
    id: row.id,
    body,
    text: body,
    undecryptable,
    attachments,
    senderUserId: row.senderUserId,
    isMe: row.senderUserId === currentUserId,
    read: !!row.readAt,
    createdAt: row.createdAt,
    time: formatTime(row.createdAt),
  };
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatRelative(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (diffMs < dayMs) return formatTime(value);
  if (diffMs < 2 * dayMs) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(date);
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseMessageContext(value: unknown): MessageContextInput {
  if (!value || typeof value !== "object") {
    return { exhibitionId: null, exhibitionName: null, projectId: null };
  }

  const data = value as Record<string, unknown>;
  return {
    exhibitionId: stringValue(data.exhibitionId),
    exhibitionName: stringValue(data.exhibitionName),
    projectId: stringValue(data.projectId),
  };
}

function parseMessageAttachments(value: unknown):
  | { ok: true; attachments: MessageAttachment[] }
  | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, attachments: [] };
  if (!Array.isArray(value)) return { ok: false, error: "Attachments must be an array." };
  if (value.length > 5) return { ok: false, error: "A message can include up to 5 attachments." };

  const attachments: MessageAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Attachment metadata is invalid." };
    }
    const data = item as Record<string, unknown>;
    const id = stringValue(data.id);
    const name = stringValue(data.name);
    const type = stringValue(data.type) ?? "application/octet-stream";
    const size = typeof data.size === "number" ? data.size : typeof data.size === "string" ? Number(data.size) : NaN;

    if (!id || !isAttachmentId(id)) return { ok: false, error: "Attachment id is invalid." };
    if (!name || name.length > 180) return { ok: false, error: "Attachment name is required and must be under 180 characters." };
    if (!Number.isFinite(size) || size < 0 || size > 10_000_000) return { ok: false, error: "Attachment size must be 10 MB or less." };
    if (type.length > 120) return { ok: false, error: "Attachment type is too long." };

    attachments.push({
      id,
      name,
      size: Math.round(size),
      type,
    });
  }

  return { ok: true, attachments };
}

function messageAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): MessageAttachment | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const data = item as Record<string, unknown>;
      const id = stringValue(data.id);
      const name = stringValue(data.name);
      const size = typeof data.size === "number" ? data.size : typeof data.size === "string" ? Number(data.size) : NaN;
      if (!id || !name || !Number.isFinite(size)) return null;
      return {
        id,
        name,
        size: Math.max(0, Math.round(size)),
        type: stringValue(data.type) ?? "application/octet-stream",
        url: stringValue(data.url) ?? `/platform/messages/attachments/${id}`,
      };
    })
    .filter((item): item is MessageAttachment => item !== null);
}

function attachmentRootDirectory() {
  return path.resolve(process.env.MESSAGE_ATTACHMENT_DIR ?? path.join(process.cwd(), "data", "message-attachments"));
}

function attachmentOrganizationDirectory(organizationId: string) {
  return path.join(attachmentRootDirectory(), organizationId);
}

function attachmentStoragePath(organizationId: string, attachmentId: string) {
  return path.join(attachmentOrganizationDirectory(organizationId), `${attachmentId}.bin`);
}

function attachmentMetadataPath(organizationId: string, attachmentId: string) {
  return path.join(attachmentOrganizationDirectory(organizationId), `${attachmentId}.json`);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function sanitizeContentType(value: string | null) {
  return (value ?? "application/octet-stream").split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function isAllowedAttachmentType(value: string) {
  if (value.startsWith("image/")) return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(value);
  return [
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/octet-stream",
  ].includes(value);
}

function isAttachmentId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function contentDispositionName(value: string) {
  return sanitizeFileName(value).replace(/"/g, "'");
}

function stringValue(value: unknown) {
  if (Array.isArray(value)) return stringValue(value[0]);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scopeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "general";
}

export default router;
