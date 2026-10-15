import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { calendarDateToInstant, documentTotals, lineTotalCents, normalizeCents, normalizeQuantity } from "@workspace/api-zod";
import { requireAuth, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { deliverNotification } from "../lib/notifications";
import { dateLabel, moneyLabel, sendInvoiceIssuedEmail, sendPaymentReceivedEmail } from "../lib/email";
import { lockPaymentRequest, parsePaymentRequest, replayPaymentRequest, savePaymentResult } from "../lib/invoice-payment-idempotency";

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

type InvoiceExecutor = Pick<typeof db, "execute">;

function invoiceFailure(status: number, code: string, message: string) {
  return { status, body: { error: { code, message } } };
}

function paymentAccountChanged(auth: AuthContext, actorId: string | undefined, organizationSlug: string | undefined) {
  return (actorId !== undefined && actorId !== auth.user.id)
    || (organizationSlug !== undefined && organizationSlug !== auth.organization.slug);
}

// Financial changes and their audit record commit together. An audit failure
// must roll back the ledger entry rather than report an untracked payment.
async function recordPaymentEvent(executor: InvoiceExecutor, auth: AuthContext, projectId: string | null, type: string, message: string) {
  await executor.execute(sql`
    insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, metadata)
    values (${auth.organization.id}::uuid, ${auth.user.id}::uuid,
      ${projectId ? sql`${projectId}::uuid` : sql`null`}, ${type}, ${message}, '{}'::jsonb)
  `);
}

async function queryRows<T>(statement: SQL, executor: InvoiceExecutor = db): Promise<T[]> {
  const result = await executor.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

function canManage(auth: AuthContext): boolean { return ["admin", "owner", "chief"].includes(auth.user.role); }
function isStaff(auth: AuthContext): boolean { return ["admin", "owner", "chief", "pm"].includes(auth.user.role); }
function normalizeLineItems(raw: unknown): NormalizedLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((entry) => {
    const item = (entry ?? {}) as LineItemInput;
    // See quotes.ts: fractional quantities are kept, and the line total comes
    // from the shared helper the staff form also uses.
    const quantity = normalizeQuantity(item.quantity);
    const unitPriceCents = normalizeCents(item.unitPriceCents);
    return {
      description: String(item.description ?? "").slice(0, 300),
      sku: item.sku ? String(item.sku).slice(0, 80) : undefined,
      quantity, unitPriceCents, totalCents: lineTotalCents(quantity, unitPriceCents),
      kind: item.kind ? String(item.kind).slice(0, 40) : undefined,
    };
  }).filter((item) => item.description.length > 0);
}

function computeTotals(items: NormalizedLineItem[], discountCents: number, taxCents: number) {
  // Delegated so the document total is computed by the same code as the
  // preview, including the int32 ceiling the columns impose.
  const totals = documentTotals({ lineItems: items, discountCents, taxCents });
  return { subtotalCents: totals.subtotalCents, totalCents: totals.totalCents };
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
// Aggregate every issued invoice rather than treating the capped list as a
// complete client balance. Visibility matches invoice listing.
router.get("/platform/invoices/summary", async (req, res) => {
  const auth = req.auth!;
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clientId)) {
    res.status(400).json({ error: { code: "invalid_client_id", message: "A valid client ID is required." } });
    return;
  }
  let visibility: SQL;
  if (isStaff(auth)) {
    visibility = staffScope(auth);
  } else {
    const ownClientId = await callerClientId(auth);
    if (!ownClientId) { res.json({ balances: [], invoiceCount: 0 }); return; }
    visibility = sql`i.client_id = ${ownClientId}::uuid`;
  }
  const rows = await queryRows<{
    currency: string;
    billedCents: string;
    receivedCents: string;
    outstandingCents: string;
    invoiceCount: number;
  }>(sql`
    select upper(i.currency) as currency,
      sum(i.total_cents)::text as "billedCents",
      sum(i.amount_paid_cents)::text as "receivedCents",
      sum(case when i.status = 'open' then greatest(0, i.total_cents - i.amount_paid_cents) else 0 end)::text as "outstandingCents",
      count(*)::int as "invoiceCount"
    from invoices i
    where i.organization_id = ${auth.organization.id}::uuid
      and i.client_id = ${clientId}::uuid and i.deleted_at is null
      and i.status in ('open', 'paid', 'uncollectible') and ${visibility}
    group by upper(i.currency) order by upper(i.currency)
  `);
  const balances = rows.map((row) => ({ ...row,
    billedCents: Number(row.billedCents), receivedCents: Number(row.receivedCents),
    outstandingCents: Number(row.outstandingCents),
  }));
  res.json({ balances, invoiceCount: balances.reduce((total, row) => total + row.invoiceCount, 0) });
});

