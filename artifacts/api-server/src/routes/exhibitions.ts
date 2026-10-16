import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { calendarDateToInstant } from "@workspace/api-zod";
import { requireAuth, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { deliverNotification } from "../lib/notifications";
import { sendExtrasListEmail } from "../lib/email";
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
/**
 * An exhibition's opening, closing, move-in, move-out or freight date.
 *
 * These are calendar dates. `new Date("2026-11-20")` is UTC midnight, so the
 * stored instant fell on the previous day for every negative offset and a show
 * opening on the 20th was listed as the 19th in New York.
 */
function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const anchored = calendarDateToInstant(value);
  return anchored ? new Date(anchored) : undefined;
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

/**
 * The shows that actually have stands, by name.
 *
 * Keyed on `projects.exhibition_name` rather than the `exhibitions` table,
 * because that is where the data is: in this database 48 of 49 projects record
 * their show as a name and *none* carries an `exhibition_id`. The foreign key
 * exists in the schema and nothing populates it, so a list built from the
 * exhibitions table shows nothing a manager recognises - the first version of
 * this listed one test row and none of the real work.
 *
 * Rows in the exhibitions table are unioned in so a show that has been set up
 * properly but has no stands yet still appears.
 */
router.get("/platform/extras/shows", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }

  const rows = await queryRows<{ name: string; boothCount: number; venue: string | null; city: string | null }>(sql`
    select
      show.name as "name",
      count(p.id)::int as "boothCount",
      max(e.venue) as "venue",
      max(e.city) as "city"
    from (
      select distinct coalesce(nullif(trim(p.exhibition_name), ''), e.name) as name
      from projects p
      left join exhibitions e on e.id = p.exhibition_id
      where p.organization_id = ${auth.organization.id}::uuid and p.deleted_at is null
      union
      select e.name from exhibitions e
      where e.organization_id = ${auth.organization.id}::uuid and e.deleted_at is null
    ) show
    left join projects p
      on p.organization_id = ${auth.organization.id}::uuid
     and p.deleted_at is null
     and coalesce(nullif(trim(p.exhibition_name), ''), '') = show.name
    left join exhibitions e
      on e.organization_id = ${auth.organization.id}::uuid
     and e.deleted_at is null
     and e.name = show.name
    where show.name is not null and show.name <> ''
    group by show.name
    order by count(p.id) desc, show.name asc
  `);

  res.json({ shows: rows });
});

/**
 * Every booth's furniture for one show, as one manifest.
 *
 * This replaces a job done by hand: before each show someone writes out, per
 * stand, what furniture it needs, and that sheet is what the warehouse loads
 * from. Reading it out of the drawings removes the transcription, and the
 * transcription is where a missing chair comes from.
 *
 * Matched on the show's name, for the same reason the list above is - the
 * `exhibition_id` foreign key is unpopulated in practice. A project that does
 * carry the id is matched through it as well, so both shapes work.
 *
 * One query rather than one per stand: the furniture lives in each booth
 * version's layout_json, so this unrolls `placedItems` in SQL and aggregates by
 * SKU there. Only the latest version of each stand counts, and only items of
 * kind 'furniture' - structure and lighting are part of the build, not things
 * picked off a shelf.
 */
/**
 * The furniture every stand on a show needs, read from the saved drawings.
 *
 * Shared by the page that displays it and the send that posts it to the
 * chief, because the two must not be able to disagree. A chief told that a
 * show needs ninety pieces is going to sign off ninety pieces; recomputing
 * that number from a second query, or trusting one the browser sent, is how
 * the notification and the sheet drift apart.
 */
async function loadFurnitureManifest(auth: AuthContext, show: string) {
  const rows = await queryRows<{
    projectId: string;
    projectName: string;
    clientName: string | null;
    standNumber: string | null;
    sku: string | null;
    itemName: string | null;
    qty: number | null;
  }>(sql`
    with latest_version as (
      select distinct on (bv.project_id)
        bv.project_id, bv.layout_json
      from booth_versions bv
      where bv.organization_id = ${auth.organization.id}::uuid
      order by bv.project_id, bv.version_number desc
    )
    select
      p.id::text as "projectId",
      coalesce(p.name, 'Untitled stand') as "projectName",
      c.company_name as "clientName",
      p.metadata ->> 'standNumber' as "standNumber",
      item ->> 'sku' as "sku",
      item ->> 'name' as "itemName",
      sum(coalesce((item ->> 'qty')::int, 1))::int as "qty"
    from projects p
    left join clients c on c.id = p.client_id
    left join exhibitions e on e.id = p.exhibition_id
    left join latest_version lv on lv.project_id = p.id
    left join lateral jsonb_array_elements(
      case when jsonb_typeof(lv.layout_json -> 'placedItems') = 'array'
        then lv.layout_json -> 'placedItems' else '[]'::jsonb end
    ) as item on true
    where p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (trim(coalesce(p.exhibition_name, '')) = ${show} or e.name = ${show})
      and (item is null or item ->> 'kind' = 'furniture')
    group by p.id, p.name, c.company_name, p.metadata ->> 'standNumber',
             item ->> 'sku', item ->> 'name'
    order by coalesce(c.company_name, p.name) asc, item ->> 'sku' asc
  `);

  // Stands with no furniture still appear, with an empty list. A stand missing
  // from the sheet reads as "nothing to load"; a stand listed as empty reads as
  // "someone has not furnished this yet", which is the useful difference.
  const booths = new Map<string, {
    projectId: string;
    projectName: string;
    clientName: string | null;
    standNumber: string | null;
    items: Array<{ sku: string; name: string; qty: number }>;
  }>();

  for (const row of rows) {
    const booth = booths.get(row.projectId) ?? {
      projectId: row.projectId,
      projectName: row.projectName,
      clientName: row.clientName,
      standNumber: row.standNumber,
      items: [],
    };
    if (row.sku || row.itemName) {
      booth.items.push({
        sku: row.sku ?? "",
        name: row.itemName ?? "",
        qty: Number(row.qty ?? 0),
      });
    }
    booths.set(row.projectId, booth);
  }

  const detail = await queryRows<{ venue: string | null; city: string | null; country: string | null }>(sql`
    select venue, city, country from exhibitions
    where organization_id = ${auth.organization.id}::uuid and deleted_at is null and name = ${show}
    limit 1
  `);

  const boothList = [...booths.values()];
  return {
    exhibition: {
      name: show,
      venue: detail[0]?.venue ?? null,
      city: detail[0]?.city ?? null,
      country: detail[0]?.country ?? null,
    },
    booths: boothList,
    totals: {
      booths: boothList.length,
      items: boothList.reduce((sum, b) => sum + b.items.reduce((n, i) => n + i.qty, 0), 0),
    },
  };
}

