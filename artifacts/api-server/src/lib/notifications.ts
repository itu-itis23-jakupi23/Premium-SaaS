import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export type NotificationCategory = "assignments" | "milestones" | "reports" | "system";

async function queryRows<T>(statement: ReturnType<typeof sql>) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

async function shouldDeliver(userId: string, category: NotificationCategory): Promise<boolean> {
  const rows = await queryRows<{ metadata: Record<string, unknown> }>(sql`
    select metadata from users where id = ${userId}::uuid and deleted_at is null limit 1
  `);
  const meta = rows[0]?.metadata ?? {};
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
  if (!(await shouldDeliver(userId, category))) return;
  await db.execute(sql`
    insert into notifications (organization_id, user_id, title, body, href)
    values (
      ${organizationId}::uuid,
      ${userId}::uuid,
      ${title.slice(0, 160)},
      ${body},
      ${href}
    )
  `);
}
