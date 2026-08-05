import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { deliverNotification } from "./notifications";
import { sendReviewReminderEmail } from "./email";

/**
 * Periodic workflow automation:
 *
 * 1. Deadline health flips — projects drift to `at_risk` when the deadline is
 *    within 14 days and to `delayed` once it passes, so the chief's risk
 *    panels light up without manual bookkeeping.
 * 2. Stalled-review nudges — designs sitting in client review for
 *    STALL_DAYS get an in-app + email reminder to the client; after
 *    2 × STALL_DAYS the chief is notified as well. Nudges repeat at most
 *    once per 24h, tracked in project metadata.
 */

const ACTIVE_STATUSES = ["planning", "in_design", "client_review", "revision", "in_production"] as const;
const STALL_DAYS = Math.max(1, Number(process.env.REVIEW_STALL_DAYS ?? 3));

let sweepTimer: NodeJS.Timeout | null = null;

async function queryRows<T>(statement: ReturnType<typeof sql>) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

export function startAutomationSweeps() {
  if (process.env.AUTOMATION_SWEEPS === "false" || sweepTimer) return;

  const intervalMs = Math.max(300_000, Number(process.env.AUTOMATION_SWEEP_INTERVAL_MS ?? 3_600_000));
  void runAutomationSweeps();
  sweepTimer = setInterval(() => {
    void runAutomationSweeps();
  }, intervalMs);
  sweepTimer.unref?.();
}

export async function runAutomationSweeps() {
  try {
    await runDeadlineHealthSweep();
  } catch (err) {
    logger.error({ err }, "Deadline health sweep failed");
  }
  try {
    await runStalledReviewSweep();
  } catch (err) {
    logger.error({ err }, "Stalled review sweep failed");
  }
}

type FlippedProject = {
  id: string;
  organizationId: string;
  name: string;
  assignedPmUserId: string | null;
};

async function runDeadlineHealthSweep() {
  const atRisk = await queryRows<FlippedProject>(sql`
    update projects
    set health = 'at_risk'::project_health, updated_at = now()
    where deadline_at is not null
      and deadline_at between now() and now() + interval '14 days'
      and health = 'on_track'::project_health
      and status::text in ${sql.raw(`('${ACTIVE_STATUSES.join("','")}')`)}
      and deleted_at is null
    returning id::text, organization_id::text as "organizationId", name, assigned_pm_user_id::text as "assignedPmUserId"
  `);

  const delayed = await queryRows<FlippedProject>(sql`
    update projects
    set health = 'delayed'::project_health, updated_at = now()
    where deadline_at is not null
      and deadline_at < now()
      and health::text in ('on_track', 'at_risk')
      and status::text in ${sql.raw(`('${ACTIVE_STATUSES.join("','")}')`)}
      and deleted_at is null
    returning id::text, organization_id::text as "organizationId", name, assigned_pm_user_id::text as "assignedPmUserId"
  `);

  for (const project of atRisk) {
    await recordSweepEvent(project, "deadline_at_risk", `"${project.name}" enters the 14-day deadline window`);
    if (project.assignedPmUserId) {
      await deliverNotification(
        project.organizationId,
        project.assignedPmUserId,
        "Deadline approaching",
        `"${project.name}" is due within 14 days and was flagged at-risk.`,
        `/pm/workspace?projectId=${project.id}`,
        "milestones",
      );
    }
  }

  for (const project of delayed) {
    await recordSweepEvent(project, "deadline_overdue", `"${project.name}" passed its deadline and was flagged delayed`);
    if (project.assignedPmUserId) {
      await deliverNotification(
        project.organizationId,
        project.assignedPmUserId,
        "Project overdue",
        `"${project.name}" passed its deadline and is now marked delayed.`,
        `/pm/workspace?projectId=${project.id}`,
        "milestones",
      );
    }
  }

  if (atRisk.length || delayed.length) {
    logger.info({ atRisk: atRisk.length, delayed: delayed.length }, "Deadline health sweep applied flips");
  }
}

