import { sql, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { hashPassword, verifyPassword } from "../lib/password";
import { createRefreshToken, hashToken } from "../lib/tokens";

const router: IRouter = Router();

router.use("/platform", requireAuth, requireTenant);

async function queryRows<T>(statement: SQL) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

router.get("/platform/overview", async (req, res) => {
  const organization = req.tenant!;

  const [metrics, projects, clients, activity] = await Promise.all([
    getMetrics(organization.id, req.auth!),
    getProjects(organization.id, 8, req.auth!),
    getClients(organization.id, 8, req.auth!),
    getActivity(organization.id, 8, req.auth!),
  ]);

  res.json({
    organization,
    metrics,
    projects,
    clients,
    activity,
    charts: buildCharts(metrics, activity),
  });
});

router.get("/platform/projects", async (req, res) => {
  const organization = req.tenant!;
  res.json({
    projects: await getProjects(organization.id, 100, req.auth!),
  });
});

router.post("/platform/projects", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const organization = req.tenant!;

  const input = parseCreateProjectInput(req.body);

  if (!input.ok) {
    res.status(400).json({ error: input.error });
    return;
  }

  const project = await createProject(organization.id, input.value);
  res.status(201).json({ project });
});

router.get("/platform/clients", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const organization = req.tenant!;
  res.json({
    clients: await getClients(organization.id, 100, req.auth!),
  });
});

router.get("/platform/account/settings", async (req, res) => {
  const settings = await getAccountSettings(req.auth!);
  res.json(settings);
});

router.put("/platform/account/settings", async (req, res) => {
  const input = parseAccountSettingsInput(req.body);

  if (!input.ok) {
    res.status(400).json({ error: input.error });
    return;
  }

  const settings = await updateAccountSettings(req.auth!, input.value);
  await auditEvent(req.tenant!.id, req.auth!.user.id, "account_settings_updated", "updated account settings", {});
  res.json(settings);
});

router.put("/platform/account/avatar", async (req, res) => {
  const input = parseAvatarInput(req.body);

  if (!input.ok) {
    res.status(400).json({ error: input.error });
    return;
  }

  const settings = await updateAccountAvatar(req.auth!, input.value);
  await auditEvent(req.tenant!.id, req.auth!.user.id, "account_avatar_updated", "updated account avatar", {});
  res.json(settings);
});

router.put("/platform/account/password", async (req, res) => {
  const input = parsePasswordInput(req.body);

  if (!input.ok) {
    res.status(400).json({ error: input.error });
    return;
  }

  const changed = await updateAccountPassword(req.auth!, input.value.currentPassword, input.value.newPassword);

  if (!changed.ok) {
    res.status(400).json({ error: changed.error });
    return;
  }

  await auditEvent(req.tenant!.id, req.auth!.user.id, "account_password_updated", "updated account password", {});
  res.status(204).send();
});

router.get("/platform/account/sessions", async (req, res) => {
  res.json({ sessions: await getAccountSessions(req.auth!) });
});

router.delete("/platform/account/sessions/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;
  if (!sessionId) {
    res.status(400).json({ error: "Session id is required" });
    return;
  }

  const count = await revokeAccountSession(req.auth!, sessionId);
  res.json({ revoked: count });
});

router.get("/platform/managers", requireRoles(["admin", "owner", "chief"]), async (req, res) => {
  const organization = req.tenant!;
  res.json({
    managers: await getManagers(organization.id),
    clients: await getManagedClients(organization.id),
    projects: await getManagedProjects(organization.id),
    audit: await getManagerAudit(organization.id, 30),
    invitations: await getManagerInvitations(organization.id),
  });
});

router.post("/platform/managers/invitations", requireRoles(["admin", "owner", "chief"]), async (req, res) => {
  const organization = req.tenant!;
  const input = parseInviteManagerInput(req.body);

  if (!input.ok) {
    res.status(400).json({ error: input.error });
    return;
  }

  const invitation = await inviteManager(organization.id, req.auth!.user.id, input.value);
  await auditEvent(organization.id, req.auth!.user.id, "manager_invited", `invited ${input.value.email}`, { email: input.value.email });
  res.status(201).json({ invitation });
});

router.put("/platform/managers/assignments", requireRoles(["admin", "owner", "chief"]), async (req, res) => {
  const organization = req.tenant!;
  const input = parseAssignmentsInput(req.body);

  if (!input.ok) {
    res.status(400).json({ error: input.error });
    return;
  }

  const result = await updateAssignments(organization.id, req.auth!.user.id, input.value);
  res.json(result);
});

router.patch("/platform/managers/:managerId/status", requireRoles(["admin", "owner", "chief"]), async (req, res) => {
  const organization = req.tenant!;
  const status = stringValue((req.body as Record<string, unknown> | undefined)?.status);
  const managerId = req.params.managerId;

  if (!managerId || !["active", "suspended"].includes(status ?? "")) {
    res.status(400).json({ error: "A valid manager id and status are required" });
    return;
  }

  await db.execute(sql`
    update memberships
    set status = ${status}::membership_status, updated_at = now()
    where organization_id = ${organization.id}::uuid
      and user_id = ${managerId}::uuid
      and role::text = 'pm'
  `);
  await auditEvent(organization.id, req.auth!.user.id, "manager_status_updated", `updated manager status to ${status}`, { managerId, status });
  res.json({ ok: true });
});