router.get("/platform/invoices/:invoiceId", async (req, res) => {
  const auth = req.auth!;
  const rows = await queryRows<{ clientId: string | null; status: string }>(sql`
    select i.client_id::text as "clientId", i.status from invoices i
    where i.id = ${req.params.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null limit 1
  `);
  const meta = rows[0];
  if (!meta) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }
  if (isStaff(auth)) {
    if (!(await loadPayableInvoice(auth, String(req.params.invoiceId)))) {
      res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return;
    }
  } else {
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

      // Only a quote the client actually agreed to may be billed. The status
      // was already being selected here and then dropped on the floor, so a
      // draft the client had never seen - or one they had explicitly rejected -
      // could be turned into an invoice and sent for payment.
      if (q[0].status !== "accepted") {
        res.status(409).json({
          error: {
            code: "quote_not_accepted",
            message: "Only an accepted quote can be invoiced.",
          },
        });
        return;
      }

      // One invoice per quote. Nothing here bills a part of a quote - the lines
      // and totals are copied wholesale - so a second invoice from the same
      // quote is the same money charged twice. Voided invoices are ignored on
      // purpose: voiding is how a mistaken invoice is withdrawn, and it has to
      // leave the quote billable again.
      const alreadyBilled = await queryRows<{ invoiceNumber: string }>(sql`
        select invoice_number as "invoiceNumber"
        from invoices
        where quote_id = ${fromQuoteId}::uuid
          and organization_id = ${auth.organization.id}::uuid
          and deleted_at is null
          and status::text <> 'void'
        limit 1
      `);
      if (alreadyBilled[0]) {
        res.status(409).json({
          error: {
            code: "quote_already_invoiced",
            message: `This quote was already invoiced as ${alreadyBilled[0].invoiceNumber}.`,
          },
        });
        return;
      }

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

    // Same as quotes: validate the project whenever one is named, not only when
    // the client has to be inferred from it, and bill in the money the project
    // is budgeted in. Skipping the lookup let an invoice be pinned to another
    // organization's project, and an unknown project id was swallowed instead
    // of reported.
    let projectCurrency: string | null = null;
    if (projectId) {
      const p = await queryRows<{ clientId: string | null; currency: string }>(sql`select client_id::text as "clientId", currency from projects where id = ${projectId}::uuid and organization_id = ${auth.organization.id}::uuid and deleted_at is null limit 1`);
      if (!p[0]) { res.status(400).json({ error: { code: "invalid_project", message: "Project not found." } }); return; }
      projectCurrency = p[0].currency;
      if (!clientId) clientId = p[0].clientId;
    }
    const items = normalizeLineItems(body.lineItems);
    if (items.length === 0) { res.status(400).json({ error: { code: "no_line_items", message: "An invoice needs at least one line item." } }); return; }
    const id = await insertInvoice(auth, {
      clientId, projectId, quoteId: null,
      title: typeof body.title === "string" ? body.title.slice(0, 200) : null,
      currency: typeof body.currency === "string" ? body.currency.slice(0, 3).toUpperCase() : (projectCurrency ?? "USD"),
      // Clamped to the integer column's ceiling: these are stored raw, so an
      // unbounded discount failed the whole insert with a 500. See quotes.ts.
      items, discountCents: normalizeCents(body.discountCents), taxCents: normalizeCents(body.taxCents),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 8000) : null,
      // A bare "2026-11-20" from <input type="date"> lands at midnight in the
      // server's own timezone, which is a different calendar date for every
      // reader west of it. calendarDateToInstant anchors it at midday UTC.
      dueAt: calendarDateToInstant(body.dueAt),
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
  const rows = await queryRows<{ status: string; clientId: string | null; projectId: string | null; invoiceNumber: string; dueAt: string | null; totalCents: number; currency: string }>(sql`
    select i.status, i.client_id::text as "clientId", i.project_id::text as "projectId", i.invoice_number as "invoiceNumber", i.due_at as "dueAt",
      i.total_cents as "totalCents", i.currency
    from invoices i where i.id = ${req.params.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null and ${staffScope(auth)} limit 1
  `);
  const inv = rows[0];
  if (!inv) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }
  if (!inv.clientId) { res.status(400).json({ error: { code: "no_client", message: "Attach a client before issuing." } }); return; }
  if (inv.status !== "draft") { res.status(409).json({ error: { code: "already_issued", message: "This invoice has already been issued." } }); return; }

  const issued = await queryRows<{ id: string }>(sql`
    update invoices set status = 'open', issued_at = now(),
      due_at = coalesce(due_at, now() + interval '30 days'), updated_at = now()
    where id = ${req.params.invoiceId}::uuid and status = 'draft' and deleted_at is null
    returning id::text
  `);
  if (!issued[0]) { res.status(409).json({ error: { code: "already_issued", message: "This invoice changed before it could be issued. Refresh and try again." } }); return; }
  await logEvent(auth.organization.id, auth.user.id, inv.projectId, "invoice_issued", `issued invoice ${inv.invoiceNumber}`);

  const clientUser = await queryRows<{ userId: string; email: string; name: string }>(sql`
    select u.id::text as "userId", u.email, u.name from clients c join users u on lower(u.email) = lower(c.contact_email)
    where c.id = ${inv.clientId}::uuid and c.organization_id = ${auth.organization.id}::uuid
      and c.deleted_at is null and u.deleted_at is null and u.disabled_at is null
      and exists (select 1 from memberships m where m.user_id = u.id
        and m.organization_id = c.organization_id and m.status = 'active') limit 1
  `);
  if (clientUser[0]) {
    await deliverNotification(auth.organization.id, clientUser[0].userId, "New invoice",
      `Invoice ${inv.invoiceNumber} is ready. View it in your portal.`, "/client/invoices", "system").catch(() => undefined);

    /**
     * Emailed as well as notified in-app. The in-app notification only reaches
     * a client who happens to log in; an invoice they are never told about is
     * an invoice that does not get paid. The due date is read back from the
     * row because the update above defaults it to 30 days when it was unset.
     */
    const issuedDueAt = await queryRows<{ dueAt: string | null }>(sql`
      select due_at::text as "dueAt" from invoices where id = ${req.params.invoiceId}::uuid
    `);
    void sendInvoiceIssuedEmail({
      to: clientUser[0].email,
      name: clientUser[0].name,
      invoiceNumber: inv.invoiceNumber,
      totalLabel: moneyLabel(inv.totalCents, inv.currency),
      dueAt: dateLabel(issuedDueAt[0]?.dueAt ?? inv.dueAt),
    }).catch((reason: unknown) => {
      console.error("[invoices] invoice-issued email failed to dispatch:", reason);
    });
  }
  const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${req.params.invoiceId}::uuid`);
  res.json({ invoice: full[0] });
});

// ── Record payment (staff): open → paid ──────────────────────────────────────
router.post("/platform/invoices/:invoiceId/mark-paid", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can record payment." } }); return; }
  // A stale tab can retain a pending request while another tab changes shared
  // cookies. Assert its original account before entering the actor-key namespace.
  if (paymentAccountChanged(auth, req.get("X-Payment-Actor-Id"), req.get("X-Payment-Organization"))) {
    res.status(409).json({ error: { code: "payment_account_changed", message: "The signed-in account changed. Sign in to the original account to recover this payment." } }); return;
  }
  const invoiceId = String(req.params.invoiceId).toLowerCase();
  const expectedAmountCents = req.body?.expectedAmountCents ?? null;
  if (expectedAmountCents !== null && (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents < 0 || expectedAmountCents > 2_147_483_647)) {
    res.status(400).json({ error: { code: "invalid_amount", message: "Expected balance must be an integer number of cents." } }); return;
  }
  const parsed = parsePaymentRequest(req.get("Idempotency-Key"), "mark-paid", { expectedAmountCents });
  if (!parsed.valid) { res.status(400).json({ error: { code: "invalid_idempotency_key", message: "Payment request keys must contain 8 to 128 letters, numbers, underscores, or hyphens." } }); return; }
  const result = await db.transaction(async (tx) => {
    await lockPaymentRequest(tx, auth, parsed.request);
    const inv = await loadPayableInvoice(auth, invoiceId, tx, true);
    if (!inv) return invoiceFailure(404, "invoice_not_found", "Invoice not found.");
    const replay = await replayPaymentRequest(tx, auth, invoiceId, parsed.request);
    if (replay) return replay;
    if (inv.status !== "open") return invoiceFailure(409, "not_payable", "Only issued (open) invoices can be marked paid.");
    const outstanding = inv.totalCents - inv.amountPaidCents;
    if (expectedAmountCents !== null && outstanding !== expectedAmountCents) {
      return invoiceFailure(409, "balance_changed", "The outstanding balance changed. Refresh the invoice and review the payment again.");
    }
    if (outstanding > 0) {
      await tx.execute(sql`
        insert into invoice_payments (organization_id, invoice_id, amount_cents, method, note, recorded_by_user_id)
        values (${auth.organization.id}::uuid, ${invoiceId}::uuid, ${outstanding}, 'manual', 'Balance settled', ${auth.user.id}::uuid)
      `);
    }
    await syncInvoicePayment(invoiceId, tx);
    await recordPaymentEvent(tx, auth, inv.projectId, "invoice_paid", `recorded payment for invoice ${inv.invoiceNumber}`);
    const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${invoiceId}::uuid`, tx);
    const response = { status: 200, body: { invoice: full[0] } };
    await savePaymentResult(tx, auth, invoiceId, parsed.request, response);
    return response;
  });
  res.status(result.status).json(result.body);
});