router.get("/platform/extras/furniture-manifest", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }

  const show = typeof req.query.show === "string" ? req.query.show.trim() : "";
  if (!show) {
    res.status(400).json({ error: { code: "show_required", message: "A show name is required." } });
    return;
  }

  res.json(await loadFurnitureManifest(auth, show));
});

/**
 * Send a show's furniture lists to the people who sign off what leaves.
 *
 * "Send to the chief" was first read as "let the chief open the page", which
 * is not the same thing: the person who needs to act on a loading list does
 * not know it is ready until someone tells them. This tells them.
 *
 * In-app notification and email both go out. The notification is what works
 * today - email returns "skipped" until a sending key is configured - so the
 * response reports what each did rather than claiming delivery, and the page
 * says so. Claiming an email was sent when it was dropped on the floor is how
 * a chief misses a show.
 *
 * Recipients are the organization's chiefs, owners and admins. A project
 * manager may send; nobody outside the organization is reachable, because the
 * recipient query is scoped to it and the show is read through the caller's
 * own tenant.
 */
router.post("/platform/extras/send-to-chief", async (req, res) => {
  const auth = req.auth!;
  if (!isStaff(auth)) { res.status(403).json({ error: { code: "forbidden", message: "Staff only." } }); return; }

  const show = typeof req.body?.show === "string" ? req.body.show.trim() : "";
  if (!show) {
    res.status(400).json({ error: { code: "show_required", message: "A show name is required." } });
    return;
  }

  const manifest = await loadFurnitureManifest(auth, show);
  if (manifest.totals.booths === 0) {
    res.status(404).json({ error: { code: "show_not_found", message: "That show has no stands." } });
    return;
  }

  const recipients = await queryRows<{ id: string; name: string | null; email: string }>(sql`
    select u.id::text, u.name, u.email
    from users u
    join memberships m on m.user_id = u.id
      and m.organization_id = ${auth.organization.id}::uuid
      and m.status = 'active'
    where u.deleted_at is null and u.disabled_at is null
      and m.role::text in ('chief', 'owner', 'admin')
    order by u.name asc
  `);

  if (recipients.length === 0) {
    res.status(409).json({
      error: { code: "no_chief", message: "This organization has no chief, owner or admin to send to." },
    });
    return;
  }

  // One line per catalogue item for the whole show: the same aggregate the
  // page prints, computed here so the mail and the sheet cannot disagree.
  const byItem = new Map<string, { sku: string; name: string; qty: number }>();
  for (const booth of manifest.booths) {
    for (const item of booth.items) {
      const key = item.sku || item.name;
      const line = byItem.get(key) ?? { sku: item.sku, name: item.name, qty: 0 };
      line.qty += item.qty;
      byItem.set(key, line);
    }
  }
  const lines = [...byItem.values()].sort((a, b) =>
    (a.sku || a.name).localeCompare(b.sku || b.name, undefined, { numeric: true }),
  );

  const summary = `${manifest.totals.booths} stands · ${lines.length} item types · ${manifest.totals.items} pieces`;
  let emailed = 0;
  let notified = 0;
  for (const recipient of recipients) {
    const delivered = await deliverNotification(
      auth.organization.id,
      recipient.id,
      `Furniture lists for ${show}`,
      `${auth.user.name} sent the furniture lists for ${show}: ${summary}.`,
      "/chief/extras",
      "reports",
    );
    if (delivered) notified += 1;
    const delivery = await sendExtrasListEmail({
      to: recipient.email,
      name: recipient.name ?? "",
      show,
      stands: manifest.totals.booths,
      pieces: manifest.totals.items,
      itemTypes: lines.length,
      sentBy: auth.user.name,
      lines,
    });
    if (delivery.ok) emailed += 1;
  }

  res.json({
    // What was delivered, not who was asked: a chief who has turned these
    // notifications off is not someone this reached.
    notified,
    emailed,
    recipients: recipients.map((r) => r.name || r.email),
    totals: { ...manifest.totals, itemTypes: lines.length },
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