router.get("/platform/calendar", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const organization = req.tenant!;
  res.json({ events: await getCalendarEvents(organization.id, req.auth!) });
});

async function getAccountSettings(auth: AuthContext) {
  const rows = await queryRows<{
    id: string;
    name: string;
    email: string;
    metadata: Record<string, unknown>;
  }>(sql`
    select id::text, name, email, metadata
    from users
    where id = ${auth.user.id}::uuid
      and deleted_at is null
    limit 1
  `);

  const row = rows[0];
  const metadata = row?.metadata ?? {};
  const profile = objectValue(metadata.profile);
  const accountSettings = objectValue(metadata.accountSettings);
  const notifications = objectValue(accountSettings.notifications);
  const appearance = objectValue(accountSettings.appearance);
  const security = objectValue(accountSettings.security);

  return {
    profile: {
      name: row?.name ?? auth.user.name,
      email: row?.email ?? auth.user.email,
      phone: stringValue(profile.phone) ?? "",
      role: auth.user.role,
      avatarTone: stringValue(profile.avatarTone) ?? "primary",
      avatarUrl: stringValue(profile.avatarUrl) ?? "",
    },
    notifications: {
      assignments: boolValue(notifications.assignments, true),
      milestones: boolValue(notifications.milestones, true),
      reports: boolValue(notifications.reports, true),
      system: boolValue(notifications.system, true),
    },
    appearance: {
      theme: stringValue(appearance.theme) ?? "dark",
      compact: boolValue(appearance.compact, false),
      language: stringValue(appearance.language) ?? "English (US)",
    },
    security: {
      twoFactorEnabled: boolValue(security.twoFactorEnabled, false),
      recoveryCodes: arrayOfStrings(security.recoveryCodes),
    },
  };
}

async function updateAccountSettings(
  auth: AuthContext,
  input: {
    profile?: Record<string, unknown>;
    notifications?: Record<string, unknown>;
    appearance?: Record<string, unknown>;
    security?: Record<string, unknown>;
  },
) {
  const current = await getUserMetadata(auth.user.id);
  const currentProfile = objectValue(current.profile);
  const currentSettings = objectValue(current.accountSettings);

  const nextProfile = {
    ...currentProfile,
    ...objectValue(input.profile),
  };
  const nextSettings = {
    ...currentSettings,
    notifications: {
      ...objectValue(currentSettings.notifications),
      ...objectValue(input.notifications),
    },
    appearance: {
      ...objectValue(currentSettings.appearance),
      ...objectValue(input.appearance),
    },
    security: {
      ...objectValue(currentSettings.security),
      ...objectValue(input.security),
    },
  };
  const nextMetadata = {
    ...current,
    profile: nextProfile,
    accountSettings: nextSettings,
  };

  const profileName = stringValue(input.profile?.name);
  const profileEmail = stringValue(input.profile?.email);

  await db.execute(sql`
    update users
    set
      name = coalesce(${profileName}, name),
      email = coalesce(${profileEmail}, email),
      metadata = ${JSON.stringify(nextMetadata)}::jsonb,
      updated_at = now()
    where id = ${auth.user.id}::uuid
  `);

  return getAccountSettings(auth);
}

async function updateAccountAvatar(auth: AuthContext, input: { avatarUrl: string; avatarTone: string }) {
  return updateAccountSettings(auth, {
    profile: {
      avatarUrl: input.avatarUrl,
      avatarTone: input.avatarTone,
    },
  });
}

async function updateAccountPassword(auth: AuthContext, currentPassword: string, newPassword: string) {
  const rows = await queryRows<{ passwordHash: string | null }>(sql`
    select password_hash as "passwordHash"
    from users
    where id = ${auth.user.id}::uuid
      and deleted_at is null
    limit 1
  `);
  const existing = rows[0];

  if (!existing?.passwordHash || !verifyPassword(currentPassword, existing.passwordHash)) {
    return { ok: false as const, error: "Current password is incorrect" };
  }

  await db.execute(sql`
    update users
    set password_hash = ${hashPassword(newPassword)}, updated_at = now()
    where id = ${auth.user.id}::uuid
  `);

  return { ok: true as const };
}

async function getAccountSessions(auth: AuthContext) {
  const rows = await queryRows<{
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    rotatedAt: string | null;
    expiresAt: string;
    current: boolean;
  }>(sql`
    select
      id::text,
      user_agent as "userAgent",
      ip_address as "ipAddress",
      created_at::text as "createdAt",
      rotated_at::text as "rotatedAt",
      expires_at::text as "expiresAt",
      (id = ${auth.sessionId}::uuid) as current
    from sessions
    where user_id = ${auth.user.id}::uuid
      and organization_id = ${auth.organization.id}::uuid
      and revoked_at is null
      and expires_at > now()
    order by created_at desc
  `);

  return rows.map((session) => ({
    id: session.id,
    device: describeUserAgent(session.userAgent),
    location: session.ipAddress ?? "Unknown location",
    lastActive: relativeTime(session.rotatedAt ?? session.createdAt),
    expiresAt: session.expiresAt,
    current: session.current,
  }));
}

