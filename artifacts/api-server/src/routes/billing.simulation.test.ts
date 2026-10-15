import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
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

/**
 * The development checkout stub, treated as a real endpoint.
 *
 * It answers 404 in production, which is why it was written loosely: a GET
 * that activates a paid plan, taking the client id straight from the query
 * string and reflecting the plan and a return URL into HTML unescaped. None
 * of that is safe in a staging environment, which is reachable and shares a
 * cookie with everyone who has a staff account.
 *
 * What these guard, in order: that a caller cannot credit a subscription to a
 * client in someone else's organization, that an unknown plan cannot be
 * written to the row, and that the return link cannot carry script or point
 * off-site.
 */
describe("GET /api/platform/workspace/billing/simulation", () => {
  let org: TestOrg;
  let otherOrg: TestOrg;
  let pm: TestUser;
  let ownClient: TestClient;
  let foreignClient: TestClient;
  let cookies: string[];

  beforeAll(async () => {
    org = await createTestOrg();
    otherOrg = await createTestOrg();
    pm = await createTestUser(org.id, "pm");
    ownClient = await createTestClient(org.id);
    foreignClient = await createTestClient(otherOrg.id);
    cookies = await loginAs(app, org.slug, pm);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
    await cleanupTestOrg(otherOrg.id);
  });

  const call = (query: Record<string, string>) =>
    request(app)
      .get("/api/platform/workspace/billing/simulation")
      .query({ reference: "WSP-test", ...query })
      .set("Cookie", cookies);

  const subscriptionOf = async (clientId: string) => {
    const rows = await db.execute<{ plan: string | null; active: boolean | null }>(sql`
      select workspace_editor_subscription_plan as plan,
             workspace_editor_subscription_active as active
      from clients where id = ${clientId}::uuid
    `);
    return (rows as unknown as { rows: Array<{ plan: string | null; active: boolean | null }> }).rows[0];
  };

  it("refuses to credit a client in another organization", async () => {
    const before = await subscriptionOf(foreignClient.id);
    const response = await call({ plan: "unlimited", client_id: foreignClient.id });

    expect(response.status).toBe(404);
    // The point is the row, not the status code: a 404 that still wrote would
    // be worse than a 200.
    expect(await subscriptionOf(foreignClient.id)).toEqual(before);
  });

  it("refuses a plan it does not sell", async () => {
    const response = await call({ plan: "free-forever", client_id: ownClient.id });

    expect(response.status).toBe(400);
    expect((await subscriptionOf(ownClient.id))?.plan).not.toBe("free-forever");
  });

  it("will not put a javascript: URI in the return link", async () => {
    const response = await call({
      plan: "starter",
      client_id: ownClient.id,
      redirect: "javascript:alert(document.cookie)",
    });

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("javascript:");
    expect(response.text).toContain('href="#"');
  });

  it("will not send the visitor to another site", async () => {
    const response = await call({
      plan: "starter",
      client_id: ownClient.id,
      redirect: "//evil.example/takeover",
    });

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("evil.example");
  });

  it("does not reflect an unescaped plan into the page", async () => {
    // The plan allowlist is what stops this, so the assertion is on the
    // output rather than the status: a future change that widens the list
    // must not reopen the hole.
    const response = await call({
      plan: "<img src=x onerror=alert(1)>",
      client_id: ownClient.id,
    });

    expect(response.text).not.toContain("<img src=x");
  });

  it("still completes a simulated checkout for the caller's own client", async () => {
    const response = await call({
      plan: "unlimited",
      client_id: ownClient.id,
      redirect: "/client/workspace?projectId=abc&checkout=success",
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain('href="/client/workspace?projectId=abc&amp;checkout=success"');

    const subscription = await subscriptionOf(ownClient.id);
    expect(subscription?.plan).toBe("unlimited");
    expect(subscription?.active).toBe(true);
  });
});
