import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import request from "supertest";
import app from "../app";
import { cleanupTestOrg, createTestClient, createTestOrg, createTestProject, createTestUser, loginAs, type TestOrg } from "../test/helpers";

describe("complete, authorized client invoice summaries", () => {
  let org: TestOrg;
  let foreignOrg: TestOrg;
  let clientId: string;
  let projectClientId: string;
  let largeClientId: string;
  let foreignClientId: string;
  let chiefCookies: string[];
  let pmCookies: string[];
  let clientCookies: string[];

  async function invoice(organizationId: string, targetClientId: string, status: string, currency: string, total: number, paid = 0, projectId: string | null = null, deleted = false) {
    await db.execute(sql`
      insert into invoices (organization_id, client_id, project_id, invoice_number, status, currency, subtotal_cents, total_cents, amount_paid_cents, deleted_at)
      values (${organizationId}::uuid, ${targetClientId}::uuid, ${projectId}::uuid, ${randomUUID()}, ${status}::invoice_status,
        ${currency}, ${total}, ${total}, ${paid}, ${deleted ? new Date() : null})
    `);
  }

  beforeAll(async () => {
    org = await createTestOrg();
    foreignOrg = await createTestOrg();
    const chief = await createTestUser(org.id, "chief");
    const pm = await createTestUser(org.id, "pm");
    const clientUser = await createTestUser(org.id, "client");
    chiefCookies = await loginAs(app, org.slug, chief);
    pmCookies = await loginAs(app, org.slug, pm);
    clientCookies = await loginAs(app, org.slug, clientUser);
    clientId = (await createTestClient(org.id, { status: "active", contactEmail: clientUser.email, assignedPmUserId: pm.id })).id;
    projectClientId = (await createTestClient(org.id, { status: "active" })).id;
    largeClientId = (await createTestClient(org.id, { status: "active", assignedPmUserId: pm.id })).id;
    foreignClientId = (await createTestClient(foreignOrg.id, { status: "active" })).id;
    await invoice(org.id, clientId, "open", "USD", 10000, 2500);
    await invoice(org.id, clientId, "paid", "usd", 5000, 5000);
    await invoice(org.id, clientId, "uncollectible", "USD", 2000, 1000);
    await invoice(org.id, clientId, "open", "EUR", 8000, 1000);
    await invoice(org.id, clientId, "draft", "USD", 99999);
    await invoice(org.id, clientId, "void", "USD", 99999);
    await invoice(org.id, clientId, "open", "USD", 99999, 0, null, true);
    const project = await createTestProject(org.id, projectClientId, { assignedPmUserId: pm.id });
    await invoice(org.id, projectClientId, "open", "EUR", 3000, 0, project.id);
    await invoice(org.id, projectClientId, "open", "EUR", 4000);
    await invoice(foreignOrg.id, foreignClientId, "open", "EUR", 9000);
    await db.execute(sql`
      insert into invoices (organization_id, client_id, invoice_number, status, currency, subtotal_cents, total_cents, amount_paid_cents)
      select ${org.id}::uuid, ${largeClientId}::uuid, 'SUMMARY-' || n::text, 'open', 'USD', 1000, 1000, 25
      from generate_series(1, 205) as n
    `);
  });

  afterAll(async () => {
    if (org) await cleanupTestOrg(org.id);
    if (foreignOrg) await cleanupTestOrg(foreignOrg.id);
  });

  function summary(id: string, cookies = chiefCookies) {
    return request(app).get("/api/platform/invoices/summary").query({ clientId: id }).set("Cookie", cookies);
  }

  const expected = {
    balances: [
      { currency: "EUR", billedCents: 8000, receivedCents: 1000, outstandingCents: 7000, invoiceCount: 1 },
      { currency: "USD", billedCents: 17000, receivedCents: 8500, outstandingCents: 7500, invoiceCount: 3 },
    ], invoiceCount: 4,
  };

  it("reports issued invoices and recorded payments per currency without counting drafts, voids or deleted records", async () => {
    const result = await summary(clientId);
    expect(result.status).toBe(200);
    expect(result.body).toEqual(expected);
  });

  it("gives an assigned manager the same authorized client balances", async () => {
    const result = await summary(clientId, pmCookies);
    expect(result.status).toBe(200);
    expect(result.body).toEqual(expected);
  });

  it("includes invoices beyond the invoice list's 200-row limit", async () => {
    const list = await request(app).get("/api/platform/invoices").set("Cookie", chiefCookies);
    expect(list.body.invoices).toHaveLength(200);
    const result = await summary(largeClientId);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ balances: [{ currency: "USD", billedCents: 205000, receivedCents: 5125, outstandingCents: 199875, invoiceCount: 205 }], invoiceCount: 205 });
  });

  it("limits a project-scoped manager to the invoices they can actually read", async () => {
    const result = await summary(projectClientId, pmCookies);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ balances: [{ currency: "EUR", billedCents: 3000, receivedCents: 0, outstandingCents: 3000, invoiceCount: 1 }], invoiceCount: 1 });
    const chiefResult = await summary(projectClientId);
    expect(chiefResult.body.balances[0].billedCents).toBe(7000);
  });

  it("allows a client to see their own balances and hides another client's balances", async () => {
    expect((await summary(clientId, clientCookies)).body).toEqual(expected);
    expect((await summary(projectClientId, clientCookies)).body).toEqual({ balances: [], invoiceCount: 0 });
  });

  it("does not reveal invoices in another organization", async () => {
    const result = await summary(foreignClientId);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ balances: [], invoiceCount: 0 });
  });

  it("returns an empty summary for a client with no visible invoices", async () => {
    expect((await summary(randomUUID())).body).toEqual({ balances: [], invoiceCount: 0 });
  });

  it.each(["", "not-a-uuid"])("rejects invalid client identifiers: %s", async (id) => {
    const result = await summary(id);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("invalid_client_id");
  });

  it("requires an authenticated session", async () => {
    const result = await request(app).get("/api/platform/invoices/summary").query({ clientId });
    expect(result.status).toBe(401);
  });
});
