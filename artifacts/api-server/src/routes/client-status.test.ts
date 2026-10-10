import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import request from "supertest";
import app from "../app";
import {
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
  createTestProject,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestUser,
} from "../test/helpers";

describe("generic client status changes respect the approval workflow", () => {
  let org: TestOrg;
  let foreignOrg: TestOrg;
  let chief: TestUser;
  let pm: TestUser;
  let chiefCookies: string[];
  let pmCookies: string[];

  beforeAll(async () => {
    org = await createTestOrg();
    foreignOrg = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    pm = await createTestUser(org.id, "pm");
    chiefCookies = await loginAs(app, org.slug, chief);
    pmCookies = await loginAs(app, org.slug, pm);
  });

  afterAll(async () => {
    if (org) await cleanupTestOrg(org.id);
    if (foreignOrg) await cleanupTestOrg(foreignOrg.id);
  });

  async function clientStatus(clientId: string) {
    const result = await db.execute(sql`select status::text from clients where id = ${clientId}::uuid`);
    return (result as unknown as { rows: Array<{ status: string }> }).rows[0]?.status;
  }

  async function statusAuditCount(clientId: string) {
    const result = await db.execute(sql`
      select count(*)::int as count from activity_events
      where organization_id = ${org.id}::uuid and event_type = 'client_status_updated'
        and metadata ->> 'clientId' = ${clientId}
    `);
    return (result as unknown as { rows: Array<{ count: number }> }).rows[0].count;
  }

  function changeStatus(clientId: string, status: string, cookies = pmCookies) {
    return request(app).put(`/api/platform/clients/${clientId}/status`).set("Cookie", cookies).send({ status });
  }

  it.each(["Active", "Lead", "Inactive", "Archived"])("prevents an assigned PM moving a pending client to %s", async (status) => {
    const client = await createTestClient(org.id, { status: "pending_approval", assignedPmUserId: pm.id });
    const response = await changeStatus(client.id, status);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("approval_workflow_required");
    expect(await clientStatus(client.id)).toBe("pending_approval");
    expect(await statusAuditCount(client.id)).toBe(0);
  });

  it.each(["Active", "Lead", "Inactive", "Archived"])("requires the dedicated Chief approval/rejection flow when changing pending status to %s", async (status) => {
    const client = await createTestClient(org.id, { status: "pending_approval" });
    const response = await changeStatus(client.id, status, chiefCookies);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("approval_workflow_required");
    expect(await clientStatus(client.id)).toBe("pending_approval");
  });

  it.each(["pm", "chief"] as const)("prevents a %s from reopening approval through the generic status endpoint", async (role) => {
    const client = await createTestClient(org.id, { status: "active", assignedPmUserId: pm.id });
    const response = await changeStatus(client.id, "Pending", role === "chief" ? chiefCookies : pmCookies);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("approval_workflow_required");
    expect(await clientStatus(client.id)).toBe("active");
    expect(await statusAuditCount(client.id)).toBe(0);
  });

  it("accepts an unchanged pending state without writing a misleading status audit", async () => {
    const client = await createTestClient(org.id, { status: "pending_approval", assignedPmUserId: pm.id });
    const response = await changeStatus(client.id, "Pending");
    expect(response.status).toBe(200);
    expect(await clientStatus(client.id)).toBe("pending_approval");
    expect(await statusAuditCount(client.id)).toBe(0);
  });

  it("preserves ordinary status changes for an assigned PM and records their audit", async () => {
    const client = await createTestClient(org.id, { status: "active", assignedPmUserId: pm.id });
    const response = await changeStatus(client.id, "Inactive");
    expect(response.status).toBe(200);
    expect(await clientStatus(client.id)).toBe("inactive");
    expect(await statusAuditCount(client.id)).toBe(1);
  });

  it("preserves access through an assigned project without direct client assignment", async () => {
    const client = await createTestClient(org.id, { status: "lead" });
    await createTestProject(org.id, client.id, { assignedPmUserId: pm.id });
    const response = await changeStatus(client.id, "Inactive");
    expect(response.status).toBe(200);
    expect(await clientStatus(client.id)).toBe("inactive");
  });

  it("does not expose protected state to an unassigned PM or another organization", async () => {
    const hiddenClient = await createTestClient(org.id, { status: "pending_approval" });
    const foreignClient = await createTestClient(foreignOrg.id, { status: "pending_approval" });
    expect((await changeStatus(hiddenClient.id, "Active")).status).toBe(403);
    expect((await changeStatus(foreignClient.id, "Active", chiefCookies)).status).toBe(404);
    expect((await changeStatus(randomUUID(), "Active", chiefCookies)).status).toBe(404);
    expect(await clientStatus(hiddenClient.id)).toBe("pending_approval");
    expect(await clientStatus(foreignClient.id)).toBe("pending_approval");
  });

  it("rechecks approval state after waiting on a concurrent client update", async () => {
    const client = await createTestClient(org.id, { status: "active", assignedPmUserId: pm.id });
    const blocker = await pool.connect();
    let mutation: Promise<request.Response> | undefined;
    try {
      await blocker.query("begin");
      const backend = await blocker.query<{ pid: number }>("select pg_backend_pid() as pid");
      await blocker.query("update clients set status = 'pending_approval' where id = $1", [client.id]);
      mutation = changeStatus(client.id, "Active").then((response) => response);
      // Wait for PostgreSQL to confirm the request is blocked on this row,
      // rather than relying on timing to manufacture the concurrency window.
      await vi.waitFor(async () => {
        const waiting = await db.execute(sql`
          select exists (
            select 1 from pg_stat_activity
            where datname = current_database()
              and ${backend.rows[0].pid}::int = any(pg_blocking_pids(pid))
          ) as blocked
        `);
        expect((waiting as unknown as { rows: Array<{ blocked: boolean }> }).rows[0].blocked).toBe(true);
      }, { timeout: 5000, interval: 25 });
      await blocker.query("commit");
      const response = await mutation;
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("approval_workflow_required");
      expect(await clientStatus(client.id)).toBe("pending_approval");
      expect(await statusAuditCount(client.id)).toBe(0);
    } finally {
      await blocker.query("rollback").catch(() => {});
      blocker.release();
      if (mutation) await mutation.catch(() => {});
    }
  });
});
