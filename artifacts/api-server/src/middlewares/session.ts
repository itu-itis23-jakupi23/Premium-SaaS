import { sql, type SQL } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "@workspace/db";
import { verifyAccessToken } from "../lib/tokens";

export type AuthRole = "admin" | "owner" | "chief" | "pm" | "client";
export type UiRole = "chief" | "pm" | "client";

export interface AuthContext {
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: AuthRole;
    uiRole: UiRole;
    avatarUrl: string;
    avatarTone: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

async function queryRows<T>(statement: SQL) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.ens_access;
    const payload = typeof token === "string" ? verifyAccessToken(token) : null;

    if (!payload) {
      res.status(401).json({
        error: {
          code: "auth_required",
          message: "Authentication is required.",
        },
      });
      return;
    }

    const auth = await getAuthContext(payload.sid, payload.sub, payload.org);

    if (!auth) {
      res.status(401).json({
        error: {
          code: "session_invalid",
          message: "Session is no longer active.",
        },
      });
      return;
    }

    req.auth = auth;
    next();
  } catch (error) {
    req.log?.error({ err: error }, "Session authentication failed");
    res.status(500).json({
      error: {
        code: "auth_failed",
        message: "Authentication failed.",
      },
    });
  }
}

export function requireRoles(roles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({
        error: {
          code: "auth_required",
          message: "Authentication is required.",
        },
      });
      return;
    }

    if (!roles.includes(req.auth.user.role)) {
      res.status(403).json({
        error: {
          code: "permission_denied",
          message: "You do not have permission to perform this action.",
        },
      });
      return;
    }

    next();
  };
}

export function toUiRole(role: AuthRole): UiRole {
  if (role === "pm") return "pm";
  if (role === "client") return "client";
  return "chief";
}

export async function getAuthContext(sessionId: string, userId: string, organizationId: string) {
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
    where s.id = ${sessionId}::uuid
      and s.user_id = ${userId}::uuid
      and s.organization_id = ${organizationId}::uuid
      and s.revoked_at is null
      and s.expires_at > now()
      and u.disabled_at is null
      and u.deleted_at is null
      and o.deleted_at is null
      and m.status::text = 'active'
    limit 1
  `);

  const row = rows[0];
  if (!row) return null;
  const profile = objectValue(row.metadata.profile);

  return {
    sessionId: row.sessionId,
    user: {
      id: row.userId,
      name: row.name,
      email: row.email,
      role: row.role,
      uiRole: toUiRole(row.role),
      avatarUrl: stringValue(profile.avatarUrl) ?? "",
      avatarTone: stringValue(profile.avatarTone) ?? "primary",
    },
    organization: {
      id: row.organizationId,
      name: row.organizationName,
      slug: row.organizationSlug,
      plan: row.organizationPlan,
    },
  } satisfies AuthContext;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
