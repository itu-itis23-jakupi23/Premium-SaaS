import type { CookieOptions, Response } from "express";
import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { hashPassword, verifyPassword } from "../lib/password";
import { createRefreshToken, hashToken, signAccessToken, verifyAccessToken } from "../lib/tokens";
import { getAuthContext, toUiRole, type AuthContext, type AuthRole } from "../middlewares/session";

const ACCESS_COOKIE = "ens_access";
const REFRESH_COOKIE = "ens_refresh";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;

const router: IRouter = Router();

async function queryRows<T>(statement: SQL) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

router.get("/auth/me", async (req, res) => {
  const auth = await authFromAccessCookie(req.cookies?.[ACCESS_COOKIE]);

  if (auth) {
    res.json(authResponse(auth));
    return;
  }

  const refreshedAuth = await refreshAuthFromCookie(req.cookies?.[REFRESH_COOKIE], res);

  if (refreshedAuth) {
    res.json(authResponse(refreshedAuth));
    return;
  }

  if (hasCookie(req.cookies?.[ACCESS_COOKIE]) || hasCookie(req.cookies?.[REFRESH_COOKIE])) {
    clearAuthCookies(res);
  }

  res.json(emptyAuthResponse());
});

router.post("/auth/login", async (req, res) => {
  const input = parseLoginInput(req.body);

  if (!input.ok) {
    res.status(400).json({
      error: {
        code: "invalid_login_input",
        message: input.error,
      },
    });
    return;
  }

  const account = await findLoginAccount(input.value.email, input.value.organizationSlug);

  if (!account || !account.passwordHash || !verifyPassword(input.value.password, account.passwordHash)) {
    res.status(401).json({
      error: {
        code: "invalid_credentials",
        message: "Email or password is incorrect.",
      },
    });
    return;
  }

  const auth = await createSession({
    userId: account.userId,
    userName: account.name,
    userEmail: account.email,
    role: account.role,
    avatarUrl: avatarField(account.metadata, "avatarUrl"),
    avatarTone: avatarField(account.metadata, "avatarTone") || "primary",
    organizationId: account.organizationId,
    organizationName: account.organizationName,
    organizationSlug: account.organizationSlug,
    organizationPlan: account.organizationPlan,
    userAgent: req.header("user-agent") ?? null,
    ipAddress: req.ip,
  });

  setAuthCookies(res, auth.accessToken, auth.refreshToken);

  await db.execute(sql`
    update users
    set last_login_at = now(), updated_at = now()
    where id = ${account.userId}::uuid
  `);

  await auditAuthEvent(account.organizationId, account.userId, "auth_login", "signed in");
  res.json(authResponse(auth.context));
});

router.post("/auth/signup", async (req, res) => {
  const input = parseSignupInput(req.body);

  if (!input.ok) {
    res.status(400).json({
      error: {
        code: "invalid_signup_input",
        message: input.error,
      },
    });
    return;
  }

  const organization = await findOrganizationBySlug(input.value.organizationSlug ?? defaultOrganizationSlug());

  if (!organization) {
    res.status(404).json({
      error: {
        code: "organization_not_found",
        message: "Organization was not found.",
      },
    });
    return;
  }

  const existing = await queryRows<{ id: string }>(sql`
    select id::text
    from users
    where lower(email) = lower(${input.value.email})
      and deleted_at is null
    limit 1
  `);

  if (existing[0]) {
    res.status(409).json({
      error: {
        code: "email_exists",
        message: "An account with this email already exists.",
      },
    });
    return;
  }

  const passwordHash = hashPassword(input.value.password);

  const userRows = await queryRows<{ id: string }>(sql`
    insert into users (email, name, role, password_hash, email_verified_at, metadata)
    values (${input.value.email}, ${input.value.name}, 'client', ${passwordHash}, null, ${JSON.stringify({ company: input.value.company })}::jsonb)
    returning id::text
  `);

  const userId = userRows[0]?.id;

  if (!userId) {
    throw new Error("User signup insert did not return an id");
  }

  await db.execute(sql`
    insert into memberships (organization_id, user_id, role, status, joined_at)
    values (${organization.id}::uuid, ${userId}::uuid, 'client', 'active', now())
  `);

  await db.execute(sql`
    insert into clients (organization_id, company_name, contact_name, contact_email, status, metadata)
    values (${organization.id}::uuid, ${input.value.company}, ${input.value.name}, ${input.value.email}, 'pending_approval', '{}'::jsonb)
  `);

  const auth = await createSession({
    userId,
    userName: input.value.name,
    userEmail: input.value.email,
    role: "client",
    avatarUrl: "",
    avatarTone: "green",
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    organizationPlan: organization.plan,
    userAgent: req.header("user-agent") ?? null,
    ipAddress: req.ip,
  });

  setAuthCookies(res, auth.accessToken, auth.refreshToken);
  await auditAuthEvent(organization.id, userId, "auth_signup", "created client account");
  res.status(201).json(authResponse(auth.context));
});