async function revokeAccountSession(auth: AuthContext, sessionId: string) {
  if (sessionId === auth.sessionId) return 0;

  await db.execute(sql`
    update sessions
    set revoked_at = now()
    where id = ${sessionId}::uuid
      and user_id = ${auth.user.id}::uuid
      and organization_id = ${auth.organization.id}::uuid
      and revoked_at is null
  `);

  return 1;
}

async function getManagers(organizationId: string) {
  const rows = await queryRows<{
    id: string;
    name: string;
    email: string;
    status: string;
    createdAt: string;
    metadata: Record<string, unknown>;
    activeProjects: number;
    delayedProjects: number;
    urgentProjects: number;
    clients: number;
    nextDeadline: string | null;
  }>(sql`
    select
      u.id::text,
      u.name,
      u.email,
      m.status::text as status,
      m.created_at::text as "createdAt",
      u.metadata,
      count(distinct p.id) filter (where p.status::text <> 'completed' and p.deleted_at is null)::int as "activeProjects",
      count(distinct p.id) filter (where (p.status::text = 'delayed' or p.health::text in ('delayed', 'blocked', 'at_risk')) and p.deleted_at is null)::int as "delayedProjects",
      count(distinct p.id) filter (where p.deadline_at is not null and p.deadline_at <= now() + interval '14 days' and p.deleted_at is null)::int as "urgentProjects",
      count(distinct c.id)::int as clients,
      min(p.deadline_at)::text as "nextDeadline"
    from memberships m
    join users u on u.id = m.user_id
    left join clients c on c.assigned_pm_user_id = u.id and c.organization_id = m.organization_id and c.deleted_at is null
    left join projects p on p.assigned_pm_user_id = u.id and p.organization_id = m.organization_id and p.deleted_at is null
    where m.organization_id = ${organizationId}::uuid
      and m.role::text = 'pm'
      and u.deleted_at is null
    group by u.id, m.status, m.created_at
    order by u.name asc
  `);

  return rows.map((manager) => {
    const profile = objectValue(manager.metadata.profile);
    const activeProjects = Number(manager.activeProjects ?? 0);
    const delayedProjects = Number(manager.delayedProjects ?? 0);
    const urgentProjects = Number(manager.urgentProjects ?? 0);
    const clientCount = Number(manager.clients ?? 0);
    const workload = Math.min(100, Math.max(0, activeProjects * 18 + delayedProjects * 18 + urgentProjects * 8 + clientCount * 5));

    return {
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: "Project Manager",
      status: manager.status === "active" ? "Active" : manager.status === "invited" ? "Pending" : "On Leave",
      rating: numberFromMetadata(manager.metadata.rating, 4.7),
      avatarUrl: stringValue(profile.avatarUrl) ?? "",
      avatarTone: stringValue(profile.avatarTone) ?? "primary",
      workload,
      activeProjects,
      delayedProjects,
      urgentProjects,
      clients: clientCount,
      nextDeadline: manager.nextDeadline?.slice(0, 10) ?? null,
      joinedAt: manager.createdAt,
    };
  });
}

async function getManagedClients(organizationId: string) {
  const rows = await queryRows<{
    id: string;
    name: string;
    contactName: string;
    contactEmail: string;
    managerId: string | null;
    managerName: string | null;
    exhibition: string | null;
    status: string;
    lastActivity: string;
  }>(sql`
    select
      c.id::text,
      c.company_name as name,
      c.contact_name as "contactName",
      c.contact_email as "contactEmail",
      c.assigned_pm_user_id::text as "managerId",
      u.name as "managerName",
      max(p.exhibition_name) as exhibition,
      c.status::text as status,
      greatest(c.updated_at, coalesce(max(p.updated_at), c.updated_at))::text as "lastActivity"
    from clients c
    left join users u on u.id = c.assigned_pm_user_id
    left join projects p on p.client_id = c.id and p.deleted_at is null
    where c.organization_id = ${organizationId}::uuid
      and c.deleted_at is null
    group by c.id, u.name
    order by c.company_name asc
  `);

  return rows.map((client) => ({
    id: client.id,
    name: client.name,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    managerId: client.managerId,
    managerName: client.managerName ?? "Unassigned",
    exhibition: client.exhibition ?? "No active exhibition",
    status: toTitle(client.status),
    lastActivity: relativeTime(client.lastActivity),
  }));
}

async function getManagedProjects(organizationId: string) {
  const rows = await queryRows<{
    id: string;
    name: string;
    clientId: string;
    client: string;
    managerId: string | null;
    managerName: string | null;
    exhibition: string | null;
    status: string;
    health: string;
    progress: number;
    deadline: string | null;
    system: string;
  }>(sql`
    select
      p.id::text,
      p.name,
      p.client_id::text as "clientId",
      c.company_name as client,
      p.assigned_pm_user_id::text as "managerId",
      u.name as "managerName",
      p.exhibition_name as exhibition,
      p.status::text as status,
      p.health::text as health,
      ${0}::int as progress,
      p.deadline_at::text as deadline,
      coalesce(bd.booth_system::text, 'custom') as system
    from projects p
    join clients c on c.id = p.client_id
    left join users u on u.id = p.assigned_pm_user_id
    left join lateral (
      select booth_system
      from booth_designs bd
      where bd.project_id = p.id and bd.deleted_at is null
      order by bd.updated_at desc
      limit 1
    ) bd on true
    where p.organization_id = ${organizationId}::uuid
      and p.deleted_at is null
    order by p.deadline_at nulls last, p.updated_at desc
  `);

  return rows.map((project) => ({
    id: project.id,
    name: project.name,
    clientId: project.clientId,
    client: project.client,
    managerId: project.managerId,
    managerName: project.managerName ?? "Unassigned",
    exhibition: project.exhibition ?? project.name,
    status: toTitle(project.status),
    health: toTitle(project.health),
    progress: projectProgress(project.status),
    deadline: project.deadline?.slice(0, 10) ?? null,
    system: toTitle(project.system),
  }));
}

