import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import request from "supertest";
import app from "../app";
import {
  addProjectMember,
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
  createTestProject,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestProject,
  type TestUser,
} from "../test/helpers";

/**
 * The limit the server enforces must equal the limit it advertises.
 *
 * These were computed in two places. The endpoint that reported the limit added
 * purchased rounds and honoured an unlimited subscription; the endpoint that
 * enforced it hardcoded 2. A client who bought extra rounds saw the higher
 * figure, was allowed to act on it by a UI reading the same figure, and was then
 * refused at 2 - money taken, capability withheld.
 *
 * The assertion that was missing is not arithmetic about the limit. It is that
 * the two numbers are the same number, which is why this test never states the
 * enforced count independently: it submits change requests until the server
 * refuses, and compares the count it got through against what the API said it
 * would allow.
 */

const EXTRA_ROUNDS_PURCHASED = 3;
const BASE_ROUNDS = 2;

describe("revision limits: enforced equals advertised", () => {
  let org: TestOrg;
  let clientUser: TestUser;
  let pmUser: TestUser;
  let clientCookies: string[];
  let project: TestProject;

  beforeAll(async () => {
    org = await createTestOrg();
    clientUser = await createTestUser(org.id, "client");
    pmUser = await createTestUser(org.id, "pm");
    clientCookies = await loginAs(app, org.slug, clientUser);

    const client = await createTestClient(org.id, {
      status: "active",
      contactEmail: clientUser.email,
      assignedPmUserId: pmUser.id,
    });

    // The client has bought extra rounds, exactly as billing.ts records them
    // on Stripe confirmation.
    await db.execute(sql`
      update clients
      set workspace_editor_extra_revision_rounds = ${EXTRA_ROUNDS_PURCHASED}
      where id = ${client.id}::uuid
    `);

    project = await createTestProject(org.id, client.id, {
      status: "client_review",
      assignedPmUserId: pmUser.id,
    });
    await addProjectMember(project.id, clientUser.id, "client");

    // A change request has to attach to a submitted version of the design that
    // getProjectAccess resolves. createTestProject already creates that design,
    // and booth_designs has no unique key on project_id - inserting another one
    // here silently gave the version a different parent, and the endpoint then
    // reported "No design version exists to request changes on."
    const designRow = await db.execute(sql`
      select id::text from booth_designs
      where project_id = ${project.id}::uuid and deleted_at is null
      order by created_at
      limit 1
    `);
    const designId = (designRow as unknown as { rows: { id: string }[] }).rows[0]?.id;
    await db.execute(sql`
      insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json)
      values (
        ${org.id}::uuid, ${designId}::uuid, ${project.id}::uuid,
        1, 'submitted'::booth_version_status, 'v1', '{}'::jsonb
      )
      on conflict do nothing
    `);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("advertises the purchased rounds on top of the base allowance", async () => {
    const response = await request(app)
      .get(`/api/platform/projects/${project.id}/workspace`)
      .set("Cookie", clientCookies);

    expect(response.status).toBe(200);
    expect(response.body.revisionLimit).toBe(BASE_ROUNDS + EXTRA_ROUNDS_PURCHASED);
  });

  it("reports one limit, not two, in the permissions payload", async () => {
    // arrangement_round_limit used to carry the base allowance while
    // total_round_limit carried the real one - two numbers for one policy,
    // sitting in the same object.
    const response = await request(app)
      .get(`/api/platform/projects/${project.id}/workspace`)
      .set("Cookie", clientCookies);

    const permissions = response.body.permissions;
    expect(permissions.arrangement_round_limit).toBe(response.body.revisionLimit);
    expect(permissions.total_round_limit).toBe(response.body.revisionLimit);
  });

  it("accepts exactly as many change requests as it said it would", async () => {
    const before = await request(app)
      .get(`/api/platform/projects/${project.id}/workspace`)
      .set("Cookie", clientCookies);
    const advertised: number = before.body.revisionLimit;
    expect(advertised).toBeGreaterThan(BASE_ROUNDS);

    let accepted = 0;
    let refusal: { error?: { code?: string } } | null = null;

    // Two past the advertised limit, so a server that never refuses fails too.
    for (let attempt = 0; attempt < advertised + 2; attempt += 1) {
      // A granted request moves the project to `revision`, which the endpoint
      // will not accept another request against. Put it back into review so the
      // only thing that can stop the loop is the round limit itself.
      await db.execute(sql`
        update projects set status = 'client_review'::project_status
        where id = ${project.id}::uuid
      `);

      const response = await request(app)
        .post(`/api/platform/projects/${project.id}/change-requests`)
        .set("Cookie", clientCookies)
        .send({ changeText: `Change request ${attempt + 1}: move the info desk.` });

      if (response.status === 200) {
        accepted += 1;
        continue;
      }
      refusal = response.body;
      break;
    }

    expect(
      accepted,
      `server advertised ${advertised} rounds and granted ${accepted}`,
    ).toBe(advertised);
    expect(refusal?.error?.code).toBe("revision_limit_reached");
  });

  it("reports the rounds it has spent, and none remaining, once exhausted", async () => {
    const response = await request(app)
      .get(`/api/platform/projects/${project.id}/workspace`)
      .set("Cookie", clientCookies);

    expect(response.body.revisionCount).toBe(BASE_ROUNDS + EXTRA_ROUNDS_PURCHASED);
    expect(response.body.permissions.arrangement_rounds_remaining).toBe(0);
    expect(response.body.permissions.subscription_required).toBe(true);
    // The message named the base allowance regardless of what was bought.
    expect(response.body.permissions.edit_disabled_reason).toContain(
      String(BASE_ROUNDS + EXTRA_ROUNDS_PURCHASED),
    );
  });
});