router.post("/auth/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];

  if (typeof refreshToken !== "string") {
    res.status(401).json({
      error: {
        code: "refresh_required",
        message: "Refresh token is required.",
      },
    });
    return;
  }

  const tokenHash = hashToken(refreshToken);
  const session = await findSessionByRefreshHash(tokenHash);

  if (!session) {
    clearAuthCookies(res);
    res.status(401).json({
      error: {
        code: "session_invalid",
        message: "Session is no longer active.",
      },
    });
    return;
  }

  const auth = await rotateSession(session, res);
  res.json(authResponse(auth));
});

router.post("/auth/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];

  if (typeof refreshToken === "string") {
    await db.execute(sql`
      update sessions
      set revoked_at = now()
      where refresh_token_hash = ${hashToken(refreshToken)}
        and revoked_at is null
    `);
  }

  clearAuthCookies(res);
  res.status(204).send();
});

async function createSession(input: {
  userId: string;
  userName: string;
  userEmail: string;
  role: AuthRole;
  avatarUrl: string;
  avatarTone: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationPlan: string;
  userAgent: string | null;
  ipAddress: string | undefined;
}) {
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const rows = await queryRows<{ id: string }>(sql`
    insert into sessions (
      user_id,
      organization_id,
      refresh_token_hash,
      user_agent,
      ip_address,
      expires_at
    )
    values (
      ${input.userId}::uuid,
      ${input.organizationId}::uuid,
      ${refreshTokenHash},
      ${input.userAgent},
      ${input.ipAddress ?? null},
      ${expiresAt}
    )
    returning id::text
  `);

  const sessionId = rows[0]?.id;
  if (!sessionId) throw new Error("Session insert did not return an id");

  const accessToken = signAccessToken({
    sub: input.userId,
    sid: sessionId,
    org: input.organizationId,
    role: input.role,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });

  return {
    accessToken,
    refreshToken,
    context: {
      sessionId,
      user: {
        id: input.userId,
        name: input.userName,
        email: input.userEmail,
        role: input.role,
        uiRole: toUiRole(input.role),
        avatarUrl: input.avatarUrl,
        avatarTone: input.avatarTone,
      },
      organization: {
        id: input.organizationId,
        name: input.organizationName,
        slug: input.organizationSlug,
        plan: input.organizationPlan,
      },
    } satisfies AuthContext,
  };
}

async function findLoginAccount(email: string, organizationSlug: string | null) {
  const slug = organizationSlug ?? defaultOrganizationSlug();
  const rows = await queryRows<{
    userId: string;
    email: string;
    name: string;
    passwordHash: string | null;
    role: AuthRole;
    metadata: Record<string, unknown>;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationPlan: string;
  }>(sql`
    select
      u.id::text as "userId",
      u.email,
      u.name,
      u.password_hash as "passwordHash",
      m.role::text as role,
      u.metadata,
      o.id::text as "organizationId",
      o.name as "organizationName",
      o.slug as "organizationSlug",
      o.plan as "organizationPlan"
    from users u
    join memberships m on m.user_id = u.id
    join organizations o on o.id = m.organization_id
    where lower(u.email) = lower(${email})
      and o.slug = ${slug}
      and u.disabled_at is null
      and u.deleted_at is null
      and o.deleted_at is null
      and m.status::text = 'active'
    limit 1
  `);

  return rows[0] ?? null;
}

async function findSessionByRefreshHash(refreshTokenHash: string) {
  const rows = await queryRows<{
    sessionId: string;
    userId: string;
    name: string;
    email: string;
    role: AuthRole;
    metadata: Record<string, unknown>;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationPlan: string;
  }>(sql`
    select
      s.id::text as "sessionId",
      u.id::text as "userId",
      u.name,
      u.email,
      m.role::text as role,
      u.metadata,
      o.id::text as "organizationId",
      o.name as "organizationName",
      o.slug as "organizationSlug",
      o.plan as "organizationPlan"
    from sessions s
    join users u on u.id = s.user_id
    join organizations o on o.id = s.organization_id
    join memberships m on m.user_id = u.id and m.organization_id = o.id
    where s.refresh_token_hash = ${refreshTokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
      and u.disabled_at is null
      and u.deleted_at is null
      and o.deleted_at is null
      and m.status::text = 'active'
    limit 1
  `);

  return rows[0] ?? null;
}

