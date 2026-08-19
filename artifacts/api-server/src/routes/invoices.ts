import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { deliverNotification } from "../lib/notifications";

/**
 * Client invoicing workflow (BIZ-02).
 *
 * Turns an accepted quote (or a manual line-item set) into a client-facing
 * invoice that moves through draft → open (issued/awaiting payment) → paid,
 * with void as an escape hatch. Staff issue and record payment; the client
 * whose record the invoice is addressed to can view it and its status. Totals
 * are always recomputed server-side.
 */

const router: IRouter = Router();
router.use(requireAuth, requireTenant);

interface LineItemInput { description: string; sku?: string; quantity: number; unitPriceCents: number; kind?: string; }
interface NormalizedLineItem { description: string; sku?: string; quantity: number; unitPriceCents: number; totalCents: number; kind?: string; }

async function queryRows<T>(statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

function canManage(auth: AuthContext): boolean { return ["admin", "owner", "chief"].includes(auth.user.role); }
function isStaff(auth: AuthContext): boolean { return ["admin", "owner", "chief", "pm"].includes(auth.user.role); }
function toInt(value: unknown): number { const n = Math.round(Number(value)); return Number.isFinite(n) ? n : 0; }

function normalizeLineItems(raw: unknown): NormalizedLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((entry) => {
    const item = (entry ?? {}) as LineItemInput;
    const quantity = Math.max(0, toInt(item.quantity));
    const unitPriceCents = Math.max(0, toInt(item.unitPriceCents));
    return {
      description: String(item.description ?? "").slice(0, 300),
      sku: item.sku ? String(item.sku).slice(0, 80) : undefined,
      quantity, unitPriceCents, totalCents: quantity * unitPriceCents,
      kind: item.kind ? String(item.kind).slice(0, 40) : undefined,
    };
  }).filter((item) => item.description.length > 0);
}

function computeTotals(items: NormalizedLineItem[], discountCents: number, taxCents: number) {
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
  return { subtotalCents, totalCents };
}

function staffScope(auth: AuthContext): SQL {
  if (canManage(auth)) return sql`true`;
  const uid = auth.user.id;
  return sql`(
    exists (select 1 from projects p where p.id = i.project_id and (p.assigned_pm_user_id = ${uid}::uuid
      or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${uid}::uuid)))
    or exists (select 1 from clients c where c.id = i.client_id and c.assigned_pm_user_id = ${uid}::uuid)
  )`;
}

async function callerClientId(auth: AuthContext): Promise<string | null> {
  const rows = await queryRows<{ id: string }>(sql`
    select id::text from clients
    where organization_id = ${auth.organization.id}::uuid and lower(contact_email) = lower(${auth.user.email}) and deleted_at is null
    limit 1
  `);
  return rows[0]?.id ?? null;
}

const INVOICE_COLUMNS = sql`
  i.id::text as "id", i.invoice_number as "invoiceNumber", i.title, i.status, i.currency,
  i.line_items as "lineItems", i.subtotal_cents as "subtotalCents", i.discount_cents as "discountCents",
  i.tax_cents as "taxCents", i.total_cents as "totalCents", i.amount_paid_cents as "amountPaidCents",
  i.notes, i.due_at as "dueAt", i.issued_at as "issuedAt", i.paid_at as "paidAt",
  i.client_id::text as "clientId", i.project_id::text as "projectId", i.quote_id::text as "quoteId",
  i.created_at as "createdAt", i.updated_at as "updatedAt"
`;

async function generateInvoiceNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await queryRows<{ n: number }>(sql`
    select count(*)::int as n from invoices
    where organization_id = ${organizationId}::uuid and invoice_number like ${`INV-${year}-%`}
  `);
  return `INV-${year}-${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
}

async function logEvent(orgId: string, actor: string | null, projectId: string | null, type: string, message: string) {
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, metadata)
    values (${orgId}::uuid, ${actor ? sql`${actor}::uuid` : sql`null`}, ${projectId ? sql`${projectId}::uuid` : sql`null`}, ${type}, ${message}, '{}'::jsonb)
  `).catch(() => undefined);
}

