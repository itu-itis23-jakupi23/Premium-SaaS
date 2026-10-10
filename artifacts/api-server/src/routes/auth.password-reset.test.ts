import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { sql, type SQL } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import app from "../app";
import { hashToken } from "../lib/tokens";
import { verifyPassword } from "../lib/password";
import { encryptSecret, hashBackupCode, verifyChallengeToken } from "../lib/totp";
import { cleanupTestOrg, createTestOrg, createTestUser, loginAs, type TestOrg, type TestUser } from "../test/helpers";

const { sendResetEmail } = vi.hoisted(() => ({ sendResetEmail: vi.fn().mockResolvedValue({ ok: true, status: "sent" }) }));
vi.mock("../lib/email", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/email")>(),
  sendPasswordResetEmail: sendResetEmail,
}));

type TokenState = { id: string; tokenHash: string; usedAt: string | null; active: boolean };
const RFC_SECRET_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

function currentTotpCode() {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", "12345678901234567890").update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

describe("password reset transaction safety", () => {
  let org: TestOrg;
  let otherOrg: TestOrg;

  beforeAll(async () => { org = await createTestOrg(); otherOrg = await createTestOrg(); });
  beforeEach(() => { sendResetEmail.mockClear(); });
  afterAll(async () => {
    if (org) await cleanupTestOrg(org.id);
    if (otherOrg) await cleanupTestOrg(otherOrg.id);
  });

  async function rows<T>(statement: SQL) {
    return (await db.execute(statement) as unknown as { rows: T[] }).rows;
  }

  async function insertToken(user: TestUser, state: "active" | "expired" | "used" = "active") {
    const token = randomBytes(32).toString("hex");
    const inserted = await rows<{ id: string }>(sql`
      insert into password_reset_tokens (user_id, token_hash, expires_at, used_at)
      values (${user.id}::uuid, ${hashToken(token)},
        now() + ${state === "expired" ? -1 : 1} * interval '1 hour',
        ${state === "used" ? new Date() : null})
      returning id::text
    `);
    return { id: inserted[0].id, token };
  }

  async function passwordHash(user: TestUser) {
    return (await rows<{ hash: string }>(sql`select password_hash as hash from users where id = ${user.id}::uuid`))[0].hash;
  }

  async function tokenState(user: TestUser) {
    return rows<TokenState>(sql`
      select id::text, token_hash as "tokenHash", used_at::text as "usedAt",
        used_at is null and expires_at > clock_timestamp() as active
      from password_reset_tokens where user_id = ${user.id}::uuid order by id
    `);
  }

  async function sessionState(user: TestUser) {
    return rows<{ id: string; revokedAt: string | null }>(sql`
      select id::text, revoked_at::text as "revokedAt" from sessions
      where user_id = ${user.id}::uuid order by id
    `);
  }

  function reset(token: string, password = "ChangedPassword123!") {
    return request(app).post("/api/auth/reset-password").send({ token, password });
  }

  function forgot(email: string) {
    return request(app).post("/api/auth/forgot-password").send({ email });
  }

  function login(user: TestUser, password = user.password, organizationSlug = org.slug) {
    return request(app).post("/api/auth/login").send({ email: user.email, password, organizationSlug });
  }

  async function enableTwoFactor(user: TestUser) {
    const code = "ABCDE-12345";
    await db.execute(sql`update users set metadata = ${JSON.stringify({
      twoFactor: { enabled: true, secret: encryptSecret(RFC_SECRET_BASE32), backupCodes: [hashBackupCode(code)] },
    })}::jsonb where id = ${user.id}::uuid`);
    return code;
  }

  async function waitForBlockedQuery(fragment: string) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const result = await rows<{ waiting: boolean }>(sql`select exists (
        select 1 from pg_stat_activity where wait_event_type = 'Lock' and query like ${`%${fragment}%`}
      ) as waiting`);
      if (result[0].waiting) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for a blocked query: ${fragment}`);
  }

  function deliveredTokens(email: string) {
    return sendResetEmail.mock.calls
      .map(([payload]) => payload as { to: string; resetUrl: string })
      .filter((payload) => payload.to === email)
      .map((payload) => new URL(payload.resetUrl).searchParams.get("token")!);
  }

  // Failure triggers are restricted to fresh disposable accounts in this suite.
  async function withWriteFailure(table: string, event: "insert" | "update", condition: SQL, action: () => Promise<void>) {
    const name = sql.identifier(`reset_failure_${randomUUID().replaceAll("-", "")}`);
    const target = sql.identifier(table);
    await db.execute(sql`create function ${name}() returns trigger language plpgsql as 'begin raise exception ''Simulated password reset write failure''; end'`);
    try {
      await db.execute(sql`create trigger ${name} before ${sql.raw(event)} on ${target}
        for each row when (${condition}) execute function ${name}()`);
      try { await action(); }
      finally { await db.execute(sql`drop trigger ${name} on ${target}`); }
    } finally { await db.execute(sql`drop function ${name}()`); }
  }

  it("changes only the addressed account and revokes all sessions and active reset links", async () => {
    const user = await createTestUser(org.id, "chief");
    const other = await createTestUser(org.id, "chief");
    const otherHash = await passwordHash(other);
    const cookies = await loginAs(app, org.slug, user);
    await loginAs(app, org.slug, user);
    const current = await insertToken(user);
    const older = await insertToken(user);

    const response = await reset(current.token);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.get("Set-Cookie")).toBeUndefined();
    expect(verifyPassword("ChangedPassword123!", await passwordHash(user))).toBe(true);
    expect(await passwordHash(other)).toBe(otherHash);
    const tokens = await tokenState(user);
    expect(tokens).toHaveLength(2);
    expect(tokens.every((entry) => entry.usedAt !== null && !entry.active)).toBe(true);
    const sessions = await sessionState(user);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    expect((await request(app).get("/api/platform/clients").set("Cookie", cookies)).status).toBe(401);
    expect((await reset(older.token)).body.error.code).toBe("invalid_token");
    expect((await reset(current.token)).body.error.code).toBe("invalid_token");
  });

  it("allows exactly one concurrent consumption of the same link", async () => {
    const user = await createTestUser(org.id, "chief");
    const { token } = await insertToken(user);
    const passwords = Array.from({ length: 6 }, (_, index) => `ConcurrentPassword${index}!`);
    const responses = await Promise.all(passwords.map((password) => reset(token, password)));
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 400 && response.body.error.code === "invalid_token")).toHaveLength(5);
    expect(verifyPassword(passwords[responses.findIndex((response) => response.status === 200)], await passwordHash(user))).toBe(true);
    expect((await tokenState(user))[0].usedAt).not.toBeNull();
  });

  it("serializes concurrent resets using different active links for the same account", async () => {
    const user = await createTestUser(org.id, "chief");
    const first = await insertToken(user);
    const second = await insertToken(user);
    const responses = await Promise.all([reset(first.token, "FirstConcurrent123!"), reset(second.token, "SecondConcurrent123!")]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const winner = responses[0].status === 200 ? "FirstConcurrent123!" : "SecondConcurrent123!";
    expect(verifyPassword(winner, await passwordHash(user))).toBe(true);
    expect((await tokenState(user)).every((entry) => entry.usedAt !== null)).toBe(true);
  });

  it("rejects an old-password login queued behind password reset and accepts the new password", async () => {
    const user = await createTestUser(org.id, "chief");
    const { token } = await insertToken(user);
    const blocker = await pool.connect();
    let pendingReset: Promise<request.Response> | undefined;
    let pendingLogin: Promise<request.Response> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from users where id = $1 for update", [user.id]);
      pendingReset = reset(token).then((response) => response);
      await waitForBlockedQuery("from users u join password_reset_tokens t");
      pendingLogin = login(user).then((response) => response);
      await waitForBlockedQuery('select password_hash as "passwordHash" from users');
      await blocker.query("commit");
      expect((await pendingReset).status).toBe(200);
      const loginResponse = await pendingLogin;
      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.error.code).toBe("invalid_credentials");
      expect(loginResponse.get("Set-Cookie")).toBeUndefined();
      expect(await sessionState(user)).toHaveLength(0);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      await Promise.all([pendingReset, pendingLogin]);
    }
    expect((await login(user)).status).toBe(401);
    const newLogin = await login(user, "ChangedPassword123!");
    expect(newLogin.status).toBe(200);
    expect(newLogin.get("Set-Cookie")).toBeDefined();
    expect((await sessionState(user)).filter((session) => session.revokedAt === null)).toHaveLength(1);
  });

  it("rejects a pending login if its organization membership is revoked before session creation", async () => {
    const user = await createTestUser(org.id, "chief");
    const blocker = await pool.connect();
    let pending: Promise<request.Response> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from users where id = $1 for update", [user.id]);
      pending = login(user).then((response) => response);
      await waitForBlockedQuery('select password_hash as "passwordHash" from users');
      await blocker.query("update memberships set status = 'revoked' where user_id = $1 and organization_id = $2", [user.id, org.id]);
      await blocker.query("commit");
      expect((await pending).status).toBe(401);
      expect(await sessionState(user)).toHaveLength(0);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  });

  it("invalidates pre-reset two-factor challenges without consuming a backup code", async () => {
    const user = await createTestUser(org.id, "chief");
    const code = await enableTwoFactor(user);
    const first = await login(user);
    expect(first.status).toBe(200);
    expect(first.body.twoFactorRequired).toBe(true);
    const { token } = await insertToken(user);
    expect((await reset(token)).status).toBe(200);
    const rejected = await request(app).post("/api/auth/login/2fa").send({ challengeToken: first.body.challengeToken, code });
    expect(rejected.status).toBe(401);
    expect(rejected.body.error.code).toBe("invalid_2fa_challenge");
    expect(rejected.get("Set-Cookie")).toBeUndefined();
    expect(await sessionState(user)).toHaveLength(0);
    expect((await login(user)).status).toBe(401);
    const next = await login(user, "ChangedPassword123!");
    expect(next.status).toBe(200);
    const completed = await request(app).post("/api/auth/login/2fa").send({ challengeToken: next.body.challengeToken, code });
    expect(completed.status).toBe(200);
    expect(completed.get("Set-Cookie")).toBeDefined();
  });

  it("creates a two-factor session only in the organization bound to the challenge", async () => {
    const user = await createTestUser(org.id, "chief");
    await db.execute(sql`insert into memberships (organization_id, user_id, role, status, joined_at)
      values (${otherOrg.id}::uuid, ${user.id}::uuid, 'pm', 'active', now())`);
    const code = await enableTwoFactor(user);
    const first = await login(user, user.password, otherOrg.slug);
    expect(first.status).toBe(200);
    const completed = await request(app).post("/api/auth/login/2fa").send({ challengeToken: first.body.challengeToken, code });
    expect(completed.status).toBe(200);
    expect(completed.body.organization.id).toBe(otherOrg.id);
    expect(completed.body.user.role).toBe("pm");
    const sessions = await rows<{ organizationId: string }>(sql`select organization_id::text as "organizationId"
      from sessions where user_id = ${user.id}::uuid`);
    expect(sessions).toEqual([{ organizationId: otherOrg.id }]);
  });

  it("rejects a two-factor challenge that expires while session creation waits on a lock", async () => {
    const user = await createTestUser(org.id, "chief");
    await enableTwoFactor(user);
    const first = await login(user);
    expect(first.status).toBe(200);
    const challenge = verifyChallengeToken(first.body.challengeToken)!;
    const blocker = await pool.connect();
    let pending: Promise<request.Response> | undefined;
    let clock: ReturnType<typeof vi.spyOn> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from users where id = $1 for update", [user.id]);
      pending = request(app).post("/api/auth/login/2fa").send({ challengeToken: first.body.challengeToken, code: currentTotpCode() })
        .then((response) => response);
      await waitForBlockedQuery('select password_hash as "passwordHash" from users');
      clock = vi.spyOn(Date, "now").mockReturnValue((challenge.expiresAt + 1) * 1000);
      await blocker.query("commit");
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("invalid_2fa_challenge");
      expect(response.get("Set-Cookie")).toBeUndefined();
      expect(await sessionState(user)).toHaveLength(0);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
      clock?.mockRestore();
    }
  });

  it.each(["expired", "used"] as const)("rejects a %s link without changing credentials", async (state) => {
    const user = await createTestUser(org.id, "chief");
    const { token } = await insertToken(user, state);
    const before = await passwordHash(user);
    expect((await reset(token)).status).toBe(400);
    expect(await passwordHash(user)).toBe(before);
  });

  it("rejects an unknown token", async () => {
    const response = await reset(randomBytes(32).toString("hex"));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_token");
  });

  it.each(["disabled_at", "deleted_at"])("refuses issuance and consumption for a user with %s set", async (column) => {
    const user = await createTestUser(org.id, "chief");
    const { token } = await insertToken(user);
    const before = await passwordHash(user);
    await db.execute(sql`update users set ${sql.identifier(column)} = now() where id = ${user.id}::uuid`);
    expect((await forgot(user.email)).body).toEqual({ ok: true });
    expect(sendResetEmail).not.toHaveBeenCalled();
    const response = await reset(token);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_token");
    expect(await passwordHash(user)).toBe(before);
    const tokens = await tokenState(user);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].usedAt).toBeNull();
  });

  it("serializes concurrent issuance and leaves only the latest link usable", async () => {
    const user = await createTestUser(org.id, "chief");
    const older = await insertToken(user);
    const responses = await Promise.all(Array.from({ length: 3 }, () => forgot(user.email)));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    const delivered = deliveredTokens(user.email);
    expect(delivered).toHaveLength(3);
    expect(new Set(delivered).size).toBe(3);
    const tokens = await tokenState(user);
    const active = tokens.filter((entry) => entry.active);
    expect(tokens).toHaveLength(4);
    expect(active).toHaveLength(1);
    const latest = delivered.find((token) => hashToken(token) === active[0].tokenHash)!;
    expect(latest).toBeTruthy();
    expect(tokens.some((entry) => delivered.includes(entry.tokenHash))).toBe(false);
    expect((await reset(older.token)).status).toBe(400);
    for (const token of delivered.filter((value) => value !== latest)) expect((await reset(token)).status).toBe(400);
    expect((await reset(latest)).status).toBe(200);
  });

  it("does not revive old links when issuance races with a reset", async () => {
    const user = await createTestUser(org.id, "chief");
    const current = await insertToken(user);
    const older = await insertToken(user);
    const [resetResponse, issued] = await Promise.all([reset(current.token), forgot(user.email)]);
    expect([200, 400]).toContain(resetResponse.status);
    expect(issued.status).toBe(200);
    expect((await reset(current.token)).status).toBe(400);
    expect((await reset(older.token)).status).toBe(400);
    expect((await tokenState(user)).filter((entry) => entry.active).length).toBeLessThanOrEqual(1);
  });

  it("checks expiry after waiting for the user lock", async () => {
    const user = await createTestUser(org.id, "chief");
    const { id, token } = await insertToken(user);
    const before = await passwordHash(user);
    const blocker = await pool.connect();
    let pending: Promise<request.Response> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from users where id = $1 for update", [user.id]);
      pending = reset(token).then((response) => response);
      await waitForBlockedQuery("from users u join password_reset_tokens t");
      await blocker.query("update password_reset_tokens set expires_at = clock_timestamp() - interval '1 millisecond' where id = $1", [id]);
      await blocker.query("commit");
      expect((await pending).status).toBe(400);
      expect(await passwordHash(user)).toBe(before);
      expect((await tokenState(user))[0].usedAt).toBeNull();
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  });

  it.each(["users", "password_reset_tokens", "sessions"])("rolls back the reset if %s cannot be updated, then allows retry", async (table) => {
    const user = await createTestUser(org.id, "chief");
    await loginAs(app, org.slug, user);
    const current = await insertToken(user);
    const older = await insertToken(user);
    const beforeHash = await passwordHash(user);
    const beforeTokens = await tokenState(user);
    const beforeSessions = await sessionState(user);
    const condition = table === "users" ? sql`new.id = ${sql.raw(`'${user.id}'::uuid`)}`
      : table === "password_reset_tokens" ? sql`new.id = ${sql.raw(`'${older.id}'::uuid`)}`
        : sql`new.user_id = ${sql.raw(`'${user.id}'::uuid`)}`;
    await withWriteFailure(table, "update", condition, async () => {
      expect((await reset(current.token)).status).toBe(500);
      expect(await passwordHash(user)).toBe(beforeHash);
      expect(await tokenState(user)).toEqual(beforeTokens);
      expect(await sessionState(user)).toEqual(beforeSessions);
    });
    expect((await reset(current.token)).status).toBe(200);
  });

  it("rolls back superseding links if issuance fails and sends no unusable email", async () => {
    const user = await createTestUser(org.id, "chief");
    const current = await insertToken(user);
    const before = await tokenState(user);
    await withWriteFailure("password_reset_tokens", "insert", sql`new.user_id = ${sql.raw(`'${user.id}'::uuid`)}`, async () => {
      expect((await forgot(user.email)).status).toBe(500);
      expect(await tokenState(user)).toEqual(before);
      expect(sendResetEmail).not.toHaveBeenCalled();
    });
    expect((await reset(current.token)).status).toBe(200);
  });
});
