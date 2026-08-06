import type { NextFunction, Request, Response } from "express";

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

    // requireTenant is only used after requireAuth, so if req.auth is not set
    // the auth middleware must have failed to block the request. Enforce here.
    res.status(401).json({
      error: {
        code: "auth_required",
        message: "Authentication is required.",
      },
    });
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
