import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import {
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
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
  let chiefCookies: string[];
  let pmCookies: string[];
  let pendingClient: TestClient;
  let activeClient: TestClient;

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    pm = await createTestUser(org.id, "pm");
    chiefCookies = await loginAs(app, org.slug, chief);
    pmCookies = await loginAs(app, org.slug, pm);
    pendingClient = await createTestClient(org.id, { status: "pending_approval", contactEmail: chief.email });
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

  it("approves the client and returns status 200 with updated client list", async () => {
    const response = await request(app)
      .patch(`/api/platform/clients/${pendingClient.id}/approve`)
      .set("Cookie", chiefCookies)
      .send({ note: "Approved by automated test" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    const updatedClient = response.body.clients?.find((c: { id: string }) => c.id === pendingClient.id);
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
