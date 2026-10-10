import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { deliverNotification } from "./notifications";
import { cleanupTestOrg, createTestOrg, createTestUser, type TestOrg } from "../test/helpers";

describe("notification recipient isolation", () => {
  let org: TestOrg;
  let otherOrg: TestOrg;
  beforeAll(async () => {
    org = await createTestOrg();
    otherOrg = await createTestOrg();
  });
  afterAll(async () => {
    if (otherOrg) await cleanupTestOrg(otherOrg.id);
    if (org) await cleanupTestOrg(org.id);
  });

  async function countFor(userId: string) {
    const result = await db.execute(sql`select count(*)::int as count from notifications where user_id = ${userId}::uuid`);
    return result.rows[0].count;
  }

  it("delivers to an active member of the sending organization", async () => {
    const user = await createTestUser(org.id, "client");
    await deliverNotification(org.id, user.id, "Invoice ready", "Review your invoice", "/client/invoices");
    expect(await countFor(user.id)).toBe(1);
  });

  it("does not deliver another organization's notification to an unrelated user", async () => {
    const user = await createTestUser(otherOrg.id, "client");
    await deliverNotification(org.id, user.id, "Private invoice", "Confidential information", "/client/invoices");
    expect(await countFor(user.id)).toBe(0);
  });

  it.each(["invited", "suspended", "revoked"])("does not deliver to a member whose status is %s", async (status) => {
    const user = await createTestUser(org.id, "client");
    await db.execute(sql`update memberships set status = ${status}::membership_status where user_id = ${user.id}::uuid and organization_id = ${org.id}::uuid`);
    await deliverNotification(org.id, user.id, "Private invoice", "Confidential information", null);
    expect(await countFor(user.id)).toBe(0);
  });

  it.each(["deleted_at", "disabled_at"])("does not deliver to an account with %s set", async (column) => {
    const user = await createTestUser(org.id, "client");
    await db.execute(sql`update users set ${sql.identifier(column)} = now() where id = ${user.id}::uuid`);
    await deliverNotification(org.id, user.id, "Private invoice", "Confidential information", null);
    expect(await countFor(user.id)).toBe(0);
  });

  it("respects category opt-outs for an otherwise eligible member", async () => {
    const user = await createTestUser(org.id, "client");
    await db.execute(sql`update users set metadata = '{"accountSettings":{"notifications":{"system":false}}}'::jsonb where id = ${user.id}::uuid`);
    await deliverNotification(org.id, user.id, "Invoice ready", "Review your invoice", null);
    expect(await countFor(user.id)).toBe(0);
    await deliverNotification(org.id, user.id, "Project assigned", "Review your assignment", null, "assignments");
    expect(await countFor(user.id)).toBe(1);
  });
});
