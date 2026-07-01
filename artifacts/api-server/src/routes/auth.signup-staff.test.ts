import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Legit Chief",
      company: `${org.slug}-staffco`,
      email: `legit-${Date.now()}@test.local`,
      password: "SuperSecret123!",
      role: "chief",
      setupKey: "the-real-key",
    });

    if (response.status !== 201) {
      console.error("[debug] signup-staff 500 body:", JSON.stringify(response.body));
    }
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("chief");
    createdOrgId = response.body.organization?.id ?? null;
  });

  it("rejects a password under 8 characters regardless of setup key", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(app).post("/api/auth/signup-staff").send({
      name: "Short Pass",
      company: org.slug,
      email: `short-${Date.now()}@test.local`,
      password: "short",
      role: "pm",
      organizationSlug: org.slug,
    });

    expect(response.status).toBe(400);
  });
});