async function getManagerAudit(organizationId: string, limit: number) {
  const events = await getActivity(
    organizationId,
    limit,
    {
      sessionId: "",
      user: { id: "00000000-0000-0000-0000-000000000000", name: "System", email: "", role: "owner", uiRole: "chief" },
      organization: { id: organizationId, name: "", slug: "", plan: "" },
    },
  );
  return events;
}

async function getManagerInvitations(organizationId: string) {
  const rows = await queryRows<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>(sql`
    select
      id::text,
      email,
      role::text,
      expires_at::text as "expiresAt",
      accepted_at::text as "acceptedAt",
      revoked_at::text as "revokedAt",
      created_at::text as "createdAt"
    from invitations
    where organization_id = ${organizationId}::uuid
      and role::text = 'pm'
    order by created_at desc
    limit 50
  `);

  return rows.map((invite) => ({
    ...invite,
    status: invite.revokedAt ? "Revoked" : invite.acceptedAt ? "Accepted" : new Date(invite.expiresAt) < new Date() ? "Expired" : "Pending",
  }));
}

async function inviteManager(
  organizationId: string,
  actorUserId: string,
  input: { name: string; email: string },
) {
  const token = createRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const rows = await queryRows<{
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    createdAt: string;
  }>(sql`
    insert into invitations (
      organization_id,
      email,
      role,
      token_hash,
      invited_by_user_id,
      expires_at
    )
    values (
      ${organizationId}::uuid,
      ${input.email},
      'pm',
      ${tokenHash},
      ${actorUserId}::uuid,
      ${expiresAt}
    )
    returning id::text, email, role::text, expires_at::text as "expiresAt", created_at::text as "createdAt"
  `);

  return {
    ...rows[0],
    name: input.name,
    token,
    inviteUrl: `/signup?invite=${encodeURIComponent(token)}`,
    status: "Pending",
  };
}

async function updateAssignments(
  organizationId: string,
  actorUserId: string,
  input: {
    clientAssignments: Array<{ clientId: string; managerId: string | null }>;
    projectAssignments: Array<{ projectId: string; managerId: string | null }>;
    cascadeClientProjects: boolean;
  },
) {
  let changedClients = 0;
  let changedProjects = 0;

  for (const assignment of input.clientAssignments) {
    await db.execute(sql`
      update clients
      set assigned_pm_user_id = ${assignment.managerId}::uuid, updated_at = now()
      where id = ${assignment.clientId}::uuid
        and organization_id = ${organizationId}::uuid
        and deleted_at is null
    `);
    changedClients += 1;

    if (input.cascadeClientProjects) {
      await db.execute(sql`
        update projects
        set assigned_pm_user_id = ${assignment.managerId}::uuid, updated_at = now()
        where client_id = ${assignment.clientId}::uuid
          and organization_id = ${organizationId}::uuid
          and deleted_at is null
      `);
    }
  }

  for (const assignment of input.projectAssignments) {
    await db.execute(sql`
      update projects
      set assigned_pm_user_id = ${assignment.managerId}::uuid, updated_at = now()
      where id = ${assignment.projectId}::uuid
        and organization_id = ${organizationId}::uuid
        and deleted_at is null
    `);
    changedProjects += 1;

    if (assignment.managerId) {
      await db.execute(sql`
        insert into project_members (project_id, user_id, role)
        values (${assignment.projectId}::uuid, ${assignment.managerId}::uuid, 'pm')
        on conflict (project_id, user_id) do nothing
      `);
    }
  }

  await auditEvent(organizationId, actorUserId, "manager_assignments_updated", "updated manager assignments", {
    changedClients,
    changedProjects,
    cascadeClientProjects: input.cascadeClientProjects,
  });

  return {
    changedClients,
    changedProjects,
    managers: await getManagers(organizationId),
    clients: await getManagedClients(organizationId),
    projects: await getManagedProjects(organizationId),
    audit: await getManagerAudit(organizationId, 30),
  };
}

async function getCalendarEvents(organizationId: string, auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const rows = await queryRows<{
    id: string;
    name: string;
    client: string;
    pm: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    standType: string;
  }>(sql`
    select
      p.id::text,
      coalesce(p.exhibition_name, p.name) as name,
      c.company_name as client,
      u.name as pm,
      p.status::text as status,
      coalesce(p.starts_at, p.deadline_at, p.created_at)::text as "startDate",
      coalesce(p.ends_at, p.deadline_at, p.created_at)::text as "endDate",
      nullif(concat_ws(', ', p.city, p.country), '') as location,
      coalesce(bd.booth_system::text, 'custom') as "standType"
    from projects p
    join clients c on c.id = p.client_id
    left join users u on u.id = p.assigned_pm_user_id
    left join lateral (
      select booth_system
      from booth_designs bd
      where bd.project_id = p.id and bd.deleted_at is null
      order by bd.updated_at desc
      limit 1
    ) bd on true
    where p.organization_id = ${organizationId}::uuid
      and p.deleted_at is null
      and (${canSeeAll}::boolean or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
        select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
      ))
    order by coalesce(p.starts_at, p.deadline_at, p.created_at) asc
  `);

  return rows.map((event) => ({
    id: event.id,
    name: event.name,
    client: event.client,
    pm: event.pm ?? "Unassigned",
    status: toTitle(event.status),
    startDate: event.startDate?.slice(0, 10) ?? "",
    endDate: event.endDate?.slice(0, 10) ?? "",
    location: event.location ?? "Location TBD",
    standType: toTitle(event.standType),
  }));
}

