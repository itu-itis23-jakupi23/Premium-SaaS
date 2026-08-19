import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { leadTimeAssessment, planMilestones } from "../lib/exhibition-schedule";

/**
 * Exhibitions and backwards planning (SHOW-01 / WF-05).
 *
 * A show is a first-class, org-level entity with its own calendar: freight
 * cut-off, move-in, open, close, move-out. Projects link to it, and the
 * internal milestone chain for a project is planned backwards from the show's
 * dates (see ../lib/exhibition-schedule). Staff read; chief/owner/admin write.
 */

const router: IRouter = Router();
router.use(requireAuth, requireTenant);

const STATUSES = ["planned", "confirmed", "in_production", "on_site", "live", "completed", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const DATE_FIELDS = ["opensAt", "closesAt", "moveInAt", "moveOutAt", "freightDeadlineAt"] as const;
const TEXT_FIELDS = [
  ["name", 180], ["venue", 180], ["city", 120], ["country", 120], ["hall", 60], ["standNumber", 60],
] as const;

const COLUMN_OF: Record<string, string> = {
  name: "name", venue: "venue", city: "city", country: "country",
  hall: "hall", standNumber: "stand_number",
  opensAt: "opens_at", closesAt: "closes_at", moveInAt: "move_in_at",
  moveOutAt: "move_out_at", freightDeadlineAt: "freight_deadline_at",
};

async function queryRows<T>(statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

function canManage(auth: AuthContext): boolean { return ["admin", "owner", "chief"].includes(auth.user.role); }
function isStaff(auth: AuthContext): boolean { return ["admin", "owner", "chief", "pm"].includes(auth.user.role); }

const EXHIBITION_COLUMNS = sql`
  e.id::text as "id", e.name, e.venue, e.city, e.country, e.hall,
  e.stand_number as "standNumber", e.status,
  e.opens_at as "opensAt", e.closes_at as "closesAt",
  e.move_in_at as "moveInAt", e.move_out_at as "moveOutAt",
  e.freight_deadline_at as "freightDeadlineAt",
  e.notes, e.created_at as "createdAt", e.updated_at as "updatedAt"
`;

interface ExhibitionRow {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  moveInAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  moveOutAt: string | null;
  freightDeadlineAt: string | null;
}

const toDate = (value: string | null) => (value ? new Date(value) : null);

function datesOf(row: ExhibitionRow) {
  return {
    moveInAt: toDate(row.moveInAt),
    opensAt: toDate(row.opensAt),
    closesAt: toDate(row.closesAt),
    moveOutAt: toDate(row.moveOutAt),
    freightDeadlineAt: toDate(row.freightDeadlineAt),
  };
}

async function logEvent(orgId: string, actor: string, type: string, message: string, meta: Record<string, unknown>) {
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
    values (${orgId}::uuid, ${actor}::uuid, ${type}, ${message}, ${JSON.stringify(meta)}::jsonb)
  `).catch(() => undefined);
}

/** Parse an ISO date from the request; undefined = not supplied, null = cleared. */
function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// ── List ─────────────────────────────────────────────────────────────────────
router.get("/platform/exhibitions", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }

  const rows = await queryRows<ExhibitionRow & { projectCount: number }>(sql`
    select ${EXHIBITION_COLUMNS},
      (select count(*) from projects p where p.exhibition_id = e.id and p.deleted_at is null)::int as "projectCount"
    from exhibitions e
    where e.organization_id = ${auth.organization.id}::uuid and e.deleted_at is null
    order by coalesce(e.move_in_at, e.opens_at, e.created_at) asc
    limit 500
  `);

  res.json({
    exhibitions: rows.map(row => ({ ...row, leadTime: leadTimeAssessment(datesOf(row)) })),
  });
});

// ── Read one, with its projects and the planned chain ────────────────────────
router.get("/platform/exhibitions/:exhibitionId", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }

  const rows = await queryRows<ExhibitionRow>(sql`
    select ${EXHIBITION_COLUMNS} from exhibitions e
    where e.id = ${req.params.exhibitionId}::uuid and e.organization_id = ${auth.organization.id}::uuid
      and e.deleted_at is null limit 1
  `);
  const exhibition = rows[0];
  if (!exhibition) { res.status(404).json({ error: { code: "exhibition_not_found", message: "Exhibition not found." } }); return; }

  const projects = await queryRows(sql`
    select p.id::text as "id", p.name, p.status, p.deadline_at as "deadlineAt",
           c.company_name as "clientName"
    from projects p join clients c on c.id = p.client_id
    where p.exhibition_id = ${exhibition.id}::uuid and p.deleted_at is null
    order by p.created_at asc
  `);

  res.json({
    exhibition,
    projects,
    leadTime: leadTimeAssessment(datesOf(exhibition)),
    plan: planMilestones(datesOf(exhibition)),
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
router.post("/platform/exhibitions", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Chief access required." } }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 180) : "";
  if (!name) { res.status(400).json({ error: { code: "name_required", message: "An exhibition name is required." } }); return; }

  const text = (field: string, max: number) =>
    typeof body[field] === "string" && (body[field] as string).trim() ? (body[field] as string).trim().slice(0, max) : null;
  const date = (field: string) => parseDate(body[field]) ?? null;

  const rows = await queryRows<ExhibitionRow>(sql`
    insert into exhibitions (organization_id, name, venue, city, country, hall, stand_number,
      opens_at, closes_at, move_in_at, move_out_at, freight_deadline_at, notes)
    values (${auth.organization.id}::uuid, ${name}, ${text("venue", 180)}, ${text("city", 120)},
      ${text("country", 120)}, ${text("hall", 60)}, ${text("standNumber", 60)},
      ${date("opensAt")}, ${date("closesAt")}, ${date("moveInAt")}, ${date("moveOutAt")},
      ${date("freightDeadlineAt")}, ${text("notes", 4000)})
    returning id::text as "id", name, venue, city, country, hall, stand_number as "standNumber", status,
      opens_at as "opensAt", closes_at as "closesAt", move_in_at as "moveInAt",
      move_out_at as "moveOutAt", freight_deadline_at as "freightDeadlineAt", notes
  `);

  await logEvent(auth.organization.id, auth.user.id, "exhibition_created", `created exhibition ${name}`, { exhibitionId: rows[0].id });
  res.status(201).json({ exhibition: rows[0], leadTime: leadTimeAssessment(datesOf(rows[0])) });
});

// ── Update ───────────────────────────────────────────────────────────────────
router.patch("/platform/exhibitions/:exhibitionId", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Chief access required." } }); return; }

  const existing = await queryRows<{ id: string }>(sql`
    select id::text from exhibitions
    where id = ${req.params.exhibitionId}::uuid and organization_id = ${auth.organization.id}::uuid
      and deleted_at is null limit 1
  `);
  if (!existing[0]) { res.status(404).json({ error: { code: "exhibition_not_found", message: "Exhibition not found." } }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const sets: SQL[] = [];

  for (const [field, max] of TEXT_FIELDS) {
    if (body[field] === undefined) continue;
    const raw = body[field];
    const value = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, max) : null;
    if (field === "name" && !value) { res.status(400).json({ error: { code: "name_required", message: "An exhibition name is required." } }); return; }
    sets.push(sql`${sql.raw(`"${COLUMN_OF[field]}"`)} = ${value}`);
  }

  for (const field of DATE_FIELDS) {
    const parsed = parseDate(body[field]);
    if (parsed === undefined) continue;
    sets.push(sql`${sql.raw(`"${COLUMN_OF[field]}"`)} = ${parsed}`);
  }

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as Status)) {
      res.status(400).json({ error: { code: "invalid_status", message: "Unknown exhibition status." } });
      return;
    }
    sets.push(sql`status = ${body.status}::exhibition_status`);
  }

  if (typeof body.notes === "string") sets.push(sql`notes = ${body.notes.slice(0, 4000)}`);

  if (sets.length === 0) { res.status(400).json({ error: { code: "no_changes", message: "Nothing to update." } }); return; }

  await db.execute(sql`
    update exhibitions set ${sql.join(sets, sql`, `)}, updated_at = now()
    where id = ${req.params.exhibitionId}::uuid
  `);

  const rows = await queryRows<ExhibitionRow>(sql`
    select ${EXHIBITION_COLUMNS} from exhibitions e where e.id = ${req.params.exhibitionId}::uuid
  `);
  res.json({ exhibition: rows[0], leadTime: leadTimeAssessment(datesOf(rows[0])) });
});

// ── Link a project to a show ─────────────────────────────────────────────────
router.post("/platform/exhibitions/:exhibitionId/projects/:projectId", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Chief access required." } }); return; }

  const rows = await queryRows<ExhibitionRow>(sql`
    select ${EXHIBITION_COLUMNS} from exhibitions e
    where e.id = ${req.params.exhibitionId}::uuid and e.organization_id = ${auth.organization.id}::uuid
      and e.deleted_at is null limit 1
  `);
  const exhibition = rows[0];
  if (!exhibition) { res.status(404).json({ error: { code: "exhibition_not_found", message: "Exhibition not found." } }); return; }

  const projects = await queryRows<{ id: string }>(sql`
    select id::text from projects
    where id = ${req.params.projectId}::uuid and organization_id = ${auth.organization.id}::uuid
      and deleted_at is null limit 1
  `);
  if (!projects[0]) { res.status(404).json({ error: { code: "project_not_found", message: "Project not found." } }); return; }

  // The show's own dates become the project's headline deadline: move-in is
  // when the stand must physically exist.
  await db.execute(sql`
    update projects set exhibition_id = ${exhibition.id}::uuid,
      exhibition_name = ${exhibition.name},
      venue = coalesce(${exhibition.venue ?? null}, venue),
      city = coalesce(${exhibition.city ?? null}, city),
      country = coalesce(${exhibition.country ?? null}, country),
      deadline_at = coalesce(${exhibition.moveInAt}, ${exhibition.opensAt}, deadline_at),
      updated_at = now()
    where id = ${req.params.projectId}::uuid
  `);

  await logEvent(auth.organization.id, auth.user.id, "project_linked_to_exhibition",
    `linked project to ${exhibition.name}`, { exhibitionId: exhibition.id, projectId: req.params.projectId });

  res.json({ ok: true, exhibitionId: exhibition.id, projectId: req.params.projectId });
});

// ── Plan / re-plan the milestone chain for one project ───────────────────────
router.post("/platform/exhibitions/:exhibitionId/projects/:projectId/plan", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }

  const rows = await queryRows<ExhibitionRow>(sql`
    select ${EXHIBITION_COLUMNS} from exhibitions e
    where e.id = ${req.params.exhibitionId}::uuid and e.organization_id = ${auth.organization.id}::uuid
      and e.deleted_at is null limit 1
  `);
  const exhibition = rows[0];
  if (!exhibition) { res.status(404).json({ error: { code: "exhibition_not_found", message: "Exhibition not found." } }); return; }

  const projects = await queryRows<{ id: string }>(sql`
    select p.id::text from projects p
    where p.id = ${req.params.projectId}::uuid and p.organization_id = ${auth.organization.id}::uuid
      and p.exhibition_id = ${exhibition.id}::uuid and p.deleted_at is null
      and (${canManage(auth)} or p.assigned_pm_user_id = ${auth.user.id}::uuid)
    limit 1
  `);
  if (!projects[0]) { res.status(404).json({ error: { code: "project_not_found", message: "Project not linked to this exhibition." } }); return; }

  const plan = planMilestones(datesOf(exhibition));
  if (plan.length === 0) {
    res.status(400).json({ error: { code: "no_dates", message: "Set the exhibition dates before planning." } });
    return;
  }

  // Generated milestones are replaced on every re-plan; hand-added milestones
  // (source_key is null) are never touched.
  for (const milestone of plan) {
    await db.execute(sql`
      insert into milestones (project_id, title, due_at, sort_order, source_key)
      values (${req.params.projectId}::uuid, ${milestone.title}, ${milestone.dueAt}, ${milestone.sortOrder}, ${milestone.key})
      on conflict (project_id, source_key) where source_key is not null
      do update set title = excluded.title, due_at = excluded.due_at, sort_order = excluded.sort_order
    `);
  }

  await logEvent(auth.organization.id, auth.user.id, "exhibition_schedule_planned",
    `planned ${plan.length} milestones from ${req.params.exhibitionId}`,
    { exhibitionId: exhibition.id, projectId: req.params.projectId, milestones: plan.length });

  const milestones = await queryRows(sql`
    select id::text as "id", title, due_at as "dueAt", completed_at as "completedAt",
           sort_order as "sortOrder", source_key as "sourceKey"
    from milestones where project_id = ${req.params.projectId}::uuid
    order by sort_order asc, due_at asc
  `);

  res.json({ milestones, plan, leadTime: leadTimeAssessment(datesOf(exhibition)) });
});

// ── Soft delete ──────────────────────────────────────────────────────────────
router.delete("/platform/exhibitions/:exhibitionId", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Chief access required." } }); return; }

  const linked = await queryRows<{ count: number }>(sql`
    select count(*)::int as "count" from projects
    where exhibition_id = ${req.params.exhibitionId}::uuid and deleted_at is null
  `);
  if ((linked[0]?.count ?? 0) > 0) {
    res.status(409).json({ error: { code: "exhibition_in_use", message: "Unlink its projects before deleting this exhibition." } });
    return;
  }

  const rows = await queryRows<{ id: string }>(sql`
    update exhibitions set deleted_at = now(), updated_at = now()
    where id = ${req.params.exhibitionId}::uuid and organization_id = ${auth.organization.id}::uuid
      and deleted_at is null
    returning id::text as "id"
  `);
  if (!rows[0]) { res.status(404).json({ error: { code: "exhibition_not_found", message: "Exhibition not found." } }); return; }

  res.json({ ok: true });
});

export default router;