/**
 * Recompute invoices.amount_paid_cents from the invoice_payments ledger and move
 * the invoice to `paid` once the balance is covered.
 *
 * Every payment path funnels through here rather than adjusting the column in
 * place, so the cached total and the ledger cannot disagree - a partial payment
 * followed by a mark-paid would otherwise double-count.
 */
async function syncInvoicePayment(invoiceId: string, executor: InvoiceExecutor) {
  await executor.execute(sql`
    update invoices i set
      amount_paid_cents = coalesce(paid.total, 0),
      status = case
        when i.status = 'open' and coalesce(paid.total, 0) >= i.total_cents then 'open'::invoice_status
        else i.status
      end,
      updated_at = now()
    from (select coalesce(sum(amount_cents), 0)::int as total from invoice_payments where invoice_id = ${invoiceId}::uuid) paid
    where i.id = ${invoiceId}::uuid
  `);
  // Settle in a second statement so `paid_at` is only ever stamped on the
  // transition, never refreshed by a later recompute.
  await executor.execute(sql`
    update invoices set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = ${invoiceId}::uuid and status = 'open' and amount_paid_cents >= total_cents
  `);
}

interface InvoicePaymentRow {
  id: string;
  amountCents: number;
  method: string;
  reference: string | null;
  note: string | null;
  recordedBy: string | null;
  createdAt: string;
}

