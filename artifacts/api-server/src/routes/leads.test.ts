import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { createTestOrg, cleanupTestOrg, type TestOrg } from "../test/helpers";
import {
  describeLeadIntakeFailure,
  isFatalLeadIntakeFailure,
  resolveLeadIntakeOrganization,
} from "../lib/lead-intake";

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

  /**
   * The blind spot this suite used to have.
   *
   * `beforeAll` points DEFAULT_ORGANIZATION_SLUG at an organization it has just
   * created, so every test above passes *because the suite supplies the thing a
   * real deployment was missing*. Production had the variable set to a slug no
   * organization owned, and this file stayed green while every website lead was
   * answered 503 and thrown away.
   *
   * These two restore the real failure mode and assert it is loud: the startup
   * assertion rejects, so a misconfigured deployment cannot begin serving.
   */
  describe("when the configured organization does not exist", () => {
    const bogus = "no-such-organization-slug";
    let restore: string | undefined;

    beforeAll(() => {
      restore = process.env.DEFAULT_ORGANIZATION_SLUG;
      process.env.DEFAULT_ORGANIZATION_SLUG = bogus;
    });
    afterAll(() => {
      process.env.DEFAULT_ORGANIZATION_SLUG = restore;
    });

    it("refuses to start rather than accepting leads it cannot file", async () => {
      const result = await resolveLeadIntakeOrganization();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("unknown-organization");
      // Fatal in every profile: the database has organizations, none is this one.
      expect(isFatalLeadIntakeFailure(result.reason, "production")).toBe(true);
      expect(isFatalLeadIntakeFailure(result.reason, "development")).toBe(true);
      expect(describeLeadIntakeFailure(result)).toMatch(/no organization has that slug/i);
    });

    it("drops nothing quietly: a submission is refused and no client row appears", async () => {
      const before = await queryRows<{ n: string }>(
        sql`select count(*)::text as n from clients where contact_email = ${"stranded-lead@example.test"}`,
      );
      const res = await request(app).post("/api/leads").send({ ...validLead, contactEmail: "stranded-lead@example.test" });
      expect(res.status).toBe(503);
      const after = await queryRows<{ n: string }>(
        sql`select count(*)::text as n from clients where contact_email = ${"stranded-lead@example.test"}`,
      );
      expect(after[0].n).toBe(before[0].n);
    });
  });

  describe("when the slug is not configured at all", () => {
    let restore: string | undefined;

    beforeAll(() => {
      restore = process.env.DEFAULT_ORGANIZATION_SLUG;
      delete process.env.DEFAULT_ORGANIZATION_SLUG;
    });
    afterAll(() => {
      process.env.DEFAULT_ORGANIZATION_SLUG = restore;
    });

    it("refuses to start in a real deployment and says which variable is missing", async () => {
      const result = await resolveLeadIntakeOrganization();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("unset");
      expect(isFatalLeadIntakeFailure(result.reason, "production")).toBe(true);
      expect(isFatalLeadIntakeFailure(result.reason, "staging")).toBe(true);
      // Tolerated where the variable is routinely absent.
      expect(isFatalLeadIntakeFailure(result.reason, "test")).toBe(false);
      expect(describeLeadIntakeFailure(result)).toMatch(/is not set/i);
    });
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
