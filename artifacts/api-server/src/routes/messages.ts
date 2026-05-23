import { sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { decryptMessageBody, encryptMessageBody } from "../lib/messageCrypto";

const router = Router();

router.use("/platform/messages", requireAuth, requireTenant);

router.get("/platform/messages/contacts", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  await ensureMessageTables();
  const auth = req.auth!;
  const contacts = await getContacts(auth);
  res.json({ contacts });
});

router.get("/platform/messages/:contactId", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  await ensureMessageTables();
  const auth = req.auth!;
  const contactId = paramValue(req.params.contactId);
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

router.post("/platform/messages/:contactId", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  await ensureMessageTables();
  const auth = req.auth!;
  const contactId = paramValue(req.params.contactId);
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const scope = await resolveConversationScope(auth, contactId, parseMessageContext(req.body?.context));

  if (!body) {
    res.status(400).json({ error: { code: "message_required", message: "Message cannot be empty." } });
    return;
  }

  if (body.length > 4000) {
    res.status(400).json({ error: { code: "message_too_long", message: "Message is too long." } });
    return;
  }

  if (!(await canContact(auth, contactId))) {
    res.status(404).json({ error: { code: "contact_not_found", message: "Contact was not found." } });
    return;
  }

  if (!scope.ok) {
    res.status(scope.status).json({ error: { code: scope.code, message: scope.message } });
    return;
  }

  const conversationId = await getOrCreateConversation(auth, contactId, scope.value);
  const encryptedBody = encryptMessageBody(body);
  const [message] = await queryRows<MessageRow>(sql`
    insert into direct_messages (conversation_id, organization_id, sender_user_id, body)
    values (${conversationId}::uuid, ${auth.organization.id}::uuid, ${auth.user.id}::uuid, ${encryptedBody})
    returning id::text, sender_user_id::text as "senderUserId", body, read_at::text as "readAt", created_at::text as "createdAt"
  `);

  await db.execute(sql`
    update direct_conversations
    set last_message_at = now(), updated_at = now()
    where id = ${conversationId}::uuid
  `);

  await db.execute(sql`
    insert into notifications (organization_id, user_id, title, body, href)
    values (
      ${auth.organization.id}::uuid,
      ${contactId}::uuid,
      ${`New message from ${auth.user.name}`},
      ${scope.value.isScoped ? `Encrypted message about ${scope.value.exhibitionName}` : "Encrypted message"},
      ${auth.user.role === "pm" ? "/chief/messages" : "/pm/messages"}
    )
  `);

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
  readAt: string | null;
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

async function getContacts(auth: AuthContext) {
  const contactRoles = auth.user.role === "pm" ? ["chief", "owner", "admin"] : ["pm"];
  const roleFilter = sql.join(contactRoles.map((role) => sql`${role}`), sql`, `);
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
  const contactRoles = auth.user.role === "pm" ? ["chief", "owner", "admin"] : ["pm"];
  const roleFilter = sql.join(contactRoles.map((role) => sql`${role}`), sql`, `);
  const rows = await queryRows<{ id: string }>(sql`
    select u.id::text
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${auth.organization.id}::uuid
      and m.status::text = 'active'
      and u.id = ${contactId}::uuid
      and u.id <> ${auth.user.id}::uuid
      and u.deleted_at is null
      and u.disabled_at is null
      and m.role::text in (${roleFilter})
    limit 1
  `);
  return !!rows[0];
}

async function resolveConversationScope(auth: AuthContext, contactId: string, input: MessageContextInput) {
  if (!input.exhibitionId && !input.exhibitionName && !input.projectId) {
    return {
      ok: true as const,
      value: { exhibitionKey: "general", exhibitionName: null, projectId: null, isScoped: false },
    };
  }

  const pmUserId = auth.user.role === "pm" ? auth.user.id : contactId;
  const project = input.projectId
    ? await findScopedProjectById(auth.organization.id, pmUserId, input.projectId)
    : await findScopedProjectByExhibition(auth.organization.id, pmUserId, input.exhibitionId ?? input.exhibitionName);

  if (!project) {
    return {
      ok: false as const,
      status: 403,
      code: "message_scope_denied",
      message: "This project manager is not assigned to the selected exhibition.",
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

async function findScopedProjectById(organizationId: string, pmUserId: string, projectId: string) {
  const rows = await queryRows<{ id: string; name: string; exhibitionName: string | null }>(sql`
    select id::text, name, exhibition_name as "exhibitionName"
    from projects
    where organization_id = ${organizationId}::uuid
      and assigned_pm_user_id = ${pmUserId}::uuid
      and id = ${projectId}::uuid
      and deleted_at is null
    limit 1
  `);
  return rows[0] ?? null;
}

async function findScopedProjectByExhibition(organizationId: string, pmUserId: string, exhibition: string | null) {
  if (!exhibition) return null;
  const requestedKey = scopeKey(exhibition);
  const rows = await queryRows<{ id: string; name: string; exhibitionName: string | null }>(sql`
    select id::text, name, exhibition_name as "exhibitionName"
    from projects
    where organization_id = ${organizationId}::uuid
      and assigned_pm_user_id = ${pmUserId}::uuid
      and deleted_at is null
    order by deadline_at nulls last, updated_at desc
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
    select id::text, sender_user_id::text as "senderUserId", body, read_at::text as "readAt", created_at::text as "createdAt"
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
  return {
    id: row.id,
    body,
    text: body,
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

function stringValue(value: unknown) {
  if (Array.isArray(value)) return stringValue(value[0]);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scopeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "general";
}

let tablesReady: Promise<void> | null = null;

function ensureMessageTables() {
  tablesReady ??= (async () => {
    await db.execute(sql`
      create table if not exists direct_conversations (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references organizations(id) on delete cascade,
        participant_one_user_id uuid not null references users(id) on delete cascade,
        participant_two_user_id uuid not null references users(id) on delete cascade,
        project_id uuid references projects(id) on delete set null,
        exhibition_key text not null default 'general',
        exhibition_name text,
        last_message_at timestamp with time zone,
        created_at timestamp with time zone not null default now(),
        updated_at timestamp with time zone not null default now(),
        constraint direct_conversations_distinct_participants_chk check (participant_one_user_id <> participant_two_user_id),
        constraint direct_conversations_sorted_participants_chk check (participant_one_user_id < participant_two_user_id)
      )
    `);
    await db.execute(sql`
      alter table direct_conversations
      add column if not exists project_id uuid references projects(id) on delete set null
    `);
    await db.execute(sql`
      alter table direct_conversations
      add column if not exists exhibition_key text not null default 'general'
    `);
    await db.execute(sql`
      alter table direct_conversations
      add column if not exists exhibition_name text
    `);
    await db.execute(sql`
      alter table direct_conversations
      drop constraint if exists direct_conversations_org_pair_unique
    `);
    await db.execute(sql`
      create unique index if not exists direct_conversations_org_pair_scope_unique_idx
      on direct_conversations(organization_id, participant_one_user_id, participant_two_user_id, exhibition_key)
    `);
    await db.execute(sql`
      create index if not exists direct_conversations_participant_one_idx
      on direct_conversations(participant_one_user_id, last_message_at)
    `);
    await db.execute(sql`
      create index if not exists direct_conversations_participant_two_idx
      on direct_conversations(participant_two_user_id, last_message_at)
    `);
    await db.execute(sql`
      create table if not exists direct_messages (
        id uuid primary key default gen_random_uuid(),
        conversation_id uuid not null references direct_conversations(id) on delete cascade,
        organization_id uuid not null references organizations(id) on delete cascade,
        sender_user_id uuid not null references users(id) on delete cascade,
        body text not null,
        read_at timestamp with time zone,
        created_at timestamp with time zone not null default now()
      )
    `);
    await db.execute(sql`
      create index if not exists direct_messages_conversation_created_idx
      on direct_messages(conversation_id, created_at)
    `);
    await db.execute(sql`
      create index if not exists direct_messages_unread_idx
      on direct_messages(conversation_id, sender_user_id, read_at)
    `);
  })();

  return tablesReady;
}

export default router;
