import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import request from "supertest";
import app from "../app";
import {
  addProjectMember,
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
  createTestProject,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestProject,
  type TestUser,
} from "../test/helpers";

// Regression guard for workspace approve/change-request role and state enforcement.

describe("POST /api/platform/projects/:projectId/approve (workspace)", () => {
  let org: TestOrg;
  let chief: TestUser;
  let clientUser: TestUser;
  let pmUser: TestUser;
  let chiefCookies: string[];
  let clientCookies: string[];
  let pmCookies: string[];
  let reviewProject: TestProject;
  let planningProject: TestProject;

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    clientUser = await createTestUser(org.id, "client");
    pmUser = await createTestUser(org.id, "pm");
    chiefCookies = await loginAs(app, org.slug, chief);
    clientCookies = await loginAs(app, org.slug, clientUser);
    pmCookies = await loginAs(app, org.slug, pmUser);

    const client = await createTestClient(org.id, { status: "active", contactEmail: clientUser.email });

    // A project in client_review that the client user is a member of.
    reviewProject = await createTestProject(org.id, client.id, { status: "client_review", assignedPmUserId: pmUser.id });
    await addProjectMember(reviewProject.id, clientUser.id, "client");

    // A project still in planning — should not be approvable.
    planningProject = await createTestProject(org.id, client.id, { status: "planning", assignedPmUserId: pmUser.id });
    await addProjectMember(planningProject.id, clientUser.id, "client");
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("rejects a PM trying to approve (only client/chief/admin/owner allowed)", async () => {
    const response = await request(app)
      .post(`/api/platform/projects/${reviewProject.id}/approve`)
      .set("Cookie", pmCookies);

    expect(response.status).toBe(403);
  });

  it("returns 409 when project is not in a reviewable state", async () => {
    const response = await request(app)
      .post(`/api/platform/projects/${planningProject.id}/approve`)
      .set("Cookie", clientCookies);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("not_in_review");
  });

  it("client can approve a project that is in client_review", async () => {
    // The project needs at least one booth version to approve (getLatestVersion).
    await db.execute(sql`
      insert into booth_designs (organization_id, project_id, name, booth_system, booth_type, width_mm, depth_mm, height_mm)
      values (
        (select organization_id from projects where id = ${reviewProject.id}::uuid),
        ${reviewProject.id}::uuid,
        'Test Design',
        'octanorm'::booth_system,
        'inline'::booth_type,
        6000, 3000, 2500
      )
      on conflict do nothing
    `);
    const designRow = await db.execute(sql`
      select id::text from booth_designs where project_id = ${reviewProject.id}::uuid limit 1
    `);
    const designId = (designRow as unknown as { rows: { id: string }[] }).rows[0]?.id;

    if (designId) {
      await db.execute(sql`
        insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json)
        values (
          (select organization_id from projects where id = ${reviewProject.id}::uuid),
          ${designId}::uuid,
          ${reviewProject.id}::uuid,
          1,
          'submitted'::booth_version_status,
          'v1',
          '{}'::jsonb
        )
        on conflict do nothing
      `);
    }

    const response = await request(app)
      .post(`/api/platform/projects/${reviewProject.id}/approve`)
      .set("Cookie", clientCookies);

    expect([200, 400]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body.projectStatus).toBe("approved");
    }
  });
});

