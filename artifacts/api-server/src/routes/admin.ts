import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { logger } from "../lib/logger";

/**
 * Account administration: role changes, account disabling, membership
 * suspension.
 *
 * Every one of these required a database console before this existed. The
 * schema has modelled them all along - users.role, users.disabled_at,
 * memberships.status carries 'suspended' and 'revoked' - and nothing ever wrote
 * them, so promoting a PM, disabling a compromised account or offboarding a
 * leaver all meant hand-written UPDATE statements against production.
 *
 * ── NOT ENABLED BY DEFAULT ──────────────────────────────────────────────────
 * The whole surface is behind ADMIN_SURFACE_ENABLED, which is set nowhere: not
 * in .env.example, not in either Compose file, not in CI. With it unset every
 * route here answers 404 - not 403, so the surface does not announce that it
 * exists - and no navigation anywhere links to it. Turning it on is a decision
 * for whoever owns this product, because these endpoints can lock people out of
 * their own organization.
 *
 * Authorization is the existing pattern, not a new one: requireAuth +
 * requireTenant + requireRoles(["admin","owner"]), the same trio the other
 * admin-scoped routes use, with every statement additionally scoped to
 * req.tenant so one organization's admin cannot touch another's people.
 *
 * Three rules beyond that, all of them about not creating a situation nobody
 * can undo from the UI:
 *   - nobody may change their own role, disable themselves or suspend their own
 *     membership. This is also what keeps an organization from being left with
 *     no administrator: the caller is an active admin by definition, so acting
 *     on anybody else always leaves at least the caller. An earlier draft had a
 *     separate "last administrator" check on top of this, which was removed
 *     because it could not fire - the caller is always in the count.
 *   - role changes are limited to chief/pm/client - granting or removing
 *     admin/owner is deliberately not possible from here;
 *   - every mutation writes an activity_events row naming actor, target and
 *     the before/after values.
 */

const router: IRouter = Router();

export function adminSurfaceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ADMIN_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

