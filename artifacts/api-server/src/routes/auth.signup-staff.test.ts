import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import request from "supertest";
import app from "../app";
import { cleanupTestOrg, createTestOrg, type TestOrg } from "../test/helpers";

// Regression guard for the previously-open hole: this endpoint used to create
// chief/pm accounts directly against Postgres with zero setup-key check.

describe("POST /api/auth/signup-staff", () => {
  let org: TestOrg;
  let createdOrgId: string | null = null;
  const originalEnv = process.env.NODE_ENV;
  const originalKey = process.env.STAFF_SIGNUP_KEY;
  const originalSeedDemoData = process.env.SEED_DEMO_DATA;

  beforeAll(async () => {
    org = await createTestOrg();
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
    // signup-staff always creates its own new organization — clean up the one
    // created by the "succeeds" test case too.
    if (createdOrgId) await cleanupTestOrg(createdOrgId);
    process.env.NODE_ENV = originalEnv;
    process.env.STAFF_SIGNUP_KEY = originalKey;
    process.env.SEED_DEMO_DATA = originalSeedDemoData;
  });

  it("rejects a request with no setupKey when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    process.env.STAFF_SIGNUP_KEY = "the-real-key";
    process.env.AUTH_SECRET = "ci-test-auth-secret-do-not-use-in-production";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Eve Attacker",
      company: org.slug,
      email: `eve-${Date.now()}@test.local`,
      password: "SuperSecret123!",
      role: "chief",
      organizationSlug: org.slug,
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("setup_key_required");
  });

  it("rejects a request with the wrong setupKey in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.STAFF_SIGNUP_KEY = "the-real-key";
    process.env.AUTH_SECRET = "ci-test-auth-secret-do-not-use-in-production";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Eve Attacker",
      company: org.slug,
      email: `eve2-${Date.now()}@test.local`,
      password: "SuperSecret123!",
      role: "chief",
      organizationSlug: org.slug,
      setupKey: "wrong-key",
    });

    expect(response.status).toBe(403);
  });

  it("succeeds with the correct setupKey in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.STAFF_SIGNUP_KEY = "the-real-key";
    process.env.AUTH_SECRET = "ci-test-auth-secret-do-not-use-in-production";
    process.env.SEED_DEMO_DATA = "false";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Legit Chief",
      company: `${org.slug}-staffco`,
      email: `legit-${Date.now()}@test.local`,
      password: "SuperSecret123!",
      role: "chief",
      setupKey: "the-real-key",
    });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.user.role).toBe("chief");
    createdOrgId = response.body.organization?.id ?? null;
    expect(createdOrgId).toBeTruthy();

    const counts = await db.execute(sql`
      select
        (select count(*)::int from clients where organization_id = ${createdOrgId}::uuid and deleted_at is null) as clients,
        (select count(*)::int from projects where organization_id = ${createdOrgId}::uuid and deleted_at is null) as projects,
        (select count(*)::int from memberships where organization_id = ${createdOrgId}::uuid) as memberships
    `);
    const row = (counts as unknown as { rows: Array<{ clients: number; projects: number; memberships: number }> }).rows[0];
    expect(row).toEqual({ clients: 0, projects: 0, memberships: 1 });
  });

  it("requires a Chief invitation for Project Manager signup in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.STAFF_SIGNUP_KEY = "the-real-key";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Direct Project Manager",
      company: org.slug,
      email: `direct-pm-${Date.now()}@test.local`,
      password: "SuperSecret123!",
      role: "pm",
      organizationSlug: org.slug,
      setupKey: "the-real-key",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("invitation_required");
  });

  it("rejects a password under 8 characters regardless of setup key", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Short Pass",
      company: `Short Pass Company ${Date.now()}`,
      email: `short-${Date.now()}@test.local`,
      password: "short",
      role: "chief",
    });

    expect(response.status).toBe(400);
  });

  it("requires a Chief invitation for Project Manager signup in development too", async () => {
    process.env.NODE_ENV = "development";
    process.env.STAFF_SIGNUP_KEY = "the-real-key";
    process.env.AUTH_SECRET = "ci-test-auth-secret-do-not-use-in-production";
    process.env.SEED_DEMO_DATA = "false";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Joined Project Manager",
      company: org.slug,
      email: `joined-pm-${Date.now()}@test.local`,
      password: "SuperSecret123!",
      role: "pm",
      organizationSlug: org.slug,
      setupKey: "the-real-key",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("invitation_required");
  });

  it("does not reveal whether a requested PM organization exists", async () => {
    process.env.NODE_ENV = "development";
    process.env.STAFF_SIGNUP_KEY = "the-real-key";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Unscoped Project Manager",
      company: "Missing Organization",
      email: `missing-org-pm-${Date.now()}@test.local`,
      password: "SuperSecret123!",
      role: "pm",
      organizationSlug: `missing-${Date.now()}`,
      setupKey: "the-real-key",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("invitation_required");
  });
});
