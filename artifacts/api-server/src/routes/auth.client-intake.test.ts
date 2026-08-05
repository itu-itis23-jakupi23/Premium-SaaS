import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import request from "supertest";
import app from "../app";
import {
  cleanupTestOrg,
  createTestOrg,
  createTestUser,
  type TestOrg,
  type TestUser,
} from "../test/helpers";

describe("client intake and portal identity isolation", () => {
  let org: TestOrg;
  let chief: TestUser;
  let pm: TestUser;

  beforeAll(async () => {
    process.env.AUTH_SECRET = "ci-test-auth-secret-do-not-use-in-production";
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    pm = await createTestUser(org.id, "pm");
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("keeps staff and client identities separate and sends signup to the Chief queue", async () => {
    const chiefLogin = await request(app)
      .post("/api/auth/login")
      .set("x-ens-portal", "staff")
      .send({ email: chief.email, password: chief.password, organizationSlug: org.slug });

    expect(chiefLogin.status, JSON.stringify(chiefLogin.body)).toBe(200);
    expect(cookieNames(chiefLogin.get("Set-Cookie"))).toEqual(expect.arrayContaining(["ens_access", "ens_refresh"]));

    const clientEmail = `intake-${randomUUID().slice(0, 8)}@test.local`;
    const clientSignup = await request(app)
      .post("/api/auth/signup")
      .set("x-ens-portal", "client")
      .send({
        name: "New Exhibitor",
        company: "New Exhibitor Company",
        email: clientEmail,
        password: "TestPass123!",
        organizationSlug: org.slug,
        exhibitionName: "Istanbul Expo 2027",
        boothSizeSqm: 18,
        city: "Istanbul",
        deadline: "2027-07-10",
        preferredSystem: "octanorm",
        notes: "Needs Chief assignment",
      });

    expect(clientSignup.status).toBe(201);
    expect(clientSignup.body).toMatchObject({
      user: { role: "client", name: "New Exhibitor" },
      organization: { id: org.id },
      clientRecord: { status: "pending_approval" },
    });
    expect(cookieNames(clientSignup.get("Set-Cookie"))).toEqual(
      expect.arrayContaining(["ens_client_access", "ens_client_refresh"]),
    );

    const clientRows = await db.execute(sql`
      select status::text, activated_at as "activatedAt", assigned_pm_user_id::text as "managerId"
      from clients
      where organization_id = ${org.id}::uuid
        and lower(contact_email) = lower(${clientEmail})
        and deleted_at is null
    `);
    expect((clientRows as unknown as { rows: unknown[] }).rows).toEqual([
      { status: "pending_approval", activatedAt: null, managerId: null },
    ]);

    const staffCookies = cookieHeader(chiefLogin.get("Set-Cookie"));
    const clientCookies = cookieHeader(clientSignup.get("Set-Cookie"));
    const combinedCookies = `${staffCookies}; ${clientCookies}`;

    const staffIdentity = await request(app)
      .get("/api/auth/me")
      .set("Cookie", combinedCookies)
      .set("x-ens-portal", "staff");
    expect(staffIdentity.body.user).toMatchObject({ id: chief.id, role: "chief" });

    const clientIdentity = await request(app)
      .get("/api/auth/me")
      .set("Cookie", combinedCookies)
      .set("x-ens-portal", "client");
    expect(clientIdentity.body.user).toMatchObject({ id: clientSignup.body.user.id, role: "client", name: "New Exhibitor" });

    const pendingClients = await request(app)
      .get("/api/platform/clients?status=pending_approval")
      .set("Cookie", staffCookies)
      .set("x-ens-portal", "staff");
    expect(pendingClients.status).toBe(200);
    expect(pendingClients.body.clients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contactEmail: clientEmail,
        company: "New Exhibitor Company",
        pm: "Unassigned",
        status: "Pending Approval",
      }),
    ]));

    const overview = await request(app)
      .get("/api/platform/overview")
      .set("Cookie", staffCookies)
      .set("x-ens-portal", "staff");
    expect(overview.status).toBe(200);
    expect(overview.body.workflow.counts.pendingClientApprovals).toBeGreaterThanOrEqual(1);

    const approveClient = await request(app)
      .patch(`/api/platform/clients/${pendingClients.body.clients.find(
        (client: { contactEmail: string }) => client.contactEmail === clientEmail,
      ).id}/approve`)
      .set("Cookie", staffCookies)
      .set("x-ens-portal", "staff")
      .send({ managerId: pm.id, note: "Approved and assigned from the Chief intake queue" });

    expect(approveClient.status, JSON.stringify(approveClient.body)).toBe(200);
    expect(approveClient.body.clients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contactEmail: clientEmail,
        pm: "Test pm",
        status: "Active",
      }),
    ]));

    const refreshedClientIdentity = await request(app)
      .get("/api/auth/me")
      .set("Cookie", clientCookies)
      .set("x-ens-portal", "client");
    expect(refreshedClientIdentity.status, JSON.stringify(refreshedClientIdentity.body)).toBe(200);
    expect(refreshedClientIdentity.body).toMatchObject({
      user: { id: clientSignup.body.user.id, role: "client" },
      clientRecord: { status: "active" },
    });

    const assignmentRows = await db.execute(sql`
      select
        p.id::text as "projectId",
        p.assigned_pm_user_id::text as "managerId",
        count(distinct client_member.user_id)::int as "clientMembers",
        count(distinct pm_member.user_id)::int as "pmMembers"
      from projects p
      join clients c on c.id = p.client_id
      left join project_members client_member
        on client_member.project_id = p.id
       and client_member.user_id = ${clientSignup.body.user.id}::uuid
       and client_member.role::text = 'client'
      left join project_members pm_member
        on pm_member.project_id = p.id
       and pm_member.user_id = ${pm.id}::uuid
       and pm_member.role::text = 'pm'
      where p.organization_id = ${org.id}::uuid
        and lower(c.contact_email) = lower(${clientEmail})
        and p.deleted_at is null
      group by p.id
    `);
    expect((assignmentRows as unknown as { rows: unknown[] }).rows).toEqual([
      expect.objectContaining({
        managerId: pm.id,
        clientMembers: 1,
        pmMembers: 1,
      }),
    ]);
  });

  it("rejects client signup without an agency code instead of routing it to a default tenant", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .set("x-ens-portal", "client")
      .send({
        name: "Unrouted Exhibitor",
        company: "Unrouted Exhibitor Company",
        email: `unrouted-${randomUUID().slice(0, 8)}@test.local`,
        password: "TestPass123!",
        exhibitionName: "Istanbul Expo 2027",
        boothSizeSqm: 18,
        city: "Istanbul",
        deadline: "2027-07-10",
        preferredSystem: "octanorm",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "invalid_signup_input",
      message: "Agency code is required",
    });
  });
});

function cookieNames(setCookie: string[] | undefined) {
  return (setCookie ?? []).map((cookie) => cookie.split("=", 1)[0]);
}

function cookieHeader(setCookie: string[] | undefined) {
  return (setCookie ?? []).map((cookie) => cookie.split(";", 1)[0]).join("; ");
}
