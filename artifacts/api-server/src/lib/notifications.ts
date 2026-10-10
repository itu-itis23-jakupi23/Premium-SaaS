import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export type NotificationCategory = "assignments" | "milestones" | "reports" | "system";

async function queryRows<T>(statement: ReturnType<typeof sql>) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

async function shouldDeliver(organizationId: string, userId: string, category: NotificationCategory): Promise<boolean> {
  const rows = await queryRows<{ metadata: Record<string, unknown> }>(sql`
    select u.metadata from users u
    join memberships m on m.user_id = u.id and m.organization_id = ${organizationId}::uuid and m.status = 'active'
    where u.id = ${userId}::uuid and u.deleted_at is null and u.disabled_at is null limit 1
  `);
  if (!rows[0]) return false;
  const meta = rows[0].metadata ?? {};
  const settings = meta.accountSettings && typeof meta.accountSettings === "object"
    ? (meta.accountSettings as Record<string, unknown>)
    : {};
  const notifications = settings.notifications && typeof settings.notifications === "object"
    ? (settings.notifications as Record<string, unknown>)
    : {};
  const pref = notifications[category];
  return pref === undefined || pref === null || pref === true;
}

export async function deliverNotification(
  organizationId: string,
  userId: string,
  title: string,
  body: string,
  href: string | null,
  category: NotificationCategory = "system",
): Promise<void> {
  if (!(await shouldDeliver(organizationId, userId, category))) return;
  await db.execute(sql`
    insert into notifications (organization_id, user_id, title, body, href)
    select
      ${organizationId}::uuid,
      ${userId}::uuid,
      ${title.slice(0, 160)},
      ${body},
      ${href}
    from users u
    where u.id = ${userId}::uuid and u.deleted_at is null and u.disabled_at is null
      and exists (select 1 from memberships m where m.user_id = u.id
        and m.organization_id = ${organizationId}::uuid and m.status = 'active')
  `);
}
