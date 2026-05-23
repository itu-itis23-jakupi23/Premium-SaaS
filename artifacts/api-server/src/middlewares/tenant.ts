import { sql, type SQL } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "@workspace/db";

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

async function queryRows<T>(statement: SQL) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

export async function requireTenant(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.auth?.organization) {
      const requestedOrganizationId = headerValue(req, "x-organization-id");
      const requestedOrganizationSlug = headerValue(req, "x-organization-slug");

      if (
        (requestedOrganizationId && requestedOrganizationId !== req.auth.organization.id) ||
        (requestedOrganizationSlug && requestedOrganizationSlug !== req.auth.organization.slug)
      ) {
        res.status(403).json({
          error: {
            code: "tenant_mismatch",
            message: "Authenticated session cannot access the requested organization.",
          },
        });
        return;
      }

      req.tenant = req.auth.organization;
      next();
      return;
    }

    const organizationId = headerValue(req, "x-organization-id");
    const organizationSlug = headerValue(req, "x-organization-slug") ?? localDefaultSlug();

    if (!organizationId && !organizationSlug) {
      res.status(400).json({
        error: {
          code: "tenant_required",
          message: "Organization context is required.",
        },
      });
      return;
    }

    const tenant = organizationId
      ? await findOrganizationById(organizationId)
      : await findOrganizationBySlug(organizationSlug as string);

    if (!tenant) {
      res.status(404).json({
        error: {
          code: "tenant_not_found",
          message: "Organization was not found.",
        },
      });
      return;
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    req.log?.error({ err: error }, "Tenant resolution failed");
    res.status(500).json({
      error: {
        code: "tenant_resolution_failed",
        message: "Could not resolve organization context.",
      },
    });
  }
}

function headerValue(req: Request, name: string) {
  const value = req.header(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function localDefaultSlug() {
  if (process.env.DEFAULT_ORGANIZATION_SLUG) {
    return process.env.DEFAULT_ORGANIZATION_SLUG;
  }

  return process.env.NODE_ENV === "production" ? null : "ens-demo-agency";
}

async function findOrganizationById(id: string) {
  const rows = await queryRows<TenantContext>(sql`
    select id::text, name, slug, plan
    from organizations
    where id = ${id}::uuid
      and deleted_at is null
    limit 1
  `);

  return rows[0] ?? null;
}

async function findOrganizationBySlug(slug: string) {
  const rows = await queryRows<TenantContext>(sql`
    select id::text, name, slug, plan
    from organizations
    where slug = ${slug}
      and deleted_at is null
    limit 1
  `);

  return rows[0] ?? null;
}
