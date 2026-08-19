import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { deliverNotification } from "../lib/notifications";

/**
 * Quote / proposal workflow (BIZ-01).
 *
 * Turns a booth design's BOM into a formal, client-facing quote that moves
 * through draft → sent → viewed → accepted / rejected. Staff (chief/PM) build
 * and send quotes; the client whose record the quote is addressed to can view
 * and respond. Totals are always recomputed server-side from line items — the
 * client's numbers are never trusted.
 */

const router: IRouter = Router();
router.use(requireAuth, requireTenant);

interface QuoteLineItemInput {
  description: string;
  sku?: string;
  quantity: number;
  unitPriceCents: number;
  kind?: string;
}

interface NormalizedLineItem {
  description: string;
  sku?: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  kind?: string;
}

async function queryRows<T>(statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

function canManage(auth: AuthContext): boolean {
  return ["admin", "owner", "chief"].includes(auth.user.role);
}

function isStaff(auth: AuthContext): boolean {
  return ["admin", "owner", "chief", "pm"].includes(auth.user.role);
}

function toInt(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : 0;
}

function normalizeLineItems(raw: unknown): NormalizedLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 200)
    .map((entry) => {
      const item = (entry ?? {}) as QuoteLineItemInput;
      const quantity = Math.max(0, toInt(item.quantity));
      const unitPriceCents = Math.max(0, toInt(item.unitPriceCents));
      return {
        description: String(item.description ?? "").slice(0, 300),
        sku: item.sku ? String(item.sku).slice(0, 80) : undefined,
        quantity,
        unitPriceCents,
        totalCents: quantity * unitPriceCents,
        kind: item.kind ? String(item.kind).slice(0, 40) : undefined,
      };
    })
    .filter((item) => item.description.length > 0);
}

function computeTotals(items: NormalizedLineItem[], discountCents: number, taxCents: number) {
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
  return { subtotalCents, totalCents };
}

// SQL predicate: which quotes a staff member may see (chief: all; PM: their
// projects or their assigned clients).
function staffScope(auth: AuthContext): SQL {
  if (canManage(auth)) return sql`true`;
  const uid = auth.user.id;
  return sql`(
    exists (
      select 1 from projects p
      where p.id = q.project_id
        and (p.assigned_pm_user_id = ${uid}::uuid
          or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${uid}::uuid))
    )
    or exists (select 1 from clients c where c.id = q.client_id and c.assigned_pm_user_id = ${uid}::uuid)
  )`;
}

async function callerClientId(auth: AuthContext): Promise<string | null> {
  const rows = await queryRows<{ id: string }>(sql`
    select id::text from clients
    where organization_id = ${auth.organization.id}::uuid
      and lower(contact_email) = lower(${auth.user.email})
      and deleted_at is null
    limit 1
  `);
  return rows[0]?.id ?? null;
}

const QUOTE_COLUMNS = sql`
  q.id::text as "id",
  q.quote_number as "quoteNumber",
  q.title,
  q.status,
  q.currency,
  q.line_items as "lineItems",
  q.subtotal_cents as "subtotalCents",
  q.discount_cents as "discountCents",
  q.tax_cents as "taxCents",
  q.total_cents as "totalCents",
  q.notes,
  q.terms,
  q.valid_until as "validUntil",
  q.client_id::text as "clientId",
  q.project_id::text as "projectId",
  q.sent_at as "sentAt",
  q.viewed_at as "viewedAt",
  q.responded_at as "respondedAt",
  q.response_note as "responseNote",
  q.created_at as "createdAt",
  q.updated_at as "updatedAt"
`;

async function generateQuoteNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await queryRows<{ n: number }>(sql`
    select count(*)::int as n from quotes
    where organization_id = ${organizationId}::uuid and quote_number like ${`Q-${year}-%`}
  `);
  const seq = (rows[0]?.n ?? 0) + 1;
  return `Q-${year}-${String(seq).padStart(4, "0")}`;
}

async function logEvent(organizationId: string, actorUserId: string | null, projectId: string | null, type: string, message: string) {
  await db
    .execute(sql`
      insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, metadata)
      values (${organizationId}::uuid, ${actorUserId ? sql`${actorUserId}::uuid` : sql`null`}, ${projectId ? sql`${projectId}::uuid` : sql`null`}, ${type}, ${message}, '{}'::jsonb)
    `)
    .catch(() => undefined);
}

