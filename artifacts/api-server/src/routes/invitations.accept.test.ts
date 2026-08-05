import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import {
  createTestOrg,
  cleanupTestOrg,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestUser,
} from "../test/helpers";
import { createRefreshToken, hashToken } from "../lib/tokens";

describe("POST /api/platform/managers/invitations/accept", () => {
  let org: TestOrg;
  let chief: TestUser;
  let chiefCookies: string[];

  beforeAll(async () => {
    process.env.AUTH_SECRET = "invitation-test-secret-not-for-production";
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    chiefCookies = await loginAs(app, org.slug, chief);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("issues a named invite code and rejects duplicate or existing-account invitations", async () => {
    const email = `invited-pm-${Date.now()}@test.local`;
    const created = await request(app)
      .post("/api/platform/managers/invitations")
      .set("Cookie", chiefCookies)
      .send({ name: "Invited Project Manager", email: email.toUpperCase() });

    expect(created.status).toBe(201);
    expect(created.body.invitation).toMatchObject({
      email,
      name: "Invited Project Manager",
      role: "pm",
      status: "Pending",
    });
    expect(created.body.invitation.token).toEqual(expect.any(String));

    const validation = await request(app)
      .get("/api/platform/managers/invitations/validate")
      .query({ token: created.body.invitation.token });
    expect(validation.status).toBe(200);
    expect(validation.body).toMatchObject({
      valid: true,
      email,
      name: "Invited Project Manager",
      role: "pm",
      organization: { id: org.id, slug: org.slug },
    });

    const duplicate = await request(app)
      .post("/api/platform/managers/invitations")
      .set("Cookie", chiefCookies)
      .send({ name: "Duplicate PM", email });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("invitation_pending");

    const existingAccount = await request(app)
      .post("/api/platform/managers/invitations")
      .set("Cookie", chiefCookies)
      .send({ name: "Existing User", email: chief.email });
    expect(existingAccount.status).toBe(409);
    expect(existingAccount.body.error.code).toBe("account_exists");
  });

  it("allows exactly one concurrent acceptance and leaves one membership", async () => {
    const token = createRefreshToken();
    const email = `concurrent-pm-${Date.now()}@test.local`;

    await db.execute(sql`
      insert into invitations (
        organization_id,
        email,
        role,
        token_hash,
        expires_at
      )
      values (
        ${org.id}::uuid,
        ${email},
        'pm',
        ${hashToken(token)},
        now() + interval '1 day'
      )
    `);

    const validation = await request(app)
      .get("/api/platform/managers/invitations/validate")
      .query({ token });
    expect(validation.status).toBe(200);
    expect(validation.body).toMatchObject({
      valid: true,
      email,
      role: "pm",
      organization: {
        id: org.id,
        name: org.slug,
        slug: org.slug,
      },
    });

    const payload = { token, name: "Concurrent PM", password: "ConcurrentPass123!" };
    const [first, second] = await Promise.all([
      request(app).post("/api/platform/managers/invitations/accept").send(payload),
      request(app).post("/api/platform/managers/invitations/accept").send(payload),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect([first.body.error?.code, second.body.error?.code]).toContain("invitation_unavailable");

    const membershipResult = await db.execute(sql`
      select count(*)::int as count
      from memberships m
      join users u on u.id = m.user_id
      where m.organization_id = ${org.id}::uuid
        and lower(u.email) = lower(${email})
    `);
    const count = (membershipResult as unknown as { rows: Array<{ count: number }> }).rows[0]?.count;
    expect(count).toBe(1);

    const replay = await request(app)
      .post("/api/platform/managers/invitations/accept")
      .send(payload);
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("invitation_unavailable");
  });
});
