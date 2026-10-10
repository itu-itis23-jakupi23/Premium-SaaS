import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { createTestOrg, cleanupTestOrg, createTestUser, createTestClient, loginAs, type TestOrg } from "../test/helpers";

describe("invoice payment retry safety", () => {
  let org: TestOrg;
  let otherOrg: TestOrg;
  let chiefCookies: string[];
  let secondChiefCookies: string[];
  let pmCookies: string[];
  let otherChiefCookies: string[];
  let clientId: string;
  let otherClientId: string;
  let pmId: string;
  let chiefId: string;
  const total = 1_000_000;

  beforeAll(async () => {
    org = await createTestOrg();
    otherOrg = await createTestOrg();
    const chief = await createTestUser(org.id, "chief");
    chiefId = chief.id;
    const secondChief = await createTestUser(org.id, "chief");
    const pm = await createTestUser(org.id, "pm");
    const otherChief = await createTestUser(otherOrg.id, "chief");
    pmId = pm.id;
    clientId = (await createTestClient(org.id, { status: "active" })).id;
    otherClientId = (await createTestClient(otherOrg.id, { status: "active" })).id;
    chiefCookies = await loginAs(app, org.slug, chief);
    secondChiefCookies = await loginAs(app, org.slug, secondChief);
    pmCookies = await loginAs(app, org.slug, pm);
    otherChiefCookies = await loginAs(app, otherOrg.slug, otherChief);
  });

  afterAll(async () => {
    if (org) await cleanupTestOrg(org.id);
    if (otherOrg) await cleanupTestOrg(otherOrg.id);
  });

  async function openInvoice(cookies = chiefCookies, addressedClientId = clientId) {
    const created = await request(app).post("/api/platform/invoices").set("Cookie", cookies)
      .send({ clientId: addressedClientId, currency: "USD", lineItems: [{ description: "Stand", quantity: 1, unitPriceCents: total }] });
    expect(created.status).toBe(201);
    const id = created.body.invoice.id as string;
    expect((await request(app).post(`/api/platform/invoices/${id}/send`).set("Cookie", cookies)).status).toBe(200);
    return id;
  }

  function payment(id: string, key: string, payload: Record<string, unknown> = { amountCents: 100_000 }, cookies = chiefCookies) {
    return request(app).post(`/api/platform/invoices/${id}/payments`).set("Cookie", cookies).set("Idempotency-Key", key).send(payload);
  }

  async function rows<T>(statement: ReturnType<typeof sql>) {
    return (await db.execute(statement) as unknown as { rows: T[] }).rows;
  }

  it("records concurrent identical submissions once and replays identical responses", async () => {
    const id = await openInvoice();
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 6 }, () => payment(id, key)));
    expect(responses.map((response) => response.status)).toEqual(Array(6).fill(201));
    for (const response of responses) expect(response.body).toEqual(responses[0].body);
    const history = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies);
    expect(history.body.payments).toHaveLength(1);
    expect(responses[0].body.invoice.amountPaidCents).toBe(100_000);
    const events = await rows<{ n: number }>(sql`select count(*)::int as n from activity_events
      where organization_id = ${org.id}::uuid and event_type = 'invoice_payment_recorded'
        and message = ${`recorded 100000 cents against invoice ${responses[0].body.invoice.invoiceNumber}`}`);
    expect(events[0].n).toBe(1);
    expect((await rows<{ n: number }>(sql`select count(*)::int as n from invoice_payment_requests where invoice_id = ${id}::uuid`))[0].n).toBe(1);
  });

  it("replays the original snapshot after a later payment settles the invoice", async () => {
    const id = await openInvoice();
    const key = randomUUID();
    const first = await payment(id, key);
    const settled = await payment(id, randomUUID(), { amountCents: 900_000 });
    expect(settled.body.invoice.status).toBe("paid");
    const replay = await payment(id, key);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
    expect((await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", chiefCookies)).body.invoice.amountPaidCents).toBe(total);
  });

  it("normalizes default fields and UUID casing for replay", async () => {
    const id = await openInvoice();
    const key = randomUUID();
    const first = await payment(id, key);
    const replay = await payment(id.toUpperCase(), key, { note: "", reference: null, method: "manual", amountCents: 100_000 });
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
  });

  it("prevents stale-account retries from creating another actor's payment", async () => {
    const id = await openInvoice();
    const key = randomUUID();
    const first = await payment(id, key).set("X-Payment-Actor-Id", chiefId).set("X-Payment-Organization", org.slug);
    expect(first.status).toBe(201);
    const switched = await payment(id, key, { amountCents: 100_000 }, secondChiefCookies)
      .set("X-Payment-Actor-Id", chiefId).set("X-Payment-Organization", org.slug);
    expect(switched.status).toBe(409);
    expect(switched.body.error.code).toBe("payment_account_changed");
    const wrongOrganization = await request(app).post(`/api/platform/invoices/${id}/mark-paid`).set("Cookie", chiefCookies)
      .set("Idempotency-Key", randomUUID()).set("X-Payment-Actor-Id", chiefId).set("X-Payment-Organization", otherOrg.slug);
    expect(wrongOrganization.status).toBe(409);
    expect(wrongOrganization.body.error.code).toBe("payment_account_changed");
    const recovered = await payment(id, key).set("X-Payment-Actor-Id", chiefId).set("X-Payment-Organization", org.slug);
    expect(recovered.status).toBe(201);
    expect(recovered.body).toEqual(first.body);
    expect((await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies)).body.payments).toHaveLength(1);
  });

  it("replays a full payment after the invoice becomes paid", async () => {
    const id = await openInvoice();
    const key = randomUUID();
    const first = await payment(id, key, { amountCents: total });
    const replay = await payment(id, key, { amountCents: total });
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
    expect(replay.body.payments).toHaveLength(1);
  });

  it("replays concurrent mark-paid requests without another settlement audit event", async () => {
    const id = await openInvoice();
    await payment(id, randomUUID());
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(app)
      .post(`/api/platform/invoices/${id}/mark-paid`).set("Cookie", chiefCookies).set("Idempotency-Key", key)
      .send({ expectedAmountCents: 900_000 })));
    expect(responses.map((response) => response.status)).toEqual(Array(6).fill(200));
    for (const response of responses) expect(response.body).toEqual(responses[0].body);
    const history = await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies);
    expect(history.body.payments.map((entry: { amountCents: number }) => entry.amountCents)).toEqual([100_000, 900_000]);
    const events = await rows<{ n: number }>(sql`select count(*)::int as n from activity_events
      where organization_id = ${org.id}::uuid and event_type = 'invoice_paid'
        and message = ${`recorded payment for invoice ${responses[0].body.invoice.invoiceNumber}`}`);
    expect(events[0].n).toBe(1);
  });

  it("rejects changes to amount, method, reference, note, operation, or invoice", async () => {
    const id = await openInvoice();
    const secondId = await openInvoice();
    const key = randomUUID();
    const payload = { amountCents: 100_000, method: "bank_transfer", reference: "DEP-1", note: "Deposit" };
    expect((await payment(id, key, payload)).status).toBe(201);
    for (const change of [{ amountCents: 200_000 }, { method: "cash" }, { reference: "DEP-2" }, { note: "Different deposit" }]) {
      const conflict = await payment(id, key, { ...payload, ...change });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe("idempotency_conflict");
    }
    const changedOperation = await request(app).post(`/api/platform/invoices/${id}/mark-paid`)
      .set("Cookie", chiefCookies).set("Idempotency-Key", key);
    expect(changedOperation.status).toBe(409);
    expect(changedOperation.body.error.code).toBe("idempotency_conflict");
    const changedInvoice = await payment(secondId, key, payload);
    expect(changedInvoice.status).toBe(409);
    expect(changedInvoice.body.error.code).toBe("idempotency_conflict");
    expect((await rows<{ n: number }>(sql`select count(*)::int as n from invoice_payments where invoice_id in (${id}::uuid, ${secondId}::uuid)`))[0].n).toBe(1);
  });

  it("serializes concurrent key reuse across different invoices", async () => {
    const firstId = await openInvoice();
    const secondId = await openInvoice();
    const key = randomUUID();
    const responses = await Promise.all([payment(firstId, key), payment(secondId, key)]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error.code).toBe("idempotency_conflict");
    expect((await rows<{ n: number }>(sql`select count(*)::int as n from invoice_payments where invoice_id in (${firstId}::uuid, ${secondId}::uuid)`))[0].n).toBe(1);
  });

  it("allows distinct keys for equal deposits with the same bank reference", async () => {
    const id = await openInvoice();
    const payload = { amountCents: 100_000, method: "bank_transfer", reference: "Standing order" };
    expect((await payment(id, randomUUID(), payload)).status).toBe(201);
    const second = await payment(id, randomUUID(), payload);
    expect(second.status).toBe(201);
    expect(second.body.payments).toHaveLength(2);
    expect(second.body.invoice.amountPaidCents).toBe(200_000);
  });

  it("scopes keys to actor and organization without exposing another tenant", async () => {
    const id = await openInvoice();
    const otherId = await openInvoice(otherChiefCookies, otherClientId);
    const key = randomUUID();
    expect((await payment(id, key)).status).toBe(201);
    const anotherActor = await payment(id, key, { amountCents: 100_000 }, secondChiefCookies);
    expect(anotherActor.status).toBe(201);
    expect(anotherActor.body.invoice.amountPaidCents).toBe(200_000);
    const anotherTenant = await payment(otherId, key, { amountCents: 100_000 }, otherChiefCookies);
    expect(anotherTenant.status).toBe(201);
    expect(anotherTenant.body.invoice.id).toBe(otherId);
    expect((await payment(id, key, { amountCents: 100_000 }, otherChiefCookies)).status).toBe(404);
  });

  it("rechecks PM invoice access before replaying a saved payment", async () => {
    const assignedClient = await createTestClient(org.id, { status: "active", assignedPmUserId: pmId });
    const id = await openInvoice(chiefCookies, assignedClient.id);
    const key = randomUUID();
    expect((await payment(id, key, { amountCents: 100_000 }, pmCookies)).status).toBe(201);
    expect((await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", pmCookies)).status).toBe(200);
    await db.execute(sql`update clients set assigned_pm_user_id = null where id = ${assignedClient.id}::uuid`);
    expect((await payment(id, key, { amountCents: 100_000 }, pmCookies)).status).toBe(404);
    expect((await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", pmCookies)).status).toBe(404);
    expect((await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", pmCookies)).status).toBe(404);
  });

  it("validates request keys without writing a payment", async () => {
    const id = await openInvoice();
    for (const key of ["", "short", "!bad_key", "a".repeat(129), "key/key01", "test-key,second-key"]) {
      const result = await payment(id, key);
      expect(result.status).toBe(400);
      expect(result.body.error.code).toBe("invalid_idempotency_key");
    }
    const valid = await payment(id, "a".repeat(128));
    expect(valid.status).toBe(201);
    expect(valid.body.payments).toHaveLength(1);
  });

  it("rejects a changed full-balance confirmation without consuming its key", async () => {
    const id = await openInvoice();
    const key = randomUUID();
    await payment(id, randomUUID());
    const stale = await request(app).post(`/api/platform/invoices/${id}/mark-paid`)
      .set("Cookie", chiefCookies).set("Idempotency-Key", key).send({ expectedAmountCents: total });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("balance_changed");
    expect((await rows<{ n: number }>(sql`select count(*)::int as n from invoice_payment_requests where invoice_id = ${id}::uuid and request_key = ${key}`))[0].n).toBe(0);
    const reviewed = await request(app).post(`/api/platform/invoices/${id}/mark-paid`)
      .set("Cookie", chiefCookies).set("Idempotency-Key", key).send({ expectedAmountCents: 900_000 });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.invoice.amountPaidCents).toBe(total);
  });

  it("rejects invalid expected balances before settlement", async () => {
    const id = await openInvoice();
    for (const expectedAmountCents of [-1, 0.5, "100", true, 2_147_483_648]) {
      const result = await request(app).post(`/api/platform/invoices/${id}/mark-paid`).set("Cookie", chiefCookies)
        .set("Idempotency-Key", randomUUID()).send({ expectedAmountCents });
      expect(result.status).toBe(400);
    }
    expect((await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", chiefCookies)).body.invoice.amountPaidCents).toBe(0);
  });

  it("settles and replays a zero-total invoice without inventing a receipt", async () => {
    const created = await request(app).post("/api/platform/invoices").set("Cookie", chiefCookies)
      .send({ clientId, currency: "USD", lineItems: [{ description: "Complimentary stand", quantity: 1, unitPriceCents: 0 }] });
    expect(created.status).toBe(201);
    const id = created.body.invoice.id as string;
    expect((await request(app).post(`/api/platform/invoices/${id}/send`).set("Cookie", chiefCookies)).status).toBe(200);
    const key = randomUUID();
    const settle = () => request(app).post(`/api/platform/invoices/${id}/mark-paid`).set("Cookie", chiefCookies)
      .set("Idempotency-Key", key).send({ expectedAmountCents: 0 });
    const first = await settle();
    expect(first.status).toBe(200);
    expect(first.body.invoice.status).toBe("paid");
    expect(first.body.invoice.amountPaidCents).toBe(0);
    const replay = await settle();
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect((await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies)).body.payments).toHaveLength(0);
  });

  it("rejects a changed expected balance on a previously successful settlement key", async () => {
    const id = await openInvoice();
    const key = randomUUID();
    const settle = (expectedAmountCents: number) => request(app).post(`/api/platform/invoices/${id}/mark-paid`)
      .set("Cookie", chiefCookies).set("Idempotency-Key", key).send({ expectedAmountCents });
    expect((await settle(total)).status).toBe(200);
    const changed = await settle(900_000);
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe("idempotency_conflict");
  });

  it.each(["activity_events", "invoice_payment_requests"])("rolls back all financial changes if %s cannot be written, then retries the same key", async (table) => {
    const id = await openInvoice();
    const key = randomUUID();
    const name = sql.identifier(`payment_failure_${randomUUID().replaceAll("-", "")}`);
    const target = sql.identifier(table);
    await db.execute(sql`create function ${name}() returns trigger language plpgsql as 'begin raise exception ''Simulated financial write failure''; end'`);
    try {
      await db.execute(sql`create trigger ${name} before insert on ${target}
        for each row when (new.organization_id = ${sql.raw(`'${org.id}'::uuid`)}) execute function ${name}()`);
      try {
        expect((await payment(id, key)).status).toBe(500);
        const detail = await request(app).get(`/api/platform/invoices/${id}`).set("Cookie", chiefCookies);
        expect(detail.body.invoice.amountPaidCents).toBe(0);
        expect((await request(app).get(`/api/platform/invoices/${id}/payments`).set("Cookie", chiefCookies)).body.payments).toHaveLength(0);
        expect((await rows<{ n: number }>(sql`select count(*)::int as n from invoice_payment_requests where invoice_id = ${id}::uuid`))[0].n).toBe(0);
        expect((await rows<{ n: number }>(sql`select count(*)::int as n from activity_events
          where organization_id = ${org.id}::uuid and event_type = 'invoice_payment_recorded'
            and message = ${`recorded 100000 cents against invoice ${detail.body.invoice.invoiceNumber}`}`))[0].n).toBe(0);
      } finally {
        await db.execute(sql`drop trigger ${name} on ${target}`);
      }
    } finally {
      await db.execute(sql`drop function ${name}()`);
    }
    const retry = await payment(id, key);
    expect(retry.status).toBe(201);
    expect(retry.body.payments).toHaveLength(1);
  });
});
