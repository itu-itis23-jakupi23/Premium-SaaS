import { sql, type SQL } from "drizzle-orm";
import type { AuthContext } from "../middlewares/session";

/**
 * Which commercial documents a staff member may see.
 *
 * Quotes and invoices each had their own copy of this, identical bar the table
 * alias. They had not drifted - that was checked - but nothing held them
 * together, and this is the predicate deciding whether one project manager can
 * read another's clients. The money formula was the same shape of duplication
 * and it *had* drifted, silently, into wrong invoice totals. A security
 * predicate is a worse place to discover the same thing.
 *
 * The caller supplies its own column references as SQL fragments rather than an
 * alias string, so there is no `sql.raw` and no identifier interpolation here.
 *
 * Admins, owners and chiefs see everything in their organization; the tenant
 * scope is applied separately by every caller. A project manager sees a
 * document when they are assigned to its project, are a member of that
 * project, or are the assigned manager for its client. The client arm matters:
 * a quote raised before a project exists has a client and no project.
 */
export function staffVisibilityScope(
  auth: AuthContext,
  columns: { projectId: SQL; clientId: SQL },
): SQL {
  if (canManageOrganization(auth)) return sql`true`;
  const uid = auth.user.id;
  return sql`(
    exists (
      select 1 from projects p
      where p.id = ${columns.projectId}
        and (p.assigned_pm_user_id = ${uid}::uuid
          or exists (
            select 1 from project_members pm
            where pm.project_id = p.id and pm.user_id = ${uid}::uuid
          ))
    )
    or exists (
      select 1 from clients c
      where c.id = ${columns.clientId} and c.assigned_pm_user_id = ${uid}::uuid
    )
  )`;
}

/** Roles that see every document in the organization, not only their own. */
export function canManageOrganization(auth: AuthContext): boolean {
  return ["admin", "owner", "chief"].includes(auth.user.role);
}