async function getMetrics(organizationId: string, auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const rows = await queryRows<{
    clients: number;
    projects: number;
    projectManagers: number;
    delayedProjects: number;
    pendingApprovals: number;
    activeWorkspaces: number;
    documents: number;
    comments: number;
    completedProjects: number;
  }>(sql`
    select
      (select count(*)::int from clients c where c.organization_id = ${organizationId}::uuid and c.deleted_at is null and (${canSeeAll}::boolean or exists (
        select 1 from projects p2 join project_members pm2 on pm2.project_id = p2.id where p2.client_id = c.id and pm2.user_id = ${auth.user.id}::uuid
      ))) as clients,
      (select count(*)::int from projects p where p.organization_id = ${organizationId}::uuid and p.deleted_at is null and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
      ))) as projects,
      (select count(distinct user_id)::int from memberships where organization_id = ${organizationId}::uuid and role::text = 'pm') as "projectManagers",
      (select count(*)::int from projects p where p.organization_id = ${organizationId}::uuid and (p.status::text = 'delayed' or p.health::text in ('delayed', 'blocked', 'at_risk')) and p.deleted_at is null and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
      ))) as "delayedProjects",
      (select count(*)::int from approvals a where a.organization_id = ${organizationId}::uuid and a.status::text in ('requested', 'under_review', 'revision_requested') and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = a.project_id and pm2.user_id = ${auth.user.id}::uuid
      ))) as "pendingApprovals",
      (select count(*)::int from booth_designs bd where bd.organization_id = ${organizationId}::uuid and bd.deleted_at is null and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = bd.project_id and pm2.user_id = ${auth.user.id}::uuid
      ))) as "activeWorkspaces",
      (select count(*)::int from documents d where d.organization_id = ${organizationId}::uuid and d.deleted_at is null and (${canSeeAll}::boolean or d.project_id is null or exists (
        select 1 from project_members pm2 where pm2.project_id = d.project_id and pm2.user_id = ${auth.user.id}::uuid
      ))) as documents,
      (select count(*)::int from comments c where c.organization_id = ${organizationId}::uuid and c.deleted_at is null and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = c.project_id and pm2.user_id = ${auth.user.id}::uuid
      ))) as comments,
      (select count(*)::int from projects p where p.organization_id = ${organizationId}::uuid and p.status::text in ('completed', 'approved') and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
      ))) as "completedProjects"
  `);

  return rows[0] ?? {
    clients: 0,
    projects: 0,
    projectManagers: 0,
    delayedProjects: 0,
    pendingApprovals: 0,
    activeWorkspaces: 0,
    documents: 0,
    comments: 0,
    completedProjects: 0,
  };
}

async function getProjects(organizationId: string, limit: number, auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const rows = await queryRows<{
    id: string;
    name: string;
    client: string;
    pm: string | null;
    status: string;
    health: string;
    deadline: string | null;
    system: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
    exhibition: string | null;
    description: string | null;
    updatedAt: string;
  }>(sql`
    select
      p.id::text,
      p.name,
      coalesce(c.company_name, 'Client') as client,
      coalesce(assigned_pm.name, member_pm.name) as pm,
      p.status::text as status,
      p.health::text as health,
      p.deadline_at::text as deadline,
      coalesce(bd.booth_system::text, 'custom') as system,
      coalesce(bd.width_mm, 0) as "widthMm",
      coalesce(bd.depth_mm, 0) as "depthMm",
      coalesce(bd.height_mm, 0) as "heightMm",
      p.exhibition_name as exhibition,
      (p.metadata ->> 'description') as description,
      p.updated_at::text as "updatedAt"
    from projects p
    join clients c on c.id = p.client_id
    left join lateral (
      select bd.booth_system, bd.width_mm, bd.depth_mm, bd.height_mm
      from booth_designs bd
      where bd.project_id = p.id and bd.deleted_at is null
      order by bd.updated_at desc
      limit 1
    ) bd on true
    left join users assigned_pm on assigned_pm.id = p.assigned_pm_user_id
    left join lateral (
      select u.name
      from project_members pm
      join users u on u.id = pm.user_id
      where pm.project_id = p.id and pm.role::text = 'pm'
      order by pm.created_at asc
      limit 1
    ) member_pm on true
    where p.organization_id = ${organizationId}::uuid
      and p.deleted_at is null
      and (${canSeeAll}::boolean or exists (
        select 1 from project_members scope_pm
        where scope_pm.project_id = p.id
          and scope_pm.user_id = ${auth.user.id}::uuid
      ))
    order by p.updated_at desc
    limit ${limit}
  `);

  return rows.map((project) => ({
    id: project.id,
    name: project.name,
    client: project.client,
    pm: project.pm ?? "Unassigned",
    status: toTitle(project.status),
    health: toTitle(project.health),
    progress: projectProgress(project.status),
    deadline: project.deadline?.slice(0, 10) ?? null,
    system: toTitle(project.system),
    dimensions: `${formatMeters(project.widthMm)} x ${formatMeters(project.depthMm)} m`,
    exhibition: project.exhibition ?? "Exhibition TBD",
    standType: toTitle(project.system),
    description: project.description ?? "",
    lastUpdate: relativeTime(project.updatedAt),
  }));
}

