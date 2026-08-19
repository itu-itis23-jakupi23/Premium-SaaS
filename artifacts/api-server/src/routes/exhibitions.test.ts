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

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

describe("exhibitions and backwards planning", () => {
  let org: TestOrg;
  let chief: TestUser;
  let pm: TestUser;
  let clientUser: TestUser;
  let chiefCookies: string[];
  let pmCookies: string[];
  let clientCookies: string[];
  let projectId: string;

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    pm = await createTestUser(org.id, "pm");
    clientUser = await createTestUser(org.id, "client");
    const client = await createTestClient(org.id, { contactEmail: clientUser.email, status: "active" });
    const project = await createTestProject(org.id, client.id, { assignedPmUserId: pm.id });
    projectId = project.id;

    chiefCookies = await loginAs(app, org.slug, chief);
    pmCookies = await loginAs(app, org.slug, pm);
    clientCookies = await loginAs(app, org.slug, clientUser);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  const createExhibition = async (body: Record<string, unknown> = {}) => {
    const response = await request(app)
      .post("/api/platform/exhibitions")
      .set("Cookie", chiefCookies)
      .send({ name: "Interzum 2026", venue: "Koelnmesse", city: "Cologne", country: "Germany", ...body });
    expect(response.status).toBe(201);
    return response.body.exhibition as { id: string; name: string };
  };

  it("creates an exhibition and returns it in the list", async () => {
    const exhibition = await createExhibition({ hall: "H7", standNumber: "B-042" });
    expect(exhibition.name).toBe("Interzum 2026");

    const list = await request(app).get("/api/platform/exhibitions").set("Cookie", chiefCookies);
    expect(list.status).toBe(200);
    const found = list.body.exhibitions.find((e: { id: string }) => e.id === exhibition.id);
    expect(found).toMatchObject({ hall: "H7", standNumber: "B-042", status: "planned", projectCount: 0 });
  });

  it("requires a name", async () => {
    const response = await request(app)
      .post("/api/platform/exhibitions")
      .set("Cookie", chiefCookies)
      .send({ name: "   ", city: "Cologne" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("name_required");
  });

  it("keeps clients out of the staff surface", async () => {
    const list = await request(app).get("/api/platform/exhibitions").set("Cookie", clientCookies);
    expect(list.status).toBe(403);
  });

  it("lets a PM read but not create", async () => {
    expect((await request(app).get("/api/platform/exhibitions").set("Cookie", pmCookies)).status).toBe(200);

    const create = await request(app)
      .post("/api/platform/exhibitions")
      .set("Cookie", pmCookies)
      .send({ name: "PM should not create this" });
    expect(create.status).toBe(403);
  });

  it("updates dates and rejects an unknown status", async () => {
    const exhibition = await createExhibition();

    const patch = await request(app)
      .patch(`/api/platform/exhibitions/${exhibition.id}`)
      .set("Cookie", chiefCookies)
      .send({ moveInAt: daysFromNow(90), opensAt: daysFromNow(93), status: "confirmed" });
    expect(patch.status).toBe(200);
    expect(patch.body.exhibition.status).toBe("confirmed");
    expect(patch.body.leadTime.hasRunway).toBe(true);

    const bad = await request(app)
      .patch(`/api/platform/exhibitions/${exhibition.id}`)
      .set("Cookie", chiefCookies)
      .send({ status: "sold_out" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("invalid_status");
  });

  it("flags a show that is too close to deliver on the standard lead time", async () => {
    const exhibition = await createExhibition();
    const patch = await request(app)
      .patch(`/api/platform/exhibitions/${exhibition.id}`)
      .set("Cookie", chiefCookies)
      .send({ moveInAt: daysFromNow(14) });

    expect(patch.body.leadTime.hasRunway).toBe(false);
    expect(patch.body.leadTime.shortfallDays).toBeGreaterThan(0);
    expect(patch.body.leadTime.feasible).toBe(true);
  });

  it("links a project and adopts the show's move-in as the project deadline", async () => {
    const moveInAt = daysFromNow(120);
    const exhibition = await createExhibition({ moveInAt, opensAt: daysFromNow(123) });

    const link = await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}`)
      .set("Cookie", chiefCookies)
      .send({});
    expect(link.status).toBe(200);

    const detail = await request(app)
      .get(`/api/platform/exhibitions/${exhibition.id}`)
      .set("Cookie", chiefCookies);
    expect(detail.status).toBe(200);
    expect(detail.body.projects).toHaveLength(1);
    expect(detail.body.projects[0].id).toBe(projectId);
    expect(new Date(detail.body.projects[0].deadlineAt).toISOString()).toBe(moveInAt);
  });

  it("plans the milestone chain backwards from the show", async () => {
    const exhibition = await createExhibition({
      moveInAt: daysFromNow(120), opensAt: daysFromNow(123), closesAt: daysFromNow(126), moveOutAt: daysFromNow(127),
    });
    await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}`)
      .set("Cookie", chiefCookies).send({});

    const plan = await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}/plan`)
      .set("Cookie", chiefCookies).send({});

    expect(plan.status).toBe(200);
    const keys = plan.body.plan.map((m: { key: string }) => m.key);
    expect(keys).toContain("design_freeze");
    expect(keys).toContain("freight_cutoff");
    expect(keys).toContain("move_out");
    expect(plan.body.milestones.length).toBeGreaterThanOrEqual(plan.body.plan.length);
  });

  it("re-planning updates in place instead of duplicating", async () => {
    const exhibition = await createExhibition({ moveInAt: daysFromNow(120), opensAt: daysFromNow(123) });
    await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}`)
      .set("Cookie", chiefCookies).send({});

    const first = await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}/plan`)
      .set("Cookie", chiefCookies).send({});
    const countAfterFirst = first.body.milestones.filter((m: { sourceKey: string | null }) => m.sourceKey).length;

    await request(app)
      .patch(`/api/platform/exhibitions/${exhibition.id}`)
      .set("Cookie", chiefCookies)
      .send({ moveInAt: daysFromNow(150) });

    const second = await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}/plan`)
      .set("Cookie", chiefCookies).send({});
    const generated = second.body.milestones.filter((m: { sourceKey: string | null }) => m.sourceKey);

    expect(generated).toHaveLength(countAfterFirst);
    const freeze = generated.find((m: { sourceKey: string }) => m.sourceKey === "design_freeze");
    const firstFreeze = first.body.milestones.find((m: { sourceKey: string }) => m.sourceKey === "design_freeze");
    expect(new Date(freeze.dueAt).getTime()).toBeGreaterThan(new Date(firstFreeze.dueAt).getTime());
  });

  it("refuses to plan a show with no dates", async () => {
    const exhibition = await createExhibition();
    await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}`)
      .set("Cookie", chiefCookies).send({});

    const plan = await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}/plan`)
      .set("Cookie", chiefCookies).send({});
    expect(plan.status).toBe(400);
    expect(plan.body.error.code).toBe("no_dates");
  });

  it("refuses to plan a project that is not linked to the show", async () => {
    const exhibition = await createExhibition({ moveInAt: daysFromNow(90) });
    const other = await createTestProject(org.id, (await createTestClient(org.id, { status: "active" })).id);

    const plan = await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${other.id}/plan`)
      .set("Cookie", chiefCookies).send({});
    expect(plan.status).toBe(404);
    expect(plan.body.error.code).toBe("project_not_found");
  });

  it("will not delete an exhibition that still has projects", async () => {
    const exhibition = await createExhibition({ moveInAt: daysFromNow(90) });
    await request(app)
      .post(`/api/platform/exhibitions/${exhibition.id}/projects/${projectId}`)
      .set("Cookie", chiefCookies).send({});

    const blocked = await request(app)
      .delete(`/api/platform/exhibitions/${exhibition.id}`)
      .set("Cookie", chiefCookies);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("exhibition_in_use");
  });

  it("deletes an unused exhibition and drops it from the list", async () => {
    const exhibition = await createExhibition({ name: "Disposable Show" });

    expect((await request(app).delete(`/api/platform/exhibitions/${exhibition.id}`).set("Cookie", chiefCookies)).status).toBe(200);

    const list = await request(app).get("/api/platform/exhibitions").set("Cookie", chiefCookies);
    expect(list.body.exhibitions.find((e: { id: string }) => e.id === exhibition.id)).toBeUndefined();
  });

  it("returns 404 for an exhibition in another organization", async () => {
    const otherOrg = await createTestOrg();
    try {
      const otherChief = await createTestUser(otherOrg.id, "chief");
      const otherCookies = await loginAs(app, otherOrg.slug, otherChief);
      const foreign = await request(app)
        .post("/api/platform/exhibitions")
        .set("Cookie", otherCookies)
        .send({ name: "Someone else's show" });

      const leak = await request(app)
        .get(`/api/platform/exhibitions/${foreign.body.exhibition.id}`)
        .set("Cookie", chiefCookies);
      expect(leak.status).toBe(404);
    } finally {
      await cleanupTestOrg(otherOrg.id);
    }
  });
});
