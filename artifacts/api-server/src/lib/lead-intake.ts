import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Where public website leads land.
 *
 * `POST /api/leads` files every "Request a quote" submission as a `lead` client
 * in one organization, named by `DEFAULT_ORGANIZATION_SLUG`. If that slug does
 * not resolve, the route has nowhere to put the lead and answers 503 - and the
 * visitor is told to try again, which will never work.
 *
 * That is exactly what was happening: the variable was set to a slug no
 * organization had, it was absent from both Compose files, and nothing checked
 * it. Every website lead was lost, silently, because the only place the failure
 * showed up was a 503 the submitter saw and nobody else did.
 *
 * So the resolution lives here, once, and is asserted at startup rather than
 * discovered at the first submission.
 *
 * One case is deliberately *not* fatal: a database with no organizations at
 * all. A deployment has to be able to boot before anyone has signed up, and
 * refusing to start on an unseeded database would make the very first boot
 * impossible - it would also turn every disposable-database test run red. An
 * empty database is a bootstrap state; a populated one with a slug that matches
 * nothing is a misconfiguration, and only the second should stop a server.
 */

export const LEAD_INTAKE_SLUG_VAR = "DEFAULT_ORGANIZATION_SLUG";

export type LeadIntakeFailure = "unset" | "unknown-organization" | "no-organizations";

export type LeadIntakeResolution =
  | { ok: true; slug: string; organizationId: string }
  | { ok: false; slug: string | null; reason: LeadIntakeFailure };

/** Read the configured slug, trimmed. Empty and whitespace count as unset. */
export function leadIntakeSlug(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env[LEAD_INTAKE_SLUG_VAR]?.trim();
  return raw ? raw : null;
}

async function rows<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

/**
 * Resolve the configured slug to a live organization id.
 *
 * Never throws for a configuration problem - callers decide whether an
 * unresolvable slug is fatal (startup) or a 503 (a request already in flight).
 * A database failure still throws, because that is not a configuration problem
 * and must not be reported as one.
 */
export async function resolveLeadIntakeOrganization(
  env: NodeJS.ProcessEnv = process.env,
): Promise<LeadIntakeResolution> {
  const slug = leadIntakeSlug(env);
  if (!slug) return { ok: false, slug: null, reason: "unset" };

  const found = await rows<{ id: string }>(
    sql`select id::text from organizations where slug = ${slug} and deleted_at is null limit 1`,
  );
  const organizationId = found[0]?.id;
  if (organizationId) return { ok: true, slug, organizationId };

  // Distinguish "wrong slug" from "nothing has been created yet".
  const any = await rows<{ n: string }>(
    sql`select count(*)::text as n from organizations where deleted_at is null`,
  );
  if (any[0]?.n === "0") return { ok: false, slug, reason: "no-organizations" };

  return { ok: false, slug, reason: "unknown-organization" };
}

/** Human-readable reason a resolution failed, for logs and startup output. */
export function describeLeadIntakeFailure(result: LeadIntakeResolution): string {
  if (result.ok) return "";
  if (result.reason === "unset") {
    return (
      `${LEAD_INTAKE_SLUG_VAR} is not set. Public lead intake has no organization to ` +
      `file website enquiries against, so every "Request a quote" submission would be lost. ` +
      `Set it to the slug of the organization that owns inbound leads.`
    );
  }
  if (result.reason === "no-organizations") {
    return (
      `${LEAD_INTAKE_SLUG_VAR} is "${result.slug}", and this database has no organizations yet. ` +
      `Lead intake will start working once an organization with that slug exists. ` +
      `If this is not a fresh deployment, the slug is wrong.`
    );
  }
  return (
    `${LEAD_INTAKE_SLUG_VAR} is "${result.slug}", but no organization has that slug. ` +
    `Every "Request a quote" submission would be answered 503 and lost. ` +
    `Set it to an existing organization's slug.`
  );
}

/**
 * Whether a failed resolution should stop the server.
 *
 * A wrong slug always should: the database has organizations and none of them
 * is the one named, so this deployment will drop every lead it receives. An
 * unset slug stops a real deployment but is only a warning in development and
 * test, where the variable is routinely absent. An empty database never stops
 * anything - see the note at the top of this file.
 */
export function isFatalLeadIntakeFailure(
  reason: LeadIntakeFailure,
  profile: string,
): boolean {
  if (reason === "no-organizations") return false;
  if (reason === "unknown-organization") return true;
  return profile === "production" || profile === "staging" || profile === "local";
}
