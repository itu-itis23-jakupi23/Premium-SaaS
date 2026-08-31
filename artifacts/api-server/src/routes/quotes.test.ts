import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import {
  createTestOrg,
  cleanupTestOrg,
  createTestUser,
  createTestClient,
  createTestProject,
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

  it("bills a project in the money that project is budgeted in", async () => {
    // Quotes defaulted to USD while projects default to EUR, so a quote raised
    // against a euro project came out in dollars from the defaults alone - and
    // the chief's revenue report adds those totals straight together.
    const project = await createTestProject(org.id, clientId);
    const res = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({ projectId: project.id, lineItems });
    expect(res.status).toBe(201);
    expect(res.body.quote.currency).toBe("EUR");
  });

  it("still honours a currency the caller asks for", async () => {
    const project = await createTestProject(org.id, clientId);
    const res = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({ projectId: project.id, currency: "gbp", lineItems });
    expect(res.status).toBe(201);
    expect(res.body.quote.currency).toBe("GBP");
  });

  it("will not attach a quote to another organisation's project", async () => {
    // The project lookup used to be skipped whenever a clientId was supplied
    // too, so the id went into the row unchecked and the quote was pinned to a
    // project in a different tenant.
    const otherOrg = await createTestOrg();
    try {
      const otherClient = await createTestClient(otherOrg.id, { status: "active" });
      const otherProject = await createTestProject(otherOrg.id, otherClient.id);

      const res = await request(app)
        .post("/api/platform/quotes")
        .set("Cookie", chiefCookies)
        .send({ clientId, projectId: otherProject.id, lineItems });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("invalid_project");
    } finally {
      await cleanupTestOrg(otherOrg.id);
    }
  });

  /** A quote sitting with the client whose valid-until date has already gone. */
  async function staleQuote() {
    const created = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({
        clientId,
        title: "Last season's pricing",
        lineItems,
        validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(created.status).toBe(201);
    const id = created.body.quote.id as string;
    const sent = await request(app).post(`/api/platform/quotes/${id}/send`).set("Cookie", chiefCookies).send({});
    expect(sent.status).toBe(200);
    return id;
  }

  it("will not let a client accept a quote past its valid-until date", async () => {
    const id = await staleQuote();
    const res = await request(app)
      .post(`/api/platform/quotes/${id}/respond`)
      .set("Cookie", clientCookies)
      .send({ decision: "accept" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("quote_expired");
  });

  it("marks the stale quote expired so staff can see why and re-issue it", async () => {
    const id = await staleQuote();
    await request(app)
      .post(`/api/platform/quotes/${id}/respond`)
      .set("Cookie", clientCookies)
      .send({ decision: "accept" });

    const after = await request(app).get(`/api/platform/quotes/${id}`).set("Cookie", chiefCookies);
    expect(after.body.quote.status).toBe("expired");

    // `expired` is one of the states /send re-issues from, which is the whole
    // point of moving it there rather than leaving it stuck in `sent`.
    const reissued = await request(app).post(`/api/platform/quotes/${id}/send`).set("Cookie", chiefCookies).send({});
    expect(reissued.status).toBe(200);
    expect(reissued.body.quote.status).toBe("sent");
  });

  it("still lets a client decline a stale quote without an error", async () => {
    // Saying no to old pricing is harmless, and refusing the decline would
    // leave the quote sitting open forever.
    const id = await staleQuote();
    const res = await request(app)
      .post(`/api/platform/quotes/${id}/respond`)
      .set("Cookie", clientCookies)
      .send({ decision: "reject" });
    expect(res.status).toBe(200);
    expect(res.body.quote.status).toBe("rejected");
  });

  it("accepts a quote that is still inside its valid-until date", async () => {
    const created = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({
        clientId,
        title: "Current pricing",
        lineItems,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    const id = created.body.quote.id as string;
    await request(app).post(`/api/platform/quotes/${id}/send`).set("Cookie", chiefCookies).send({});

    const res = await request(app)
      .post(`/api/platform/quotes/${id}/respond`)
      .set("Cookie", clientCookies)
      .send({ decision: "accept" });
    expect(res.status).toBe(200);
    expect(res.body.quote.status).toBe("accepted");
  });

  it("accepts a quote with no valid-until date at all", async () => {
    // Most quotes carry no expiry. They must stay acceptable indefinitely
    // rather than being caught by a null comparison.
    const created = await request(app)
      .post("/api/platform/quotes")
      .set("Cookie", chiefCookies)
      .send({ clientId, title: "Open-ended", lineItems });
    const id = created.body.quote.id as string;
    await request(app).post(`/api/platform/quotes/${id}/send`).set("Cookie", chiefCookies).send({});

    const res = await request(app)
      .post(`/api/platform/quotes/${id}/respond`)
      .set("Cookie", clientCookies)
      .send({ decision: "accept" });
    expect(res.status).toBe(200);
    expect(res.body.quote.status).toBe("accepted");
  });
});