// ── List ──────────────────────────────────────────────────────────────────────
router.get("/platform/quotes", async (req, res) => {
  const auth = req.auth!;
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const statusFilter = status ? sql`and q.status = ${status}::quote_status` : sql``;
  const projectFilter = projectId ? sql`and q.project_id = ${projectId}::uuid` : sql``;

  let visibility: SQL;
  if (isStaff(auth)) {
    visibility = staffScope(auth);
  } else {
    const clientId = await callerClientId(auth);
    if (!clientId) {
      res.json({ quotes: [] });
      return;
    }
    // Clients never see drafts.
    visibility = sql`(q.client_id = ${clientId}::uuid and q.status <> 'draft')`;
  }

  const rows = await queryRows(sql`
    select ${QUOTE_COLUMNS}
    from quotes q
    where q.organization_id = ${auth.organization.id}::uuid
      and q.deleted_at is null
      and ${visibility}
      ${statusFilter}
      ${projectFilter}
    order by q.created_at desc
    limit 200
  `);
  res.json({ quotes: rows });
});

// ── Get one (staff, or the owning client — which also marks it viewed) ──────────
router.get("/platform/quotes/:quoteId", async (req, res) => {
  const auth = req.auth!;
  const quoteId = req.params.quoteId;
  const rows = await queryRows<{ status: string; clientId: string | null; projectId: string | null }>(sql`
    select q.status, q.client_id::text as "clientId", q.project_id::text as "projectId"
    from quotes q
    where q.id = ${quoteId}::uuid and q.organization_id = ${auth.organization.id}::uuid and q.deleted_at is null
    limit 1
  `);
  const meta = rows[0];
  if (!meta) {
    res.status(404).json({ error: { code: "quote_not_found", message: "Quote not found." } });
    return;
  }

  if (!isStaff(auth)) {
    const clientId = await callerClientId(auth);
    if (!clientId || meta.clientId !== clientId || meta.status === "draft") {
      res.status(404).json({ error: { code: "quote_not_found", message: "Quote not found." } });
      return;
    }
    // First client view flips sent → viewed.
    if (meta.status === "sent") {
      await db.execute(sql`update quotes set status = 'viewed', viewed_at = now(), updated_at = now() where id = ${quoteId}::uuid and status = 'sent'`);
      await logEvent(auth.organization.id, auth.user.id, meta.projectId, "quote_viewed", "viewed a quote");
    }
  }

  const full = await queryRows(sql`select ${QUOTE_COLUMNS} from quotes q where q.id = ${quoteId}::uuid`);
  res.json({ quote: full[0] });
});

// ── Create (staff) ──────────────────────────────────────────────────────────────
router.post("/platform/quotes", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) {
    res.status(403).json({ error: { code: "forbidden", message: "Only staff can create quotes." } });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
  let clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;

  // If a project is given, inherit its client.
  if (projectId && !clientId) {
    const p = await queryRows<{ clientId: string | null }>(sql`
      select client_id::text as "clientId" from projects
      where id = ${projectId}::uuid and organization_id = ${auth.organization.id}::uuid and deleted_at is null limit 1
    `);
    if (!p[0]) {
      res.status(400).json({ error: { code: "invalid_project", message: "Project not found." } });
      return;
    }
    clientId = p[0].clientId;
  }

  const items = normalizeLineItems(body.lineItems);
  if (items.length === 0) {
    res.status(400).json({ error: { code: "no_line_items", message: "A quote needs at least one line item." } });
    return;
  }
  const discountCents = Math.max(0, toInt(body.discountCents));
  const taxCents = Math.max(0, toInt(body.taxCents));
  const { subtotalCents, totalCents } = computeTotals(items, discountCents, taxCents);
  const currency = typeof body.currency === "string" ? body.currency.slice(0, 3).toUpperCase() : "USD";
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : null;
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 8000) : null;
  const terms = typeof body.terms === "string" ? body.terms.slice(0, 8000) : null;
  const validUntil = typeof body.validUntil === "string" && body.validUntil ? body.validUntil : null;

  // Quote numbers are derived from a count, so two concurrent creates in the
  // same org can collide on the unique (organization_id, quote_number) index.
  // Retry with a freshly generated number instead of surfacing a 500.
  let id: string | undefined;
  let quoteNumber = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    quoteNumber = await generateQuoteNumber(auth.organization.id);
    try {
      const inserted = await queryRows<{ id: string }>(sql`
        insert into quotes (
          organization_id, client_id, project_id, quote_number, title, status, currency,
          line_items, subtotal_cents, discount_cents, tax_cents, total_cents, notes, terms,
          valid_until, created_by_user_id
        )
        values (
          ${auth.organization.id}::uuid, ${clientId ? sql`${clientId}::uuid` : sql`null`}, ${projectId ? sql`${projectId}::uuid` : sql`null`},
          ${quoteNumber}, ${title}, 'draft', ${currency}, ${JSON.stringify(items)}::jsonb,
          ${subtotalCents}, ${discountCents}, ${taxCents}, ${totalCents}, ${notes}, ${terms},
          ${validUntil ? sql`${validUntil}::timestamptz` : sql`null`}, ${auth.user.id}::uuid
        )
        returning id::text
      `);
      id = inserted[0]?.id;
      break;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505" && attempt < 4) continue; // duplicate quote number — retry
      throw error;
    }
  }
  if (!id) {
    res.status(500).json({ error: { code: "quote_create_failed", message: "Could not create the quote. Please try again." } });
    return;
  }
  await logEvent(auth.organization.id, auth.user.id, projectId, "quote_created", `created quote ${quoteNumber}`);
  const full = await queryRows(sql`select ${QUOTE_COLUMNS} from quotes q where q.id = ${id}::uuid`);
  res.status(201).json({ quote: full[0] });
});

