import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";

/**
 * CRM lead pipeline (CRM-01).
 *
 * A sales board over the org's leads (clients whose lifecycle status is still
 * "lead"). Leads move new → contacted → qualified → proposal → won / lost.
 * Winning a lead promotes it into the existing approval pipeline
 * (status = pending_approval); losing it records a reason and drops it from the
 * active columns. Deal value and a follow-up date drive prioritisation.
 */

const router: IRouter = Router();
router.use(requireAuth, requireTenant);

const STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];

async function queryRows<T>(statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

function canManage(auth: AuthContext): boolean { return ["admin", "owner", "chief"].includes(auth.user.role); }
function isStaff(auth: AuthContext): boolean { return ["admin", "owner", "chief", "pm"].includes(auth.user.role); }
function toInt(value: unknown): number { const n = Math.round(Number(value)); return Number.isFinite(n) ? n : 0; }

// PMs only see leads they own; chief/owner/admin see the whole board.
function scope(auth: AuthContext): SQL {
  if (canManage(auth)) return sql`true`;
  return sql`c.assigned_pm_user_id = ${auth.user.id}::uuid`;
}

const LEAD_COLUMNS = sql`
  c.id::text as "id", c.company_name as "companyName", c.contact_name as "contactName",
  c.contact_email as "contactEmail", c.phone, c.status, c.lead_stage as "leadStage",
  c.lead_value_cents as "leadValueCents", c.lead_stage_changed_at as "leadStageChangedAt",
  c.next_follow_up_at as "nextFollowUpAt", c.lost_reason as "lostReason",
  c.assigned_pm_user_id::text as "assignedPmUserId", c.created_at as "createdAt", c.updated_at as "updatedAt"
`;

async function logEvent(orgId: string, actor: string, type: string, message: string, meta: Record<string, unknown>) {
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
    values (${orgId}::uuid, ${actor}::uuid, ${type}, ${message}, ${JSON.stringify(meta)}::jsonb)
  `).catch(() => undefined);
}

// ── Board: leads grouped by stage, with per-stage count + value totals ────────
router.get("/platform/pipeline", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }
  const rows = await queryRows(sql`
    select ${LEAD_COLUMNS} from clients c
    where c.organization_id = ${auth.organization.id}::uuid and c.deleted_at is null
      and c.lead_stage is not null and c.status = 'lead' and ${scope(auth)}
    order by coalesce(c.next_follow_up_at, c.updated_at) asc
    limit 500
  `);
  const columns: Record<Stage, { leads: unknown[]; count: number; valueCents: number }> =
    Object.fromEntries(STAGES.map((s) => [s, { leads: [], count: 0, valueCents: 0 }])) as never;
  for (const lead of rows as Array<{ leadStage: Stage; leadValueCents: number }>) {
    const col = columns[lead.leadStage];
    if (!col) continue;
    col.leads.push(lead);
    col.count += 1;
    col.valueCents += lead.leadValueCents ?? 0;
  }
  res.json({ stages: STAGES, columns });
});

// ── Move a lead to a new stage ────────────────────────────────────────────────
router.patch("/platform/leads/:clientId/stage", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }
  const stage = String((req.body ?? {}).stage ?? "") as Stage;
  if (!STAGES.includes(stage)) { res.status(400).json({ error: { code: "invalid_stage", message: "Unknown pipeline stage." } }); return; }
  const lostReason = typeof (req.body ?? {}).lostReason === "string" ? (req.body as { lostReason: string }).lostReason.slice(0, 300) : null;

  const rows = await queryRows<{ companyName: string; leadStage: Stage | null }>(sql`
    select company_name as "companyName", lead_stage as "leadStage" from clients c
    where c.id = ${req.params.clientId}::uuid and c.organization_id = ${auth.organization.id}::uuid
      and c.deleted_at is null and c.status = 'lead' and ${scope(auth)} limit 1
  `);
  const lead = rows[0];
  if (!lead) { res.status(404).json({ error: { code: "lead_not_found", message: "Lead not found." } }); return; }

  if (stage === "won") {
    // Winning promotes the lead into the existing approval pipeline.
    await db.execute(sql`
      update clients set lead_stage = 'won', lead_stage_changed_at = now(),
        status = 'pending_approval', next_follow_up_at = null, updated_at = now()
      where id = ${req.params.clientId}::uuid
    `);
    await logEvent(auth.organization.id, auth.user.id, "lead_won", `won lead ${lead.companyName}`, { clientId: req.params.clientId });
  } else {
    await db.execute(sql`
      update clients set lead_stage = ${stage}::lead_stage, lead_stage_changed_at = now(),
        lost_reason = ${stage === "lost" ? lostReason : sql`null`}, updated_at = now()
      where id = ${req.params.clientId}::uuid
    `);
    await logEvent(auth.organization.id, auth.user.id, "lead_stage_changed", `moved ${lead.companyName} to ${stage}`, { clientId: req.params.clientId, stage });
  }

  const full = await queryRows(sql`select ${LEAD_COLUMNS} from clients c where c.id = ${req.params.clientId}::uuid`);
  res.json({ lead: full[0] });
});

// ── Update lead deal fields (value, follow-up date, owner) ────────────────────
router.patch("/platform/leads/:clientId", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;

  const rows = await queryRows<{ id: string }>(sql`
    select id::text from clients c
    where c.id = ${req.params.clientId}::uuid and c.organization_id = ${auth.organization.id}::uuid
      and c.deleted_at is null and c.status = 'lead' and ${scope(auth)} limit 1
  `);
  if (!rows[0]) { res.status(404).json({ error: { code: "lead_not_found", message: "Lead not found." } }); return; }

  const sets: SQL[] = [];
  if (body.leadValueCents !== undefined) sets.push(sql`lead_value_cents = ${Math.max(0, toInt(body.leadValueCents))}`);
  if (body.nextFollowUpAt !== undefined) {
    sets.push(body.nextFollowUpAt ? sql`next_follow_up_at = ${String(body.nextFollowUpAt)}::timestamptz` : sql`next_follow_up_at = null`);
  }
  if (body.assignedPmUserId !== undefined) {
    sets.push(body.assignedPmUserId ? sql`assigned_pm_user_id = ${String(body.assignedPmUserId)}::uuid` : sql`assigned_pm_user_id = null`);
  }
  if (sets.length === 0) { res.status(400).json({ error: { code: "no_changes", message: "Nothing to update." } }); return; }

  await db.execute(sql`update clients set ${sql.join(sets, sql`, `)}, updated_at = now() where id = ${req.params.clientId}::uuid`);
  const full = await queryRows(sql`select ${LEAD_COLUMNS} from clients c where c.id = ${req.params.clientId}::uuid`);
  res.json({ lead: full[0] });
});

export default router;