const PAYMENT_COLUMNS = sql`
  p.id::text as "id", p.amount_cents as "amountCents", p.method, p.reference, p.note,
  u.name as "recordedBy", p.created_at as "createdAt"
`;

/**
 * The payment ledger for one invoice, scoped to the caller's organization.
 *
 * Both callers check visibility first; the filter is here anyway so the query
 * cannot be made unsafe by being called from somewhere new.
 */
async function listInvoicePayments(auth: AuthContext, invoiceId: string, executor: InvoiceExecutor = db) {
  return queryRows<InvoicePaymentRow>(sql`
    select ${PAYMENT_COLUMNS} from invoice_payments p
    left join users u on u.id = p.recorded_by_user_id
    where p.invoice_id = ${invoiceId}::uuid
      and p.organization_id = ${auth.organization.id}::uuid
    order by p.created_at asc, p.id asc
  `, executor);
}

/** Staff-visible invoice with the balance, or null. */
async function loadPayableInvoice(auth: AuthContext, invoiceId: string, executor: InvoiceExecutor = db, lock = false) {
  const rows = await queryRows<{ status: string; totalCents: number; amountPaidCents: number; projectId: string | null; invoiceNumber: string; currency: string }>(sql`
    select i.status, i.total_cents as "totalCents", i.amount_paid_cents as "amountPaidCents",
           i.project_id::text as "projectId", i.invoice_number as "invoiceNumber", i.currency
    from invoices i
    where i.id = ${invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid
      and i.deleted_at is null and ${staffScope(auth)}
    limit 1 ${lock ? sql`for update of i` : sql``}
  `, executor);
  return rows[0] ?? null;
}