async function insertInvoice(auth: AuthContext, fields: {
  clientId: string | null; projectId: string | null; quoteId: string | null; title: string | null;
  currency: string; items: NormalizedLineItem[]; discountCents: number; taxCents: number;
  notes: string | null; dueAt: string | null;
}): Promise<string> {
  const { subtotalCents, totalCents } = computeTotals(fields.items, fields.discountCents, fields.taxCents);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = await generateInvoiceNumber(auth.organization.id);
    try {
      const inserted = await queryRows<{ id: string }>(sql`
        insert into invoices (
          organization_id, client_id, project_id, quote_id, invoice_number, title, status, currency,
          line_items, subtotal_cents, discount_cents, tax_cents, total_cents, notes, due_at, created_by_user_id
        ) values (
          ${auth.organization.id}::uuid, ${fields.clientId ? sql`${fields.clientId}::uuid` : sql`null`},
          ${fields.projectId ? sql`${fields.projectId}::uuid` : sql`null`}, ${fields.quoteId ? sql`${fields.quoteId}::uuid` : sql`null`},
          ${invoiceNumber}, ${fields.title}, 'draft', ${fields.currency}, ${JSON.stringify(fields.items)}::jsonb,
          ${subtotalCents}, ${fields.discountCents}, ${fields.taxCents}, ${totalCents}, ${fields.notes},
          ${fields.dueAt ? sql`${fields.dueAt}::timestamptz` : sql`null`}, ${auth.user.id}::uuid
        ) returning id::text
      `);
      const id = inserted[0]?.id;
      if (id) {
        await logEvent(auth.organization.id, auth.user.id, fields.projectId, "invoice_created", `created invoice ${invoiceNumber}`);
        return id;
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505" && attempt < 4) continue;
      throw error;
    }
  }
  throw new Error("invoice_insert_failed");
}

// ── List ────────────────────────────────────────────────────────────────────
router.get("/platform/invoices", async (req, res) => {
  const auth = req.auth!;
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const statusFilter = status ? sql`and i.status = ${status}::invoice_status` : sql``;
  let visibility: SQL;
  if (isStaff(auth)) {
    visibility = staffScope(auth);
  } else {
    const clientId = await callerClientId(auth);
    if (!clientId) { res.json({ invoices: [] }); return; }
    visibility = sql`(i.client_id = ${clientId}::uuid and i.status <> 'draft')`;
  }
  const rows = await queryRows(sql`
    select ${INVOICE_COLUMNS} from invoices i
    where i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null and ${visibility} ${statusFilter}
    order by i.created_at desc limit 200
  `);
  res.json({ invoices: rows });
});

// ── Get one ─────────────────────────────────────────────────────────────────
router.get("/platform/invoices/:invoiceId", async (req, res) => {
  const auth = req.auth!;
  const rows = await queryRows<{ clientId: string | null; status: string }>(sql`
    select i.client_id::text as "clientId", i.status from invoices i
    where i.id = ${req.params.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null limit 1
  `);
  const meta = rows[0];
  if (!meta) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }
  if (!isStaff(auth)) {
    const clientId = await callerClientId(auth);
    if (!clientId || meta.clientId !== clientId || meta.status === "draft") {
      res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return;
    }
  }
  const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${req.params.invoiceId}::uuid`);
  res.json({ invoice: full[0] });
});

// ── Create (staff) — optionally from an accepted quote ──────────────────────────
router.post("/platform/invoices", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can create invoices." } }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromQuoteId = typeof body.quoteId === "string" && body.quoteId ? body.quoteId : null;

  try {
    // From an accepted quote: copy its lines/totals/client/project.
    if (fromQuoteId) {
      const q = await queryRows<{
        clientId: string | null; projectId: string | null; title: string | null; currency: string;
        lineItems: NormalizedLineItem[]; discountCents: number; taxCents: number; status: string;
      }>(sql`
        select client_id::text as "clientId", project_id::text as "projectId", title, currency,
               line_items as "lineItems", discount_cents as "discountCents", tax_cents as "taxCents", status
        from quotes where id = ${fromQuoteId}::uuid and organization_id = ${auth.organization.id}::uuid and deleted_at is null limit 1
      `);
      if (!q[0]) { res.status(404).json({ error: { code: "quote_not_found", message: "Quote not found." } }); return; }
      const id = await insertInvoice(auth, {
        clientId: q[0].clientId, projectId: q[0].projectId, quoteId: fromQuoteId,
        title: q[0].title ?? "Invoice", currency: q[0].currency,
        items: normalizeLineItems(q[0].lineItems), discountCents: q[0].discountCents, taxCents: q[0].taxCents,
        notes: null, dueAt: null,
      });
      const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${id}::uuid`);
      res.status(201).json({ invoice: full[0] });
      return;
    }

    // Manual invoice.
    let clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;
    const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
    if (projectId && !clientId) {
      const p = await queryRows<{ clientId: string | null }>(sql`select client_id::text as "clientId" from projects where id = ${projectId}::uuid and organization_id = ${auth.organization.id}::uuid limit 1`);
      clientId = p[0]?.clientId ?? null;
    }
    const items = normalizeLineItems(body.lineItems);
    if (items.length === 0) { res.status(400).json({ error: { code: "no_line_items", message: "An invoice needs at least one line item." } }); return; }
    const id = await insertInvoice(auth, {
      clientId, projectId, quoteId: null,
      title: typeof body.title === "string" ? body.title.slice(0, 200) : null,
      currency: typeof body.currency === "string" ? body.currency.slice(0, 3).toUpperCase() : "USD",
      items, discountCents: Math.max(0, toInt(body.discountCents)), taxCents: Math.max(0, toInt(body.taxCents)),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 8000) : null,
      dueAt: typeof body.dueAt === "string" && body.dueAt ? body.dueAt : null,
    });
    const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${id}::uuid`);
    res.status(201).json({ invoice: full[0] });
  } catch {
    res.status(500).json({ error: { code: "invoice_create_failed", message: "Could not create the invoice." } });
  }
});

// ── Send / issue (staff): draft → open, sets issued_at and a default 30-day due date ──
router.post("/platform/invoices/:invoiceId/send", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can issue invoices." } }); return; }
  const rows = await queryRows<{ status: string; clientId: string | null; projectId: string | null; invoiceNumber: string; dueAt: string | null }>(sql`
    select i.status, i.client_id::text as "clientId", i.project_id::text as "projectId", i.invoice_number as "invoiceNumber", i.due_at as "dueAt"
    from invoices i where i.id = ${req.params.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null and ${staffScope(auth)} limit 1
  `);
  const inv = rows[0];
  if (!inv) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }
  if (!inv.clientId) { res.status(400).json({ error: { code: "no_client", message: "Attach a client before issuing." } }); return; }
  if (inv.status !== "draft") { res.status(409).json({ error: { code: "already_issued", message: "This invoice has already been issued." } }); return; }

  await db.execute(sql`
    update invoices set status = 'open', issued_at = now(),
      due_at = coalesce(due_at, now() + interval '30 days'), updated_at = now()
    where id = ${req.params.invoiceId}::uuid
  `);
  await logEvent(auth.organization.id, auth.user.id, inv.projectId, "invoice_issued", `issued invoice ${inv.invoiceNumber}`);

  const clientUser = await queryRows<{ userId: string }>(sql`
    select u.id::text as "userId" from clients c join users u on lower(u.email) = lower(c.contact_email)
    where c.id = ${inv.clientId}::uuid and u.deleted_at is null limit 1
  `);
  if (clientUser[0]) {
    await deliverNotification(auth.organization.id, clientUser[0].userId, "New invoice",
      `Invoice ${inv.invoiceNumber} is ready. View it in your portal.`, "/client/invoices", "system").catch(() => undefined);
  }
  const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${req.params.invoiceId}::uuid`);
  res.json({ invoice: full[0] });
});