async function getClients(organizationId: string, limit: number, auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const rows = await queryRows<{
    id: string;
    name: string;
    contactName: string;
    contactEmail: string;
    pm: string | null;
    exhibition: string | null;
    status: string;
    lastActivity: string;
  }>(sql`
    select
      c.id::text,
      coalesce(c.company_name, 'Client') as name,
      c.contact_name as "contactName",
      c.contact_email as "contactEmail",
      coalesce(assigned_pm.name, member_pm.name) as pm,
      max(p.exhibition_name) as exhibition,
      c.status::text as status,
      greatest(c.updated_at, coalesce(max(p.updated_at), c.updated_at))::text as "lastActivity"
    from clients c
    left join users assigned_pm on assigned_pm.id = c.assigned_pm_user_id
    left join projects p on p.client_id = c.id and p.deleted_at is null
    left join lateral (
      select u.name
      from projects p2
      join project_members pm on pm.project_id = p2.id and pm.role::text = 'pm'
      join users u on u.id = pm.user_id
      where p2.client_id = c.id
      order by pm.created_at asc
      limit 1
    ) member_pm on true
    where c.organization_id = ${organizationId}::uuid
      and c.deleted_at is null
      and (${canSeeAll}::boolean or exists (
        select 1
        from projects scoped_p
        join project_members scoped_pm on scoped_pm.project_id = scoped_p.id
        where scoped_p.client_id = c.id
          and scoped_pm.user_id = ${auth.user.id}::uuid
      ))
    group by c.id, assigned_pm.name, member_pm.name
    order by "lastActivity" desc
    limit ${limit}
  `);

  return rows.map((client) => ({
    id: client.id,
    name: client.name,
    company: client.name,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    pm: client.pm ?? "Unassigned",
    exhibition: client.exhibition ?? "No active exhibition",
    status: toTitle(client.status),
    lastActivity: relativeTime(client.lastActivity),
  }));
}

async function createProject(
  organizationId: string,
  input: {
    name: string;
    client: string;
    system: "octanorm" | "maxima" | "custom";
    widthM: number;
    depthM: number;
    deadline: string | null;
  },
) {
  const clientId = await findOrCreateClient(organizationId, input.client);
  const pm = await getFirstProjectManager(organizationId);

  const projectRows = await queryRows<{
    id: string;
  }>(sql`
    insert into projects (
      organization_id,
      client_id,
      assigned_pm_user_id,
      created_by_user_id,
      name,
      exhibition_name,
      status,
      health,
      budget_cents,
      currency,
      deadline_at,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${clientId}::uuid,
      ${pm?.id ?? null}::uuid,
      ${pm?.id ?? null}::uuid,
      ${input.name},
      ${input.name},
      'planning',
      'on_track',
      0,
      'EUR',
      ${input.deadline}::timestamptz,
      '{}'::jsonb
    )
    returning id::text
  `);

  const projectId = projectRows[0]?.id;

  if (!projectId) {
    throw new Error("Project insert did not return an id");
  }

  const widthMm = Math.round(input.widthM * 1000);
  const depthMm = Math.round(input.depthM * 1000);
  const heightMm = input.system === "maxima" ? 4000 : 2500;

  const designRows = await queryRows<{ id: string }>(sql`
    insert into booth_designs (
      organization_id,
      project_id,
      name,
      booth_system,
      booth_type,
      width_mm,
      depth_mm,
      height_mm,
      grid_size_mm,
      units,
      current_version_number,
      created_by_user_id
    )
    values (
      ${organizationId}::uuid,
      ${projectId}::uuid,
      ${`${input.name} booth design`},
      ${input.system}::booth_system,
      'inline',
      ${widthMm},
      ${depthMm},
      ${heightMm},
      1000,
      'metric',
      1,
      ${pm?.id ?? null}::uuid
    )
    returning id::text
  `);

  const designId = designRows[0]?.id;

  if (!designId) {
    throw new Error("Booth design insert did not return an id");
  }

  await db.execute(sql`
    insert into booth_versions (
      organization_id,
      design_id,
      project_id,
      version_number,
      status,
      title,
      layout_json,
      asset_summary,
      cost_estimate_cents,
      created_by_user_id
    )
    values (
      ${organizationId}::uuid,
      ${designId}::uuid,
      ${projectId}::uuid,
      1,
      'draft',
      'Initial layout',
      ${JSON.stringify({
        gridMm: 1000,
        boothSystem: input.system,
        dimensions: { widthMm, depthMm, heightMm },
        objects: [],
      })}::jsonb,
      '{}'::jsonb,
      0,
      ${pm?.id ?? null}::uuid
    )
  `);

  await db.execute(sql`
    insert into activity_events (
      organization_id,
      actor_user_id,
      project_id,
      event_type,
      message,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${pm?.id ?? null}::uuid,
      ${projectId}::uuid,
      'project_created',
      'created project',
      '{}'::jsonb
    )
  `);

  const project = await getProjectById(organizationId, projectId);
  if (!project) throw new Error("Project was created but could not be read back");
  return project;
}

