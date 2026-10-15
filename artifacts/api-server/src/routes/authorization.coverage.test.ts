import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

/**
 * Every route, probed without credentials.
 *
 * authorization.matrix.test.ts asserts the role boundaries that matter most,
 * but it is a hand-written list of about two dozen cases against more than a
 * hundred and thirty routes. A route added without a guard is exactly the kind
 * of thing a curated list misses, and the cost of missing it is an endpoint
 * serving one organization's data to anyone who asks.
 *
 * So this enumerates the Express stack at runtime rather than restating it:
 * every route the app actually serves is probed with no cookies, and anything
 * that answers is required to be on the public list below. A new route is
 * covered the moment it is mounted, without anyone remembering to add a case.
 *
 * ── Why this matters more than it looks ──────────────────────────────────────
 * Several routers - quotes, invoices, exhibitions, crm - call
 * `router.use(requireAuth, requireTenant)` with no path. An unpathed `use`
 * applies to every request that reaches that router, so each one also guards
 * everything mounted *after* it in routes/index.ts. Protection therefore
 * depends on mount order, which routes/index.ts notes in a comment.
 *
 * A comment is not a guard. Reordering those lines, or mounting a new router
 * above them, would silently expose routes with no code change at the route
 * itself and nothing failing. This test is what makes that order safe: it was
 * verified by adding an unguarded route to the first-mounted router, which it
 * reported as `GET /leaky-report -> 200`. Adding the same route to a
 * late-mounted router did *not* trip it, because an earlier blanket guard
 * already covered it - which is the mount-order dependency, demonstrated.
 */

const UUID = "00000000-0000-4000-8000-000000000001";

/**
 * Routes that answer without credentials, and why each one may.
 *
 * Deliberately a list of exact strings rather than patterns: a prefix rule
 * would quietly cover a future sibling route that should not be public.
 */
const PUBLIC_ROUTES = new Map<string, string>([
  ["GET /health", "liveness probe for the platform"],
  ["GET /healthz", "liveness probe"],
  ["GET /healthz/ready", "readiness probe, used to gate traffic during a deploy"],
  ["GET /auth/me", "returns an empty auth response when there is no session"],
  ["POST /auth/logout", "idempotent: clearing cookies that are not there is a no-op"],
  ["POST /client-errors", "browser error beacon, necessarily unauthenticated; rate limited"],
  ["POST /auth/login", "signing in is how you stop being unauthenticated"],
  ["POST /auth/signup", "public client intake"],
  ["POST /auth/signup-staff", "staff signup, gated by a setup key rather than a session"],
  ["POST /auth/forgot-password", "a locked-out user has no session; rate limited per address"],
  ["POST /auth/reset-password", "the reset token is the credential"],
  ["POST /leads", "public enquiry form at the top of the sales funnel; rate limited"],
  ["GET /platform/managers/invitations/validate", "an invited PM has no account yet"],
  ["POST /platform/managers/invitations/accept", "the invitation token is the credential"],
]);

/** Every route the app serves, read from the router rather than a list. */
function mountedRoutes(): Array<{ method: string; path: string }> {
  const internals = app as unknown as Record<string, { stack?: unknown[] }>;
  const stack = internals.router?.stack ?? internals._router?.stack ?? [];
  const found: Array<{ method: string; path: string }> = [];

  const walk = (entries: unknown[]) => {
    for (const entry of entries as Array<Record<string, never>>) {
      const layer = entry as unknown as {
        route?: { path?: string; methods?: Record<string, boolean> };
        handle?: { stack?: unknown[] };
      };
      if (layer.route?.path && layer.route.methods) {
        for (const method of Object.keys(layer.route.methods)) {
          // `_all` is not a verb a caller can send, and HEAD mirrors GET.
          if (method === "_all" || method === "head") continue;
          found.push({ method: method.toUpperCase(), path: layer.route.path });
        }
      }
      if (layer.handle?.stack) walk(layer.handle.stack);
    }
  };

  walk(stack);
  return found;
}

const routes = mountedRoutes();

describe("authorization coverage", () => {
  it("finds the routes it means to check", () => {
    // Guards the guard: an Express upgrade that moved the stack would make
    // every assertion below vacuous rather than failing.
    expect(routes.length).toBeGreaterThan(100);
  });

  it("has no stale entry in the public list", () => {
    // A route that was removed or renamed must not leave a permanent
    // exemption behind for a future route to inherit.
    const mounted = new Set(routes.map((r) => `${r.method} ${r.path}`));
    const stale = [...PUBLIC_ROUTES.keys()].filter((key) => !mounted.has(key));
    expect(stale, `these are exempted but no longer mounted: ${stale.join(", ")}`).toEqual([]);
  });

  it("refuses every route that is not deliberately public", async () => {
    const reachable: string[] = [];

    for (const { method, path } of routes) {
      const key = `${method} ${path}`;
      if (PUBLIC_ROUTES.has(key)) continue;

      const url = `/api${path.replace(/:[A-Za-z0-9_]+/g, UUID)}`;
      const send = (request(app) as unknown as Record<string, (u: string) => {
        send: (body: unknown) => Promise<{ status: number }>;
      }>)[method.toLowerCase()];
      const response = await send(url).send({});

      /**
       * 401 is the expected answer. 404 is accepted only because the admin
       * surface answers 404 rather than 403 when ADMIN_SURFACE_ENABLED is
       * unset, so that it is indistinguishable from a route that was never
       * written - see routes/admin.ts.
       *
       * Anything else means the request got past authentication.
       */
      if (response.status !== 401 && response.status !== 404) {
        reachable.push(`${key} -> ${response.status}`);
      }
    }

    expect(
      reachable,
      `these answered without credentials and are not on the public list:\n  ${reachable.join("\n  ")}`,
    ).toEqual([]);
  }, 300_000);
});