// ── Record payment (staff): open → paid ──────────────────────────────────────
router.post("/platform/invoices/:invoiceId/mark-paid", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can record payment." } }); return; }
  const rows = await queryRows<{ status: string; totalCents: number; projectId: string | null; invoiceNumber: string }>(sql`
    select i.status, i.total_cents as "totalCents", i.project_id::text as "projectId", i.invoice_number as "invoiceNumber"
    from invoices i where i.id = ${req.params.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null and ${staffScope(auth)} limit 1
  `);
  const inv = rows[0];
  if (!inv) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }
  if (inv.status !== "open") { res.status(409).json({ error: { code: "not_payable", message: "Only issued (open) invoices can be marked paid." } }); return; }
  await db.execute(sql`
    update invoices set status = 'paid', paid_at = now(), amount_paid_cents = total_cents, updated_at = now()
    where id = ${req.params.invoiceId}::uuid
  `);
  await logEvent(auth.organization.id, auth.user.id, inv.projectId, "invoice_paid", `recorded payment for invoice ${inv.invoiceNumber}`);
  const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${req.params.invoiceId}::uuid`);
  res.json({ invoice: full[0] });
});

// ── Void (staff) ─────────────────────────────────────────────────────────────
router.post("/platform/invoices/:invoiceId/void", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can void invoices." } }); return; }
  const rows = await queryRows<{ status: string }>(sql`
    select status from invoices i where i.id = ${req.params.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null and ${staffScope(auth)} limit 1
  `);
  if (!rows[0]) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }
  if (rows[0].status === "paid") { res.status(409).json({ error: { code: "already_paid", message: "A paid invoice cannot be voided." } }); return; }
  await db.execute(sql`update invoices set status = 'void', updated_at = now() where id = ${req.params.invoiceId}::uuid`);
  const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${req.params.invoiceId}::uuid`);
  res.json({ invoice: full[0] });
});

// ── Delete a draft (staff) ───────────────────────────────────────────────────
router.delete("/platform/invoices/:invoiceId", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can delete invoices." } }); return; }
  const rows = await queryRows<{ status: string }>(sql`
    select status from invoices i where i.id = ${req.params.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null and ${staffScope(auth)} limit 1
  `);
  if (!rows[0]) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }
  if (rows[0].status !== "draft") { res.status(409).json({ error: { code: "not_deletable", message: "Only draft invoices can be deleted." } }); return; }
  await db.execute(sql`update invoices set deleted_at = now(), updated_at = now() where id = ${req.params.invoiceId}::uuid`);
  res.status(204).end();
});

export default router;