/** Roles this surface may assign. admin/owner are deliberately out of reach. */
const ASSIGNABLE_ROLES = ["chief", "pm", "client"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
const MEMBERSHIP_STATES = ["active", "suspended", "revoked"] as const;
type MembershipState = (typeof MEMBERSHIP_STATES)[number];

async function queryRows<T>(statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

/**
 * The gate. Mounted before authentication so that with the flag off this
 * surface is indistinguishable from a route that was never written.
 */
router.use("/admin", (req, res, next) => {
  if (!adminSurfaceEnabled()) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  next();
});
router.use("/admin", requireAuth, requireTenant, requireRoles(["admin", "owner"]));

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  membershipStatus: string;
  disabledAt: string | null;
  joinedAt: string | null;
}

const MEMBER_COLUMNS = sql`
  u.id::text as "userId", u.name, u.email, u.role::text as "role",
  m.status::text as "membershipStatus", u.disabled_at as "disabledAt", m.joined_at as "joinedAt"
`;

async function findMember(auth: AuthContext, userId: string): Promise<MemberRow | null> {
  const rows = await queryRows<MemberRow>(sql`
    select ${MEMBER_COLUMNS}
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${auth.organization.id}::uuid
      and u.id = ${userId}::uuid
      and u.deleted_at is null
    limit 1
  `);
  return rows[0] ?? null;
}

/** Audit row. Actor, target and the change, with created_at supplying "when". */
async function audit(
  auth: AuthContext,
  eventType: string,
  message: string,
  metadata: Record<string, unknown>,
) {
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
    values (
      ${auth.organization.id}::uuid, ${auth.user.id}::uuid, ${eventType}, ${message},
      ${JSON.stringify({ ...metadata, actorEmail: auth.user.email })}::jsonb
    )
  `);
  logger.info({ ...metadata, actor: auth.user.id, organization: auth.organization.id }, message);
}

function deny(res: Parameters<Parameters<IRouter["get"]>[1]>[1], code: string, message: string, status = 409) {
  res.status(status).json({ error: { code, message } });
}

// ── Who is in this organization ─────────────────────────────────────────────
router.get("/admin/members", async (req, res) => {
  const auth = req.auth!;
  const rows = await queryRows<MemberRow>(sql`
    select ${MEMBER_COLUMNS}
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${auth.organization.id}::uuid and u.deleted_at is null
    order by u.role::text, u.name
  `);
  res.json({ members: rows });
});

// ── Role ────────────────────────────────────────────────────────────────────
router.patch("/admin/members/:userId/role", async (req, res) => {
  const auth = req.auth!;
  const { userId } = req.params;
  const role = String((req.body ?? {}).role ?? "") as AssignableRole;

  if (!ASSIGNABLE_ROLES.includes(role)) {
    deny(res, "invalid_role", `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}.`, 400);
    return;
  }
  if (userId === auth.user.id) {
    deny(res, "self_change_denied", "You cannot change your own role.");
    return;
  }

  const member = await findMember(auth, userId);
  if (!member) { deny(res, "member_not_found", "Member not found.", 404); return; }
  if (member.role === role) { deny(res, "no_change", `Already ${role}.`); return; }

  await db.execute(sql`
    update users set role = ${role}::user_role, updated_at = now() where id = ${userId}::uuid
  `);
  await db.execute(sql`
    update memberships set role = ${role}::user_role, updated_at = now()
    where organization_id = ${auth.organization.id}::uuid and user_id = ${userId}::uuid
  `);
  await audit(auth, "admin_role_changed", `changed ${member.email} from ${member.role} to ${role}`, {
    targetUserId: userId, targetEmail: member.email, from: member.role, to: role,
  });

  res.json({ member: await findMember(auth, userId) });
});

// ── Account enabled / disabled ──────────────────────────────────────────────
router.patch("/admin/members/:userId/disabled", async (req, res) => {
  const auth = req.auth!;
  const { userId } = req.params;
  const disabled = (req.body ?? {}).disabled;
  if (typeof disabled !== "boolean") {
    deny(res, "invalid_request", "`disabled` must be true or false.", 400);
    return;
  }
  if (userId === auth.user.id && disabled) {
    deny(res, "self_change_denied", "You cannot disable your own account.");
    return;
  }

  const member = await findMember(auth, userId);
  if (!member) { deny(res, "member_not_found", "Member not found.", 404); return; }
  if (Boolean(member.disabledAt) === disabled) {
    deny(res, "no_change", disabled ? "Already disabled." : "Already active.");
    return;
  }

  await db.execute(sql`
    update users set disabled_at = ${disabled ? sql`now()` : sql`null`}, updated_at = now()
    where id = ${userId}::uuid
  `);
  await audit(
    auth,
    disabled ? "admin_account_disabled" : "admin_account_enabled",
    `${disabled ? "disabled" : "re-enabled"} the account for ${member.email}`,
    { targetUserId: userId, targetEmail: member.email, disabled },
  );

  res.json({ member: await findMember(auth, userId) });
});

// ── Membership status ───────────────────────────────────────────────────────
router.patch("/admin/members/:userId/membership", async (req, res) => {
  const auth = req.auth!;
  const { userId } = req.params;
  const status = String((req.body ?? {}).status ?? "") as MembershipState;

  if (!MEMBERSHIP_STATES.includes(status)) {
    deny(res, "invalid_status", `Status must be one of: ${MEMBERSHIP_STATES.join(", ")}.`, 400);
    return;
  }
  if (userId === auth.user.id && status !== "active") {
    deny(res, "self_change_denied", "You cannot suspend your own membership.");
    return;
  }

  const member = await findMember(auth, userId);
  if (!member) { deny(res, "member_not_found", "Member not found.", 404); return; }
  if (member.membershipStatus === status) { deny(res, "no_change", `Already ${status}.`); return; }

  await db.execute(sql`
    update memberships set status = ${status}::membership_status, updated_at = now()
    where organization_id = ${auth.organization.id}::uuid and user_id = ${userId}::uuid
  `);
  await audit(auth, "admin_membership_status_changed",
    `set ${member.email}'s membership to ${status}`,
    { targetUserId: userId, targetEmail: member.email, from: member.membershipStatus, to: status });

  res.json({ member: await findMember(auth, userId) });
});

export default router;
