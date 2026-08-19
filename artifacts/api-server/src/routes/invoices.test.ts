import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
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

describe("invoices workflow", () => {
  let org: TestOrg;
  let chief: TestUser;
  let clientUser: TestUser;
  let clientId: string;
  let chiefCookies: string[];
  let clientCookies: string[];

  const lineItems = [
    { description: "Booth build (6x3m)", sku: "OCT", quantity: 1, unitPriceCents: 1_850_000, kind: "structure" },
    { description: "Counter", quantity: 2, unitPriceCents: 120_000, kind: "furniture" },
  ];
  // subtotal = 1_850_000 + 240_000 = 2_090_000

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    clientUser = await createTestUser(org.id, "client");
    const client = await createTestClient(org.id, { contactEmail: clientUser.email, status: "active" });
    clientId = client.id;
    chiefCookies = await loginAs(app, org.slug, chief);
    clientCookies = await loginAs(app, org.slug, clientUser);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  let invoiceId: string;

  it("lets staff create an invoice with server-recomputed totals and a generated number", async () => {
    const res = await request(app)
      .post("/api/platform/invoices")
      .set("Cookie", chiefCookies)
      .send({ clientId, title: "Deposit", currency: "USD", discountCents: 90_000, taxCents: 100_000, lineItems });
    expect(res.status).toBe(201);
    const inv = res.body.invoice;
    expect(inv.status).toBe("draft");
    expect(inv.subtotalCents).toBe(2_090_000);
    expect(inv.totalCents).toBe(2_090_000 - 90_000 + 100_000);
    expect(inv.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    invoiceId = inv.id;
  });

  it("rejects an invoice with no line items", async () => {
    const res = await request(app).post("/api/platform/invoices").set("Cookie", chiefCookies).send({ clientId, lineItems: [] });
    expect(res.status).toBe(400);
  });

  it("forbids a client from creating an invoice", async () => {
    const res = await request(app).post("/api/platform/invoices").set("Cookie", clientCookies).send({ clientId, lineItems });
    expect(res.status).toBe(403);
  });

  it("does not show draft invoices to the client", async () => {
    const res = await request(app).get("/api/platform/invoices").set("Cookie", clientCookies);
    expect(res.status).toBe(200);
    expect(res.body.invoices.some((i: { id: string }) => i.id === invoiceId)).toBe(false);
  });

  it("issues the invoice (draft → open) and sets a due date", async () => {
    const res = await request(app).post(`/api/platform/invoices/${invoiceId}/send`).set("Cookie", chiefCookies);
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe("open");
    expect(res.body.invoice.dueAt).toBeTruthy();
    expect(res.body.invoice.issuedAt).toBeTruthy();
  });

  it("shows the issued invoice to the client", async () => {
    const list = await request(app).get("/api/platform/invoices").set("Cookie", clientCookies);
    expect(list.body.invoices.some((i: { id: string }) => i.id === invoiceId)).toBe(true);
    const get = await request(app).get(`/api/platform/invoices/${invoiceId}`).set("Cookie", clientCookies);
    expect(get.status).toBe(200);
  });

  it("cannot issue an already-issued invoice", async () => {
    const res = await request(app).post(`/api/platform/invoices/${invoiceId}/send`).set("Cookie", chiefCookies);
    expect(res.status).toBe(409);
  });

  it("forbids a client from recording payment", async () => {
    const res = await request(app).post(`/api/platform/invoices/${invoiceId}/mark-paid`).set("Cookie", clientCookies);
    expect(res.status).toBe(403);
  });

  it("records payment (open → paid)", async () => {
    const res = await request(app).post(`/api/platform/invoices/${invoiceId}/mark-paid`).set("Cookie", chiefCookies);
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe("paid");
    expect(res.body.invoice.amountPaidCents).toBe(res.body.invoice.totalCents);
    expect(res.body.invoice.paidAt).toBeTruthy();
  });

  it("cannot void a paid invoice", async () => {
    const res = await request(app).post(`/api/platform/invoices/${invoiceId}/void`).set("Cookie", chiefCookies);
    expect(res.status).toBe(409);
  });

  it("only allows deleting drafts", async () => {
    const delPaid = await request(app).delete(`/api/platform/invoices/${invoiceId}`).set("Cookie", chiefCookies);
    expect(delPaid.status).toBe(409);
    const draft = await request(app).post("/api/platform/invoices").set("Cookie", chiefCookies).send({ clientId, lineItems });
    const delDraft = await request(app).delete(`/api/platform/invoices/${draft.body.invoice.id}`).set("Cookie", chiefCookies);
    expect(delDraft.status).toBe(204);
  });

  it("creates an invoice from an existing quote, copying its line items and totals", async () => {
    const quote = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({ clientId, title: "Full booth", currency: "USD", discountCents: 10_000, taxCents: 20_000, lineItems });
    expect(quote.status).toBe(201);
    const res = await request(app)
      .post("/api/platform/invoices")
      .set("Cookie", chiefCookies)
      .send({ quoteId: quote.body.quote.id });
    expect(res.status).toBe(201);
    expect(res.body.invoice.quoteId).toBe(quote.body.quote.id);
    expect(res.body.invoice.subtotalCents).toBe(2_090_000);
    expect(res.body.invoice.totalCents).toBe(quote.body.quote.totalCents);
  });
});