async function getProjectById(organizationId: string, projectId: string) {
  const projects = await getProjects(
    organizationId,
    1,
    {
      sessionId: "",
      user: { id: "00000000-0000-0000-0000-000000000000", name: "System", email: "", role: "owner", uiRole: "chief" },
      organization: { id: organizationId, name: "", slug: "", plan: "" },
    },
  );

  return projects.find((project) => project.id === projectId) ?? null;
}

async function findOrCreateClient(organizationId: string, companyName: string) {
  const existing = await queryRows<{ id: string }>(sql`
    select id::text
    from clients
    where organization_id = ${organizationId}::uuid
      and lower(company_name) = lower(${companyName})
      and deleted_at is null
    limit 1
  `);

  if (existing[0]?.id) return existing[0].id;

  const inserted = await queryRows<{ id: string }>(sql`
    insert into clients (
      organization_id,
      company_name,
      contact_name,
      contact_email,
      status,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${companyName},
      ${companyName},
      ${`contact+${slugify(companyName)}@example.invalid`},
      'lead',
      '{}'::jsonb
    )
    returning id::text
  `);

  const id = inserted[0]?.id;
  if (!id) throw new Error("Client insert did not return an id");
  return id;
}

async function getFirstProjectManager(organizationId: string) {
  const rows = await queryRows<{ id: string; name: string }>(sql`
    select u.id::text, u.name
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${organizationId}::uuid
      and m.role::text = 'pm'
      and m.status::text = 'active'
    order by m.created_at asc
    limit 1
  `);

  return rows[0] ?? null;
}

function parseCreateProjectInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const name = stringValue(data.name);
  const client = stringValue(data.client);
  const systemRaw = stringValue(data.system)?.toLowerCase() ?? "octanorm";
  const widthM = numberValue(data.widthM ?? data.width);
  const depthM = numberValue(data.depthM ?? data.depth);
  const deadline = stringValue(data.deadline) ?? null;

  if (!name) return { ok: false as const, error: "Project name is required" };
  if (!client) return { ok: false as const, error: "Client name is required" };
  if (!widthM || widthM < 1 || widthM > 100) return { ok: false as const, error: "Width must be between 1 and 100 meters" };
  if (!depthM || depthM < 1 || depthM > 100) return { ok: false as const, error: "Depth must be between 1 and 100 meters" };

  const system: "octanorm" | "maxima" | "custom" =
    systemRaw === "maxima" || systemRaw === "custom" ? systemRaw : "octanorm";

  return {
    ok: true as const,
    value: { name, client, system, widthM, depthM, deadline },
  };
}

function parseAccountSettingsInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  return {
    ok: true as const,
    value: {
      profile: objectValue(data.profile),
      notifications: objectValue(data.notifications),
      appearance: objectValue(data.appearance),
      security: objectValue(data.security),
    },
  };
}

function parseAvatarInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const avatarUrl = stringValue(data.avatarUrl) ?? "";
  const avatarTone = stringValue(data.avatarTone) ?? "primary";

  if (avatarUrl && !avatarUrl.startsWith("data:image/") && !avatarUrl.startsWith("https://") && !avatarUrl.startsWith("/")) {
    return { ok: false as const, error: "Avatar must be a data URL, HTTPS URL, or local path" };
  }

  if (avatarUrl.length > 2_000_000) {
    return { ok: false as const, error: "Avatar image is too large" };
  }

  return { ok: true as const, value: { avatarUrl, avatarTone } };
}

function parsePasswordInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const currentPassword = stringValue(data.currentPassword);
  const newPassword = stringValue(data.newPassword);

  if (!currentPassword) return { ok: false as const, error: "Current password is required" };
  if (!newPassword || newPassword.length < 8) return { ok: false as const, error: "New password must be at least 8 characters" };

  return { ok: true as const, value: { currentPassword, newPassword } };
}

function parseInviteManagerInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const name = stringValue(data.name) ?? "";
  const email = stringValue(data.email)?.toLowerCase();

  if (!email || !email.includes("@")) return { ok: false as const, error: "Valid manager email is required" };

  return { ok: true as const, value: { name, email } };
}

function parseAssignmentsInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const clientAssignments = Array.isArray(data.clientAssignments)
    ? data.clientAssignments.map(parseAssignmentRow).filter(isAssignmentRow)
    : [];
  const projectAssignments = Array.isArray(data.projectAssignments)
    ? data.projectAssignments.map(parseAssignmentRow).filter(isAssignmentRow)
    : [];

  return {
    ok: true as const,
    value: {
      clientAssignments: clientAssignments as Array<{ clientId: string; managerId: string | null }>,
      projectAssignments: projectAssignments.map((item) => ({
        projectId: item.clientId,
        managerId: item.managerId,
      })),
      cascadeClientProjects: boolValue(data.cascadeClientProjects, false),
    },
  };
}