// ── Update a draft (staff) ──────────────────────────────────────────────────────
router.put("/platform/quotes/:quoteId", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) {
    res.status(403).json({ error: { code: "forbidden", message: "Only staff can edit quotes." } });
    return;
  }
  const quoteId = req.params.quoteId;
  const current = await queryRows<{ status: string }>(sql`
    select status from quotes q
    where q.id = ${quoteId}::uuid and q.organization_id = ${auth.organization.id}::uuid and q.deleted_at is null
      and ${staffScope(auth)}
    limit 1
  `);
  if (!current[0]) {
    res.status(404).json({ error: { code: "quote_not_found", message: "Quote not found." } });
    return;
  }
  if (current[0].status !== "draft") {
    res.status(409).json({ error: { code: "not_editable", message: "Only draft quotes can be edited." } });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const items = normalizeLineItems(body.lineItems);
  if (items.length === 0) {
    res.status(400).json({ error: { code: "no_line_items", message: "A quote needs at least one line item." } });
    return;
  }
  const discountCents = Math.max(0, toInt(body.discountCents));
  const taxCents = Math.max(0, toInt(body.taxCents));
  const { subtotalCents, totalCents } = computeTotals(items, discountCents, taxCents);
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : null;
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 8000) : null;
  const terms = typeof body.terms === "string" ? body.terms.slice(0, 8000) : null;
  const validUntil = typeof body.validUntil === "string" && body.validUntil ? body.validUntil : null;

  await db.execute(sql`
    update quotes set
      title = ${title}, line_items = ${JSON.stringify(items)}::jsonb,
      subtotal_cents = ${subtotalCents}, discount_cents = ${discountCents}, tax_cents = ${taxCents}, total_cents = ${totalCents},
      notes = ${notes}, terms = ${terms}, valid_until = ${validUntil ? sql`${validUntil}::timestamptz` : sql`null`},
      updated_at = now()
    where id = ${quoteId}::uuid
  `);
  const full = await queryRows(sql`select ${QUOTE_COLUMNS} from quotes q where q.id = ${quoteId}::uuid`);
  res.json({ quote: full[0] });
});

// ── Send to client (staff) ──────────────────────────────────────────────────────
router.post("/platform/quotes/:quoteId/send", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) {
    res.status(403).json({ error: { code: "forbidden", message: "Only staff can send quotes." } });
    return;
  }
  const quoteId = req.params.quoteId;
  const rows = await queryRows<{ status: string; clientId: string | null; projectId: string | null; quoteNumber: string }>(sql`
    select q.status, q.client_id::text as "clientId", q.project_id::text as "projectId", q.quote_number as "quoteNumber"
    from quotes q
    where q.id = ${quoteId}::uuid and q.organization_id = ${auth.organization.id}::uuid and q.deleted_at is null and ${staffScope(auth)}
    limit 1
  `);
  const quote = rows[0];
  if (!quote) {
    res.status(404).json({ error: { code: "quote_not_found", message: "Quote not found." } });
    return;
  }
  if (!quote.clientId) {
    res.status(400).json({ error: { code: "no_client", message: "Attach a client before sending the quote." } });
    return;
  }
  if (!["draft", "rejected", "expired", "revised"].includes(quote.status)) {
    res.status(409).json({ error: { code: "already_sent", message: "This quote has already been sent." } });
    return;
  }

  await db.execute(sql`update quotes set status = 'sent', sent_at = now(), responded_at = null, response_note = null, updated_at = now() where id = ${quoteId}::uuid`);
  await logEvent(auth.organization.id, auth.user.id, quote.projectId, "quote_sent", `sent quote ${quote.quoteNumber} to the client`);

  // Notify the client's user account, if one exists.
  const clientUser = await queryRows<{ userId: string }>(sql`
    select u.id::text as "userId"
    from clients c join users u on lower(u.email) = lower(c.contact_email)
    where c.id = ${quote.clientId}::uuid and u.deleted_at is null
    limit 1
  `);
  if (clientUser[0]) {
    await deliverNotification(
      auth.organization.id,
      clientUser[0].userId,
      "New quote ready for review",
      `Quote ${quote.quoteNumber} is ready. Review and respond in your portal.`,
      "/client/quotes",
      "system",
    ).catch(() => undefined);
  }

  const full = await queryRows(sql`select ${QUOTE_COLUMNS} from quotes q where q.id = ${quoteId}::uuid`);
  res.json({ quote: full[0] });
});

