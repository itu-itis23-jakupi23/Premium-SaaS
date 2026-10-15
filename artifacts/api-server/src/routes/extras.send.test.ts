import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import {
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
  createTestProject,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestUser,
} from "../test/helpers";

/**
 * Sending a show's furniture lists to the people who sign off what leaves.
 *
 * "Send it to the chief" was first built as "let the chief open the page",
 * which is not the same thing - the person who has to act on a loading list
 * does not know it is ready until somebody tells them.
 *
 * The thing worth guarding is who receives it. The recipient query picks
 * chiefs, owners and admins, and it is scoped to the sender's organization; a
 * chief at another agency appearing in that list would be one company's show
 * schedule delivered to another's inbox.
 */
describe("POST /api/platform/extras/send-to-chief", () => {
  const SHOW = "Send Fixture Expo";
  let org: TestOrg;
  let otherOrg: TestOrg;
  let pm: TestUser;
  let chief: TestUser;
  let foreignChief: TestUser;
  let cookies: string[];

  beforeAll(async () => {
    org = await createTestOrg();
    otherOrg = await createTestOrg();
    pm = await createTestUser(org.id, "pm");
    chief = await createTestUser(org.id, "chief");
    foreignChief = await createTestUser(otherOrg.id, "chief");
    cookies = await loginAs(app, org.slug, pm);

    const client = await createTestClient(org.id, { status: "active" });
    const project = await createTestProject(org.id, client.id, { status: "planning" });
    await db.execute(sql`
      update projects set exhibition_name = ${SHOW}, exhibition_id = null
      where id = ${project.id}::uuid
    `);
    await db.execute(sql`
      insert into booth_designs (organization_id, project_id, name, booth_system, width_mm, depth_mm, height_mm)
      values (${org.id}::uuid, ${project.id}::uuid, 'Stand', 'octanorm', 6000, 3000, 2500)
      on conflict do nothing
    `);
    const design = await db.execute(sql`
      select id::text as id from booth_designs where project_id = ${project.id}::uuid limit 1
    `);
    const designId = (design as unknown as { rows: Array<{ id: string }> }).rows[0].id;
    await db.execute(sql`
      insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json, asset_summary, cost_estimate_cents)
      values (${org.id}::uuid, ${designId}::uuid, ${project.id}::uuid, 1, 'draft', 'v1',
        ${JSON.stringify({ placedItems: [
          { sku: "309", name: "LEATHER CHAIR", qty: 2, kind: "furniture" },
          { sku: "103", name: "WOODEN ROUND TABLE", qty: 1, kind: "furniture" },
        ] })}::jsonb, '{}'::jsonb, 0)
    `);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
    await cleanupTestOrg(otherOrg.id);
  });

  const notificationsFor = async (userId: string) => {
    const rows = await db.execute<{ title: string; body: string; href: string | null }>(sql`
      select title, body, href from notifications where user_id = ${userId}::uuid
    `);
    return (rows as unknown as { rows: Array<{ title: string; body: string; href: string | null }> }).rows;
  };

  it("notifies the organization's chief and nobody else's", async () => {
    const response = await request(app)
      .post("/api/platform/extras/send-to-chief")
      .set("Cookie", cookies)
      .send({ show: SHOW });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.notified).toBeGreaterThanOrEqual(1);
    // Three pieces across one stand, two distinct catalogue items.
    expect(response.body.totals).toEqual({ booths: 1, items: 3, itemTypes: 2 });

    const mine = await notificationsFor(chief.id);
    expect(mine.length).toBe(1);
    expect(mine[0].title).toContain(SHOW);
    expect(mine[0].href).toBe("/chief/extras");

    // The one that matters: a chief at another agency is not a recipient.
    expect(await notificationsFor(foreignChief.id)).toEqual([]);
  });

  it("reports email separately rather than claiming it was delivered", async () => {
    // RESEND_API_KEY is unset in test, so `send` reports "skipped". The count
    // must reflect that: a page that says "emailed" when nothing left the
    // server is how a chief misses a show.
    const response = await request(app)
      .post("/api/platform/extras/send-to-chief")
      .set("Cookie", cookies)
      .send({ show: SHOW });

    expect(response.status).toBe(200);
    expect(response.body.emailed).toBe(0);
    expect(response.body.notified).toBeGreaterThanOrEqual(1);
  });

  it("refuses a show with no stands rather than sending an empty list", async () => {
    const response = await request(app)
      .post("/api/platform/extras/send-to-chief")
      .set("Cookie", cookies)
      .send({ show: "A Show That Does Not Exist" });

    expect(response.status).toBe(404);
  });

  it("requires a show name", async () => {
    const response = await request(app)
      .post("/api/platform/extras/send-to-chief")
      .set("Cookie", cookies)
      .send({});

    expect(response.status).toBe(400);
  });

  it("is staff only", async () => {
    const clientUser = await createTestUser(org.id, "client");
    const clientCookies = await loginAs(app, org.slug, clientUser);
    const response = await request(app)
      .post("/api/platform/extras/send-to-chief")
      .set("Cookie", clientCookies)
      .send({ show: SHOW });

    expect(response.status).toBe(403);
  });
});
