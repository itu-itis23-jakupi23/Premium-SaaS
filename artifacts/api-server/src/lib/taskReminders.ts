import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

type ReminderRow = {
  organizationId: string;
  userId: string;
  taskId: string;
  taskTitle: string;
  projectName: string | null;
  dueDate: string;
  state: "overdue" | "today" | "soon";
};

let reminderTimer: NodeJS.Timeout | null = null;

export function startTaskReminderWorker() {
  if (process.env.TASK_REMINDER_WORKER === "false" || reminderTimer) return;

  const intervalMs = Math.max(300_000, Number(process.env.TASK_REMINDER_INTERVAL_MS ?? 3_600_000));
  void runTaskReminderSweep();
  reminderTimer = setInterval(() => {
    void runTaskReminderSweep();
  }, intervalMs);
  reminderTimer.unref?.();
}

export async function runTaskReminderSweep() {
  try {
    const rows = await reminderRows();
    let created = 0;

    for (const row of rows) {
      created += await createReminder(row);
    }

    if (created > 0) {
      logger.info({ created }, "Task reminder notifications created");
    }
  } catch (err) {
    logger.error({ err }, "Task reminder sweep failed");
  }
}

async function reminderRows() {
  const result = await db.execute(sql`
    select
      t.organization_id::text as "organizationId",
      t.assigned_to_user_id::text as "userId",
      t.id::text as "taskId",
      t.title as "taskTitle",
      p.name as "projectName",
      t.due_at::date::text as "dueDate",
      case
        when t.due_at::date < current_date then 'overdue'
        when t.due_at::date = current_date then 'today'
        else 'soon'
      end as state
    from tasks t
    join users u on u.id = t.assigned_to_user_id and u.deleted_at is null and u.disabled_at is null
    join memberships m on m.organization_id = t.organization_id and m.user_id = u.id and m.status::text = 'active'
    left join projects p on p.id = t.project_id and p.deleted_at is null
    where t.assigned_to_user_id is not null
      and t.status::text not in ('done', 'cancelled')
      and t.due_at is not null
      and t.due_at::date <= current_date + interval '2 days'
      and coalesce(u.metadata #>> '{accountSettings,notifications,milestones}', 'true') <> 'false'
    order by t.due_at asc, t.updated_at desc
    limit 500
  `);

  return (result as unknown as { rows: ReminderRow[] }).rows;
}

async function createReminder(row: ReminderRow) {
  const href = `/pm/tasks?taskId=${encodeURIComponent(row.taskId)}`;
  const title = row.state === "overdue"
    ? "Task overdue"
    : row.state === "today"
      ? "Task due today"
      : "Task due soon";
  const project = row.projectName ? ` for ${row.projectName}` : "";
  const body = row.state === "overdue"
    ? `${row.taskTitle}${project} is overdue.`
    : row.state === "today"
      ? `${row.taskTitle}${project} is due today.`
      : `${row.taskTitle}${project} is due on ${row.dueDate}.`;

  const result = await db.execute(sql`
    insert into notifications (organization_id, user_id, title, body, href)
    select
      ${row.organizationId}::uuid,
      ${row.userId}::uuid,
      ${title},
      ${body},
      ${href}
    where not exists (
      select 1
      from notifications n
      where n.organization_id = ${row.organizationId}::uuid
        and n.user_id = ${row.userId}::uuid
        and n.title = ${title}
        and n.href = ${href}
        and n.created_at >= date_trunc('day', now())
    )
    returning id
  `);

  return (result as unknown as { rows: unknown[] }).rows.length;
}
