import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import request from "supertest";
import app from "../app";
import {
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
  createTestProject,
  createTestUser,
  loginAs,
  type TestClient,
  type TestOrg,
  type TestUser,
} from "../test/helpers";

// Regression guard for the client-approval workflow (PATCH .../approve and .../reject).
// Tests: correct role enforcement, correct status-transition guard, and happy path.

describe("PATCH /api/platform/clients/:clientId/approve", () => {
  let org: TestOrg;
  let chief: TestUser;
  let pm: TestUser;
  let overloadedPm: TestUser;
  let clientUser: TestUser;
  let chiefCookies: string[];
  let pmCookies: string[];
  let pendingClient: TestClient;
  let pendingIntakeClient: TestClient;
  let bulkAssignmentClient: TestClient;
  let overCapacityClient: TestClient;
  let activeClient: TestClient;

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    pm = await createTestUser(org.id, "pm");
    overloadedPm = await createTestUser(org.id, "pm");
    clientUser = await createTestUser(org.id, "client");
    chiefCookies = await loginAs(app, org.slug, chief);
    pmCookies = await loginAs(app, org.slug, pm);
    pendingClient = await createTestClient(org.id, { status: "pending_approval", contactEmail: chief.email });
    pendingIntakeClient = await createTestClient(org.id, { status: "pending_approval", contactEmail: clientUser.email });
    bulkAssignmentClient = await createTestClient(org.id, { status: "pending_approval" });
    overCapacityClient = await createTestClient(org.id, { status: "pending_approval" });
    await db.execute(sql`
      update clients
      set
        company_name = 'Beauty Istanbul Client',
        intake_exhibition_name = 'Beauty Istanbul 2027',
        intake_booth_size_sqm = 21,
        intake_city = 'Istanbul',
        intake_deadline_at = '2027-07-10'::timestamptz,
        intake_preferred_system = 'octanorm'
      where id = ${pendingIntakeClient.id}::uuid
    `);
    await db.execute(sql`
      update users
      set pm_capacity_limit = 2
      where id = ${overloadedPm.id}::uuid
    `);
    const capacityFillerClient = await createTestClient(org.id, { status: "active", assignedPmUserId: overloadedPm.id });
    await createTestProject(org.id, capacityFillerClient.id, { assignedPmUserId: overloadedPm.id });
    activeClient = await createTestClient(org.id, { status: "active" });
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("rejects a PM (non-chief) approving a client", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingClient.id}/approve`)
      .set("Cookie", pmCookies)
      .send({ note: "Looks good" });

    expect(response.status).toBe(403);
  });

  it("returns 409 if client is already active", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${activeClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/not in pending_approval/i);
  });

  it("rejects a request with an invalid managerId UUID", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({ managerId: "not-a-uuid" });

    expect(response.status).toBe(400);
  });

  it("requires a Project Manager before approving the client", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({ note: "Approval without ownership" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/select an active project manager/i);
  });

  it("prevents bulk assignment from bypassing pending-client approval", async () => {
    const response = await request(app)
      .put("/api/platform/managers/assignments")
      .set("Cookie", chiefCookies)
      .send({
        clientAssignments: [{ clientId: bulkAssignmentClient.id, managerId: pm.id }],
        projectAssignments: [],
        cascadeClientProjects: true,
        reason: "Attempted assignment before approval",
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: "pending_approval_requires_review",
      clientIds: [bulkAssignmentClient.id],
    });

    const rows = await db.execute(sql`
      select
        c.status::text,
        c.assigned_pm_user_id::text as "managerId",
        count(p.id)::int as "projectCount"
      from clients c
      left join projects p on p.client_id = c.id and p.deleted_at is null
      where c.id = ${bulkAssignmentClient.id}::uuid
      group by c.id
    `);
    const clientState = (rows as unknown as { rows: Array<{
      status: string;
      managerId: string | null;
      projectCount: number;
    }> }).rows[0];

    expect(clientState).toEqual({
      status: "pending_approval",
      managerId: null,
      projectCount: 0,
    });
  });

  it("approves and assigns the client in one request", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({ managerId: pm.id, note: "Approved by automated test" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    const updatedClient = response.body.clients?.find((c: { id: string }) => c.id === pendingClient.id);
    expect(updatedClient).toBeDefined();
    expect(updatedClient.status.toLowerCase()).toBe("active");
    expect(updatedClient.pm).toBe("Test pm");
  });

  it("creates the intake project, design, and memberships when assigning a PM at approval", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingIntakeClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({ managerId: pm.id, note: "Assign PM and open intake project" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    const projectRows = await db.execute(sql`
      select
        p.id::text,
        p.name,
        p.exhibition_name as "exhibitionName",
        p.city,
        p.status::text,
        p.assigned_pm_user_id::text as "managerId",
        bd.booth_system::text as "system",
        bd.width_mm as "widthMm",
        bd.depth_mm as "depthMm",
        bd.height_mm as "heightMm",
        count(distinct pm_all.user_id)::int as "memberCount",
        count(distinct pm_client.user_id)::int as "clientMemberCount",
        count(distinct pm_pm.user_id)::int as "pmMemberCount"
      from projects p
      join booth_designs bd on bd.project_id = p.id and bd.deleted_at is null
      left join project_members pm_all on pm_all.project_id = p.id
      left join project_members pm_client on pm_client.project_id = p.id and pm_client.user_id = ${clientUser.id}::uuid and pm_client.role::text = 'client'
      left join project_members pm_pm on pm_pm.project_id = p.id and pm_pm.user_id = ${pm.id}::uuid and pm_pm.role::text = 'pm'
      where p.organization_id = ${org.id}::uuid
        and p.client_id = ${pendingIntakeClient.id}::uuid
        and p.deleted_at is null
      group by p.id, bd.id
    `);
    const project = (projectRows as unknown as { rows: Array<{
      id: string;
      name: string;
      exhibitionName: string;
      city: string;
      status: string;
      managerId: string;
      system: string;
      widthMm: number;
      depthMm: number;
      heightMm: number;
      memberCount: number;
      clientMemberCount: number;
      pmMemberCount: number;
    }> }).rows[0];

    expect(project).toMatchObject({
      name: "Beauty Istanbul 2027 - Beauty Istanbul Client",
      exhibitionName: "Beauty Istanbul 2027",
      city: "Istanbul",
      status: "planning",
      managerId: pm.id,
      system: "octanorm",
      widthMm: 6000,
      depthMm: 3500,
      heightMm: 2500,
    });
    expect(project.memberCount).toBeGreaterThanOrEqual(2);
    expect(project.clientMemberCount).toBe(1);
    expect(project.pmMemberCount).toBe(1);

    const secondaryProject = await createTestProject(org.id, pendingIntakeClient.id, {
      assignedPmUserId: pm.id,
    });
    await db.execute(sql`
      update projects
      set name = 'Workspace Editor', exhibition_name = 'Workspace Editor'
      where id = ${secondaryProject.id}::uuid
    `);

    const clientsResponse = await request(app)
      .get("/api/platform/clients?limit=25")
      .set("Cookie", chiefCookies);
    expect(clientsResponse.status).toBe(200);
    const listedClient = clientsResponse.body.clients?.find(
      (client: { id: string }) => client.id === pendingIntakeClient.id,
    );
    expect(listedClient?.exhibition).toBe("Beauty Istanbul 2027");
  });

  it("requires explicit confirmation before approving a client into an overloaded PM queue", async () => {
    const blocked = await request(app)
      .patch(`/api/platform/clients/${overCapacityClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({ managerId: overloadedPm.id, note: "Assign despite a full queue" });

    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({
      error: "over_capacity",
      managerId: overloadedPm.id,
      limit: 2,
    });

    const confirmed = await request(app)
      .patch(`/api/platform/clients/${overCapacityClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({ managerId: overloadedPm.id, confirmOverCapacity: true, note: "Confirmed over-capacity assignment" });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.ok).toBe(true);

    const updatedClient = confirmed.body.clients?.find((c: { id: string }) => c.id === overCapacityClient.id);
    expect(updatedClient).toBeDefined();
    expect(updatedClient.status.toLowerCase()).toBe("active");
  });
});

describe("PATCH /api/platform/clients/:clientId/reject", () => {
  let org: TestOrg;
  let chief: TestUser;
  let chiefCookies: string[];
  let pendingClient: TestClient;

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    chiefCookies = await loginAs(app, org.slug, chief);
    pendingClient = await createTestClient(org.id, { status: "pending_approval" });
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("requires a reason", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingClient.id}/reject`)
      .set("Cookie", chiefCookies)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/reason is required/i);
  });

  it("rejects and archives the client when a reason is given", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingClient.id}/reject`)
      .set("Cookie", chiefCookies)
      .send({ reason: "Incomplete information provided." });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    const updated = response.body.clients?.find((c: { id: string }) => c.id === pendingClient.id);
    expect(updated).toBeDefined();
    expect(updated.status.toLowerCase()).toBe("archived");
  });
});
