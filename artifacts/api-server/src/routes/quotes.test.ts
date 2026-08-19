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

describe("quotes workflow", () => {
  let org: TestOrg;
  let chief: TestUser;
  let clientUser: TestUser;
  let clientId: string;
  let chiefCookies: string[];
  let clientCookies: string[];

  const lineItems = [
    { description: "Octanorm frame (6x3m)", sku: "OCT", quantity: 1, unitPriceCents: 1_850_000, kind: "structure" },
    { description: "Counter", quantity: 2, unitPriceCents: 120_000, kind: "furniture" },
    { description: "Spotlight", quantity: 8, unitPriceCents: 9_000, kind: "lighting" },
  ];
  // subtotal = 1_850_000 + 240_000 + 72_000 = 2_162_000

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

  let quoteId: string;

  it("lets staff create a quote with server-recomputed totals and a generated number", async () => {
    const res = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({ clientId, title: "CES 2027 Booth", currency: "USD", discountCents: 50_000, taxCents: 100_000, lineItems });
    expect(res.status).toBe(201);
    const q = res.body.quote;
    expect(q.status).toBe("draft");
    expect(q.subtotalCents).toBe(2_162_000);
    expect(q.totalCents).toBe(2_162_000 - 50_000 + 100_000);
    expect(q.quoteNumber).toMatch(/^Q-\d{4}-\d{4}$/);
    quoteId = q.id;
  });

  it("ignores client-supplied totals (recomputes from line items)", async () => {
    const res = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({ clientId, lineItems: [{ description: "x", quantity: 3, unitPriceCents: 1000, totalCents: 999999 }] });
    expect(res.status).toBe(201);
    expect(res.body.quote.subtotalCents).toBe(3000);
  });

  it("rejects a quote with no line items", async () => {
    const res = await request(app).post("/api/platform/quotes").set("Cookie", chiefCookies).send({ clientId, lineItems: [] });
    expect(res.status).toBe(400);
  });

  it("forbids a client from creating a quote", async () => {
    const res = await request(app).post("/api/platform/quotes").set("Cookie", clientCookies).send({ clientId, lineItems });
    expect(res.status).toBe(403);
  });

  it("does not show draft quotes to the client", async () => {
    const res = await request(app).get("/api/platform/quotes").set("Cookie", clientCookies);
    expect(res.status).toBe(200);
    expect(res.body.quotes.some((q: { id: string }) => q.id === quoteId)).toBe(false);
  });

  it("sends the quote to the client", async () => {
    const res = await request(app).post(`/api/platform/quotes/${quoteId}/send`).set("Cookie", chiefCookies);
    expect(res.status).toBe(200);
    expect(res.body.quote.status).toBe("sent");
  });

  it("shows the sent quote to the client and flips it to viewed on open", async () => {
    const list = await request(app).get("/api/platform/quotes").set("Cookie", clientCookies);
    expect(list.body.quotes.some((q: { id: string }) => q.id === quoteId)).toBe(true);
    const get = await request(app).get(`/api/platform/quotes/${quoteId}`).set("Cookie", clientCookies);
    expect(get.status).toBe(200);
    expect(get.body.quote.status).toBe("viewed");
  });

  it("forbids staff from responding to a quote", async () => {
    const res = await request(app)
      .post(`/api/platform/quotes/${quoteId}/respond`)
      .set("Cookie", chiefCookies)
      .send({ decision: "accept" });
    expect(res.status).toBe(403);
  });

  it("lets the client accept the quote", async () => {
    const res = await request(app)
      .post(`/api/platform/quotes/${quoteId}/respond`)
      .set("Cookie", clientCookies)
      .send({ decision: "accept", note: "Approved." });
    expect(res.status).toBe(200);
    expect(res.body.quote.status).toBe("accepted");
  });

  it("cannot respond to a quote twice", async () => {
    const res = await request(app)
      .post(`/api/platform/quotes/${quoteId}/respond`)
      .set("Cookie", clientCookies)
      .send({ decision: "reject" });
    expect(res.status).toBe(409);
  });

  it("only allows editing and deleting drafts", async () => {
    // The sent/accepted quote cannot be edited or deleted.
    const edit = await request(app).put(`/api/platform/quotes/${quoteId}`).set("Cookie", chiefCookies).send({ lineItems });
    expect(edit.status).toBe(409);
    const del = await request(app).delete(`/api/platform/quotes/${quoteId}`).set("Cookie", chiefCookies);
    expect(del.status).toBe(409);

    // A fresh draft can be edited then deleted.
    const draft = await request(app).post("/api/platform/quotes").set("Cookie", chiefCookies).send({ clientId, lineItems });
    const draftId = draft.body.quote.id;
    const editDraft = await request(app)
      .put(`/api/platform/quotes/${draftId}`)
      .set("Cookie", chiefCookies)
      .send({ title: "Revised", lineItems });
    expect(editDraft.status).toBe(200);
    expect(editDraft.body.quote.title).toBe("Revised");
    const delDraft = await request(app).delete(`/api/platform/quotes/${draftId}`).set("Cookie", chiefCookies);
    expect(delDraft.status).toBe(204);
  });
});
