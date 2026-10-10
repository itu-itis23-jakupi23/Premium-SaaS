import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import {
  createTestOrg,
  cleanupTestOrg,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestUser,
} from "../test/helpers";

async function queryRows<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

/**
 * The admin surface, which is off unless ADMIN_SURFACE_ENABLED=true.
 *
 * The flag is the first thing these cover, because the whole point of the
 * surface being gated is worth nothing if the gate leaks.
 */
describe("admin surface", () => {
  let org: TestOrg;
  let owner: TestUser;
  let secondOwner: TestUser;
  let pm: TestUser;
  let chief: TestUser;
  let ownerCookies: string[];
  let chiefCookies: string[];
  let previousFlag: string | undefined;

  beforeAll(async () => {
    previousFlag = process.env.ADMIN_SURFACE_ENABLED;
    process.env.ADMIN_SURFACE_ENABLED = "true";
    org = await createTestOrg();
    owner = await createTestUser(org.id, "chief");
    secondOwner = await createTestUser(org.id, "chief");
    pm = await createTestUser(org.id, "pm");
    chief = await createTestUser(org.id, "chief");
    // Two owners, so acting on one administrator still leaves another and the
    // suite is not testing a one-person organization by accident.
    for (const u of [owner, secondOwner]) {
      await db.execute(sql`update users set role = 'owner' where id = ${u.id}::uuid`);
      await db.execute(sql`update memberships set role = 'owner' where organization_id = ${org.id}::uuid and user_id = ${u.id}::uuid`);
    }
    ownerCookies = await loginAs(app, org.slug, owner);
    chiefCookies = await loginAs(app, org.slug, chief);
  });

  afterAll(async () => {
    process.env.ADMIN_SURFACE_ENABLED = previousFlag;
    await cleanupTestOrg(org.id);
  });

  describe("the flag", () => {
    afterEach(() => { process.env.ADMIN_SURFACE_ENABLED = "true"; });

    it("answers 404 - not 403 - for every route when the flag is off", async () => {
      process.env.ADMIN_SURFACE_ENABLED = "false";
      for (const [method, path] of [
        ["get", "/api/admin/members"],
        ["patch", `/api/admin/members/${pm.id}/role`],
        ["patch", `/api/admin/members/${pm.id}/disabled`],
        ["patch", `/api/admin/members/${pm.id}/membership`],
      ] as const) {
        const res = await request(app)[method](path).set("Cookie", ownerCookies).send({});
        // 404 rather than 403: with the flag off the surface should be
        // indistinguishable from one that was never written.
        expect(res.status, `${method} ${path}`).toBe(404);
      }
    });

    it("answers 404 when the flag is simply unset", async () => {
      delete process.env.ADMIN_SURFACE_ENABLED;
      const res = await request(app).get("/api/admin/members").set("Cookie", ownerCookies);
      expect(res.status).toBe(404);
    });
  });

  describe("authorization", () => {
    it("refuses a chief", async () => {
      const res = await request(app).get("/api/admin/members").set("Cookie", chiefCookies);
      expect(res.status).toBe(403);
    });

    it("refuses an unauthenticated caller", async () => {
      const res = await request(app).get("/api/admin/members");
      expect(res.status).toBe(401);
    });

    it("admits an owner", async () => {
      const res = await request(app).get("/api/admin/members").set("Cookie", ownerCookies);
      expect(res.status).toBe(200);
      expect(res.body.members.length).toBeGreaterThanOrEqual(4);
    });

    it("cannot reach a member of another organization", async () => {
      const other = await createTestOrg();
      try {
        const stranger = await createTestUser(other.id, "pm");
        const res = await request(app)
          .patch(`/api/admin/members/${stranger.id}/role`)
          .set("Cookie", ownerCookies)
          .send({ role: "chief" });
        expect(res.status).toBe(404);
      } finally {
        await cleanupTestOrg(other.id);
      }
    });
  });

  describe("role changes", () => {
    afterEach(async () => {
      await db.execute(sql`update users set role = 'pm' where id = ${pm.id}::uuid`);
      await db.execute(sql`update memberships set role = 'pm' where organization_id = ${org.id}::uuid and user_id = ${pm.id}::uuid`);
    });

    it("promotes a PM to chief and records who did it", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${pm.id}/role`)
        .set("Cookie", ownerCookies)
        .send({ role: "chief" });

      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe("chief");

      const events = await queryRows<{ message: string; metadata: Record<string, unknown>; actor: string }>(sql`
        select message, metadata, actor_user_id::text as actor from activity_events
        where organization_id = ${org.id}::uuid and event_type = 'admin_role_changed'
        order by created_at desc limit 1
      `);
      expect(events[0].actor).toBe(owner.id);
      expect(events[0].metadata.targetUserId).toBe(pm.id);
      expect(events[0].metadata.from).toBe("pm");
      expect(events[0].metadata.to).toBe("chief");
    });

    it("refuses to grant admin or owner from here", async () => {
      for (const role of ["admin", "owner"]) {
        const res = await request(app)
          .patch(`/api/admin/members/${pm.id}/role`)
          .set("Cookie", ownerCookies)
          .send({ role });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("invalid_role");
      }
    });

    it("refuses to change your own role", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${owner.id}/role`)
        .set("Cookie", ownerCookies)
        .send({ role: "chief" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("self_change_denied");
    });
  });

  /**
   * What actually stops an organization losing its last administrator.
   *
   * Not a "last admin" counter - an earlier draft had one and it could never
   * fire, because the caller is an active administrator by definition and is
   * always in the count. The protection is that nobody can act on themselves,
   * so acting on anyone else always leaves at least the caller.
   */
  describe("nobody can lock themselves out", () => {
    it("refuses to disable your own account", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${owner.id}/disabled`)
        .set("Cookie", ownerCookies)
        .send({ disabled: true });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("self_change_denied");

      const still = await queryRows<{ disabledAt: string | null }>(sql`
        select disabled_at as "disabledAt" from users where id = ${owner.id}::uuid
      `);
      expect(still[0].disabledAt).toBeNull();
    });

    it("refuses to suspend your own membership", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${owner.id}/membership`)
        .set("Cookie", ownerCookies)
        .send({ status: "suspended" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("self_change_denied");
    });

    it("allows acting on another administrator, which always leaves the caller", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${secondOwner.id}/disabled`)
        .set("Cookie", ownerCookies)
        .send({ disabled: true });
      expect(res.status).toBe(200);
      expect(res.body.member.disabledAt).toBeTruthy();
      await db.execute(sql`update users set disabled_at = null where id = ${secondOwner.id}::uuid`);
    });
  });

  describe("account disabling and membership suspension", () => {
    afterEach(async () => {
      await db.execute(sql`update users set disabled_at = null where id = ${pm.id}::uuid`);
      await db.execute(sql`update memberships set status = 'active' where organization_id = ${org.id}::uuid and user_id = ${pm.id}::uuid`);
    });

    it("disables an account and writes an audit row", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${pm.id}/disabled`)
        .set("Cookie", ownerCookies)
        .send({ disabled: true });
      expect(res.status).toBe(200);
      expect(res.body.member.disabledAt).toBeTruthy();

      const events = await queryRows<{ metadata: Record<string, unknown> }>(sql`
        select metadata from activity_events
        where organization_id = ${org.id}::uuid and event_type = 'admin_account_disabled'
        order by created_at desc limit 1
      `);
      expect(events[0].metadata.targetUserId).toBe(pm.id);
    });

    it("suspends a membership and writes an audit row", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${pm.id}/membership`)
        .set("Cookie", ownerCookies)
        .send({ status: "suspended" });
      expect(res.status).toBe(200);
      expect(res.body.member.membershipStatus).toBe("suspended");

      const events = await queryRows<{ metadata: Record<string, unknown> }>(sql`
        select metadata from activity_events
        where organization_id = ${org.id}::uuid and event_type = 'admin_membership_status_changed'
        order by created_at desc limit 1
      `);
      expect(events[0].metadata.to).toBe("suspended");
    });

    it("rejects a status the enum does not have", async () => {
      const res = await request(app)
        .patch(`/api/admin/members/${pm.id}/membership`)
        .set("Cookie", ownerCookies)
        .send({ status: "banished" });
      expect(res.status).toBe(400);
    });
  });
});