// ── Client responds: accept or reject ───────────────────────────────────────────
router.post("/platform/quotes/:quoteId/respond", async (req, res) => {
  const auth = req.auth!;
  if (isStaff(auth)) {
    res.status(403).json({ error: { code: "forbidden", message: "Only the client can respond to a quote." } });
    return;
  }
  const decision = (req.body?.decision === "accept" || req.body?.decision === "reject") ? req.body.decision : null;
  if (!decision) {
    res.status(400).json({ error: { code: "invalid_decision", message: "Decision must be 'accept' or 'reject'." } });
    return;
  }
  const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 2000) : null;

  const clientId = await callerClientId(auth);
  const quoteId = req.params.quoteId;
  const rows = await queryRows<{ status: string; clientId: string | null; projectId: string | null; quoteNumber: string; createdBy: string | null }>(sql`
    select q.status, q.client_id::text as "clientId", q.project_id::text as "projectId", q.quote_number as "quoteNumber", q.created_by_user_id::text as "createdBy"
    from quotes q
    where q.id = ${quoteId}::uuid and q.organization_id = ${auth.organization.id}::uuid and q.deleted_at is null
    limit 1
  `);
  const quote = rows[0];
  if (!quote || !clientId || quote.clientId !== clientId) {
    res.status(404).json({ error: { code: "quote_not_found", message: "Quote not found." } });
    return;
  }
  if (!["sent", "viewed"].includes(quote.status)) {
    res.status(409).json({ error: { code: "not_respondable", message: "This quote can no longer be responded to." } });
    return;
  }

  const nextStatus = decision === "accept" ? "accepted" : "rejected";
  await db.execute(sql`
    update quotes set status = ${nextStatus}::quote_status, responded_at = now(), response_note = ${note}, updated_at = now()
    where id = ${quoteId}::uuid
  `);
  await logEvent(
    auth.organization.id,
    auth.user.id,
    quote.projectId,
    decision === "accept" ? "quote_accepted" : "quote_rejected",
    `${decision === "accept" ? "accepted" : "rejected"} quote ${quote.quoteNumber}`,
  );

  if (quote.createdBy) {
    await deliverNotification(
      auth.organization.id,
      quote.createdBy,
      decision === "accept" ? "Quote accepted 🎉" : "Quote declined",
      `${auth.user.name} ${decision === "accept" ? "accepted" : "declined"} quote ${quote.quoteNumber}.`,
      "/chief/reports",
      "system",
    ).catch(() => undefined);
  }

  const full = await queryRows(sql`select ${QUOTE_COLUMNS} from quotes q where q.id = ${quoteId}::uuid`);
  res.json({ quote: full[0] });
});

// ── Soft-delete a draft (staff) ─────────────────────────────────────────────────
router.delete("/platform/quotes/:quoteId", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) {
    res.status(403).json({ error: { code: "forbidden", message: "Only staff can delete quotes." } });
    return;
  }
  const quoteId = req.params.quoteId;
  const rows = await queryRows<{ status: string }>(sql`
    select status from quotes q
    where q.id = ${quoteId}::uuid and q.organization_id = ${auth.organization.id}::uuid and q.deleted_at is null and ${staffScope(auth)}
    limit 1
  `);
  if (!rows[0]) {
    res.status(404).json({ error: { code: "quote_not_found", message: "Quote not found." } });
    return;
  }
  if (rows[0].status !== "draft") {
    res.status(409).json({ error: { code: "not_deletable", message: "Only draft quotes can be deleted." } });
    return;
  }
  await db.execute(sql`update quotes set deleted_at = now(), updated_at = now() where id = ${quoteId}::uuid`);
  res.status(204).end();
});

export default router;
