import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import {
  createTestOrg,
  cleanupTestOrg,
  createTestUser,
  createTestClient,
  loginAs,
  type TestOrg,
  type TestUser,
} from "../test/helpers";

describe("invoice partial payments", () => {
  let org: TestOrg;
  let chief: TestUser;
  let clientUser: TestUser;
  let otherClientUser: TestUser;
  let clientId: string;
  let chiefCookies: string[];
  let clientCookies: string[];
  let otherClientCookies: string[];

  // subtotal 1_000_000, no discount or tax, so total == 1_000_000
  const lineItems = [{ description: "Stand build", quantity: 1, unitPriceCents: 1_000_000 }];

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    clientUser = await createTestUser(org.id, "client");
    otherClientUser = await createTestUser(org.id, "client");
    const client = await createTestClient(org.id, { contactEmail: clientUser.email, status: "active" });
    clientId = client.id;
    await createTestClient(org.id, { contactEmail: otherClientUser.email, status: "active" });
    chiefCookies = await loginAs(app, org.slug, chief);
    clientCookies = await loginAs(app, org.slug, clientUser);
    otherClientCookies = await loginAs(app, org.slug, otherClientUser);
  });

  afterAll(async () => {
    if (org) await cleanupTestOrg(org.id);
  });

  async function openInvoice() {
    const created = await request(app)
      .post("/api/platform/invoices")
      .set("Cookie", chiefCookies)
      .send({ clientId, title: "Stand", currency: "USD", lineItems });
    const id = created.body.invoice.id as string;
    await request(app).post(`/api/platform/invoices/${id}/send`).set("Cookie", chiefCookies);
    return id;
  }

  it("issues a draft only once when requests overlap", async () => {
    const created = await request(app).post("/api/platform/invoices")
      .set("Cookie", chiefCookies).send({ clientId, currency: "USD", lineItems });
    const id = created.body.invoice.id;
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app)
      .post(`/api/platform/invoices/${id}/send`).set("Cookie", chiefCookies)));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(5);
  });

  it("cannot reopen a draft voided while issuing it", async () => {
    const created = await request(app).post("/api/platform/invoices")
      .set("Cookie", chiefCookies).send({ clientId, currency: "USD", lineItems });
    const id = created.body.invoice.id;
    const [issued, voided] = await Promise.all([
      request(app).post(`/api/platform/invoices/${id}/send`).set("Cookie", chiefCookies),
      request(app).post(`/api/platform/invoices/${id}/void`).set("Cookie", chiefCookies),
    ]);
    expect([200, 409]).toContain(issued.status);
    expect(voided.status).toBe(200);
    const detail = await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", chiefCookies);
    expect(detail.body.invoice.status).toBe("void");
  });

  it("records a deposit without settling the invoice", async () => {
    const id = await openInvoice();
    const res = await request(app)
      .post(`/api/platform/invoices/${id}/payments`)
      .set("Cookie", chiefCookies)
      .send({ amountCents: 250_000, method: "bank_transfer", reference: "DEP-1" });

    expect(res.status).toBe(201);
    expect(res.body.invoice.amountPaidCents).toBe(250_000);
    expect(res.body.invoice.status).toBe("open");
    expect(res.body.invoice.paidAt).toBeNull();
    expect(res.body.payments).toHaveLength(1);
  });

  it("settles the invoice once instalments cover the total", async () => {
    const id = await openInvoice();
    await request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies).send({ amountCents: 400_000 });
    await request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies).send({ amountCents: 300_000 });
    const final = await request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies).send({ amountCents: 300_000 });

    expect(final.status).toBe(201);
    expect(final.body.invoice.amountPaidCents).toBe(1_000_000);
    expect(final.body.invoice.status).toBe("paid");
    expect(final.body.invoice.paidAt).toBeTruthy();
    expect(final.body.payments).toHaveLength(3);
  });

  it("refuses a payment larger than the outstanding balance", async () => {
    const id = await openInvoice();
    await request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies).send({ amountCents: 900_000 });
    const over = await request(app)
      .post(`/api/platform/invoices/${id}/payments`)
      .set("Cookie", chiefCookies)
      .send({ amountCents: 200_000 });

    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("amount_exceeds_balance");
  });

  it("serializes concurrent payments so they cannot overpay the balance", async () => {
    const id = await openInvoice();
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app)
      .post(`/api/platform/invoices/${id}/payments`)
      .set("Cookie", chiefCookies)
      .send({ amountCents: 600_000 })));
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(5);
    const history = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies);
    expect(history.body.payments).toHaveLength(1);
    expect(history.body.payments[0].amountCents).toBe(600_000);
  });

  it("settles the balance only once when mark-paid requests overlap", async () => {
    const id = await openInvoice();
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app)
      .post(`/api/platform/invoices/${id}/mark-paid`).set("Cookie", chiefCookies)));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(5);
    const history = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies);
    expect(history.body.payments).toHaveLength(1);
    expect(history.body.payments[0].amountCents).toBe(1_000_000);
  });

  it("keeps concurrent settlement and voiding mutually exclusive", async () => {
    const id = await openInvoice();
    const results = await Promise.all([
      request(app).post(`/api/platform/invoices/${id}/mark-paid`).set("Cookie", chiefCookies),
      request(app).post(`/api/platform/invoices/${id}/void`).set("Cookie", chiefCookies),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const detail = await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", chiefCookies);
    const history = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies);
    if (detail.body.invoice.status === "paid") {
      expect(detail.body.invoice.amountPaidCents).toBe(1_000_000);
      expect(history.body.payments).toHaveLength(1);
    } else {
      expect(detail.body.invoice.status).toBe("void");
      expect(detail.body.invoice.amountPaidCents).toBe(0);
      expect(history.body.payments).toHaveLength(0);
    }
  });

  it("rolls back the ledger and balance if the audit record cannot be written", async () => {
    const id = await openInvoice();
    const name = sql.identifier(`invoice_audit_failure_${org.id.replaceAll("-", "")}`);
    // Inject a real database failure for this test organization only. Other
    // tenants and suites can still write events while this trigger is active.
    await db.execute(sql`
      create function ${name}() returns trigger language plpgsql as
      'begin raise exception ''Simulated audit write failure''; end'
    `);
    try {
      await db.execute(sql`
        create trigger ${name} before insert on activity_events
        for each row when (new.organization_id = ${sql.raw(`'${org.id}'::uuid`)})
        execute function ${name}()
      `);
      try {
        const result = await request(app).post(`/api/platform/invoices/${id}/payments`)
          .set("Cookie", chiefCookies).send({ amountCents: 100_000 });
        expect(result.status).toBe(500);
        const detail = await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", chiefCookies);
        const history = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies);
        expect(detail.body.invoice.amountPaidCents).toBe(0);
        expect(detail.body.invoice.status).toBe("open");
        expect(history.body.payments).toHaveLength(0);
      } finally {
        await db.execute(sql`drop trigger ${name} on activity_events`);
      }
    } finally {
      await db.execute(sql`drop function ${name}()`);
    }
    const retried = await request(app).post(`/api/platform/invoices/${id}/payments`)
      .set("Cookie", chiefCookies).send({ amountCents: 100_000 });
    expect(retried.status).toBe(201);
    expect(retried.body.invoice.amountPaidCents).toBe(100_000);
    expect(retried.body.payments).toHaveLength(1);
  });

  it("refuses a zero or negative payment", async () => {
    const id = await openInvoice();
    for (const amountCents of [0, -500, 0.5, "100", true, null, 2_147_483_648]) {
      const res = await request(app)
        .post(`/api/platform/invoices/${id}/payments`)
        .set("Cookie", chiefCookies)
        .send({ amountCents });
      expect(res.status).toBe(400);
    }
  });

  it("refuses to void an invoice that already has a deposit", async () => {
    const id = await openInvoice();
    await request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies).send({ amountCents: 100_000 });
    const result = await request(app).post(`/api/platform/invoices/${id}/void`).set("Cookie", chiefCookies);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("payments_recorded");
    const detail = await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", chiefCookies);
    expect(detail.body.invoice.status).toBe("open");
    expect(detail.body.invoice.amountPaidCents).toBe(100_000);
  });

  it("settles only the remaining balance when mark-paid follows a deposit", async () => {
    const id = await openInvoice();
    await request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies).send({ amountCents: 600_000 });
    const paid = await request(app).post(`/api/platform/invoices/${id}/mark-paid`).set("Cookie", chiefCookies);

    expect(paid.status).toBe(200);
    // The regression this guards: mark-paid used to overwrite amount_paid_cents,
    // so the deposit vanished from the ledger and the totals disagreed.
    expect(paid.body.invoice.amountPaidCents).toBe(1_000_000);
    expect(paid.body.invoice.status).toBe("paid");

    const history = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies);
    expect(history.body.payments.map((p: { amountCents: number }) => p.amountCents)).toEqual([600_000, 400_000]);
  });

  it("shows payment history to the client the invoice belongs to, and hides it from others", async () => {
    const id = await openInvoice();
    await request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies).send({ amountCents: 100_000 });

    const mine = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", clientCookies);
    expect(mine.status).toBe(200);
    expect(mine.body.payments).toHaveLength(1);

    const theirs = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", otherClientCookies);
    expect(theirs.status).toBe(404);
  });

  it("hides payment history on a draft invoice from the client", async () => {
    const created = await request(app)
      .post("/api/platform/invoices")
      .set("Cookie", chiefCookies)
      .send({ clientId, title: "Draft", currency: "USD", lineItems });
    const draftId = created.body.invoice.id as string;

    const res = await request(app).get(`/api/platform/invoices/${draftId}/payments`).set("Cookie", clientCookies);
    expect(res.status).toBe(404);
  });

  it("refuses a client attempting to record a payment", async () => {
    const id = await openInvoice();
    const res = await request(app)
      .post(`/api/platform/invoices/${id}/payments`)
      .set("Cookie", clientCookies)
      .send({ amountCents: 100_000 });
    expect(res.status).toBe(403);
  });
});