function parseAssignmentRow(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const clientId = stringValue(data.clientId ?? data.projectId);
  const rawManagerId = stringValue(data.managerId);

  if (!clientId) return null;
  return {
    clientId,
    managerId: rawManagerId === "unassigned" ? null : rawManagerId,
  };
}

function isAssignmentRow(value: ReturnType<typeof parseAssignmentRow>): value is { clientId: string; managerId: string | null } {
  return value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function numberFromMetadata(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function getUserMetadata(userId: string) {
  const rows = await queryRows<{ metadata: Record<string, unknown> }>(sql`
    select metadata
    from users
    where id = ${userId}::uuid
    limit 1
  `);

  return rows[0]?.metadata ?? {};
}

async function auditEvent(
  organizationId: string,
  actorUserId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown>,
) {
  await db.execute(sql`
    insert into activity_events (
      organization_id,
      actor_user_id,
      event_type,
      message,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${actorUserId}::uuid,
      ${type},
      ${message},
      ${JSON.stringify(metadata)}::jsonb
    )
  `);
}

function describeUserAgent(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  if (userAgent.includes("iPhone")) return "Safari on iPhone";
  if (userAgent.includes("Edg/")) return "Edge on Windows";
  if (userAgent.includes("Chrome/")) return "Chrome on Windows";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Safari/")) return "Safari";
  return "Browser session";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
}

async function getActivity(organizationId: string, limit: number, auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const rows = await queryRows<{
    id: string;
    type: string;
    user: string;
    action: string;
    project: string;
    createdAt: string;
  }>(sql`
    select *
    from (
      select
        ae.id::text,
        ae.event_type as type,
        coalesce(u.name, 'System') as "user",
        ae.message as action,
        coalesce(p.name, 'Workspace') as project,
        ae.created_at::text as "createdAt"
      from activity_events ae
      left join users u on u.id = ae.actor_user_id
      left join projects p on p.id = ae.project_id
      where ae.organization_id = ${organizationId}::uuid
        and (${canSeeAll}::boolean or ae.project_id is null or exists (
          select 1 from project_members pm2 where pm2.project_id = ae.project_id and pm2.user_id = ${auth.user.id}::uuid
        ))

      union all

      select
        ('project-' || p.id)::text as id,
        'project_created' as type,
        coalesce(u.name, 'System') as "user",
        'created project' as action,
        p.name as project,
        p.created_at::text as "createdAt"
      from projects p
      left join users u on u.id = p.created_by_user_id
      where p.organization_id = ${organizationId}::uuid
        and (${canSeeAll}::boolean or exists (
          select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
        ))

      union all

      select
        ('layout-' || bv.id)::text as id,
        'layout_updated' as type,
        coalesce(u.name, 'System') as "user",
        'saved booth layout v' || bv.version_number as action,
        p.name as project,
        bv.created_at::text as "createdAt"
      from booth_versions bv
      join projects p on p.id = bv.project_id
      left join users u on u.id = bv.created_by_user_id
      where bv.organization_id = ${organizationId}::uuid
        and (${canSeeAll}::boolean or exists (
          select 1 from project_members pm2 where pm2.project_id = bv.project_id and pm2.user_id = ${auth.user.id}::uuid
        ))
    ) activity
    order by "createdAt" desc
    limit ${limit}
  `);

  return rows.map((event) => ({
    id: event.id,
    type: event.type,
    user: event.user,
    action: event.action,
    project: event.project,
    time: relativeTime(event.createdAt),
  }));
}

function emptyOverview() {
  const metrics = {
    clients: 0,
    projects: 0,
    projectManagers: 0,
    delayedProjects: 0,
    pendingApprovals: 0,
    activeWorkspaces: 0,
    documents: 0,
    comments: 0,
    completedProjects: 0,
  };

  return {
    organization: null,
    metrics,
    projects: [],
    clients: [],
    activity: [],
    charts: buildCharts(metrics, []),
  };
}

function buildCharts(
  metrics: Awaited<ReturnType<typeof getMetrics>>,
  activity: Array<{ time: string }>,
) {
  return {
    activity: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => ({
      day,
      projects: index === 6 ? metrics.projects : Math.max(0, metrics.projects - (6 - index)),
    })),
    distribution: [
      { name: "Active", value: metrics.projects - metrics.completedProjects - metrics.delayedProjects, color: "#3b82f6" },
      { name: "Pending", value: metrics.pendingApprovals, color: "#eab308" },
      { name: "Delayed", value: metrics.delayedProjects, color: "#ef4444" },
      { name: "Completed", value: metrics.completedProjects, color: "#22c55e" },
    ].map((item) => ({ ...item, value: Math.max(0, item.value) })),
    activityCount: activity.length,
  };
}

function projectProgress(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return 100;
  if (normalized === "approved") return 85;
  if (normalized === "in_production") return 90;
  if (normalized === "client_review") return 65;
  if (normalized === "revision") return 55;
  if (normalized === "in_design") return 45;
  if (normalized === "delayed") return 35;
  if (normalized === "planning") return 20;
  return 10;
}

function formatMeters(valueMm: number) {
  return Number(valueMm / 1000).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });
}

function toTitle(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function relativeTime(dateText: string) {
  const date = new Date(dateText);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function canManageOrganization(auth: AuthContext) {
  return ["admin", "owner", "chief"].includes(auth.user.role);
}

export default router;
