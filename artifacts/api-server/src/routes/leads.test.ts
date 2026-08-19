import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { createTestOrg, cleanupTestOrg, type TestOrg } from "../test/helpers";

async function queryRows<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

describe("POST /api/leads (public lead intake)", () => {
  let org: TestOrg;
  let previousSlug: string | undefined;

  beforeAll(async () => {
    org = await createTestOrg();
    previousSlug = process.env.DEFAULT_ORGANIZATION_SLUG;
    process.env.DEFAULT_ORGANIZATION_SLUG = org.slug;
  });

  afterAll(async () => {
    process.env.DEFAULT_ORGANIZATION_SLUG = previousSlug;
    await cleanupTestOrg(org.id);
  });

  const email = "lead-intake@example.test";
  const validLead = {
    companyName: "Globex Expo",
    contactName: "Jane Doe",
    contactEmail: email,
    exhibitionName: "CES 2027",
    boothSize: "6x3 m",
    budget: "$40k",
    timeline: "Q1 2027",
    message: "Two-storey booth with a demo bar.",
  };

  it("creates a lead client from a valid submission", async () => {
    const res = await request(app).post("/api/leads").send(validLead);
    expect(res.status).toBe(201);
    const rows = await queryRows<{ status: string; exhibition: string | null }>(sql`
      select status, metadata->'leadIntake'->>'exhibitionName' as exhibition
      from clients
      where organization_id = ${org.id}::uuid and lower(contact_email) = ${email}
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("lead");
    expect(rows[0].exhibition).toBe("CES 2027");
  });

  it("de-duplicates repeat submissions by email (updates, never duplicates)", async () => {
    const res = await request(app)
      .post("/api/leads")
      .send({ ...validLead, message: "Updated: add hospitality lounge." });
    expect(res.status).toBe(201);
    const rows = await queryRows<{ count: string }>(sql`
      select count(*)::text as count
      from clients
      where organization_id = ${org.id}::uuid and lower(contact_email) = ${email}
    `);
    expect(rows[0].count).toBe("1");
  });

  it("rejects a submission missing required fields", async () => {
    const res = await request(app).post("/api/leads").send({ companyName: "X" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app)
      .post("/api/leads")
      .send({ companyName: "X", contactName: "Y", contactEmail: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("rate limits a flood of submissions from one client", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app)
        .post("/api/leads")
        .send({ companyName: `Flood ${i}`, contactName: "Z", contactEmail: `flood${i}@example.test` });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