// ── Record a payment (staff) — supports deposits and instalments ─────────────
router.post("/platform/invoices/:invoiceId/payments", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can record payment." } }); return; }
  if (paymentAccountChanged(auth, req.get("X-Payment-Actor-Id"), req.get("X-Payment-Organization"))) {
    res.status(409).json({ error: { code: "payment_account_changed", message: "The signed-in account changed. Sign in to the original account to recover this payment." } }); return;
  }
  const invoiceId = String(req.params.invoiceId).toLowerCase();
  const amountCents = req.body?.amountCents;
  // Money must be an integer number of cents; rounding or coercion can record
  // a different amount from the one the caller intended.
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) {
    res.status(400).json({ error: { code: "invalid_amount", message: "Payment amount must be a positive integer number of cents." } });
    return;
  }
  const method = String(req.body?.method ?? "manual").slice(0, 40) || "manual";
  const reference = req.body?.reference ? String(req.body.reference).slice(0, 200) : null;
  const note = req.body?.note ? String(req.body.note).slice(0, 1000) : null;
  const parsed = parsePaymentRequest(req.get("Idempotency-Key"), "record-payment", { amountCents, method, reference, note });
  if (!parsed.valid) { res.status(400).json({ error: { code: "invalid_idempotency_key", message: "Payment request keys must contain 8 to 128 letters, numbers, underscores, or hyphens." } }); return; }
  /**
   * What to put in a receipt, filled in only on the path that actually inserts.
   *
   * Read after the transaction resolves rather than inside it, for two reasons:
   * a rollback must not send a receipt for a payment that was never recorded,
   * and a replayed idempotent request returns the stored response without
   * inserting anything - sending there would mail the client a fresh receipt
   * for the same payment every time they retried.
   */
  let receipt: { invoiceId: string; invoiceNumber: string; amountCents: number; currency: string } | null = null;
  const result = await db.transaction(async (tx) => {
    await lockPaymentRequest(tx, auth, parsed.request);
    // Lock before reading the balance. All payment and void paths use this
    // same row lock, including requests handled by other server processes.
    const inv = await loadPayableInvoice(auth, invoiceId, tx, true);
    if (!inv) return invoiceFailure(404, "invoice_not_found", "Invoice not found.");
    const replay = await replayPaymentRequest(tx, auth, invoiceId, parsed.request);
    if (replay) return replay;
    if (inv.status !== "open") return invoiceFailure(409, "not_payable", "Only issued (open) invoices can take a payment.");
    const outstanding = inv.totalCents - inv.amountPaidCents;
    if (amountCents > outstanding) return invoiceFailure(409, "amount_exceeds_balance", `Payment exceeds the outstanding balance of ${outstanding} cents.`);
    await tx.execute(sql`
      insert into invoice_payments (organization_id, invoice_id, amount_cents, method, reference, note, recorded_by_user_id)
      values (${auth.organization.id}::uuid, ${invoiceId}::uuid, ${amountCents}, ${method},
              ${reference}, ${note}, ${auth.user.id}::uuid)
    `);
    await syncInvoicePayment(invoiceId, tx);
    const full = await queryRows<{ status: string }>(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${invoiceId}::uuid`, tx);
    await recordPaymentEvent(tx, auth, inv.projectId,
      full[0]?.status === "paid" ? "invoice_paid" : "invoice_payment_recorded",
      `recorded ${amountCents} cents against invoice ${inv.invoiceNumber}`);
    const response = { status: 201, body: { invoice: full[0], payments: await listInvoicePayments(auth, invoiceId, tx) } };
    await savePaymentResult(tx, auth, invoiceId, parsed.request, response);
    receipt = { invoiceId, invoiceNumber: inv.invoiceNumber, amountCents, currency: inv.currency };
    return response;
  });
  res.status(result.status).json(result.body);
  if (receipt) void sendPaymentReceipt(auth, receipt);
});

/**
 * Tell the client their payment landed.
 *
 * Separate from the route because it runs after the response has been sent:
 * the payment is already committed, so a slow or failing mail provider must
 * not affect the status the caller sees. Everything it needs is passed in,
 * since the transaction it came from has closed.
 */
async function sendPaymentReceipt(
  auth: AuthContext,
  receipt: { invoiceId: string; invoiceNumber: string; amountCents: number; currency: string },
) {
  try {
    const rows = await queryRows<{ email: string; name: string; totalCents: number; amountPaidCents: number }>(sql`
      select u.email, u.name, i.total_cents as "totalCents", i.amount_paid_cents as "amountPaidCents"
      from invoices i
      join clients c on c.id = i.client_id
      join users u on lower(u.email) = lower(c.contact_email)
      where i.id = ${receipt.invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid
        and c.deleted_at is null and u.deleted_at is null and u.disabled_at is null
        and exists (select 1 from memberships m where m.user_id = u.id
          and m.organization_id = c.organization_id and m.status = 'active')
      limit 1
    `);
    const target = rows[0];
    if (!target) return;
    // Taken from the synced cache rather than subtracted here, so the figure in
    // the email is the one the ledger produced.
    const remaining = target.totalCents - target.amountPaidCents;
    await sendPaymentReceivedEmail({
      to: target.email,
      name: target.name,
      invoiceNumber: receipt.invoiceNumber,
      amountLabel: moneyLabel(receipt.amountCents, receipt.currency),
      remainingLabel: remaining > 0 ? moneyLabel(remaining, receipt.currency) : null,
    });
  } catch (reason) {
    console.error("[invoices] payment receipt email failed to dispatch:", reason);
  }
}

// ── Payment history — staff, or the client the invoice is addressed to ───────
router.get("/platform/invoices/:invoiceId/payments", async (req, res) => {
  const auth = req.auth!;
  const invoiceId = String(req.params.invoiceId);
  const rows = await queryRows<{ clientId: string | null; status: string }>(sql`
    select i.client_id::text as "clientId", i.status from invoices i
    where i.id = ${invoiceId}::uuid and i.organization_id = ${auth.organization.id}::uuid and i.deleted_at is null limit 1
  `);
  const meta = rows[0];
  if (!meta) { res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } }); return; }

  if (isStaff(auth)) {
    // A PM only sees invoices inside their own scope, same as the detail route.
    if (!(await loadPayableInvoice(auth, invoiceId))) {
      res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } });
      return;
    }
  } else {
    const clientId = await callerClientId(auth);
    if (!clientId || meta.clientId !== clientId || meta.status === "draft") {
      res.status(404).json({ error: { code: "invoice_not_found", message: "Invoice not found." } });
      return;
    }
  }

  res.json({ payments: await listInvoicePayments(auth, invoiceId) });
});

// ── Void (staff) ─────────────────────────────────────────────────────────────
router.post("/platform/invoices/:invoiceId/void", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Only staff can void invoices." } }); return; }
  const invoiceId = String(req.params.invoiceId);
  const result = await db.transaction(async (tx) => {
    const inv = await loadPayableInvoice(auth, invoiceId, tx, true);
    if (!inv) return invoiceFailure(404, "invoice_not_found", "Invoice not found.");
    if (inv.status === "paid") return invoiceFailure(409, "already_paid", "A paid invoice cannot be voided.");
    if (inv.amountPaidCents > 0) return invoiceFailure(409, "payments_recorded", "An invoice with recorded payments cannot be voided.");
    await tx.execute(sql`update invoices set status = 'void', updated_at = now() where id = ${invoiceId}::uuid`);
    const full = await queryRows(sql`select ${INVOICE_COLUMNS} from invoices i where i.id = ${invoiceId}::uuid`, tx);
    return { status: 200, body: { invoice: full[0] } };
  });
  res.status(result.status).json(result.body);
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
  const deleted = await queryRows<{ id: string }>(sql`
    update invoices set deleted_at = now(), updated_at = now()
    where id = ${req.params.invoiceId}::uuid and status = 'draft' and deleted_at is null
    returning id::text
  `);
  if (!deleted[0]) { res.status(409).json({ error: { code: "not_deletable", message: "This invoice changed before it could be deleted. Refresh and try again." } }); return; }
  res.status(204).end();
});

export default router;