async function findOrganizationBySlug(slug: string) {
  const rows = await queryRows<{
    id: string;
    name: string;
    slug: string;
    plan: string;
  }>(sql`
    select id::text, name, slug, plan
    from organizations
    where slug = ${slug}
      and deleted_at is null
    limit 1
  `);

  return rows[0] ?? null;
}

function authResponse(auth: AuthContext) {
  return {
    user: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.uiRole,
      systemRole: auth.user.role,
      avatarUrl: auth.user.avatarUrl,
      avatarTone: auth.user.avatarTone,
    },
    organization: auth.organization,
  };
}

function emptyAuthResponse() {
  return {
    user: null,
    organization: null,
  };
}

async function authFromAccessCookie(token: unknown) {
  const payload = typeof token === "string" ? verifyAccessToken(token) : null;
  if (!payload) return null;
  return getAuthContext(payload.sid, payload.sub, payload.org);
}

async function refreshAuthFromCookie(refreshToken: unknown, res: Response) {
  if (typeof refreshToken !== "string") return null;
  const session = await findSessionByRefreshHash(hashToken(refreshToken));
  if (!session) return null;
  return rotateSession(session, res);
}

type RefreshSession = NonNullable<Awaited<ReturnType<typeof findSessionByRefreshHash>>>;

async function rotateSession(session: RefreshSession, res: Response) {
  const nextRefreshToken = createRefreshToken();
  const nextRefreshHash = hashToken(nextRefreshToken);

  await db.execute(sql`
    update sessions
    set refresh_token_hash = ${nextRefreshHash}, rotated_at = now()
    where id = ${session.sessionId}::uuid
  `);

  const accessToken = signAccessToken({
    sub: session.userId,
    sid: session.sessionId,
    org: session.organizationId,
    role: session.role,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });

  setAuthCookies(res, accessToken, nextRefreshToken);
  return toAuthContext(session);
}

function hasCookie(value: unknown) {
  return typeof value === "string" && value.length > 0;
}

function toAuthContext(session: Awaited<ReturnType<typeof findSessionByRefreshHash>>): AuthContext {
  if (!session) throw new Error("Session is required");

  return {
    sessionId: session.sessionId,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      uiRole: toUiRole(session.role),
      avatarUrl: avatarField(session.metadata, "avatarUrl"),
      avatarTone: avatarField(session.metadata, "avatarTone") || "primary",
    },
    organization: {
      id: session.organizationId,
      name: session.organizationName,
      slug: session.organizationSlug,
      plan: session.organizationPlan,
    },
  };
}

function avatarField(metadata: Record<string, unknown>, key: "avatarUrl" | "avatarTone") {
  const profile = metadata.profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return "";
  const value = (profile as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions(),
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(),
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions());
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

function parseLoginInput(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "Request body must be an object" };
  const data = body as Record<string, unknown>;
  const email = stringValue(data.email)?.toLowerCase();
  const password = stringValue(data.password);
  const organizationSlug = stringValue(data.organizationSlug);

  if (!email || !email.includes("@")) return { ok: false as const, error: "Valid email is required" };
  if (!password) return { ok: false as const, error: "Password is required" };

  return { ok: true as const, value: { email, password, organizationSlug } };
}

function parseSignupInput(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "Request body must be an object" };
  const data = body as Record<string, unknown>;
  const name = stringValue(data.name);
  const company = stringValue(data.company);
  const email = stringValue(data.email)?.toLowerCase();
  const password = stringValue(data.password);
  const organizationSlug = stringValue(data.organizationSlug);

  if (!name || name.length < 2) return { ok: false as const, error: "Name is required" };
  if (!company || company.length < 2) return { ok: false as const, error: "Company is required" };
  if (!email || !email.includes("@")) return { ok: false as const, error: "Valid email is required" };
  if (!password || password.length < 8) return { ok: false as const, error: "Password must be at least 8 characters" };

  return { ok: true as const, value: { name, company, email, password, organizationSlug } };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function defaultOrganizationSlug() {
  return process.env.DEFAULT_ORGANIZATION_SLUG ?? "ens-demo-agency";
}

async function auditAuthEvent(organizationId: string, actorUserId: string, type: string, message: string) {
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
    values (${organizationId}::uuid, ${actorUserId}::uuid, ${type}, ${message}, '{}'::jsonb)
  `);
}

export default router;