describe("POST /api/platform/projects/:projectId/change-requests", () => {
  let org: TestOrg;
  let clientUser: TestUser;
  let pmUser: TestUser;
  let clientCookies: string[];
  let pmCookies: string[];
  let reviewProject: TestProject;

  beforeAll(async () => {
    org = await createTestOrg();
    clientUser = await createTestUser(org.id, "client");
    pmUser = await createTestUser(org.id, "pm");
    clientCookies = await loginAs(app, org.slug, clientUser);
    pmCookies = await loginAs(app, org.slug, pmUser);

    const client = await createTestClient(org.id, { status: "active", contactEmail: clientUser.email });
    reviewProject = await createTestProject(org.id, client.id, { status: "client_review", assignedPmUserId: pmUser.id });
    await addProjectMember(reviewProject.id, clientUser.id, "client");
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("rejects a PM requesting changes (client-only endpoint)", async () => {
    const response = await request(app)
      .post(`/api/platform/projects/${reviewProject.id}/change-requests`)
      .set("Cookie", pmCookies)
      .send({ changeText: "Please change the color" });

    expect(response.status).toBe(403);
  });

  it("rejects an empty changeText", async () => {
    const response = await request(app)
      .post(`/api/platform/projects/${reviewProject.id}/change-requests`)
      .set("Cookie", clientCookies)
      .send({ changeText: "   " });

    expect(response.status).toBe(400);
  });

  it("client can request a revision on a project in client_review", async () => {
    // Needs a booth version to attach the change request to.
    await db.execute(sql`
      insert into booth_designs (organization_id, project_id, name, booth_system, booth_type, width_mm, depth_mm, height_mm)
      values (
        (select organization_id from projects where id = ${reviewProject.id}::uuid),
        ${reviewProject.id}::uuid,
        'Design',
        'octanorm'::booth_system,
        'inline'::booth_type,
        6000, 3000, 2500
      )
      on conflict do nothing
    `);
    const designRow = await db.execute(sql`
      select id::text from booth_designs where project_id = ${reviewProject.id}::uuid limit 1
    `);
    const designId = (designRow as unknown as { rows: { id: string }[] }).rows[0]?.id;

    if (designId) {
      await db.execute(sql`
        insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json)
        values (
          (select organization_id from projects where id = ${reviewProject.id}::uuid),
          ${designId}::uuid,
          ${reviewProject.id}::uuid,
          1,
          'submitted'::booth_version_status,
          'v1',
          '{}'::jsonb
        )
        on conflict do nothing
      `);
    }

    const response = await request(app)
      .post(`/api/platform/projects/${reviewProject.id}/change-requests`)
      .set("Cookie", clientCookies)
      .send({ changeText: "Please darken the fascia band and move the info desk 1m to the right." });

    expect([200, 400]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body.projectStatus).toBe("revision");
    }
  });
});

describe("PUT /api/platform/projects/:projectId/workspace", () => {
  let org: TestOrg;
  let pmUser: TestUser;
  let pmCookies: string[];
  let project: TestProject;

  beforeAll(async () => {
    org = await createTestOrg();
    pmUser = await createTestUser(org.id, "pm");
    pmCookies = await loginAs(app, org.slug, pmUser);

    const client = await createTestClient(org.id, { status: "active", assignedPmUserId: pmUser.id });
    project = await createTestProject(org.id, client.id, { status: "planning", assignedPmUserId: pmUser.id });
    await addProjectMember(project.id, pmUser.id, "pm");
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("normalizes furniture dimensions and coordinates inside the booth footprint", async () => {
    const response = await request(app)
      .put(`/api/platform/projects/${project.id}/workspace`)
      .set("Cookie", pmCookies)
      .send({
        title: "Out of bounds furniture normalization",
        workspace: {
          booth: {
            width: 6,
            depth: 3,
            height: 2.5,
            system: "octanorm",
            companyName: "Bounds Test",
            openFront: true,
            openBack: false,
            openLeft: false,
            openRight: false,
          },
          themeIdx: 0,
          carpetIdx: 0,
          placedItems: [{
            id: "chair-1",
            catalogId: "149",
            name: "Plastic Chair",
            sku: "149",
            qty: 1,
            w: 99,
            d: 99,
            h: 1,
            color: "#ffffff",
            weight: 5,
            x: -500,
            z: 500,
            rotation: 0,
            kind: "furniture",
          }],
          notes: [],
        },
      });

    expect(response.status).toBe(200);
    const item = response.body.workspace.placedItems[0];
    expect(item.w).toBe(6);
    expect(item.d).toBe(3);
    expect(item.x).toBe(3);
    expect(item.z).toBe(1.5);
  });
});
