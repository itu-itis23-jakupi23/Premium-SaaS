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
    res.json(await enrichAuthResponse(auth));
    return;
  }

  const refreshedAuth = await refreshAuthFromCookie(req.cookies?.[REFRESH_COOKIE], res);

  if (refreshedAuth) {
    res.json(await enrichAuthResponse(refreshedAuth));
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
    insert into clients (
      organization_id,
      company_name,
      contact_name,
      contact_email,
      status,
      intake_exhibition_name,
      intake_booth_size_sqm,
      intake_city,
      intake_deadline_at,
      intake_preferred_system,
      intake_notes,
      metadata
    )
    values (
      ${organization.id}::uuid,
      ${input.value.company},
      ${input.value.name},
      ${input.value.email},
      'pending_approval',
      ${input.value.exhibitionName},
      ${input.value.boothSizeSqm},
      ${input.value.city},
      ${input.value.deadline}::timestamptz,
      ${input.value.preferredSystem}::booth_system,
      ${input.value.notes},
      '{}'::jsonb
    )
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

router.post("/auth/signup-staff", async (req, res) => {
  const input = parseSignupStaffInput(req.body);

  if (!input.ok) {
    res.status(400).json({
      error: {
        code: "invalid_signup_input",
        message: input.error,
      },
    });
    return;
  }

  const isDev = process.env.NODE_ENV !== "production";
  const requiredKey = process.env.STAFF_SIGNUP_KEY || process.env.CHIEF_BOOTSTRAP_KEY || process.env.STAFF_ACCESS_CODE;
  if (!isDev && (!requiredKey || input.value.setupKey !== requiredKey)) {
    res.status(403).json({
      error: {
        code: "setup_key_required",
        message: "Staff signup requires a valid setup key.",
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

  const orgSlug = slugify(input.value.company);
  let finalSlug = orgSlug;
  const existingOrg = await findOrganizationBySlug(finalSlug);
  if (existingOrg) {
    finalSlug = `${orgSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const orgRows = await queryRows<{ id: string; name: string; slug: string; plan: string }>(sql`
    insert into organizations (name, slug, plan, timezone, seat_limit, active_project_limit, storage_limit_mb, metadata)
    values (${input.value.company}, ${finalSlug}, 'starter', 'Europe/Istanbul', 10, 20, 10240, '{}'::jsonb)
    returning id::text, name, slug, plan
  `);

  const org = orgRows[0];
  if (!org) {
    throw new Error("Organization signup insert did not return a row");
  }

  const passwordHash = hashPassword(input.value.password);
  const userRows = await queryRows<{ id: string }>(sql`
    insert into users (email, name, role, password_hash, email_verified_at, metadata)
    values (${input.value.email}, ${input.value.name}, ${input.value.role}, ${passwordHash}, now(), '{}'::jsonb)
    returning id::text
  `);

  const userId = userRows[0]?.id;
  if (!userId) {
    throw new Error("User signup insert did not return an id");
  }

  await db.execute(sql`
    insert into memberships (organization_id, user_id, role, status, joined_at)
    values (${org.id}::uuid, ${userId}::uuid, ${input.value.role}, 'active', now())
  `);

  // Instantly seed/fill the organization with active demo data
  await seedStaffOrganizationData(org.id, userId, input.value.role, input.value.name, passwordHash);

  const auth = await createSession({
    userId,
    userName: input.value.name,
    userEmail: input.value.email,
    role: input.value.role,
    avatarUrl: "",
    avatarTone: input.value.role === "chief" ? "primary" : "blue",
    organizationId: org.id,
    organizationName: org.name,
    organizationSlug: org.slug,
    organizationPlan: org.plan,
    userAgent: req.header("user-agent") ?? null,
    ipAddress: req.ip,
  });

  setAuthCookies(res, auth.accessToken, auth.refreshToken);
  await auditAuthEvent(org.id, userId, "auth_signup", `created staff account (${input.value.role})`);
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

function authResponse(auth: AuthContext, clientRecord?: { status: string; id: string } | null) {
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
    clientRecord: clientRecord ?? null,
  };
}

async function enrichAuthResponse(auth: AuthContext) {
  if (auth.user.role !== "client") return authResponse(auth, null);
  const rows = await queryRows<{ id: string; status: string }>(sql`
    select id::text, status::text
    from clients
    where organization_id = ${auth.organization.id}::uuid
      and lower(contact_email) = lower(${auth.user.email})
      and deleted_at is null
    limit 1
  `);
  return authResponse(auth, rows[0] ?? null);
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

const INTAKE_BOOTH_SYSTEMS = ["octanorm", "maxima", "custom"] as const;

function parseSignupInput(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "Request body must be an object" };
  const data = body as Record<string, unknown>;
  const name = stringValue(data.name);
  const company = stringValue(data.company);
  const email = stringValue(data.email)?.toLowerCase();
  const password = stringValue(data.password);
  const organizationSlug = stringValue(data.organizationSlug);

  const exhibitionName = stringValue(data.exhibitionName);
  const boothSizeSqmRaw = stringValue(String(data.boothSizeSqm ?? ""));
  const boothSizeSqm = boothSizeSqmRaw ? Number(boothSizeSqmRaw) : null;
  const city = stringValue(data.city);
  const deadline = stringValue(data.deadline);
  const preferredSystemRaw = stringValue(data.preferredSystem);
  const preferredSystem = preferredSystemRaw && (INTAKE_BOOTH_SYSTEMS as readonly string[]).includes(preferredSystemRaw)
    ? (preferredSystemRaw as (typeof INTAKE_BOOTH_SYSTEMS)[number])
    : null;
  const notes = stringValue(data.notes);

  if (!name || name.length < 2) return { ok: false as const, error: "Name is required" };
  if (!company || company.length < 2) return { ok: false as const, error: "Company is required" };
  if (!email || !email.includes("@")) return { ok: false as const, error: "Valid email is required" };
  if (!password || password.length < 8) return { ok: false as const, error: "Password must be at least 8 characters" };
  if (!exhibitionName || exhibitionName.length < 2) return { ok: false as const, error: "Exhibition name is required" };
  if (!boothSizeSqm || !Number.isFinite(boothSizeSqm) || boothSizeSqm <= 0) return { ok: false as const, error: "A valid booth size (sqm) is required" };
  if (!city) return { ok: false as const, error: "City is required" };
  if (!deadline || !isIsoDate(deadline)) return { ok: false as const, error: "A valid deadline (YYYY-MM-DD) is required" };

  return {
    ok: true as const,
    value: {
      name,
      company,
      email,
      password,
      organizationSlug,
      exhibitionName,
      boothSizeSqm,
      city,
      deadline,
      preferredSystem,
      notes,
    },
  };
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function parseSignupStaffInput(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "Request body must be an object" };
  const data = body as Record<string, unknown>;
  const name = stringValue(data.name);
  const company = stringValue(data.company);
  const email = stringValue(data.email)?.toLowerCase();
  const password = stringValue(data.password);
  const roleRaw = stringValue(data.role);
  const setupKey = stringValue(data.setupKey);

  if (!name || name.length < 2) return { ok: false as const, error: "Name is required" };
  if (!company || company.length < 2) return { ok: false as const, error: "Company name is required" };
  if (!email || !email.includes("@")) return { ok: false as const, error: "Valid email is required" };
  if (!password || password.length < 8) return { ok: false as const, error: "Password must be at least 8 characters" };

  const role: "pm" | "chief" = roleRaw === "chief" ? "chief" : "pm";

  return { ok: true as const, value: { name, company, email, password, role, setupKey } };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agency";
}

async function seedStaffOrganizationData(orgId: string, primaryUserId: string, primaryUserRole: "chief" | "pm", primaryUserName: string, passwordHash: string) {
  let pmUserId = primaryUserId;
  let chiefUserId = primaryUserId;

  if (primaryUserRole === "chief") {
    // Seed a PM user under this chief
    const pmUserRows = await queryRows<{ id: string }>(sql`
      insert into users (email, name, role, password_hash, email_verified_at, metadata)
      values (${`jane.pm+${orgId.slice(0, 8)}@example.com`}, 'Jane Project Manager', 'pm', ${passwordHash}, now(), '{}'::jsonb)
      returning id::text
    `);
    pmUserId = pmUserRows[0]?.id ?? primaryUserId;
    await db.execute(sql`
      insert into memberships (organization_id, user_id, role, status, joined_at)
      values (${orgId}::uuid, ${pmUserId}::uuid, 'pm', 'active', now())
    `);
  } else {
    // Seed a Chief/Owner user
    const chiefUserRows = await queryRows<{ id: string }>(sql`
      insert into users (email, name, role, password_hash, email_verified_at, metadata)
      values (${`owner+${orgId.slice(0, 8)}@example.com`}, 'Agency Owner', 'chief', ${passwordHash}, now(), '{}'::jsonb)
      returning id::text
    `);
    chiefUserId = chiefUserRows[0]?.id ?? primaryUserId;
    await db.execute(sql`
      insert into memberships (organization_id, user_id, role, status, joined_at)
      values (${orgId}::uuid, ${chiefUserId}::uuid, 'chief', 'active', now())
    `);
  }

  // Seed 3 Clients
  const client1Rows = await queryRows<{ id: string }>(sql`
    insert into clients (organization_id, company_name, contact_name, contact_email, status, assigned_pm_user_id, activated_at, metadata)
    values (${orgId}::uuid, 'Acme Corp', 'John Acme', ${`john@acme+${orgId.slice(0, 8)}.com`}, 'active', ${pmUserId}::uuid, now(), '{}'::jsonb)
    returning id::text
  `);
  const c1Id = client1Rows[0]?.id;

  const client2Rows = await queryRows<{ id: string }>(sql`
    insert into clients (organization_id, company_name, contact_name, contact_email, status, assigned_pm_user_id, activated_at, metadata)
    values (${orgId}::uuid, 'Globex Showcase', 'Hank Globex', ${`hank@globex+${orgId.slice(0, 8)}.com`}, 'active', ${pmUserId}::uuid, now(), '{}'::jsonb)
    returning id::text
  `);
  const c2Id = client2Rows[0]?.id;

  const client3Rows = await queryRows<{ id: string }>(sql`
    insert into clients (organization_id, company_name, contact_name, contact_email, status, assigned_pm_user_id, activated_at, metadata)
    values (${orgId}::uuid, 'Initech Labs', 'Peter Initech', ${`peter@initech+${orgId.slice(0, 8)}.com`}, 'pending_approval', ${pmUserId}::uuid, null, '{}'::jsonb)
    returning id::text
  `);
  const c3Id = client3Rows[0]?.id;

  if (!c1Id || !c2Id || !c3Id) return;

  // Seed 3 Projects
  const proj1Rows = await queryRows<{ id: string }>(sql`
    insert into projects (organization_id, client_id, assigned_pm_user_id, created_by_user_id, name, exhibition_name, status, health, budget_cents, currency, starts_at, deadline_at, metadata)
    values (
      ${orgId}::uuid,
      ${c1Id}::uuid,
      ${pmUserId}::uuid,
      ${chiefUserId}::uuid,
      'Acme Exhibition Stand',
      'Acme Exhibition Stand',
      'in_design',
      'on_track',
      3500000,
      'EUR',
      now() - interval '5 days',
      now() + interval '20 days',
      '{"pipelineStage": "design"}'::jsonb
    )
    returning id::text
  `);
  const p1Id = proj1Rows[0]?.id;

  const proj2Rows = await queryRows<{ id: string }>(sql`
    insert into projects (organization_id, client_id, assigned_pm_user_id, created_by_user_id, name, exhibition_name, status, health, budget_cents, currency, starts_at, deadline_at, metadata)
    values (
      ${orgId}::uuid,
      ${c2Id}::uuid,
      ${pmUserId}::uuid,
      ${chiefUserId}::uuid,
      'Globex Summit Booth',
      'Globex Summit Booth',
      'completed',
      'on_track',
      6200000,
      'EUR',
      now() - interval '15 days',
      now() - interval '2 days',
      '{"pipelineStage": "closed"}'::jsonb
    )
    returning id::text
  `);
  const p2Id = proj2Rows[0]?.id;

  const proj3Rows = await queryRows<{ id: string }>(sql`
    insert into projects (organization_id, client_id, assigned_pm_user_id, created_by_user_id, name, exhibition_name, status, health, budget_cents, currency, starts_at, deadline_at, metadata)
    values (
      ${orgId}::uuid,
      ${c3Id}::uuid,
      ${pmUserId}::uuid,
      ${chiefUserId}::uuid,
      'Initech Showcase',
      'Initech Showcase',
      'delayed',
      'delayed',
      1500000,
      'EUR',
      now() - interval '3 days',
      now() + interval '5 days',
      '{"pipelineStage": "review"}'::jsonb
    )
    returning id::text
  `);
  const p3Id = proj3Rows[0]?.id;

  if (!p1Id || !p2Id || !p3Id) return;

  // Project Members
  for (const pid of [p1Id, p2Id, p3Id]) {
    await db.execute(sql`
      insert into project_members (project_id, user_id, role)
      values (${pid}::uuid, ${pmUserId}::uuid, 'pm')
    `);
    await db.execute(sql`
      insert into project_members (project_id, user_id, role)
      values (${pid}::uuid, ${chiefUserId}::uuid, 'chief')
    `);
  }

  // Booth Designs
  const d1Rows = await queryRows<{ id: string }>(sql`
    insert into booth_designs (organization_id, project_id, name, booth_system, booth_type, width_mm, depth_mm, height_mm, grid_size_mm, units, current_version_number, created_by_user_id)
    values (${orgId}::uuid, ${p1Id}::uuid, 'Acme layout design', 'octanorm', 'inline', 6000, 4000, 2500, 1000, 'metric', 1, ${pmUserId}::uuid)
    returning id::text
  `);
  const d1Id = d1Rows[0]?.id;

  const d2Rows = await queryRows<{ id: string }>(sql`
    insert into booth_designs (organization_id, project_id, name, booth_system, booth_type, width_mm, depth_mm, height_mm, grid_size_mm, units, current_version_number, created_by_user_id)
    values (${orgId}::uuid, ${p2Id}::uuid, 'Globex booth layout', 'maxima', 'corner', 8000, 5000, 4000, 1000, 'metric', 1, ${pmUserId}::uuid)
    returning id::text
  `);
  const d2Id = d2Rows[0]?.id;

  const d3Rows = await queryRows<{ id: string }>(sql`
    insert into booth_designs (organization_id, project_id, name, booth_system, booth_type, width_mm, depth_mm, height_mm, grid_size_mm, units, current_version_number, created_by_user_id)
    values (${orgId}::uuid, ${p3Id}::uuid, 'Initech booth design', 'custom', 'peninsula', 4000, 3000, 2500, 1000, 'metric', 1, ${pmUserId}::uuid)
    returning id::text
  `);
  const d3Id = d3Rows[0]?.id;

  if (!d1Id || !d2Id || !d3Id) return;

  // Booth Versions
  const v1Rows = await queryRows<{ id: string }>(sql`
    insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json, asset_summary, cost_estimate_cents, created_by_user_id)
    values (${orgId}::uuid, ${d1Id}::uuid, ${p1Id}::uuid, 1, 'draft', 'Initial concept layout', '{"gridMm": 1000, "boothSystem": "octanorm", "dimensions": {"widthMm": 6000, "depthMm": 4000, "heightMm": 2500}, "objects": []}'::jsonb, '{}'::jsonb, 0, ${pmUserId}::uuid)
    returning id::text
  `);
  const v1Id = v1Rows[0]?.id;

  const v2Rows = await queryRows<{ id: string }>(sql`
    insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json, asset_summary, cost_estimate_cents, created_by_user_id)
    values (${orgId}::uuid, ${d2Id}::uuid, ${p2Id}::uuid, 1, 'approved', 'Final build version', '{"gridMm": 1000, "boothSystem": "maxima", "dimensions": {"widthMm": 8000, "depthMm": 5000, "heightMm": 4000}, "objects": []}'::jsonb, '{}'::jsonb, 0, ${pmUserId}::uuid)
    returning id::text
  `);
  const v2Id = v2Rows[0]?.id;

  const v3Rows = await queryRows<{ id: string }>(sql`
    insert into booth_versions (organization_id, design_id, project_id, version_number, status, title, layout_json, asset_summary, cost_estimate_cents, created_by_user_id)
    values (${orgId}::uuid, ${d3Id}::uuid, ${p3Id}::uuid, 1, 'submitted', 'Review draft', '{"gridMm": 1000, "boothSystem": "custom", "dimensions": {"widthMm": 4000, "depthMm": 3000, "heightMm": 2500}, "objects": []}'::jsonb, '{}'::jsonb, 0, ${pmUserId}::uuid)
    returning id::text
  `);
  const v3Id = v3Rows[0]?.id;

  if (!v1Id || !v2Id || !v3Id) return;

  // Tasks
  await db.execute(sql`
    insert into tasks (organization_id, project_id, assigned_to_user_id, created_by_user_id, title, description, status, priority, due_at)
    values 
      (${orgId}::uuid, ${p1Id}::uuid, ${pmUserId}::uuid, ${chiefUserId}::uuid, 'Design initial concept layout', 'Create 3D octanorm mockups.', 'done', 'high', now() - interval '2 days'),
      (${orgId}::uuid, ${p1Id}::uuid, ${pmUserId}::uuid, ${chiefUserId}::uuid, 'Review materials quote', 'Check prices for PVC panels.', 'in_progress', 'normal', now() + interval '3 days'),
      (${orgId}::uuid, ${p1Id}::uuid, ${pmUserId}::uuid, ${chiefUserId}::uuid, 'Submit budget proposal', 'Send total cost estimation.', 'todo', 'urgent', now() + interval '5 days')
  `);

  await db.execute(sql`
    insert into tasks (organization_id, project_id, assigned_to_user_id, created_by_user_id, title, description, status, priority, due_at)
    values 
      (${orgId}::uuid, ${p3Id}::uuid, ${pmUserId}::uuid, ${chiefUserId}::uuid, 'Setup structure frame', 'Assemble the booth space frame.', 'todo', 'high', now() + interval '1 day'),
      (${orgId}::uuid, ${p3Id}::uuid, ${pmUserId}::uuid, ${chiefUserId}::uuid, 'Prepare graphic assets', 'Review print resolution.', 'todo', 'normal', now() + interval '2 days')
  `);

  // Approvals
  await db.execute(sql`
    insert into approvals (organization_id, project_id, booth_version_id, requested_by_user_id, status, message, requested_at, due_at)
    values (${orgId}::uuid, ${p1Id}::uuid, ${v1Id}::uuid, ${pmUserId}::uuid, 'requested', 'Initial 3D Layout review request', now() - interval '1 day', now() + interval '3 days')
  `);

  await db.execute(sql`
    insert into approvals (organization_id, project_id, booth_version_id, requested_by_user_id, status, message, requested_at, due_at)
    values (${orgId}::uuid, ${p3Id}::uuid, ${v3Id}::uuid, ${pmUserId}::uuid, 'under_review', 'Please review the custom graphic panel placements', now() - interval '2 days', now() + interval '1 day')
  `);

  // Comments
  await db.execute(sql`
    insert into comments (organization_id, project_id, booth_version_id, author_user_id, body, created_at)
    values (${orgId}::uuid, ${p1Id}::uuid, ${v1Id}::uuid, ${pmUserId}::uuid, 'Please review the structure heights.', now() - interval '12 hours')
  `);

  // Invoices
  await db.execute(sql`
    insert into invoices (organization_id, client_id, invoice_number, status, currency, subtotal_cents, tax_cents, total_cents, due_at, paid_at, created_at)
    values 
      (${orgId}::uuid, ${c1Id}::uuid, 'INV-2026-001', 'paid', 'EUR', 300000, 60000, 360000, now() - interval '20 days', now() - interval '20 days', now() - interval '25 days'),
      (${orgId}::uuid, ${c2Id}::uuid, 'INV-2026-002', 'paid', 'EUR', 500000, 100000, 600000, now() - interval '10 days', now() - interval '10 days', now() - interval '12 days'),
      (${orgId}::uuid, ${c3Id}::uuid, 'INV-2026-003', 'open', 'EUR', 150000, 30000, 180000, now() + interval '10 days', null, now() - interval '2 days')
  `);

  // Activity Events
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, created_at)
    values 
      (${orgId}::uuid, ${primaryUserId}::uuid, ${p1Id}::uuid, 'project_created', 'created project', now() - interval '5 days'),
      (${orgId}::uuid, ${pmUserId}::uuid, ${p1Id}::uuid, 'layout_updated', 'saved booth layout v1', now() - interval '3 days'),
      (${orgId}::uuid, ${pmUserId}::uuid, ${p1Id}::uuid, 'approval_requested', 'requested layout approval', now() - interval '1 day')
  `);
}

export default router;
