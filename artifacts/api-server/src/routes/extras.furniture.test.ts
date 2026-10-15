import { describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { createTestOrg, createTestClient, createTestProject, createTestUser, loginAs } from "../test/helpers";

/**
 * Extras: the furniture loading list for a show.
 *
 * The first version of this feature keyed on `projects.exhibition_id` because
 * that is what the schema implies. In the real database *none* of 49 projects
 * carried that id - 48 recorded their show as a name in `exhibition_name` -
 * so the page listed no shows the owner recognised and found no furniture for
 * the one stand they had drawn.
 *
 * So the fixture here is deliberately the broken shape: a show name on the
 * project and a null exhibition_id. If someone re-keys this on the foreign key
 * again, this test is what says no.
 */
describe("extras: shows and furniture", () => {
  it("finds a show recorded only by name, with its booth furniture", async () => {
    const org = await createTestOrg();
    const chief = await createTestUser(org.id, "chief");
    const cookies = await loginAs(app, org.slug, chief);
    const client = await createTestClient(org.id, { status: "active" });
    const project = await createTestProject(org.id, client.id, { status: "planning" });

    // Exactly the shape the real database is in: a show name on the project,
    // and no exhibition_id at all.
    await db.execute(sql`
      update projects set exhibition_name = 'Beauty Istanbul', exhibition_id = null
      where id = ${project.id}::uuid
    `);
    await db.execute(sql`
      insert into booth_designs (organization_id, project_id, name, booth_system, width_mm, depth_mm, height_mm)
      values (${org.id}::uuid, ${project.id}::uuid, 'Stand', 'octanorm', 6000, 3000, 2500)
      on conflict do nothing
    `);
    const design = await db.execute(sql`select id::text as id from booth_designs where project_id = ${project.id}::uuid limit 1`);
    const designId = (design as unknown as { rows: Array<{ id: string }> }).rows[0].id;
    await db.execute(sql`
      insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json, asset_summary, cost_estimate_cents)
      values (${org.id}::uuid, ${designId}::uuid, ${project.id}::uuid, 1, 'draft', 'v1',
        ${JSON.stringify({ placedItems: [
          { sku: "103", name: "WOODEN ROUND TABLE", qty: 1, kind: "furniture" },
          { sku: "309", name: "LEATHER CHAIR", qty: 2, kind: "furniture" },
          { sku: "417", name: "SPOTLIGHT", qty: 4, kind: "light" },
        ] })}::jsonb, '{}'::jsonb, 0)
    `);

    const shows = await request(app).get("/api/platform/extras/shows").set("Cookie", cookies);
    expect(shows.status, JSON.stringify(shows.body)).toBe(200);
    expect(shows.body.shows.map((s: { name: string }) => s.name)).toContain("Beauty Istanbul");

    const manifest = await request(app)
      .get(`/api/platform/extras/furniture-manifest?show=${encodeURIComponent("Beauty Istanbul")}`)
      .set("Cookie", cookies);
    expect(manifest.status, JSON.stringify(manifest.body)).toBe(200);
    expect(manifest.body.booths).toHaveLength(1);

    const items = manifest.body.booths[0].items;
    // Lighting is part of the build, not something picked off a shelf.
    expect(items.map((i: { sku: string }) => i.sku).sort()).toEqual(["103", "309"]);
    expect(items.find((i: { sku: string }) => i.sku === "309").qty).toBe(2);
    expect(manifest.body.totals).toEqual({ booths: 1, items: 3 });
  });
});
