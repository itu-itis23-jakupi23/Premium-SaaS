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

describe("CRM lead pipeline", () => {
  let org: TestOrg;
  let chief: TestUser;
  let clientUser: TestUser;
  let leadId: string;
  let chiefCookies: string[];
  let clientCookies: string[];

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    clientUser = await createTestUser(org.id, "client");
    // A lead sitting at the top of the funnel.
    const lead = await createTestClient(org.id, { status: "lead" });
    leadId = lead.id;
    await db.execute(sql`update clients set lead_stage = 'new', lead_stage_changed_at = now() where id = ${leadId}::uuid`);
    chiefCookies = await loginAs(app, org.slug, chief);
    clientCookies = await loginAs(app, org.slug, clientUser);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("returns the pipeline board grouped by stage with the lead in 'new'", async () => {
    const res = await request(app).get("/api/platform/pipeline").set("Cookie", chiefCookies);
    expect(res.status).toBe(200);
    expect(res.body.stages).toContain("qualified");
    expect(res.body.columns.new.count).toBeGreaterThanOrEqual(1);
    expect(res.body.columns.new.leads.some((l: { id: string }) => l.id === leadId)).toBe(true);
  });

  it("forbids a client from viewing the pipeline", async () => {
    const res = await request(app).get("/api/platform/pipeline").set("Cookie", clientCookies);
    expect(res.status).toBe(403);
  });

  it("updates deal value and follow-up date", async () => {
    const res = await request(app)
      .patch(`/api/platform/leads/${leadId}`)
      .set("Cookie", chiefCookies)
      .send({ leadValueCents: 4_500_000, nextFollowUpAt: "2026-09-01T10:00:00.000Z" });
    expect(res.status).toBe(200);
    expect(res.body.lead.leadValueCents).toBe(4_500_000);
    expect(res.body.lead.nextFollowUpAt).toBeTruthy();
  });

  it("moves the lead through stages", async () => {
    const res = await request(app)
      .patch(`/api/platform/leads/${leadId}/stage`)
      .set("Cookie", chiefCookies)
      .send({ stage: "qualified" });
    expect(res.status).toBe(200);
    expect(res.body.lead.leadStage).toBe("qualified");
  });

  it("rejects an unknown stage", async () => {
    const res = await request(app)
      .patch(`/api/platform/leads/${leadId}/stage`)
      .set("Cookie", chiefCookies)
      .send({ stage: "nonsense" });
    expect(res.status).toBe(400);
  });

  it("winning a lead promotes it to pending_approval and out of the board", async () => {
    const res = await request(app)
      .patch(`/api/platform/leads/${leadId}/stage`)
      .set("Cookie", chiefCookies)
      .send({ stage: "won" });
    expect(res.status).toBe(200);
    expect(res.body.lead.leadStage).toBe("won");
    expect(res.body.lead.status).toBe("pending_approval");

    // A won lead is no longer status='lead', so it drops off the pipeline board.
    const board = await request(app).get("/api/platform/pipeline").set("Cookie", chiefCookies);
    expect(board.body.columns.won.leads.some((l: { id: string }) => l.id === leadId)).toBe(false);
  });

  it("does not act on a client that is no longer a lead", async () => {
    const res = await request(app)
      .patch(`/api/platform/leads/${leadId}/stage`)
      .set("Cookie", chiefCookies)
      .send({ stage: "contacted" });
    expect(res.status).toBe(404);
  });
});