type StalledReview = {
  id: string;
  organizationId: string;
  name: string;
  clientContactEmail: string | null;
  clientContactName: string | null;
  clientUserId: string | null;
  submittedAt: string;
  lastClientNudgeAt: string | null;
  lastChiefEscalationAt: string | null;
};

async function runStalledReviewSweep() {
  const rows = await queryRows<StalledReview>(sql`
    select
      p.id::text,
      p.organization_id::text as "organizationId",
      p.name,
      c.contact_email as "clientContactEmail",
      c.contact_name as "clientContactName",
      cu.id::text as "clientUserId",
      bv.submitted_at::text as "submittedAt",
      (p.metadata ->> 'lastClientNudgeAt') as "lastClientNudgeAt",
      (p.metadata ->> 'lastChiefEscalationAt') as "lastChiefEscalationAt"
    from projects p
    join clients c on c.id = p.client_id and c.deleted_at is null
    left join users cu on lower(cu.email) = lower(c.contact_email) and cu.deleted_at is null
    join lateral (
      select submitted_at
      from booth_versions bv
      where bv.project_id = p.id and bv.submitted_at is not null
      order by bv.version_number desc
      limit 1
    ) bv on true
    where p.status = 'client_review'::project_status
      and p.deleted_at is null
      and bv.submitted_at < now() - make_interval(days => ${STALL_DAYS})
  `);

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const row of rows) {
    const waitingDays = Math.floor((now - new Date(row.submittedAt).getTime()) / DAY_MS);
    const lastNudge = row.lastClientNudgeAt ? new Date(row.lastClientNudgeAt).getTime() : 0;

    if (now - lastNudge >= DAY_MS) {
      if (row.clientUserId) {
        await deliverNotification(
          row.organizationId,
          row.clientUserId,
          "Design waiting for your review",
          `The booth design for "${row.name}" has been waiting ${waitingDays} days for your approval or feedback.`,
          "/client/workspace",
          "milestones",
        );
      }
      if (row.clientContactEmail) {
        await sendReviewReminderEmail({
          to: row.clientContactEmail,
          name: row.clientContactName ?? "there",
          projectName: row.name,
          daysWaiting: waitingDays,
        });
      }
      await stampMetadata(row.id, "lastClientNudgeAt");
      await recordSweepEvent(
        { id: row.id, organizationId: row.organizationId, name: row.name, assignedPmUserId: null },
        "review_nudge_sent",
        `Client reminded about "${row.name}" (${waitingDays} days in review)`,
      );
    }

    const lastEscalation = row.lastChiefEscalationAt ? new Date(row.lastChiefEscalationAt).getTime() : 0;
    if (waitingDays >= STALL_DAYS * 2 && now - lastEscalation >= DAY_MS) {
      const chiefs = await queryRows<{ userId: string }>(sql`
        select m.user_id::text as "userId"
        from memberships m
        where m.organization_id = ${row.organizationId}::uuid
          and m.role::text in ('chief', 'owner', 'admin')
          and m.status::text = 'active'
      `);
      for (const chief of chiefs) {
        await deliverNotification(
          row.organizationId,
          chief.userId,
          "Client review stalled",
          `"${row.name}" has waited ${waitingDays} days for client review — consider following up directly.`,
          `/chief/workspace?projectId=${row.id}`,
          "milestones",
        );
      }
      await stampMetadata(row.id, "lastChiefEscalationAt");
      await recordSweepEvent(
        { id: row.id, organizationId: row.organizationId, name: row.name, assignedPmUserId: null },
        "review_stall_escalated",
        `Chief notified: "${row.name}" stalled ${waitingDays} days in client review`,
      );
    }
  }

  if (rows.length) {
    logger.info({ stalled: rows.length }, "Stalled review sweep processed projects");
  }
}

async function stampMetadata(projectId: string, key: "lastClientNudgeAt" | "lastChiefEscalationAt") {
  await db.execute(sql`
    update projects
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(${key}::text, now()::text)
    where id = ${projectId}::uuid
  `);
}

async function recordSweepEvent(project: FlippedProject, type: string, message: string) {
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, metadata)
    values (${project.organizationId}::uuid, null, ${project.id}::uuid, ${type}, ${message}, '{}'::jsonb)
  `).catch(() => undefined);
}
