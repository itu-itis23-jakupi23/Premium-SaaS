import { sql, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  createProjectSchema,
  updateProjectSchema,
  pipelineStageSchema,
  createClientSchema,
  updateClientSchema,
  assignmentsSchema,
  inviteManagerSchema,
  pmCapacityLimitSchema,
  pmTaskSchema,
  pmTaskPatchSchema,
} from "@workspace/api-zod";
import {
  requireAuth,
  requireRoles,
  type AuthContext,
} from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { hashPassword, verifyPassword } from "../lib/password";
import { createRefreshToken, hashToken } from "../lib/tokens";
import {
  sendClientApprovedEmail,
  sendManagerInvitationEmail,
  type EmailDeliveryResult,
} from "../lib/email";

function zParse<T>(
  schema: {
    safeParse: (
      v: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ message?: string }> } };
  },
  body: unknown,
) {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false as const,
      error: result.error.issues[0]?.message ?? "Invalid input",
    };
  }
  return { ok: true as const, value: result.data };
}

const router: IRouter = Router();

// ── Public invitation routes — registered BEFORE requireAuth so they're accessible without a session ──

router.get("/platform/managers/invitations/validate", async (req, res) => {
  const token =
    typeof req.query.token === "string" ? req.query.token.trim() : null;
  if (!token) {
    res
      .status(400)
      .json({
        error: {
          code: "token_required",
          message: "Invitation token is required.",
        },
      });
    return;
  }

  const rows = await queryInvRows(token);
  const invitation = rows[0];

  if (!invitation) {
    res
      .status(404)
      .json({
        error: {
          code: "invitation_not_found",
          message:
            "This invitation link is invalid. Please ask your administrator for a new one.",
        },
      });
    return;
  }
  if (invitation.revokedAt) {
    res
      .status(410)
      .json({
        error: {
          code: "invitation_revoked",
          message: "This invitation has been revoked.",
        },
      });
    return;
  }
  if (invitation.acceptedAt) {
    res
      .status(409)
      .json({
        error: {
          code: "invitation_used",
          message:
            "This invitation has already been used. Please log in with your credentials.",
        },
      });
    return;
  }
  if (new Date(invitation.expiresAt) < new Date()) {
    res
      .status(410)
      .json({
        error: {
          code: "invitation_expired",
          message:
            "This invitation link has expired. Please ask your administrator to resend the invitation.",
        },
      });
    return;
  }

  res.json({
    valid: true,
    email: invitation.email,
    name: invitation.name,
    expiresAt: invitation.expiresAt,
    role: invitation.role,
    organization: {
      id: invitation.organizationId,
      name: invitation.organizationName,
      slug: invitation.organizationSlug,
    },
  });
});

router.post("/platform/managers/invitations/accept", async (req, res) => {
  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : {};
  const token = typeof body.token === "string" ? body.token.trim() : null;
  const name = typeof body.name === "string" ? body.name.trim() : null;
  const password = typeof body.password === "string" ? body.password : null;

  if (!token || !name || !password) {
    res
      .status(400)
      .json({
        error: {
          code: "missing_fields",
          message: "token, name and password are required.",
        },
      });
    return;
  }
  if (password.length < 8) {
    res
      .status(400)
      .json({
        error: {
          code: "password_too_short",
          message: "Password must be at least 8 characters.",
        },
      });
    return;
  }

  const passwordHash = hashPassword(password);
  const result = await db.transaction(async (tx) => {
    const invitationResult = await tx.execute(sql`
      select
        i.id::text,
        i.email,
        i.role::text,
        i.expires_at::text as "expiresAt",
        i.accepted_at::text as "acceptedAt",
        i.revoked_at::text as "revokedAt",
        i.organization_id::text as "organizationId",
        o.slug as "organizationSlug"
      from invitations i
      join organizations o on o.id = i.organization_id
      where i.token_hash = ${hashToken(token)}
        and o.deleted_at is null
      limit 1
      for update of i
    `);
    const inv = (
      invitationResult as unknown as {
        rows: Array<{
          id: string;
          email: string;
          role: string;
          expiresAt: string;
          acceptedAt: string | null;
          revokedAt: string | null;
          organizationId: string;
          organizationSlug: string;
        }>;
      }
    ).rows[0];

    if (!inv) return { status: "not_found" as const };
    if (
      inv.revokedAt ||
      inv.acceptedAt ||
      new Date(inv.expiresAt) < new Date()
    ) {
      return { status: "unavailable" as const };
    }

    const userResult = await tx.execute(sql`
      insert into users (email, name, role, password_hash, email_verified_at, metadata)
      values (${inv.email}, ${name}, ${inv.role}, ${passwordHash}, now(), '{}'::jsonb)
      on conflict do nothing
      returning id::text
    `);
    const userId = (userResult as unknown as { rows: Array<{ id: string }> })
      .rows[0]?.id;
    if (!userId) return { status: "email_exists" as const };

    await tx.execute(sql`
      insert into memberships (organization_id, user_id, role, status, joined_at)
      values (${inv.organizationId}::uuid, ${userId}::uuid, ${inv.role}, 'active', now())
    `);

    const acceptedResult = await tx.execute(sql`
      update invitations
      set accepted_at = now()
      where id = ${inv.id}::uuid
        and accepted_at is null
        and revoked_at is null
      returning id::text
    `);
    const accepted = (
      acceptedResult as unknown as { rows: Array<{ id: string }> }
    ).rows[0];
    if (!accepted)
      throw new Error("Invitation changed while it was being accepted");

    return {
      status: "accepted" as const,
      user: { id: userId, email: inv.email, name, role: inv.role },
      organizationSlug: inv.organizationSlug,
    };
  });

  if (result.status === "not_found") {
    res
      .status(404)
      .json({
        error: {
          code: "invitation_not_found",
          message: "This invitation link is invalid.",
        },
      });
    return;
  }
  if (result.status === "unavailable") {
    res
      .status(409)
      .json({
        error: {
          code: "invitation_unavailable",
          message: "This invitation is no longer valid.",
        },
      });
    return;
  }
  if (result.status === "email_exists") {
    res
      .status(409)
      .json({
        error: {
          code: "email_exists",
          message: "An account with this email already exists. Please log in.",
        },
      });
    return;
  }

  res
    .status(201)
    .json({
      ok: true,
      user: result.user,
      organizationSlug: result.organizationSlug,
    });
});

router.use("/platform", requireAuth, requireTenant);

type SqlExecutor = {
  execute: (statement: SQL) => Promise<unknown>;
};

const databaseExecutor = db as unknown as SqlExecutor;

async function queryRows<T>(
  statement: SQL,
  executor: SqlExecutor = databaseExecutor,
) {
  const result = await executor.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

async function queryInvRows(token: string) {
  return queryRows<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationPlan: string;
  }>(sql`
    select
      i.id::text,
      i.email,
      i.name,
      i.role::text,
      i.expires_at::text as "expiresAt",
      i.accepted_at::text as "acceptedAt",
      i.revoked_at::text as "revokedAt",
      o.id::text as "organizationId",
      o.name as "organizationName",
      o.slug as "organizationSlug",
      o.plan as "organizationPlan"
    from invitations i
    join organizations o on o.id = i.organization_id
    where i.token_hash = ${hashToken(token)}
      and o.deleted_at is null
    limit 1
  `);
}

const PLACEHOLDER_CONFIG_VALUES = new Set([
  "",
  "change-me-before-deploy",
  "ens-staff-local-dev",
  "replace-with-a-long-random-secret",
  "replace-with-a-separate-long-random-secret",
  "your-resend-api-key-here",
  "your-stripe-secret-key-here",
  "your-stripe-webhook-secret-here",
]);

function hasConfiguredValue(value: string | undefined | null) {
  return Boolean(value && !PLACEHOLDER_CONFIG_VALUES.has(value.trim()));
}

function isAbsoluteUrl(value: string | undefined | null) {
  return Boolean(value && /^https?:\/\//.test(value));
}

router.get(
  "/platform/system/readiness",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const isProd = process.env.NODE_ENV === "production";
    const appUrl = process.env.APP_URL;
    const cookieSecure = process.env.COOKIE_SECURE?.trim().toLowerCase();
    const stripeConfigured = hasConfiguredValue(process.env.STRIPE_SECRET_KEY);
    const recentActivity = await queryRows<{
      id: string;
      eventType: string;
      message: string;
      actorName: string | null;
      projectName: string | null;
      createdAt: string;
    }>(sql`
    select
      ae.id::text,
      ae.event_type as "eventType",
      ae.message,
      u.name as "actorName",
      p.name as "projectName",
      ae.created_at::text as "createdAt"
    from activity_events ae
    left join users u on u.id = ae.actor_user_id
    left join projects p on p.id = ae.project_id
    where ae.organization_id = ${organization.id}::uuid
    order by ae.created_at desc
    limit 12
  `);
    const operationalRows = await queryRows<{
      pendingClients: number;
      unassignedProjects: number;
      failedInvitations: number;
      stalledReviews: number;
      overloadedPMs: number;
    }>(sql`
    select
      (select count(*)::int
       from clients c
       where c.organization_id = ${organization.id}::uuid
         and c.deleted_at is null
         and c.status::text = 'pending_approval') as "pendingClients",
      (select count(*)::int
       from projects p
       where p.organization_id = ${organization.id}::uuid
         and p.deleted_at is null
         and p.assigned_pm_user_id is null
         and p.status::text not in ('completed', 'archived', 'cancelled')) as "unassignedProjects",
      (select count(*)::int
       from invitations i
       where i.organization_id = ${organization.id}::uuid
         and i.revoked_at is null
         and i.accepted_at is null
         and i.email_status::text = 'failed') as "failedInvitations",
      (select count(*)::int
       from projects p
       where p.organization_id = ${organization.id}::uuid
         and p.deleted_at is null
         and p.status::text = 'client_review'
         and p.updated_at < now() - interval '3 days') as "stalledReviews",
      (select count(*)::int
       from users u
       join memberships m on m.user_id = u.id and m.organization_id = ${organization.id}::uuid
       where u.deleted_at is null
         and m.role::text = 'pm'
         and m.status::text = 'active'
         and u.pm_capacity_limit is not null
         and u.pm_capacity_limit > 0
         and (
           select count(*)::float
           from projects p
           where p.organization_id = ${organization.id}::uuid
             and p.assigned_pm_user_id = u.id
             and p.deleted_at is null
             and p.status::text not in ('completed', 'archived', 'cancelled')
         ) / u.pm_capacity_limit >= 1.0) as "overloadedPMs"
  `);
    const operational = operationalRows[0] ?? {
      pendingClients: 0,
      unassignedProjects: 0,
      failedInvitations: 0,
      stalledReviews: 0,
      overloadedPMs: 0,
    };
    const checks = {
      databaseConfigured: hasConfiguredValue(process.env.DATABASE_URL),
      emailConfigured:
        hasConfiguredValue(process.env.RESEND_API_KEY) &&
        hasConfiguredValue(process.env.RESEND_FROM),
      appUrlConfigured: isAbsoluteUrl(appUrl),
      staffAccessConfigured: hasConfiguredValue(process.env.STAFF_SIGNUP_KEY),
      authSecretConfigured: hasConfiguredValue(process.env.AUTH_SECRET),
      messageEncryptionConfigured: hasConfiguredValue(
        process.env.MESSAGE_ENCRYPTION_KEY,
      ),
      cookieSecureCompatible:
        !isProd ||
        cookieSecure === "false" ||
        appUrl?.startsWith("https://") === true,
      documentStorageConfigured:
        !isProd || hasConfiguredValue(process.env.DOCUMENT_STORAGE_DIR),
      messageAttachmentStorageConfigured:
        !isProd || hasConfiguredValue(process.env.MESSAGE_ATTACHMENT_DIR),
      stripeWebhookConfigured:
        !stripeConfigured ||
        hasConfiguredValue(process.env.STRIPE_WEBHOOK_SECRET),
      assetStorageConfigured:
        !isProd ||
        (hasConfiguredValue(process.env.DOCUMENT_STORAGE_DIR) &&
          hasConfiguredValue(process.env.MESSAGE_ATTACHMENT_DIR)),
      productionMode: isProd,
    };
    const warnings = [
      !checks.databaseConfigured
        ? "DATABASE_URL is missing or still a placeholder."
        : null,
      !checks.emailConfigured
        ? "RESEND_API_KEY and RESEND_FROM are not fully configured."
        : null,
      !checks.appUrlConfigured ? "APP_URL must be an absolute URL." : null,
      !checks.staffAccessConfigured
        ? "STAFF_SIGNUP_KEY is missing or still a placeholder."
        : null,
      !checks.authSecretConfigured
        ? "AUTH_SECRET is missing or still a placeholder."
        : null,
      !checks.messageEncryptionConfigured
        ? "MESSAGE_ENCRYPTION_KEY is missing or still a placeholder."
        : null,
      !checks.cookieSecureCompatible
        ? "COOKIE_SECURE is incompatible with the configured APP_URL. Use COOKIE_SECURE=false for HTTP or deploy behind HTTPS."
        : null,
      !checks.documentStorageConfigured
        ? "DOCUMENT_STORAGE_DIR must point at durable storage in production."
        : null,
      !checks.messageAttachmentStorageConfigured
        ? "MESSAGE_ATTACHMENT_DIR must point at durable storage in production."
        : null,
      !checks.stripeWebhookConfigured
        ? "STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is configured."
        : null,
    ].filter(Boolean);

    res.json({
      ready: warnings.length === 0,
      mode: isProd ? "production" : "development",
      checks,
      limits: {
        apiJsonLimit: process.env.API_JSON_LIMIT || "75mb",
      },
      storage: {
        assetStorageProvider: process.env.STORAGE_PROVIDER || "local",
        documentStorageDirConfigured: hasConfiguredValue(
          process.env.DOCUMENT_STORAGE_DIR,
        ),
        messageAttachmentDirConfigured: hasConfiguredValue(
          process.env.MESSAGE_ATTACHMENT_DIR,
        ),
        workspaceAssetDirConfigured: hasConfiguredValue(
          process.env.WORKSPACE_ASSET_DIR,
        ),
      },
      billing: {
        stripeConfigured,
        stripeWebhookConfigured: checks.stripeWebhookConfigured,
      },
      operational,
      recentActivity,
      warnings,
    });
  },
);

router.get(
  "/platform/overview",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const organization = req.tenant!;
    const auth = req.auth!;
    const isChief = canManageOrganization(auth);

    const [
      metrics,
      projects,
      clients,
      activity,
      workflowRows,
      workflowDetails,
    ] = await Promise.all([
      getMetrics(organization.id, auth),
      getProjects(organization.id, 8, auth),
      getClients(organization.id, 8, auth).then((result) => result.clients),
      getActivity(organization.id, 8, auth),
      isChief
        ? queryRows<{
            pendingClientApprovals: number;
            unassignedClients: number;
            unassignedProjects: number;
            newPMs: number;
            stalledApprovals: number;
            overloadedPMs: number;
          }>(sql`
      select
        (select count(*)::int from clients c where c.organization_id = ${organization.id}::uuid and c.status::text = 'pending_approval' and c.deleted_at is null) as "pendingClientApprovals",
        (select count(*)::int from clients c where c.organization_id = ${organization.id}::uuid and c.assigned_pm_user_id is null and c.status::text = 'active' and c.deleted_at is null) as "unassignedClients",
        (select count(*)::int from projects p where p.organization_id = ${organization.id}::uuid and p.assigned_pm_user_id is null and p.deleted_at is null and p.status::text not in ('completed','archived','cancelled')) as "unassignedProjects",
        (select count(*)::int from users u join memberships m on m.user_id = u.id and m.organization_id = ${organization.id}::uuid where u.role::text = 'pm' and m.joined_at > now() - interval '7 days') as "newPMs",
        (select count(*)::int from approvals a where a.organization_id = ${organization.id}::uuid and a.status::text in ('requested','under_review') and a.requested_at < now() - interval '3 days') as "stalledApprovals",
        (select count(*)::int from users u join memberships m on m.user_id = u.id and m.organization_id = ${organization.id}::uuid where u.role::text = 'pm' and u.pm_capacity_limit is not null and (select count(*) from projects p where p.assigned_pm_user_id = u.id and p.organization_id = ${organization.id}::uuid and p.deleted_at is null and p.status::text not in ('completed','archived','cancelled'))::float / u.pm_capacity_limit >= 1.0) as "overloadedPMs"
    `)
        : Promise.resolve([]),
      isChief
        ? Promise.all([
            queryRows<{ id: string; name: string }>(sql`
        select id::text, company_name as name
        from clients
        where organization_id = ${organization.id}::uuid
          and assigned_pm_user_id is null
          and status::text = 'active'
          and deleted_at is null
        order by created_at desc
        limit 5
      `),
            queryRows<{ id: string; name: string }>(sql`
        select id::text, name
        from projects
        where organization_id = ${organization.id}::uuid
          and assigned_pm_user_id is null
          and deleted_at is null
          and status::text not in ('completed','archived','cancelled')
        order by created_at desc
        limit 5
      `),
            queryRows<{ id: string; name: string }>(sql`
        select u.id::text, u.name
        from users u
        join memberships m on m.user_id = u.id and m.organization_id = ${organization.id}::uuid
        where u.role::text = 'pm'
          and m.joined_at > now() - interval '7 days'
        order by m.joined_at desc
        limit 5
      `),
            queryRows<{ id: string; name: string; waitingDays: number }>(sql`
        select a.id::text, p.name, extract(day from (now() - a.requested_at))::int as "waitingDays"
        from approvals a
        join projects p on p.id = a.project_id
        where a.organization_id = ${organization.id}::uuid
          and a.status::text in ('requested','under_review')
          and a.requested_at < now() - interval '3 days'
        order by a.requested_at asc
        limit 5
      `),
            queryRows<{ id: string; name: string; workload: number }>(sql`
        select
          u.id::text,
          u.name,
          round(( (select count(*) from projects p where p.assigned_pm_user_id = u.id and p.organization_id = ${organization.id}::uuid and p.deleted_at is null and p.status::text not in ('completed','archived','cancelled'))::float / u.pm_capacity_limit ) * 100)::int as workload
        from users u
        join memberships m on m.user_id = u.id and m.organization_id = ${organization.id}::uuid
        where u.role::text = 'pm'
          and u.pm_capacity_limit is not null
          and u.pm_capacity_limit > 0
          and (select count(*) from projects p where p.assigned_pm_user_id = u.id and p.organization_id = ${organization.id}::uuid and p.deleted_at is null and p.status::text not in ('completed','archived','cancelled'))::float / u.pm_capacity_limit >= 1.0
        order by workload desc
        limit 5
      `),
          ])
        : Promise.resolve(null),
    ]);

    const wf = workflowRows[0];
    const workflow =
      isChief && wf && workflowDetails
        ? {
            unassignedClients: workflowDetails[0],
            unassignedProjects: workflowDetails[1],
            newProjectManagers: workflowDetails[2],
            approvalAging: workflowDetails[3],
            workloadAlerts: workflowDetails[4],
            counts: {
              pendingClientApprovals: wf.pendingClientApprovals,
              unassignedClients: wf.unassignedClients,
              unassignedProjects: wf.unassignedProjects,
              newProjectManagers: wf.newPMs,
              stalledApprovals: wf.stalledApprovals,
              overloadedManagers: wf.overloadedPMs,
            },
          }
        : null;

    res.json({
      organization,
      metrics,
      projects,
      clients,
      activity,
      charts: buildCharts(metrics, activity),
      workflow,
    });
  },
);

router.get(
  "/platform/projects",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const organization = req.tenant!;
    res.json(
      await getProjectList(
        organization.id,
        parseProjectListQuery(req.query),
        req.auth!,
      ),
    );
  },
);

router.post(
  "/platform/projects",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;

    const input = parseCreateProjectInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const project = await createProject(
      organization.id,
      req.auth!,
      input.value,
    );
    if (project === "client_not_accessible") {
      res.status(403).json({ error: "This client is not assigned to you" });
      return;
    }

    res.status(201).json({ project });
  },
);

router.put(
  "/platform/projects/:projectId/pipeline-stage",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const projectId = stringValue(req.params.projectId);
    const input = parsePipelineStageInput(req.body);

    if (!projectId || !isUuid(projectId)) {
      res.status(400).json({ error: "A valid project id is required" });
      return;
    }

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const updated = await updateProjectPipelineStage(
      organization.id,
      req.auth!,
      projectId,
      input.value.stage,
    );
    if (updated === "not_found") {
      res.status(404).json({ error: "Project was not found" });
      return;
    }
    if (updated === "not_authorized") {
      res
        .status(403)
        .json({ error: "You do not have access to update this project" });
      return;
    }

    res.json({
      ok: true,
      project: updated,
      projects: await getProjects(organization.id, 100, req.auth!),
    });
  },
);

router.put(
  "/platform/projects/:projectId",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const projectId = stringValue(req.params.projectId);
    const input = parseUpdateProjectInput(req.body);

    if (!projectId || !isUuid(projectId)) {
      res.status(400).json({ error: "A valid project id is required" });
      return;
    }

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const updated = await updateProjectRecord(
      organization.id,
      req.auth!,
      projectId,
      input.value,
    );
    if (updated === "not_found") {
      res.status(404).json({ error: "Project was not found" });
      return;
    }
    if (updated === "not_authorized") {
      res
        .status(403)
        .json({ error: "You do not have access to update this project" });
      return;
    }
    if (updated === "invalid_manager") {
      res.status(400).json({ error: "Selected project manager is not active" });
      return;
    }

    res.json({
      ok: true,
      project: updated,
      projects: await getProjects(organization.id, 100, req.auth!),
    });
  },
);

router.delete(
  "/platform/projects/:projectId",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const projectId = stringValue(req.params.projectId);

    if (!projectId || !isUuid(projectId)) {
      res.status(400).json({ error: "A valid project id is required" });
      return;
    }

    const removed = await removeProjectRecord(
      organization.id,
      req.auth!,
      projectId,
    );
    if (removed === "not_found") {
      res.status(404).json({ error: "Project was not found" });
      return;
    }
    if (removed === "not_authorized") {
      res
        .status(403)
        .json({ error: "You do not have access to remove this project" });
      return;
    }

    res.json({
      ok: true,
      projects: await getProjects(organization.id, 100, req.auth!),
    });
  },
);

interface ServerExhibition {
  id: string;
  name: string;
  venue?: string;
  city?: string;
  startDate?: string | null;
  endDate?: string | null;
  status: "Draft" | "Active" | "Closed";
  createdAt: string;
}

const tenantExhibitionsStore = new Map<string, ServerExhibition[]>();

router.get(
  "/platform/exhibitions",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const organization = req.tenant!;
    const stored = tenantExhibitionsStore.get(organization.id) || [];
    const projectsList = await getProjects(organization.id, 500, req.auth!);
    const projectExhibitions = Array.from(
      new Set(projectsList.map((p) => p.exhibition || p.name).filter(Boolean)),
    );

    const existingNames = new Set(stored.map((e) => e.name));
    const combined = [...stored];
    for (const name of projectExhibitions) {
      if (!existingNames.has(name)) {
        combined.push({
          id: `exhibition-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name,
          status: "Active",
          createdAt: new Date().toISOString(),
        });
        existingNames.add(name);
      }
    }

    res.json({ exhibitions: combined });
  },
);

router.post(
  "/platform/exhibitions",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!name) {
      res.status(400).json({ error: "Exhibition name is required" });
      return;
    }

    const venue =
      typeof req.body?.venue === "string" ? req.body.venue.trim() : "";
    const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
    const startDate =
      typeof req.body?.startDate === "string" ? req.body.startDate : null;
    const endDate =
      typeof req.body?.endDate === "string" ? req.body.endDate : null;
    const status =
      req.body?.status === "Draft" || req.body?.status === "Closed"
        ? req.body.status
        : "Active";

    const currentList = tenantExhibitionsStore.get(organization.id) || [];
    const newEx: ServerExhibition = {
      id: `exhibition-${Date.now()}`,
      name,
      venue,
      city,
      startDate,
      endDate,
      status,
      createdAt: new Date().toISOString(),
    };

    const updatedList = [newEx, ...currentList.filter((e) => e.name !== name)];
    tenantExhibitionsStore.set(organization.id, updatedList);

    res.json({ exhibition: newEx, exhibitions: updatedList });
  },
);

router.get(
  "/platform/clients",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const query = parseClientListQuery(req.query);
    res.json({
      ...(await getClients(organization.id, query, req.auth!)),
    });
  },
);

router.post(
  "/platform/clients",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const input = parseCreateClientInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const clientId = await createClientRecord(organization.id, {
      ...input.value,
      contactName: input.value.contactName ?? input.value.companyName,
    });
    await auditEvent(
      organization.id,
      req.auth!.user.id,
      "client_created",
      `created client ${input.value.companyName}`,
      {
        clientId,
        companyName: input.value.companyName,
      },
    );

    res
      .status(201)
      .json({
        clients: (await getClients(organization.id, 100, req.auth!)).clients,
      });
  },
);

router.put(
  "/platform/clients/:clientId",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const clientId = stringValue(req.params.clientId);
    const input = parseUpdateClientInput(req.body);

    if (!clientId || !isUuid(clientId)) {
      res.status(400).json({ error: "A valid client id is required" });
      return;
    }

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const updated = await updateClientRecord(
      organization.id,
      req.auth!.user.id,
      clientId,
      input.value,
    );
    if (updated === "not_found") {
      res.status(404).json({ error: "Client was not found" });
      return;
    }
    if (updated === "duplicate") {
      res
        .status(409)
        .json({ error: "Another client already uses this company name" });
      return;
    }

    res.json({
      ok: true,
      clients: (await getClients(organization.id, 100, req.auth!)).clients,
    });
  },
);

router.put(
  "/platform/clients/:clientId/status",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const clientId = stringValue(req.params.clientId);
    const status = normalizeClientStatus(
      stringValue((req.body as Record<string, unknown> | undefined)?.status),
    );

    if (!clientId || !isUuid(clientId)) {
      res.status(400).json({ error: "A valid client id is required" });
      return;
    }
    if (!status) {
      res
        .status(400)
        .json({
          error: "status must be Active, Lead, Pending, Inactive, or Archived",
        });
      return;
    }

    const updated = await updateClientStatus(
      organization.id,
      req.auth!,
      clientId,
      status,
    );
    if (updated === "not_found") {
      res.status(404).json({ error: "Client was not found" });
      return;
    }
    if (updated === "not_authorized") {
      res
        .status(403)
        .json({ error: "You do not have access to update this client" });
      return;
    }

    res.json({
      ok: true,
      clients: (await getClients(organization.id, 100, req.auth!)).clients,
    });
  },
);

router.delete(
  "/platform/clients/:clientId",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const clientId = stringValue(req.params.clientId);

    if (!clientId || !isUuid(clientId)) {
      res.status(400).json({ error: "A valid client id is required" });
      return;
    }

    const removed = await removeClientRecord(
      organization.id,
      req.auth!.user.id,
      clientId,
    );
    if (removed.status === "not_found") {
      res.status(404).json({ error: "Client was not found" });
      return;
    }
    if (removed.status === "has_projects") {
      res.status(409).json({
        error: "Client has active projects and cannot be removed",
        projects: removed.projects,
      });
      return;
    }

    res.json({
      ok: true,
      clients: (await getClients(organization.id, 100, req.auth!)).clients,
    });
  },
);

router.patch(
  "/platform/clients/:clientId/approve",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const actorUserId = req.auth!.user.id;
    const clientId = stringValue(req.params.clientId);

    if (!clientId || !isUuid(clientId)) {
      res.status(400).json({ error: "A valid client id is required" });
      return;
    }

    const data =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};
    const managerIdRaw = stringValue(data.managerId);
    const managerId =
      managerIdRaw === "unassigned" ? null : (managerIdRaw ?? null);
    const note = stringValue(data.note);
    const confirmOverCapacity = data.confirmOverCapacity === true;
    const overrideReason = stringValue(data.overrideReason);

    if (managerId && !isUuid(managerId)) {
      res.status(400).json({ error: "A valid manager id is required" });
      return;
    }

    if (managerId) {
      const managerName = await getAssignmentTargetName(
        organization.id,
        managerId,
      );
      if (!managerName) {
        res
          .status(400)
          .json({ error: "Manager must be an active PM in this organization" });
        return;
      }
    }

    const clientRows = await queryRows<{
      id: string;
      companyName: string;
      contactName: string | null;
      contactEmail: string;
      status: string;
      intakeExhibitionName: string | null;
      intakeBoothSizeSqm: string | null;
      intakeCity: string | null;
      intakeDeadlineAt: string | null;
      intakePreferredSystem: "octanorm" | "maxima" | "custom" | null;
    }>(sql`
    select
      id::text,
      company_name as "companyName",
      contact_name as "contactName",
      contact_email as "contactEmail",
      status::text,
      intake_exhibition_name as "intakeExhibitionName",
      intake_booth_size_sqm::text as "intakeBoothSizeSqm",
      intake_city as "intakeCity",
      intake_deadline_at::text as "intakeDeadlineAt",
      intake_preferred_system::text as "intakePreferredSystem"
    from clients
    where id = ${clientId}::uuid
      and organization_id = ${organization.id}::uuid
      and deleted_at is null
    limit 1
  `);
    const client = clientRows[0];
    if (!client) {
      res.status(404).json({ error: "Client was not found" });
      return;
    }
    if (client.status !== "pending_approval") {
      res
        .status(409)
        .json({
          error: "Client is not in pending_approval state",
          currentStatus: client.status,
        });
      return;
    }

    if (!managerId) {
      res
        .status(400)
        .json({
          error:
            "Select an active Project Manager before approving this client",
        });
      return;
    }

    const capacity = await getPmCapacityInfo(organization.id, managerId);
    if (capacity.limit !== null) {
      const projectLoadRows = await queryRows<{
        alreadyAssignedToManager: number;
      }>(sql`
      select count(*) filter (where assigned_pm_user_id = ${managerId}::uuid)::int as "alreadyAssignedToManager"
      from projects
      where organization_id = ${organization.id}::uuid
        and client_id = ${clientId}::uuid
        and deleted_at is null
        and status::text not in ('completed', 'archived', 'cancelled')
    `);
      const additionalProjectLoad =
        (projectLoadRows[0]?.alreadyAssignedToManager ?? 0) > 0 ? 0 : 1;
      const projectedCount = capacity.count + additionalProjectLoad;
      const projectedRatio = projectedCount / capacity.limit;

      if (projectedRatio >= PM_EXTREME_THRESHOLD && !overrideReason) {
        res.status(409).json({
          error: "extreme_overload",
          managerId,
          count: projectedCount,
          limit: capacity.limit,
          message: `PM would reach ${Math.round(projectedRatio * 100)}% capacity. An override reason is required.`,
        });
        return;
      }

      if (
        projectedRatio >= PM_BLOCK_THRESHOLD &&
        !confirmOverCapacity &&
        !overrideReason
      ) {
        res.status(409).json({
          error: "over_capacity",
          managerId,
          count: projectedCount,
          limit: capacity.limit,
          message: `PM would be at ${Math.round(projectedRatio * 100)}% capacity. Confirm to proceed.`,
        });
        return;
      }
    }

    const approvalResult = await db.transaction(async (tx) => {
      const executor = tx as unknown as SqlExecutor;
      const lockedClients = await queryRows<{
        status: string;
        previousManagerId: string | null;
      }>(
        sql`
      select status::text, assigned_pm_user_id::text as "previousManagerId"
      from clients
      where id = ${clientId}::uuid
        and organization_id = ${organization.id}::uuid
        and deleted_at is null
      limit 1
      for update
    `,
        executor,
      );
      const lockedClient = lockedClients[0];
      if (!lockedClient) return { status: "not_found" as const };
      if (lockedClient.status !== "pending_approval") {
        return {
          status: "not_pending" as const,
          currentStatus: lockedClient.status,
        };
      }

      await executor.execute(sql`
      update clients
      set
        status = 'active',
        activated_at = now(),
        assigned_pm_user_id = ${managerId}::uuid,
        updated_at = now()
      where id = ${clientId}::uuid
        and organization_id = ${organization.id}::uuid
    `);

      await recordAssignmentHistory(
        organization.id,
        {
          targetType: "client_pm",
          projectId: null,
          clientId,
          actorUserId,
          previousManagerId: lockedClient.previousManagerId,
          newManagerId: managerId,
          reason: note ?? "Assigned at client approval",
        },
        executor,
      );

      await ensureClientIntakeProject(
        organization.id,
        actorUserId,
        client,
        managerId,
        executor,
      );
      await auditEvent(
        organization.id,
        actorUserId,
        "client_approved",
        `approved client ${client.companyName}`,
        {
          clientId,
          managerId,
          note,
        },
        executor,
      );

      return { status: "approved" as const };
    });

    if (approvalResult.status === "not_found") {
      res.status(404).json({ error: "Client was not found" });
      return;
    }
    if (approvalResult.status === "not_pending") {
      res
        .status(409)
        .json({
          error: "Client is not in pending_approval state",
          currentStatus: approvalResult.currentStatus,
        });
      return;
    }

    // Notify the client user if their account is linked by email
    const userRows = await queryRows<{ id: string }>(sql`
    select u.id::text
    from users u
    join memberships m on m.user_id = u.id
      and m.organization_id = ${organization.id}::uuid
      and m.role::text = 'client'
    where lower(u.email) = lower(${client.contactEmail})
    limit 1
  `);
    if (userRows[0]) {
      await db.execute(sql`
      insert into notifications (organization_id, user_id, title, body, href)
      values (
        ${organization.id}::uuid,
        ${userRows[0].id}::uuid,
        'Your account has been approved',
        ${`Welcome, ${client.companyName}! Your portal access is now active.`},
        '/client/dashboard'
      )
    `);
    }

    // Send email to the newly-activated client (non-blocking — failure is logged, never thrown)
    const approvalEmailDelivery = await sendClientApprovedEmail({
      to: client.contactEmail,
      name: client.companyName,
    });
    await recordEmailDeliveryIncident(
      organization.id,
      actorUserId,
      approvalEmailDelivery,
      {
        kind: "client_approval",
        to: client.contactEmail,
        clientId,
        clientName: client.companyName,
      },
    );

    res.json({
      ok: true,
      clients: (await getClients(organization.id, 100, req.auth!)).clients,
    });
  },
);

router.patch(
  "/platform/clients/:clientId/reject",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const actorUserId = req.auth!.user.id;
    const clientId = stringValue(req.params.clientId);

    if (!clientId || !isUuid(clientId)) {
      res.status(400).json({ error: "A valid client id is required" });
      return;
    }

    const data =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};
    const reason = stringValue(data.reason);
    if (!reason) {
      res
        .status(400)
        .json({
          error: "A reason is required when rejecting a client account",
        });
      return;
    }

    const clientRows = await queryRows<{
      id: string;
      companyName: string;
      status: string;
    }>(sql`
    select id::text, company_name as "companyName", status::text
    from clients
    where id = ${clientId}::uuid
      and organization_id = ${organization.id}::uuid
      and deleted_at is null
    limit 1
  `);
    const client = clientRows[0];
    if (!client) {
      res.status(404).json({ error: "Client was not found" });
      return;
    }
    if (client.status !== "pending_approval") {
      res
        .status(409)
        .json({
          error: "Client is not in pending_approval state",
          currentStatus: client.status,
        });
      return;
    }

    await db.execute(sql`
    update clients
    set status = 'archived', updated_at = now()
    where id = ${clientId}::uuid
      and organization_id = ${organization.id}::uuid
  `);

    await auditEvent(
      organization.id,
      actorUserId,
      "client_rejected",
      `rejected client ${client.companyName}`,
      {
        clientId,
        reason,
      },
    );

    res.json({
      ok: true,
      clients: (await getClients(organization.id, 100, req.auth!)).clients,
    });
  },
);

router.get(
  "/platform/tasks",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    res.json(await getPmTaskBoard(req.auth!));
  },
);

router.post(
  "/platform/tasks",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const input = parsePmTaskInput(req.body);
    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const result = await createPmTask(req.auth!, input.value);
    if (result === "project_not_found") {
      res
        .status(404)
        .json({ error: "Project was not found or is not accessible" });
      return;
    }

    res.status(201).json(await getPmTaskBoard(req.auth!));
  },
);

router.patch(
  "/platform/tasks/:taskId",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const taskId = stringValue(req.params.taskId);
    const input = parsePmTaskPatch(req.body);
    if (!taskId || !isUuid(taskId)) {
      res.status(400).json({ error: "A valid task id is required" });
      return;
    }
    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const updated = await updatePmTask(req.auth!, taskId, input.value);
    if (!updated) {
      res
        .status(404)
        .json({ error: "Task was not found or is not accessible" });
      return;
    }

    res.json(await getPmTaskBoard(req.auth!));
  },
);

router.delete(
  "/platform/tasks/:taskId",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const taskId = stringValue(req.params.taskId);
    if (!taskId || !isUuid(taskId)) {
      res.status(400).json({ error: "A valid task id is required" });
      return;
    }

    const removed = await deletePmTask(req.auth!, taskId);
    if (!removed) {
      res
        .status(404)
        .json({ error: "Task was not found or is not accessible" });
      return;
    }

    res.json(await getPmTaskBoard(req.auth!));
  },
);

router.get(
  "/platform/requests",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    res.json(
      await getPmRequests(req.auth!, parsePmRequestListQuery(req.query)),
    );
  },
);

router.patch(
  "/platform/requests/:requestId/status",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const requestId = stringValue(req.params.requestId);
    const input = parsePmRequestStatusInput(req.body);

    if (!requestId || !isUuid(requestId)) {
      res.status(400).json({ error: "A valid request id is required" });
      return;
    }

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const updated = await updatePmRequestStatus(
      req.auth!,
      requestId,
      input.value.status,
    );
    if (updated === "invalid_transition") {
      res
        .status(409)
        .json({ error: "Request status transition is not allowed" });
      return;
    }
    if (!updated) {
      res
        .status(404)
        .json({ error: "Request was not found or is not accessible" });
      return;
    }

    res.json(
      await getPmRequests(req.auth!, parsePmRequestListQuery(req.query)),
    );
  },
);

router.post(
  "/platform/requests/:requestId/replies",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const requestId = stringValue(req.params.requestId);
    const input = parsePmRequestReplyInput(req.body);

    if (!requestId || !isUuid(requestId)) {
      res.status(400).json({ error: "A valid request id is required" });
      return;
    }

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const created = await createPmRequestReply(
      req.auth!,
      requestId,
      input.value.body,
    );
    if (!created) {
      res
        .status(404)
        .json({ error: "Request was not found or is not accessible" });
      return;
    }

    res
      .status(201)
      .json(await getPmRequests(req.auth!, parsePmRequestListQuery(req.query)));
  },
);

router.get(
  "/platform/account/settings",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const settings = await getAccountSettings(req.auth!);
    res.json(settings);
  },
);

router.put(
  "/platform/account/settings",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const input = parseAccountSettingsInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const settings = await updateAccountSettings(req.auth!, input.value);
    if ("error" in settings) {
      res.status(409).json({ error: settings.error });
      return;
    }
    await auditEvent(
      req.tenant!.id,
      req.auth!.user.id,
      "account_settings_updated",
      "updated account settings",
      {},
    );
    res.json(settings);
  },
);

router.put(
  "/platform/account/avatar",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const input = parseAvatarInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const settings = await updateAccountAvatar(req.auth!, input.value);
    await auditEvent(
      req.tenant!.id,
      req.auth!.user.id,
      "account_avatar_updated",
      "updated account avatar",
      {},
    );
    res.json(settings);
  },
);

router.put(
  "/platform/account/password",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const input = parsePasswordInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const changed = await updateAccountPassword(
      req.auth!,
      input.value.currentPassword,
      input.value.newPassword,
    );

    if (!changed.ok) {
      res.status(400).json({ error: changed.error });
      return;
    }

    await auditEvent(
      req.tenant!.id,
      req.auth!.user.id,
      "account_password_updated",
      "updated account password",
      {},
    );
    res.status(204).send();
  },
);

router.get(
  "/platform/account/sessions",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    res.json({ sessions: await getAccountSessions(req.auth!) });
  },
);

router.delete(
  "/platform/account/sessions/:sessionId",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const sessionId = stringValue(req.params.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: "Session id is required" });
      return;
    }

    const count = await revokeAccountSession(req.auth!, sessionId);
    res.json({ revoked: count });
  },
);

router.get(
  "/platform/managers",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    res.json({
      managers: await getManagers(organization.id),
      clients: await getManagedClients(organization.id),
      projects: await getManagedProjects(organization.id),
      audit: await getManagerAudit(organization.id, 30),
      invitations: await getManagerInvitations(organization.id),
    });
  },
);

router.get(
  "/platform/managers/assignment-items",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    res.json(
      await getManagerAssignmentItems(
        organization.id,
        parseManagerAssignmentItemsQuery(req.query),
      ),
    );
  },
);

router.post(
  "/platform/managers/invitations",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const input = parseInviteManagerInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const normalizedInput = {
      ...input.value,
      email: input.value.email.trim().toLowerCase(),
    };
    const existingUsers = await queryRows<{ id: string }>(sql`
    select id::text
    from users
    where lower(email) = ${normalizedInput.email}
      and deleted_at is null
    limit 1
  `);
    if (existingUsers[0]) {
      res.status(409).json({
        error: {
          code: "account_exists",
          message:
            "An account already exists for this email. Sign in instead of creating another invitation.",
        },
      });
      return;
    }

    const pendingInvitations = await queryRows<{ id: string }>(sql`
    select id::text
    from invitations
    where organization_id = ${organization.id}::uuid
      and lower(email) = ${normalizedInput.email}
      and accepted_at is null
      and revoked_at is null
      and expires_at > now()
    limit 1
  `);
    if (pendingInvitations[0]) {
      res.status(409).json({
        error: {
          code: "invitation_pending",
          message:
            "A valid invitation is already pending for this email. Resend or revoke it from the invitation list.",
        },
      });
      return;
    }

    const invitation = await inviteManager(
      organization.id,
      req.auth!.user.id,
      normalizedInput,
    );
    await auditEvent(
      organization.id,
      req.auth!.user.id,
      "manager_invited",
      `invited ${normalizedInput.email}`,
      { email: normalizedInput.email },
    );
    const delivery = await sendManagerInvitationEmail({
      to: normalizedInput.email,
      name: normalizedInput.name,
      inviteUrl: invitation.inviteUrl,
      expiresAt:
        invitation.expiresAt ??
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await updateInvitationEmailDelivery(
      organization.id,
      invitation.id,
      delivery,
    );
    await recordEmailDeliveryIncident(
      organization.id,
      req.auth!.user.id,
      delivery,
      {
        kind: "manager_invitation",
        to: normalizedInput.email,
        invitationId: invitation.id,
      },
    );
    res
      .status(201)
      .json({ invitation: invitationWithEmailDelivery(invitation, delivery) });
  },
);

router.post(
  "/platform/managers/invitations/:invitationId/resend",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const invitationId = stringValue(req.params.invitationId);

    if (!invitationId || !isUuid(invitationId)) {
      res.status(400).json({ error: "A valid invitation id is required" });
      return;
    }

    const invitation = await resendManagerInvitation(
      organization.id,
      req.auth!.user.id,
      invitationId,
    );
    if (!invitation) {
      res.status(404).json({ error: "Pending invitation was not found" });
      return;
    }

    const delivery = await sendManagerInvitationEmail({
      to: invitation.email,
      name: invitation.name ?? "",
      inviteUrl: invitation.inviteUrl,
      expiresAt:
        invitation.expiresAt ??
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await updateInvitationEmailDelivery(
      organization.id,
      invitation.id,
      delivery,
    );
    await recordEmailDeliveryIncident(
      organization.id,
      req.auth!.user.id,
      delivery,
      {
        kind: "manager_invitation_resend",
        to: invitation.email,
        invitationId: invitation.id,
      },
    );
    res.json({ invitation: invitationWithEmailDelivery(invitation, delivery) });
  },
);

router.delete(
  "/platform/managers/invitations/:invitationId",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const invitationId = stringValue(req.params.invitationId);

    if (!invitationId || !isUuid(invitationId)) {
      res.status(400).json({ error: "A valid invitation id is required" });
      return;
    }

    const revoked = await revokeManagerInvitation(
      organization.id,
      req.auth!.user.id,
      invitationId,
    );
    if (!revoked) {
      res.status(404).json({ error: "Pending invitation was not found" });
      return;
    }

    res.json({
      ok: true,
      invitations: await getManagerInvitations(organization.id),
    });
  },
);

router.put(
  "/platform/managers/assignments",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const input = parseAssignmentsInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const result = await updateAssignments(
      organization.id,
      req.auth!.user.id,
      input.value,
    );
    if ("error" in result) {
      res
        .status(result.error === "pending_approval_requires_review" ? 409 : 422)
        .json(result);
      return;
    }
    res.json(result);
  },
);

router.get(
  "/platform/assignment-history",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const projectId = stringValue(req.query.projectId);
    const clientId = stringValue(req.query.clientId);
    if (projectId && !isUuid(projectId)) {
      res.status(400).json({ error: "A valid projectId is required" });
      return;
    }
    if (clientId && !isUuid(clientId)) {
      res.status(400).json({ error: "A valid clientId is required" });
      return;
    }

    const rows = await queryRows<{
      id: string;
      targetType: string;
      projectId: string | null;
      clientId: string | null;
      changedBy: string | null;
      previousPm: string | null;
      newPm: string | null;
      reason: string | null;
      createdAt: string;
    }>(sql`
    select
      h.id::text,
      h.target_type::text as "targetType",
      h.project_id::text as "projectId",
      h.client_id::text as "clientId",
      changedBy.name as "changedBy",
      previousPm.name as "previousPm",
      newPm.name as "newPm",
      h.reason,
      h.created_at as "createdAt"
    from project_assignment_history h
    left join users changedBy on changedBy.id = h.changed_by_user_id
    left join users previousPm on previousPm.id = h.previous_pm_user_id
    left join users newPm on newPm.id = h.new_pm_user_id
    where h.organization_id = ${organization.id}::uuid
      ${projectId ? sql`and h.project_id = ${projectId}::uuid` : sql``}
      ${clientId ? sql`and h.client_id = ${clientId}::uuid` : sql``}
    order by h.created_at desc
    limit 200
  `);

    res.json({ history: rows });
  },
);

router.get(
  "/platform/managers/:managerId/capacity",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const managerId = stringValue(req.params.managerId);
    if (!managerId || !isUuid(managerId)) {
      res.status(400).json({ error: "A valid manager id is required" });
      return;
    }
    const info = await getPmCapacityInfo(organization.id, managerId);
    res.json({
      managerId,
      count: info.count,
      limit: info.limit,
      percentage: info.limit
        ? Math.round((info.count / info.limit) * 100)
        : null,
      status: info.status,
    });
  },
);

router.patch(
  "/platform/managers/:managerId/status",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const status = stringValue(
      (req.body as Record<string, unknown> | undefined)?.status,
    );
    const managerId = stringValue(req.params.managerId);

    if (
      !managerId ||
      !isUuid(managerId) ||
      !["active", "suspended"].includes(status ?? "")
    ) {
      res
        .status(400)
        .json({ error: "A valid manager id and status are required" });
      return;
    }

    const rows = await queryRows<{ name: string }>(sql`
    update memberships
    set status = ${status}::membership_status, updated_at = now()
    where organization_id = ${organization.id}::uuid
      and user_id = ${managerId}::uuid
      and role::text = 'pm'
    returning (
      select name from users where id = ${managerId}::uuid and deleted_at is null
    ) as name
  `);

    const manager = rows[0];
    if (!manager?.name) {
      res.status(404).json({ error: "Project manager was not found" });
      return;
    }

    await auditEvent(
      organization.id,
      req.auth!.user.id,
      "manager_status_updated",
      `updated manager status to ${status}`,
      { managerId, status },
    );
    await createNotification(
      organization.id,
      managerId,
      status === "active" ? "Account reactivated" : "Account paused",
      status === "active"
        ? "Your project manager account is active again."
        : "Your project manager account has been paused. Contact the chief manager if you need access restored.",
      "/pm",
    );
    res.json({ ok: true });
  },
);

router.post(
  "/platform/managers/:managerId/reminders",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const managerId = stringValue(req.params.managerId);
    const input = parseManagerReminderInput(req.body);

    if (!managerId || !isUuid(managerId)) {
      res.status(400).json({ error: "A valid manager id is required" });
      return;
    }

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const queued = await queueManagerReminder(
      organization.id,
      req.auth!.user.id,
      managerId,
      input.value,
    );
    if (!queued) {
      res.status(404).json({ error: "Project manager was not found" });
      return;
    }

    res.status(201).json({ ok: true });
  },
);

router.get(
  "/platform/notifications",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    res.json(await getNotifications(req.auth!, 20));
  },
);

router.patch(
  "/platform/notifications/read-all",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const updated = await markAllNotificationsRead(req.auth!);
    res.json({ updated, ...(await getNotifications(req.auth!, 20)) });
  },
);

router.patch(
  "/platform/notifications/:notificationId/read",
  requireRoles(["admin", "owner", "chief", "pm", "client"]),
  async (req, res) => {
    const notificationId = stringValue(req.params.notificationId);

    if (!notificationId || !isUuid(notificationId)) {
      res.status(400).json({ error: "A valid notification id is required" });
      return;
    }

    const updated = await markNotificationRead(req.auth!, notificationId);
    if (!updated) {
      res.status(404).json({ error: "Notification was not found" });
      return;
    }

    res.json({ ok: true, ...(await getNotifications(req.auth!, 20)) });
  },
);

router.post(
  "/platform/reports/export-audit",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    const data = objectValue(req.body);
    const report = stringValue(data.report) ?? "chief_report";
    const range = stringValue(data.range) ?? "current";
    const format = stringValue(data.format) ?? "xls";

    await auditEvent(
      organization.id,
      req.auth!.user.id,
      "report_exported",
      `exported ${report}`,
      {
        report,
        range,
        format,
      },
    );
    await createNotification(
      organization.id,
      req.auth!.user.id,
      "Report exported",
      `${report} was exported as ${format.toUpperCase()}.`,
      req.auth!.user.role === "pm" ? "/pm/reports" : "/chief/reports",
      "reports",
    );

    res.status(201).json({ ok: true });
  },
);

router.get(
  "/platform/reports/chief",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const range = stringValue(req.query.range) ?? "6M";
    res.json(await getChiefReport(organization.id, range));
  },
);

router.get(
  "/platform/reports/pm",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const period = stringValue(req.query.period) ?? "this_week";
    res.json(await getPmReport(req.auth!, period));
  },
);

// Time-in-stage analytics built from recorded pipeline-stage transitions
// (manual kanban moves and automatic lifecycle sync both emit
// 'project_pipeline_stage_updated' events).
router.get(
  "/platform/reports/pipeline-flow",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;

    const projects = await queryRows<{
      id: string;
      name: string;
      createdAt: string;
      status: string;
      metadataStage: string | null;
    }>(sql`
    select id::text, name, created_at::text as "createdAt", status::text as status,
      (metadata ->> 'pipelineStage') as "metadataStage"
    from projects
    where organization_id = ${organization.id}::uuid and deleted_at is null
  `);

    const events = await queryRows<{
      projectId: string | null;
      stage: string | null;
      createdAt: string;
    }>(sql`
    select
      coalesce(project_id::text, metadata ->> 'projectId') as "projectId",
      (metadata ->> 'stage') as stage,
      created_at::text as "createdAt"
    from activity_events
    where organization_id = ${organization.id}::uuid
      and event_type = 'project_pipeline_stage_updated'
    order by created_at asc
  `);

    const eventsByProject = new Map<string, { stage: string; at: number }[]>();
    for (const event of events) {
      if (!event.projectId || !event.stage) continue;
      const list = eventsByProject.get(event.projectId) ?? [];
      list.push({
        stage: event.stage,
        at: new Date(event.createdAt).getTime(),
      });
      eventsByProject.set(event.projectId, list);
    }

    const STAGES = [
      "intake",
      "design",
      "review",
      "production",
      "closed",
    ] as const;
    const totals = new Map<
      string,
      { totalMs: number; projects: Set<string> }
    >();
    const now = Date.now();
    const slowest: {
      projectId: string;
      name: string;
      stage: string;
      days: number;
    }[] = [];

    for (const project of projects) {
      const transitions = eventsByProject.get(project.id) ?? [];
      let cursorStage = "intake";
      let cursorAt = new Date(project.createdAt).getTime();

      const addSpan = (stage: string, from: number, to: number) => {
        if (to <= from) return;
        const bucket = totals.get(stage) ?? {
          totalMs: 0,
          projects: new Set<string>(),
        };
        bucket.totalMs += to - from;
        bucket.projects.add(project.id);
        totals.set(stage, bucket);
      };

      for (const transition of transitions) {
        if (transition.stage === cursorStage) continue;
        addSpan(cursorStage, cursorAt, transition.at);
        cursorStage = transition.stage;
        cursorAt = transition.at;
      }

      const currentStage =
        normalizePipelineStage(project.metadataStage) ??
        pipelineStageFromProjectStatus(project.status);
      if (currentStage !== "closed") {
        addSpan(cursorStage, cursorAt, now);
        slowest.push({
          projectId: project.id,
          name: project.name,
          stage: currentStage,
          days:
            Math.round(((now - cursorAt) / (24 * 60 * 60 * 1000)) * 10) / 10,
        });
      } else {
        addSpan(
          cursorStage,
          cursorAt,
          transitions.length ? transitions[transitions.length - 1].at : now,
        );
      }
    }

    res.json({
      stages: STAGES.map((stage) => {
        const bucket = totals.get(stage);
        const projectCount = bucket?.projects.size ?? 0;
        return {
          stage,
          projects: projectCount,
          avgDays: projectCount
            ? Math.round(
                (bucket!.totalMs / projectCount / (24 * 60 * 60 * 1000)) * 10,
              ) / 10
            : 0,
        };
      }),
      slowest: slowest.sort((a, b) => b.days - a.days).slice(0, 5),
    });
  },
);

router.get(
  "/platform/calendar",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const organization = req.tenant!;
    res.json({ events: await getCalendarEvents(organization.id, req.auth!) });
  },
);

router.get(
  "/platform/workspaces/monitor",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    res.json({
      projects: await getWorkspaceMonitorProjects(organization.id),
      managers: await getManagers(organization.id),
    });
  },
);

router.post(
  "/platform/calendar/events",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const input = parseCalendarEventInput(req.body);

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const event = await createCalendarEvent(
      organization.id,
      req.auth!.user.id,
      input.value,
    );
    await auditEvent(
      organization.id,
      req.auth!.user.id,
      "calendar_event_created",
      `created calendar event ${event.name}`,
      {
        projectId: event.id,
        name: event.name,
      },
    );

    res
      .status(201)
      .json({
        event,
        events: await getCalendarEvents(organization.id, req.auth!),
      });
  },
);

router.put(
  "/platform/calendar/events/:eventId",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const eventId = stringValue(req.params.eventId);
    const input = parseCalendarEventInput(req.body);

    if (!eventId || !isUuid(eventId)) {
      res.status(400).json({ error: "A valid calendar event id is required" });
      return;
    }

    if (!input.ok) {
      res.status(400).json({ error: input.error });
      return;
    }

    const event = await updateCalendarEvent(
      organization.id,
      req.auth!.user.id,
      eventId,
      input.value,
    );
    if (!event) {
      res.status(404).json({ error: "Calendar event was not found" });
      return;
    }

    await auditEvent(
      organization.id,
      req.auth!.user.id,
      "calendar_event_updated",
      `updated calendar event ${event.name}`,
      {
        projectId: event.id,
        name: event.name,
      },
    );

    res.json({
      event,
      events: await getCalendarEvents(organization.id, req.auth!),
    });
  },
);

router.delete(
  "/platform/calendar/events/:eventId",
  requireRoles(["admin", "owner", "chief"]),
  async (req, res) => {
    const organization = req.tenant!;
    const eventId = stringValue(req.params.eventId);

    if (!eventId || !isUuid(eventId)) {
      res.status(400).json({ error: "A valid calendar event id is required" });
      return;
    }

    const removed = await deleteCalendarEvent(
      organization.id,
      req.auth!.user.id,
      eventId,
    );
    if (!removed) {
      res.status(404).json({ error: "Calendar event was not found" });
      return;
    }

    res.json({
      ok: true,
      events: await getCalendarEvents(organization.id, req.auth!),
    });
  },
);

async function getAccountSettings(auth: AuthContext) {
  const rows = await queryRows<{
    id: string;
    userId: string | null;
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
  const profileEmail = stringValue(input.profile?.email)?.toLowerCase() ?? null;

  if (profileEmail) {
    const conflict = await queryRows<{ id: string }>(sql`
      select id::text from users
      where lower(email) = ${profileEmail}
        and id <> ${auth.user.id}::uuid
        and deleted_at is null
      limit 1
    `);
    if (conflict[0]) {
      return { error: "That email address is already in use." } as never;
    }
  }

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

async function updateAccountAvatar(
  auth: AuthContext,
  input: { avatarUrl: string; avatarTone: string },
) {
  return updateAccountSettings(auth, {
    profile: {
      avatarUrl: input.avatarUrl,
      avatarTone: input.avatarTone,
    },
  });
}

async function updateAccountPassword(
  auth: AuthContext,
  currentPassword: string,
  newPassword: string,
) {
  const rows = await queryRows<{ passwordHash: string | null }>(sql`
    select password_hash as "passwordHash"
    from users
    where id = ${auth.user.id}::uuid
      and deleted_at is null
    limit 1
  `);
  const existing = rows[0];

  if (
    !existing?.passwordHash ||
    !verifyPassword(currentPassword, existing.passwordHash)
  ) {
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

  const rows = await queryRows<{ id: string }>(sql`
    update sessions
    set revoked_at = now()
    where id = ${sessionId}::uuid
      and user_id = ${auth.user.id}::uuid
      and organization_id = ${auth.organization.id}::uuid
      and revoked_at is null
    returning id::text
  `);

  return rows.length;
}

async function getNotifications(auth: AuthContext, limit: number) {
  const rows = await queryRows<{
    id: string;
    title: string;
    body: string;
    href: string | null;
    readAt: string | null;
    createdAt: string;
  }>(sql`
    select
      id::text,
      title,
      body,
      href,
      read_at::text as "readAt",
      created_at::text as "createdAt"
    from notifications
    where organization_id = ${auth.organization.id}::uuid
      and user_id = ${auth.user.id}::uuid
    order by created_at desc
    limit ${limit}
  `);

  const unreadRows = await queryRows<{ count: number }>(sql`
    select count(*)::int as count
    from notifications
    where organization_id = ${auth.organization.id}::uuid
      and user_id = ${auth.user.id}::uuid
      and read_at is null
  `);

  return {
    unread: Number(unreadRows[0]?.count ?? 0),
    notifications: rows.map((notification) => ({
      ...notification,
      read: Boolean(notification.readAt),
      time: relativeTime(notification.createdAt),
    })),
  };
}

async function markNotificationRead(auth: AuthContext, notificationId: string) {
  const rows = await queryRows<{ id: string }>(sql`
    update notifications
    set read_at = coalesce(read_at, now())
    where id = ${notificationId}::uuid
      and organization_id = ${auth.organization.id}::uuid
      and user_id = ${auth.user.id}::uuid
    returning id::text
  `);

  return rows.length > 0;
}

async function markAllNotificationsRead(auth: AuthContext) {
  const rows = await queryRows<{ id: string }>(sql`
    update notifications
    set read_at = now()
    where organization_id = ${auth.organization.id}::uuid
      and user_id = ${auth.user.id}::uuid
      and read_at is null
    returning id::text
  `);

  return rows.length;
}

async function createNotification(
  organizationId: string,
  userId: string,
  title: string,
  body: string,
  href: string | null,
  category: "assignments" | "milestones" | "reports" | "system" = "system",
) {
  if (!(await shouldDeliverNotification(userId, category))) return;

  await db.execute(sql`
    insert into notifications (organization_id, user_id, title, body, href)
    values (
      ${organizationId}::uuid,
      ${userId}::uuid,
      ${title.slice(0, 160)},
      ${body},
      ${href}
    )
  `);
}

async function shouldDeliverNotification(
  userId: string,
  category: "assignments" | "milestones" | "reports" | "system",
) {
  const metadata = await getUserMetadata(userId);
  const settings = objectValue(metadata.accountSettings);
  const notifications = objectValue(settings.notifications);
  return boolValue(notifications[category], true);
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
    const workload = Math.min(
      100,
      Math.max(
        0,
        activeProjects * 18 +
          delayedProjects * 18 +
          urgentProjects * 8 +
          clientCount * 5,
      ),
    );

    return {
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: "Project Manager",
      status:
        manager.status === "active"
          ? "Active"
          : manager.status === "invited"
            ? "Pending"
            : "On Leave",
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
    userId: string | null;
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
      coalesce(c.intake_exhibition_name, c.metadata ->> 'exhibition', max(p.exhibition_name)) as exhibition,
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

interface ManagerAssignmentItemsQuery {
  managerId: string | null;
  clientQ: string;
  projectQ: string;
  clientLimit: number;
  clientOffset: number;
  projectLimit: number;
  projectOffset: number;
}

async function getManagerAssignmentItems(
  organizationId: string,
  query: ManagerAssignmentItemsQuery,
) {
  const clientConditions: SQL[] = [
    sql`c.organization_id = ${organizationId}::uuid`,
    sql`c.deleted_at is null`,
  ];
  const projectConditions: SQL[] = [
    sql`p.organization_id = ${organizationId}::uuid`,
    sql`p.deleted_at is null`,
  ];

  if (query.managerId) {
    clientConditions.push(
      sql`(c.assigned_pm_user_id = ${query.managerId}::uuid or c.assigned_pm_user_id is null)`,
    );
    projectConditions.push(
      sql`(p.assigned_pm_user_id = ${query.managerId}::uuid or p.assigned_pm_user_id is null)`,
    );
  }

  if (query.clientQ) {
    const q = `%${query.clientQ.toLowerCase()}%`;
    clientConditions.push(sql`(
      lower(c.company_name) like ${q}
      or lower(c.contact_name) like ${q}
      or lower(c.contact_email) like ${q}
      or lower(coalesce(c.metadata ->> 'exhibition', '')) like ${q}
      or exists (
        select 1
        from projects search_p
        where search_p.client_id = c.id
          and search_p.deleted_at is null
          and lower(coalesce(search_p.exhibition_name, search_p.name, '')) like ${q}
      )
    )`);
  }

  if (query.projectQ) {
    const q = `%${query.projectQ.toLowerCase()}%`;
    projectConditions.push(sql`(
      lower(p.name) like ${q}
      or lower(c.company_name) like ${q}
      or lower(coalesce(p.exhibition_name, '')) like ${q}
      or exists (
        select 1
        from booth_designs search_bd
        where search_bd.project_id = p.id
          and search_bd.deleted_at is null
          and lower(search_bd.booth_system::text) like ${q}
      )
    )`);
  }

  const clientWhere = sql.join(clientConditions, sql` and `);
  const projectWhere = sql.join(projectConditions, sql` and `);

  const [clientRows, clientCountRows, projectRows, projectCountRows] =
    await Promise.all([
      queryRows<{
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
        coalesce(c.intake_exhibition_name, c.metadata ->> 'exhibition', max(p.exhibition_name)) as exhibition,
        c.status::text as status,
        greatest(c.updated_at, coalesce(max(p.updated_at), c.updated_at))::text as "lastActivity"
      from clients c
      left join users u on u.id = c.assigned_pm_user_id
      left join projects p on p.client_id = c.id and p.deleted_at is null
      where ${clientWhere}
      group by c.id, u.name
      order by c.company_name asc
      limit ${query.clientLimit}
      offset ${query.clientOffset}
    `),
      queryRows<{ count: number }>(sql`
      select count(distinct c.id)::int as count
      from clients c
      where ${clientWhere}
    `),
      queryRows<{
        id: string;
        name: string;
        clientId: string;
        client: string;
        managerId: string | null;
        managerName: string | null;
        exhibition: string | null;
        status: string;
        health: string;
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
      where ${projectWhere}
      order by p.deadline_at nulls last, p.updated_at desc
      limit ${query.projectLimit}
      offset ${query.projectOffset}
    `),
      queryRows<{ count: number }>(sql`
      select count(distinct p.id)::int as count
      from projects p
      join clients c on c.id = p.client_id
      where ${projectWhere}
    `),
    ]);

  const clientTotal = Number(clientCountRows[0]?.count ?? 0);
  const projectTotal = Number(projectCountRows[0]?.count ?? 0);

  return {
    clients: clientRows.map((client) => ({
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      managerId: client.managerId,
      managerName: client.managerName ?? "Unassigned",
      exhibition: client.exhibition ?? "No active exhibition",
      status: toTitle(client.status),
      lastActivity: relativeTime(client.lastActivity),
    })),
    projects: projectRows.map((project) => ({
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
    })),
    clientPagination: {
      total: clientTotal,
      limit: query.clientLimit,
      offset: query.clientOffset,
      hasMore: query.clientOffset + clientRows.length < clientTotal,
    },
    projectPagination: {
      total: projectTotal,
      limit: query.projectLimit,
      offset: query.projectOffset,
      hasMore: query.projectOffset + projectRows.length < projectTotal,
    },
  };
}

async function getManagerAudit(organizationId: string, limit: number) {
  const events = await getActivity(organizationId, limit, {
    sessionId: "",
    user: {
      id: "00000000-0000-0000-0000-000000000000",
      name: "System",
      email: "",
      role: "owner",
      uiRole: "chief",
      avatarUrl: "",
      avatarTone: "primary",
    },
    organization: { id: organizationId, name: "", slug: "", plan: "" },
  });
  return events;
}

async function getManagerInvitations(organizationId: string) {
  const rows = await queryRows<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    emailStatus: "pending" | "sent" | "failed" | "skipped";
    emailLastError: string | null;
    emailLastAttemptAt: string | null;
    createdAt: string;
  }>(sql`
    select
      id::text,
      email,
      name,
      role::text,
      expires_at::text as "expiresAt",
      accepted_at::text as "acceptedAt",
      revoked_at::text as "revokedAt",
      email_status::text as "emailStatus",
      email_last_error as "emailLastError",
      email_last_attempt_at::text as "emailLastAttemptAt",
      created_at::text as "createdAt"
    from invitations
    where organization_id = ${organizationId}::uuid
      and role::text = 'pm'
    order by created_at desc
    limit 50
  `);

  return rows.map((invite) => ({
    ...invite,
    status: invite.revokedAt
      ? "Revoked"
      : invite.acceptedAt
        ? "Accepted"
        : new Date(invite.expiresAt) < new Date()
          ? "Expired"
          : "Pending",
    emailWarning:
      invite.emailStatus === "failed" || invite.emailStatus === "skipped"
        ? (invite.emailLastError ?? "Invitation email was not delivered")
        : null,
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
      name,
      role,
      token_hash,
      invited_by_user_id,
      expires_at
    )
    values (
      ${organizationId}::uuid,
      ${input.email},
      ${input.name},
      'pm',
      ${tokenHash},
      ${actorUserId}::uuid,
      ${expiresAt}
    )
    returning id::text, email, name, role::text, expires_at::text as "expiresAt", created_at::text as "createdAt"
  `);

  return {
    ...rows[0],
    name: input.name,
    token,
    inviteUrl: `/pm/join?token=${encodeURIComponent(token)}`,
    status: "Pending",
  };
}

async function resendManagerInvitation(
  organizationId: string,
  actorUserId: string,
  invitationId: string,
) {
  const token = createRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const rows = await queryRows<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    expiresAt: string;
    createdAt: string;
  }>(sql`
    update invitations
    set token_hash = ${tokenHash},
        expires_at = ${expiresAt},
        revoked_at = null
    where id = ${invitationId}::uuid
      and organization_id = ${organizationId}::uuid
      and role::text = 'pm'
      and accepted_at is null
    returning id::text, email, name, role::text, expires_at::text as "expiresAt", created_at::text as "createdAt"
  `);

  const invitation = rows[0];
  if (!invitation) return null;

  await auditEvent(
    organizationId,
    actorUserId,
    "manager_invite_resent",
    `resent invite to ${invitation.email}`,
    {
      invitationId,
      email: invitation.email,
    },
  );

  return {
    ...invitation,
    token,
    inviteUrl: `/pm/join?token=${encodeURIComponent(token)}`,
    status: "Pending",
  };
}

async function updateInvitationEmailDelivery(
  organizationId: string,
  invitationId: string,
  delivery: EmailDeliveryResult,
) {
  const error = delivery.ok ? null : delivery.error;
  await db.execute(sql`
    update invitations
    set email_status = ${delivery.status},
        email_last_error = ${error},
        email_last_attempt_at = now()
    where id = ${invitationId}::uuid
      and organization_id = ${organizationId}::uuid
  `);
}

function invitationWithEmailDelivery<T extends Record<string, unknown>>(
  invitation: T,
  delivery: EmailDeliveryResult,
) {
  return {
    ...invitation,
    emailStatus: delivery.status,
    emailWarning: delivery.ok ? null : delivery.error,
  };
}

async function recordEmailDeliveryIncident(
  organizationId: string,
  actorUserId: string,
  delivery: EmailDeliveryResult,
  context: Record<string, unknown> & { kind: string; to: string },
) {
  if (delivery.ok) return;

  const type =
    delivery.status === "failed"
      ? "email_delivery_failed"
      : "email_delivery_skipped";
  await auditEvent(
    organizationId,
    actorUserId,
    type,
    `${context.kind} email ${delivery.status} for ${context.to}`,
    {
      ...context,
      emailStatus: delivery.status,
      error: delivery.error,
    },
  );
}

async function revokeManagerInvitation(
  organizationId: string,
  actorUserId: string,
  invitationId: string,
) {
  const rows = await queryRows<{ id: string; email: string }>(sql`
    update invitations
    set revoked_at = now()
    where id = ${invitationId}::uuid
      and organization_id = ${organizationId}::uuid
      and role::text = 'pm'
      and accepted_at is null
      and revoked_at is null
    returning id::text, email
  `);

  const invitation = rows[0];
  if (!invitation) return false;

  await auditEvent(
    organizationId,
    actorUserId,
    "manager_invite_revoked",
    `revoked invite to ${invitation.email}`,
    {
      invitationId,
      email: invitation.email,
    },
  );

  return true;
}

async function updateAssignments(
  organizationId: string,
  actorUserId: string,
  input: {
    clientAssignments: Array<{ clientId: string; managerId: string | null }>;
    projectAssignments: Array<{ projectId: string; managerId: string | null }>;
    cascadeClientProjects: boolean;
    reason: string | null;
    confirmOverCapacity: boolean;
    overrideReason: string | null;
  },
) {
  const clientChanges: AssignmentChange[] = [];
  const projectChanges: AssignmentChange[] = [];

  // Capacity pre-check: count how many new assignments each target PM would gain.
  const allTargetManagerIds = new Set(
    [...input.clientAssignments, ...input.projectAssignments]
      .map((a) => a.managerId)
      .filter((id): id is string => id !== null),
  );
  for (const managerId of allTargetManagerIds) {
    const capacity = await getPmCapacityInfo(organizationId, managerId);
    if (capacity.limit === null) continue;
    const newCount = [
      ...input.clientAssignments,
      ...input.projectAssignments,
    ].filter((a) => a.managerId === managerId).length;
    const projectedCount = capacity.count + newCount;
    const projectedRatio = projectedCount / capacity.limit;
    if (projectedRatio >= PM_EXTREME_THRESHOLD && !input.overrideReason) {
      return {
        error: "extreme_overload",
        managerId,
        count: projectedCount,
        limit: capacity.limit,
        message: `PM would reach ${Math.round(projectedRatio * 100)}% capacity. An override reason is required.`,
      } as const;
    }
    if (
      projectedRatio >= PM_BLOCK_THRESHOLD &&
      !input.confirmOverCapacity &&
      !input.overrideReason
    ) {
      return {
        error: "over_capacity",
        managerId,
        count: projectedCount,
        limit: capacity.limit,
        message: `PM would be at ${Math.round(projectedRatio * 100)}% capacity. Confirm to proceed.`,
      } as const;
    }
  }

  const clientIds = [
    ...new Set(
      input.clientAssignments.map((assignment) => assignment.clientId),
    ),
  ];
  if (clientIds.length > 0) {
    const clientIdList = sql.join(
      clientIds.map((clientId) => sql`${clientId}::uuid`),
      sql`, `,
    );
    const pendingClients = await queryRows<{ id: string; name: string }>(sql`
      select c.id::text, c.company_name as name
      from clients c
      where c.organization_id = ${organizationId}::uuid
        and c.id in (${clientIdList})
        and c.status::text = 'pending_approval'
        and c.deleted_at is null
    `);
    if (pendingClients.length > 0) {
      return {
        error: "pending_approval_requires_review",
        clientIds: pendingClients.map((client) => client.id),
        message:
          "Pending clients must be reviewed and approved before assignment.",
      } as const;
    }
  }

  for (const assignment of input.clientAssignments) {
    const targetName = await getAssignmentTargetName(
      organizationId,
      assignment.managerId,
    );
    if (assignment.managerId && !targetName) continue;

    const clientRows = await queryRows<{
      id: string;
      name: string;
      managerId: string | null;
      managerName: string | null;
      contactEmail: string;
      intakeExhibitionName: string | null;
      intakeBoothSizeSqm: string | null;
      intakeCity: string | null;
      intakeDeadlineAt: string | null;
      intakePreferredSystem: string | null;
    }>(sql`
      select
        c.id::text,
        c.company_name as name,
        c.assigned_pm_user_id::text as "managerId",
        u.name as "managerName",
        c.contact_email as "contactEmail",
        c.intake_exhibition_name as "intakeExhibitionName",
        c.intake_booth_size_sqm::text as "intakeBoothSizeSqm",
        c.intake_city as "intakeCity",
        c.intake_deadline_at::text as "intakeDeadlineAt",
        c.intake_preferred_system::text as "intakePreferredSystem"
      from clients c
      left join users u on u.id = c.assigned_pm_user_id
      where c.id = ${assignment.clientId}::uuid
        and c.organization_id = ${organizationId}::uuid
        and c.deleted_at is null
      limit 1
    `);
    const client = clientRows[0];
    if (!client || (client.managerId ?? null) === assignment.managerId)
      continue;

    await db.execute(sql`
      update clients
      set
        assigned_pm_user_id = ${assignment.managerId}::uuid,
        status = 'active',
        activated_at = coalesce(activated_at, now()),
        updated_at = now()
      where id = ${assignment.clientId}::uuid
        and organization_id = ${organizationId}::uuid
        and deleted_at is null
    `);

    if (assignment.managerId) {
      await ensureClientIntakeProject(
        organizationId,
        actorUserId,
        {
          id: client.id,
          companyName: client.name,
          contactEmail: client.contactEmail,
          intakeExhibitionName: client.intakeExhibitionName,
          intakeBoothSizeSqm: client.intakeBoothSizeSqm,
          intakeCity: client.intakeCity,
          intakeDeadlineAt: client.intakeDeadlineAt,
          intakePreferredSystem: client.intakePreferredSystem as
            | "octanorm"
            | "maxima"
            | "custom"
            | null,
        },
        assignment.managerId,
      );

      const clientUserRows = await queryRows<{ id: string }>(sql`
        select u.id::text
        from users u
        join memberships m on m.user_id = u.id
          and m.organization_id = ${organizationId}::uuid
          and m.role::text = 'client'
        where lower(u.email) = lower(${client.contactEmail})
          and u.deleted_at is null
        limit 1
      `);
      if (clientUserRows[0]?.id) {
        const body = `A project manager (${targetName}) has been assigned to your workspace. Log in to access your booth project.`;
        await createNotification(
          organizationId,
          clientUserRows[0].id,
          "Project Manager Assigned",
          body,
          "/client",
          "assignments",
        );
      }
      await sendClientApprovedEmail({
        to: client.contactEmail,
        name: client.name,
      });
    }

    await recordAssignmentHistory(organizationId, {
      targetType: "client_pm",
      projectId: null,
      clientId: assignment.clientId,
      actorUserId,
      previousManagerId: client.managerId,
      newManagerId: assignment.managerId,
      reason: input.reason ?? null,
    });
    clientChanges.push({
      id: client.id,
      name: client.name,
      fromManagerId: client.managerId,
      toManagerId: assignment.managerId,
      from: client.managerName ?? "Unassigned",
      to: targetName ?? "Unassigned",
    });

    if (input.cascadeClientProjects) {
      const clientProjects = await queryRows<AssignmentState>(sql`
        select
          p.id::text,
          p.name,
          p.assigned_pm_user_id::text as "managerId",
          u.name as "managerName"
        from projects p
        left join users u on u.id = p.assigned_pm_user_id
        where p.client_id = ${assignment.clientId}::uuid
          and p.organization_id = ${organizationId}::uuid
          and p.deleted_at is null
      `);

      for (const project of clientProjects) {
        if ((project.managerId ?? null) === assignment.managerId) continue;
        await reassignProjectManager(
          organizationId,
          actorUserId,
          project.id,
          assignment.managerId,
          input.reason,
        );
        projectChanges.push({
          id: project.id,
          name: project.name,
          fromManagerId: project.managerId,
          toManagerId: assignment.managerId,
          from: project.managerName ?? "Unassigned",
          to: targetName ?? "Unassigned",
        });
      }
    }
  }

  for (const assignment of input.projectAssignments) {
    const targetName = await getAssignmentTargetName(
      organizationId,
      assignment.managerId,
    );
    if (assignment.managerId && !targetName) continue;

    const projectRows = await queryRows<AssignmentState>(sql`
      select
        p.id::text,
        p.name,
        p.assigned_pm_user_id::text as "managerId",
        u.name as "managerName"
      from projects p
      left join users u on u.id = p.assigned_pm_user_id
      where p.id = ${assignment.projectId}::uuid
        and p.organization_id = ${organizationId}::uuid
        and p.deleted_at is null
      limit 1
    `);
    const project = projectRows[0];
    if (!project || (project.managerId ?? null) === assignment.managerId)
      continue;

    await reassignProjectManager(
      organizationId,
      actorUserId,
      project.id,
      assignment.managerId,
      input.reason,
    );
    projectChanges.push({
      id: project.id,
      name: project.name,
      fromManagerId: project.managerId,
      toManagerId: assignment.managerId,
      from: project.managerName ?? "Unassigned",
      to: targetName ?? "Unassigned",
    });
  }

  const changedClients = clientChanges.length;
  const changedProjects = projectChanges.length;

  if (changedClients || changedProjects) {
    await auditEvent(
      organizationId,
      actorUserId,
      "manager_assignments_updated",
      "updated manager assignments",
      {
        changedClients,
        changedProjects,
        cascadeClientProjects: input.cascadeClientProjects,
        clientChanges: clientChanges.slice(0, 20),
        projectChanges: projectChanges.slice(0, 20),
      },
    );
    await notifyManagerAssignmentChanges(
      organizationId,
      clientChanges,
      projectChanges,
    );
  }

  return {
    changedClients,
    changedProjects,
    managers: await getManagers(organizationId),
    clients: await getManagedClients(organizationId),
    projects: await getManagedProjects(organizationId),
    audit: await getManagerAudit(organizationId, 30),
  };
}

interface AssignmentState {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
}

interface AssignmentChange {
  id: string;
  name: string;
  fromManagerId: string | null;
  toManagerId: string | null;
  from: string;
  to: string;
}

async function notifyManagerAssignmentChanges(
  organizationId: string,
  clientChanges: AssignmentChange[],
  projectChanges: AssignmentChange[],
) {
  const assigned = new Map<string, string[]>();
  const removed = new Map<string, string[]>();

  for (const change of [...clientChanges, ...projectChanges]) {
    if (change.toManagerId) {
      const current = assigned.get(change.toManagerId) ?? [];
      current.push(change.name);
      assigned.set(change.toManagerId, current);
    }
    if (change.fromManagerId && change.fromManagerId !== change.toManagerId) {
      const current = removed.get(change.fromManagerId) ?? [];
      current.push(change.name);
      removed.set(change.fromManagerId, current);
    }
  }

  for (const [managerId, names] of assigned) {
    await createNotification(
      organizationId,
      managerId,
      "Assignment updated",
      assignmentSummary(names, "assigned to you"),
      "/pm/projects",
      "assignments",
    );
  }

  for (const [managerId, names] of removed) {
    await createNotification(
      organizationId,
      managerId,
      "Assignment updated",
      assignmentSummary(names, "moved away from your queue"),
      "/pm/projects",
      "assignments",
    );
  }
}

function assignmentSummary(names: string[], action: string) {
  const shown = names.slice(0, 3).join(", ");
  const extra = names.length > 3 ? ` and ${names.length - 3} more` : "";
  return `${shown}${extra} ${names.length === 1 ? "was" : "were"} ${action}.`;
}

async function getAssignmentTargetName(
  organizationId: string,
  managerId: string | null,
) {
  if (!managerId) return "Unassigned";

  const rows = await queryRows<{ name: string }>(sql`
    select u.name
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${organizationId}::uuid
      and m.user_id = ${managerId}::uuid
      and m.role::text = 'pm'
      and m.status::text = 'active'
      and u.deleted_at is null
    limit 1
  `);

  return rows[0]?.name ?? null;
}

const PM_CAPACITY_DEFAULT = 10;
const PM_WARN_THRESHOLD = 0.8;
const PM_BLOCK_THRESHOLD = 1.0;
const PM_EXTREME_THRESHOLD = 1.5;

async function getPmCapacityInfo(organizationId: string, managerId: string) {
  const rows = await queryRows<{ count: number; limit: number | null }>(sql`
    select
      count(p.id)::int as count,
      u.pm_capacity_limit as limit
    from users u
    join memberships m
      on m.user_id = u.id
      and m.organization_id = ${organizationId}::uuid
    left join projects p
      on p.assigned_pm_user_id = u.id
      and p.organization_id = ${organizationId}::uuid
      and p.deleted_at is null
      and p.status::text not in ('completed', 'archived', 'cancelled')
    where u.id = ${managerId}::uuid
    group by u.pm_capacity_limit
  `);
  const count = rows[0]?.count ?? 0;
  const limit = rows[0]?.limit ?? null;
  if (limit === null) return { count, limit: null, status: "ok" as const };
  const ratio = count / limit;
  const status =
    ratio >= PM_EXTREME_THRESHOLD
      ? ("extreme" as const)
      : ratio >= PM_BLOCK_THRESHOLD
        ? ("over" as const)
        : ratio >= PM_WARN_THRESHOLD
          ? ("warn" as const)
          : ("ok" as const);
  return { count, limit, status };
}

async function reassignProjectManager(
  organizationId: string,
  actorUserId: string,
  projectId: string,
  managerId: string | null,
  reason?: string | null,
  executor: SqlExecutor = databaseExecutor,
) {
  const previous = await queryRows<{ managerId: string | null }>(
    sql`
    select assigned_pm_user_id::text as "managerId"
    from projects
    where id = ${projectId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
    limit 1
  `,
    executor,
  );
  const previousManagerId = previous[0]?.managerId ?? null;
  if (previousManagerId === managerId) return;

  await executor.execute(sql`
    update projects
    set assigned_pm_user_id = ${managerId}::uuid, updated_at = now()
    where id = ${projectId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
  `);

  await executor.execute(sql`
    delete from project_members
    where project_id = ${projectId}::uuid
      and role::text = 'pm'
  `);

  if (managerId) {
    await executor.execute(sql`
      insert into project_members (project_id, user_id, role)
      values (${projectId}::uuid, ${managerId}::uuid, 'pm')
      on conflict (project_id, user_id) do nothing
    `);
  }

  await recordAssignmentHistory(
    organizationId,
    {
      targetType: "project_pm",
      projectId,
      clientId: null,
      actorUserId,
      previousManagerId,
      newManagerId: managerId,
      reason: reason ?? null,
    },
    executor,
  );
}

async function recordAssignmentHistory(
  organizationId: string,
  entry: {
    targetType: "project_pm" | "client_pm";
    projectId: string | null;
    clientId: string | null;
    actorUserId: string;
    previousManagerId: string | null;
    newManagerId: string | null;
    reason: string | null;
  },
  executor: SqlExecutor = databaseExecutor,
) {
  await executor.execute(sql`
    insert into project_assignment_history (
      organization_id,
      target_type,
      project_id,
      client_id,
      changed_by_user_id,
      previous_pm_user_id,
      new_pm_user_id,
      reason
    )
    values (
      ${organizationId}::uuid,
      ${entry.targetType}::assignment_target,
      ${entry.projectId}::uuid,
      ${entry.clientId}::uuid,
      ${entry.actorUserId}::uuid,
      ${entry.previousManagerId}::uuid,
      ${entry.newManagerId}::uuid,
      ${entry.reason}
    )
  `);
}

async function queueManagerReminder(
  organizationId: string,
  actorUserId: string,
  managerId: string,
  input: { itemCount: number; delayedCount: number; urgentCount: number },
) {
  const rows = await queryRows<{ id: string; name: string }>(sql`
    select u.id::text, u.name
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${organizationId}::uuid
      and m.user_id = ${managerId}::uuid
      and m.role::text = 'pm'
      and m.status::text = 'active'
      and u.deleted_at is null
    limit 1
  `);
  const manager = rows[0];
  if (!manager) return false;

  const priorityParts = [
    input.delayedCount > 0 ? `${input.delayedCount} delayed` : "",
    input.urgentCount > 0 ? `${input.urgentCount} due soon` : "",
  ].filter(Boolean);
  const body = priorityParts.length
    ? `Please review ${priorityParts.join(" and ")} project item${input.itemCount === 1 ? "" : "s"}.`
    : "Please review your current project workload.";

  await createNotification(
    organizationId,
    managerId,
    "Chief manager reminder",
    body,
    "/pm/projects",
    "assignments",
  );

  await auditEvent(
    organizationId,
    actorUserId,
    "manager_reminder_queued",
    `queued reminder for ${manager.name}`,
    {
      managerId,
      itemCount: input.itemCount,
      delayedCount: input.delayedCount,
      urgentCount: input.urgentCount,
    },
  );

  return true;
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
      coalesce(nullif(concat_ws(', ', p.city, p.country), ''), p.venue) as location,
      coalesce(bd.booth_system::text, p.metadata ->> 'standType', 'custom') as "standType"
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

async function getCalendarEventById(
  organizationId: string,
  auth: AuthContext,
  eventId: string,
) {
  const events = await getCalendarEvents(organizationId, auth);
  return events.find((event) => event.id === eventId) ?? null;
}

async function createCalendarEvent(
  organizationId: string,
  actorUserId: string,
  input: CalendarEventInput,
) {
  const clientId = await createClientRecord(organizationId, {
    companyName: input.client,
    contactName: input.client,
    contactEmail: null,
    exhibition: input.name,
  });
  const managerId = await findProjectManagerIdByName(organizationId, input.pm);
  const status = calendarStatusToProject(input.status);

  const rows = await queryRows<{ id: string }>(sql`
    insert into projects (
      organization_id,
      client_id,
      assigned_pm_user_id,
      created_by_user_id,
      name,
      exhibition_name,
      venue,
      city,
      status,
      health,
      budget_cents,
      currency,
      starts_at,
      ends_at,
      deadline_at,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${clientId}::uuid,
      ${managerId}::uuid,
      ${actorUserId}::uuid,
      ${input.name},
      ${input.name},
      ${input.location},
      ${input.location},
      ${status.status}::project_status,
      ${status.health}::project_health,
      0,
      'EUR',
      ${input.startDate}::timestamptz,
      ${input.endDate}::timestamptz,
      ${input.endDate}::timestamptz,
      ${JSON.stringify({ standType: input.standType })}::jsonb
    )
    returning id::text
  `);

  const eventId = rows[0]?.id;
  if (!eventId) throw new Error("Calendar event insert did not return an id");
  if (managerId)
    await reassignProjectManager(
      organizationId,
      actorUserId,
      eventId,
      managerId,
    );

  return (
    (await getCalendarEventById(
      organizationId,
      managerAuth(organizationId),
      eventId,
    )) ?? {
      id: eventId,
      name: input.name,
      client: input.client,
      pm: input.pm || "Unassigned",
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      standType: input.standType,
    }
  );
}

async function updateCalendarEvent(
  organizationId: string,
  actorUserId: string,
  eventId: string,
  input: CalendarEventInput,
) {
  const exists = await queryRows<{ id: string }>(sql`
    select id::text
    from projects
    where id = ${eventId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
    limit 1
  `);
  if (!exists[0]) return null;

  const clientId = await createClientRecord(organizationId, {
    companyName: input.client,
    contactName: input.client,
    contactEmail: null,
    exhibition: input.name,
  });
  const managerId = await findProjectManagerIdByName(organizationId, input.pm);
  const status = calendarStatusToProject(input.status);

  await db.execute(sql`
    update projects
    set
      client_id = ${clientId}::uuid,
      assigned_pm_user_id = ${managerId}::uuid,
      name = ${input.name},
      exhibition_name = ${input.name},
      venue = ${input.location},
      city = ${input.location},
      status = ${status.status}::project_status,
      health = ${status.health}::project_health,
      starts_at = ${input.startDate}::timestamptz,
      ends_at = ${input.endDate}::timestamptz,
      deadline_at = ${input.endDate}::timestamptz,
      metadata = metadata || ${JSON.stringify({ standType: input.standType })}::jsonb,
      updated_at = now()
    where id = ${eventId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
  `);
  await reassignProjectManager(organizationId, actorUserId, eventId, managerId);

  return getCalendarEventById(
    organizationId,
    managerAuth(organizationId),
    eventId,
  );
}

async function deleteCalendarEvent(
  organizationId: string,
  actorUserId: string,
  eventId: string,
) {
  const rows = await queryRows<{ id: string; name: string }>(sql`
    update projects
    set deleted_at = now(), updated_at = now()
    where id = ${eventId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
    returning id::text, coalesce(exhibition_name, name) as name
  `);

  const event = rows[0];
  if (!event) return false;

  await auditEvent(
    organizationId,
    actorUserId,
    "calendar_event_deleted",
    `deleted calendar event ${event.name}`,
    {
      projectId: event.id,
      name: event.name,
    },
  );
  return true;
}

async function getWorkspaceMonitorProjects(organizationId: string) {
  const rows = await queryRows<{
    id: string;
    name: string;
    client: string;
    system: string;
    status: string;
    health: string;
    versionNumber: number | null;
    widthMm: number | null;
    depthMm: number | null;
    pm: string | null;
    managerId: string | null;
    progressStatus: string;
    updatedAt: string;
    activity: string | null;
    activityAt: string | null;
  }>(sql`
    select
      p.id::text,
      coalesce(p.exhibition_name, p.name) as name,
      c.company_name as client,
      coalesce(bd.booth_system::text, p.metadata ->> 'standType', 'custom') as system,
      p.status::text as status,
      p.health::text as health,
      bd.current_version_number as "versionNumber",
      bd.width_mm as "widthMm",
      bd.depth_mm as "depthMm",
      u.name as pm,
      p.assigned_pm_user_id::text as "managerId",
      p.status::text as "progressStatus",
      p.updated_at::text as "updatedAt",
      latest_activity.message as activity,
      latest_activity.created_at::text as "activityAt"
    from projects p
    join clients c on c.id = p.client_id
    left join users u on u.id = p.assigned_pm_user_id
    left join lateral (
      select booth_system, current_version_number, width_mm, depth_mm
      from booth_designs bd
      where bd.project_id = p.id and bd.deleted_at is null
      order by bd.updated_at desc
      limit 1
    ) bd on true
    left join lateral (
      select message, created_at
      from activity_events ae
      where ae.project_id = p.id
      order by ae.created_at desc
      limit 1
    ) latest_activity on true
    where p.organization_id = ${organizationId}::uuid
      and p.deleted_at is null
      and p.status::text not in ('completed', 'cancelled', 'archived')
    order by coalesce(latest_activity.created_at, p.updated_at) desc
  `);

  return rows.map((project, index) => {
    const lastActionAt = project.activityAt ?? project.updatedAt;
    return {
      id: project.id,
      name: project.name,
      client: project.client,
      system: toTitle(project.system),
      status: monitorStatus(project.status, project.health),
      version: `v${project.versionNumber ?? 1}.0`,
      dims:
        project.widthMm && project.depthMm
          ? `${formatMeters(project.widthMm)}x${formatMeters(project.depthMm)}`
          : "TBD",
      pm: project.pm ?? "Unassigned",
      managerId: project.managerId,
      lastActionMins: minutesSince(lastActionAt),
      currentAction:
        project.activity ?? monitorAction(project.status, project.health),
      waitingDays: monitorWaitingDays(
        project.status,
        project.health,
        project.updatedAt,
      ),
      progress: projectProgress(project.progressStatus),
      sort: index,
    };
  });
}

function monitorStatus(status: string, health: string) {
  if (
    ["blocked", "delayed", "at_risk"].includes(health) ||
    status === "delayed"
  )
    return "blocked";
  if (["client_review", "revision", "approved"].includes(status))
    return "review";
  if (["draft", "planning"].includes(status)) return "pending";
  return "live";
}

function monitorAction(status: string, health: string) {
  if (
    ["blocked", "delayed", "at_risk"].includes(health) ||
    status === "delayed"
  )
    return "Waiting for recovery action";
  if (["client_review", "revision"].includes(status))
    return "Waiting for client review";
  if (["draft", "planning"].includes(status)) return "Preparing workspace";
  return "Workspace updated";
}

function monitorWaitingDays(status: string, health: string, updatedAt: string) {
  if (
    !["client_review", "revision", "delayed"].includes(status) &&
    !["blocked", "delayed", "at_risk"].includes(health)
  )
    return 0;
  return Math.max(
    1,
    Math.round((Date.now() - new Date(updatedAt).getTime()) / 86_400_000),
  );
}

async function findProjectManagerIdByName(
  organizationId: string,
  name: string,
) {
  const normalized = name.trim();
  if (
    !normalized ||
    normalized === "-" ||
    normalized.toLowerCase() === "unassigned"
  )
    return null;

  const rows = await queryRows<{ id: string }>(sql`
    select u.id::text
    from memberships m
    join users u on u.id = m.user_id
    where m.organization_id = ${organizationId}::uuid
      and m.role::text = 'pm'
      and m.status::text = 'active'
      and lower(u.name) = lower(${normalized})
      and u.deleted_at is null
    limit 1
  `);

  return rows[0]?.id ?? null;
}

function calendarStatusToProject(status: CalendarEventInput["status"]) {
  if (status === "Completed")
    return { status: "completed", health: "on_track" };
  if (status === "Delayed") return { status: "delayed", health: "delayed" };
  if (status === "Active") return { status: "in_design", health: "on_track" };
  return { status: "planning", health: "on_track" };
}

function managerAuth(organizationId: string): AuthContext {
  return {
    sessionId: "",
    user: {
      id: "00000000-0000-0000-0000-000000000000",
      name: "System",
      email: "",
      role: "owner",
      uiRole: "chief",
      avatarUrl: "",
      avatarTone: "primary",
    },
    organization: { id: organizationId, name: "", slug: "", plan: "" },
  };
}

async function getChiefReport(organizationId: string, rawRange: string) {
  const range = rawRange === "3M" || rawRange === "12M" ? rawRange : "6M";
  const months = range === "3M" ? 3 : range === "12M" ? 12 : 6;
  const monthStarts = lastMonthStarts(months);
  const since = monthStarts[0].toISOString();

  const projects = await queryRows<{
    id: string;
    name: string;
    pm: string | null;
    status: string;
    health: string;
    system: string;
    budgetCents: number;
    projectDate: string;
    updatedAt: string;
  }>(sql`
    select
      p.id::text,
      coalesce(p.exhibition_name, p.name) as name,
      u.name as pm,
      p.status::text as status,
      p.health::text as health,
      coalesce(bd.booth_system::text, p.metadata ->> 'standType', 'custom') as system,
      p.budget_cents as "budgetCents",
      coalesce(p.starts_at, p.deadline_at, p.created_at)::text as "projectDate",
      p.updated_at::text as "updatedAt"
    from projects p
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
      and coalesce(p.starts_at, p.deadline_at, p.created_at) >= ${since}::timestamptz
  `);

  const invoices = await queryRows<{
    totalCents: number;
    invoiceDate: string;
  }>(sql`
    select total_cents as "totalCents", created_at::text as "invoiceDate"
    from invoices
    where organization_id = ${organizationId}::uuid
      and status::text in ('open', 'paid')
      and created_at >= ${since}::timestamptz
  `);

  const invoiceRevenueByMonth = new Map<string, number>();
  for (const invoice of invoices) {
    const key = monthKey(invoice.invoiceDate);
    invoiceRevenueByMonth.set(
      key,
      (invoiceRevenueByMonth.get(key) ?? 0) +
        centsToCurrency(invoice.totalCents),
    );
  }

  const projectRevenueByMonth = new Map<string, number>();
  const projectCountByMonth = new Map<string, number>();
  for (const project of projects) {
    const key = monthKey(project.projectDate);
    projectRevenueByMonth.set(
      key,
      (projectRevenueByMonth.get(key) ?? 0) +
        centsToCurrency(project.budgetCents),
    );
    projectCountByMonth.set(key, (projectCountByMonth.get(key) ?? 0) + 1);
  }

  const hasInvoiceRevenue = invoices.length > 0;
  const revenueData = monthStarts.map((date) => {
    const key = monthKey(date.toISOString());
    const revenue = Math.round(
      hasInvoiceRevenue
        ? (invoiceRevenueByMonth.get(key) ?? 0)
        : (projectRevenueByMonth.get(key) ?? 0),
    );
    const projectsForMonth = projectCountByMonth.get(key) ?? 0;
    return {
      month: shortMonth(date),
      revenue,
      target: Math.round(Math.max(revenue * 0.92, projectsForMonth * 45_000)),
      projects: projectsForMonth,
    };
  });

  const pmPerformance = buildPmPerformance(projects);
  const systemSplit = buildSystemSplit(projects);
  const bottlenecks = buildBottlenecks(projects);
  const monthlyTrend = revenueData.map((item) => ({
    month: item.month,
    revenue: item.revenue,
    projects: item.projects,
    satisfaction: item.projects
      ? Number(
          (
            4.1 +
            Math.min(0.8, item.revenue / Math.max(1, item.projects * 100_000))
          ).toFixed(1),
        )
      : 0,
  }));

  return {
    range,
    revenueData,
    pmPerformance,
    systemSplit,
    bottlenecks,
    monthlyTrend,
  };
}

async function getPmReport(auth: AuthContext, rawPeriod: string) {
  const period = normalizePmReportPeriod(rawPeriod);
  const range = pmReportRange(period);
  const canSeeAll = canManageOrganization(auth);

  const [
    taskMetrics,
    previousTaskMetrics,
    approvalMetrics,
    previousApprovalMetrics,
    activeClients,
    weeklyRows,
    projectRows,
    revisionRows,
    statusRows,
  ] = await Promise.all([
    queryRows<{ total: number; done: number }>(sql`
      select count(*)::int as total, count(*) filter (where t.status::text = 'done')::int as done
      from tasks t
      left join projects p on p.id = t.project_id
      where t.organization_id = ${auth.organization.id}::uuid
        and t.status::text <> 'cancelled'
        and (
          ${canSeeAll}::boolean
          or t.assigned_to_user_id = ${auth.user.id}::uuid
          or exists (select 1 from project_members pm where pm.project_id = t.project_id and pm.user_id = ${auth.user.id}::uuid)
        )
    `),
    queryRows<{ total: number; done: number }>(sql`
      select count(*)::int as total, count(*) filter (where t.status::text = 'done')::int as done
      from tasks t
      left join projects p on p.id = t.project_id
      where t.organization_id = ${auth.organization.id}::uuid
        and t.status::text <> 'cancelled'
        and t.updated_at >= ${range.previousStart.toISOString()}::timestamptz
        and t.updated_at < ${range.previousEnd.toISOString()}::timestamptz
        and (
          ${canSeeAll}::boolean
          or t.assigned_to_user_id = ${auth.user.id}::uuid
          or exists (select 1 from project_members pm where pm.project_id = t.project_id and pm.user_id = ${auth.user.id}::uuid)
        )
    `),
    queryRows<{
      total: number;
      approved: number;
      rejected: number;
      avgHours: number | null;
    }>(sql`
      select
        count(*)::int as total,
        count(*) filter (where a.status::text = 'approved')::int as approved,
        count(*) filter (where a.status::text = 'rejected')::int as rejected,
        avg(extract(epoch from (a.responded_at - a.requested_at)) / 3600) filter (where a.responded_at is not null)::float as "avgHours"
      from approvals a
      join projects p on p.id = a.project_id
      where a.organization_id = ${auth.organization.id}::uuid
        and a.status::text <> 'cancelled'
        and p.deleted_at is null
        and (
          ${canSeeAll}::boolean
          or p.assigned_pm_user_id = ${auth.user.id}::uuid
          or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
        )
    `),
    queryRows<{
      total: number;
      approved: number;
      rejected: number;
      avgHours: number | null;
    }>(sql`
      select
        count(*)::int as total,
        count(*) filter (where a.status::text = 'approved')::int as approved,
        count(*) filter (where a.status::text = 'rejected')::int as rejected,
        avg(extract(epoch from (a.responded_at - a.requested_at)) / 3600) filter (where a.responded_at is not null)::float as "avgHours"
      from approvals a
      join projects p on p.id = a.project_id
      where a.organization_id = ${auth.organization.id}::uuid
        and a.status::text <> 'cancelled'
        and a.requested_at >= ${range.previousStart.toISOString()}::timestamptz
        and a.requested_at < ${range.previousEnd.toISOString()}::timestamptz
        and p.deleted_at is null
        and (
          ${canSeeAll}::boolean
          or p.assigned_pm_user_id = ${auth.user.id}::uuid
          or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
        )
    `),
    queryRows<{ count: number }>(sql`
      select count(distinct c.id)::int as count
      from clients c
      where c.organization_id = ${auth.organization.id}::uuid
        and c.status::text = 'active'
        and c.deleted_at is null
        and (
          ${canSeeAll}::boolean
          or exists (
            select 1
            from projects p
            join project_members pm on pm.project_id = p.id
            where p.client_id = c.id
              and p.deleted_at is null
              and pm.user_id = ${auth.user.id}::uuid
          )
        )
    `),
    queryRows<{
      key: string;
      tasks: number;
      revisions: number;
      approvals: number;
    }>(sql`
      with days as (
        select generate_series(${range.start.toISOString()}::timestamptz, ${range.end.toISOString()}::timestamptz - interval '1 day', interval '1 day') as day
      )
      select
        to_char(day, 'Dy') as key,
        (
          select count(*)::int
          from tasks t
          left join projects p on p.id = t.project_id
          where t.organization_id = ${auth.organization.id}::uuid
            and t.status::text <> 'cancelled'
            and t.created_at >= day
            and t.created_at < day + interval '1 day'
            and (
              ${canSeeAll}::boolean
              or t.assigned_to_user_id = ${auth.user.id}::uuid
              or exists (select 1 from project_members pm where pm.project_id = t.project_id and pm.user_id = ${auth.user.id}::uuid)
            )
        ) as tasks,
        (
          select count(*)::int
          from approvals a
          join projects p on p.id = a.project_id
          where a.organization_id = ${auth.organization.id}::uuid
            and a.status::text = 'revision_requested'
            and a.requested_at >= day
            and a.requested_at < day + interval '1 day'
            and p.deleted_at is null
            and (
              ${canSeeAll}::boolean
              or p.assigned_pm_user_id = ${auth.user.id}::uuid
              or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
            )
        ) as revisions,
        (
          select count(*)::int
          from approvals a
          join projects p on p.id = a.project_id
          where a.organization_id = ${auth.organization.id}::uuid
            and a.status::text in ('requested', 'under_review', 'approved')
            and a.requested_at >= day
            and a.requested_at < day + interval '1 day'
            and p.deleted_at is null
            and (
              ${canSeeAll}::boolean
              or p.assigned_pm_user_id = ${auth.user.id}::uuid
              or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
            )
        ) as approvals
      from days
      order by day asc
    `),
    queryRows<{
      name: string;
      status: string;
      health: string;
      deadline: string | null;
      tasks: number;
      done: number;
    }>(sql`
      select
        coalesce(p.exhibition_name, p.name) as name,
        p.status::text as status,
        p.health::text as health,
        p.deadline_at::text as deadline,
        count(t.id)::int as tasks,
        count(t.id) filter (where t.status::text = 'done')::int as done
      from projects p
      left join tasks t on t.project_id = p.id and t.status::text <> 'cancelled'
      where p.organization_id = ${auth.organization.id}::uuid
        and p.deleted_at is null
        and (
          ${canSeeAll}::boolean
          or p.assigned_pm_user_id = ${auth.user.id}::uuid
          or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
        )
      group by p.id
      order by p.updated_at desc
      limit 8
    `),
    queryRows<{ month: string; revisions: number; changes: number }>(sql`
      with months as (
        select generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as month_start
      )
      select
        to_char(month_start, 'Mon') as month,
        (
          select count(*)::int
          from approvals a
          join projects p on p.id = a.project_id
          where a.organization_id = ${auth.organization.id}::uuid
            and a.status::text = 'revision_requested'
            and a.requested_at >= month_start
            and a.requested_at < month_start + interval '1 month'
            and p.deleted_at is null
            and (
              ${canSeeAll}::boolean
              or p.assigned_pm_user_id = ${auth.user.id}::uuid
              or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
            )
        ) as revisions,
        (
          select count(*)::int
          from comments cm
          join projects p on p.id = cm.project_id
          where cm.organization_id = ${auth.organization.id}::uuid
            and cm.deleted_at is null
            and cm.created_at >= month_start
            and cm.created_at < month_start + interval '1 month'
            and p.deleted_at is null
            and (
              ${canSeeAll}::boolean
              or p.assigned_pm_user_id = ${auth.user.id}::uuid
              or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
            )
        ) as changes
      from months
      order by month_start asc
    `),
    queryRows<{ bucket: string; count: number }>(sql`
      select
        case
          when p.status::text = 'delayed' or p.health::text in ('delayed', 'blocked', 'at_risk') then 'delayed'
          when p.status::text in ('client_review', 'revision') then 'review'
          when p.status::text in ('draft', 'planning') then 'pending'
          else 'active'
        end as bucket,
        count(*)::int as count
      from projects p
      where p.organization_id = ${auth.organization.id}::uuid
        and p.deleted_at is null
        and (
          ${canSeeAll}::boolean
          or p.assigned_pm_user_id = ${auth.user.id}::uuid
          or exists (select 1 from project_members pm where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid)
        )
      group by bucket
    `),
  ]);

  const tasks = taskMetrics[0] ?? { total: 0, done: 0 };
  const previousTasks = previousTaskMetrics[0] ?? { total: 0, done: 0 };
  const approvals = approvalMetrics[0] ?? {
    total: 0,
    approved: 0,
    rejected: 0,
    avgHours: null,
  };
  const previousApprovals = previousApprovalMetrics[0] ?? {
    total: 0,
    approved: 0,
    rejected: 0,
    avgHours: null,
  };
  const completionRate = percent(tasks.done, tasks.total);
  const previousCompletionRate = percent(
    previousTasks.done,
    previousTasks.total,
  );
  const satisfaction = approvalSatisfaction(
    approvals.approved,
    approvals.rejected,
  );
  const previousSatisfaction = approvalSatisfaction(
    previousApprovals.approved,
    previousApprovals.rejected,
  );
  const avgResponseHours = Number(approvals.avgHours ?? 0);
  const previousAvgResponseHours = Number(previousApprovals.avgHours ?? 0);

  return {
    period,
    stats: {
      completionRate,
      completionRateDelta: completionRate - previousCompletionRate,
      satisfaction,
      satisfactionDelta:
        satisfaction === null || previousSatisfaction === null
          ? null
          : satisfaction - previousSatisfaction,
      activeClients: Number(activeClients[0]?.count ?? 0),
      activeClientsDelta: 0,
      avgResponseHours,
      avgResponseHoursDelta: previousAvgResponseHours
        ? avgResponseHours - previousAvgResponseHours
        : 0,
    },
    weeklyData: weeklyRows.map((row) => ({
      key: row.key.trim(),
      tasks: Number(row.tasks ?? 0),
      revisions: Number(row.revisions ?? 0),
      approvals: Number(row.approvals ?? 0),
    })),
    projectEfficiency: projectRows.map((project) => {
      const delayed =
        project.status === "delayed" ||
        ["delayed", "blocked", "at_risk"].includes(project.health);
      const overdue =
        !!project.deadline &&
        new Date(project.deadline).getTime() < Date.now() &&
        !["completed", "approved"].includes(project.status);
      return {
        name: project.name,
        efficiency: project.tasks
          ? percent(project.done, project.tasks)
          : projectProgress(project.status),
        onTime: delayed || overdue ? 0 : 100,
      };
    }),
    revisionTrend: revisionRows.map((row) => ({
      month: row.month.trim(),
      revisions: Number(row.revisions ?? 0),
      changes: Number(row.changes ?? 0),
    })),
    statusPie: pmStatusPie(statusRows),
  };
}

type PmReportPeriod =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter";

function normalizePmReportPeriod(value: string): PmReportPeriod {
  if (
    [
      "this_week",
      "last_week",
      "this_month",
      "last_month",
      "this_quarter",
    ].includes(value)
  ) {
    return value as PmReportPeriod;
  }
  return "this_week";
}

function pmReportRange(period: PmReportPeriod) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  let start: Date;
  let end: Date;
  let previousStart: Date;

  if (period === "this_month" || period === "last_month") {
    const monthOffset = period === "last_month" ? -1 : 0;
    start = new Date(Date.UTC(year, month + monthOffset, 1));
    end = new Date(Date.UTC(year, month + monthOffset + 1, 1));
    previousStart = new Date(Date.UTC(year, month + monthOffset - 1, 1));
  } else if (period === "this_quarter") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    start = new Date(Date.UTC(year, quarterStartMonth, 1));
    end = new Date(Date.UTC(year, quarterStartMonth + 3, 1));
    previousStart = new Date(Date.UTC(year, quarterStartMonth - 3, 1));
  } else {
    start = new Date(Date.UTC(year, month, now.getUTCDate()));
    const day = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() + (day === 0 ? -6 : 1 - day));
    if (period === "last_week") start.setUTCDate(start.getUTCDate() - 7);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    previousStart = new Date(start);
    previousStart.setUTCDate(previousStart.getUTCDate() - 7);
  }

  const previousEnd = new Date(start);

  return { start, end, previousStart, previousEnd };
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function approvalSatisfaction(approved: number, rejected: number) {
  const total = approved + rejected;
  return total > 0 ? Number(((approved / total) * 5).toFixed(1)) : null;
}

function pmStatusPie(rows: Array<{ bucket: string; count: number }>) {
  const colors: Record<string, string> = {
    active: "#2f7d3a",
    pending: "#d97706",
    review: "#1d4ed8",
    delayed: "#dc2626",
  };
  const byBucket = new Map(
    rows.map((row) => [row.bucket, Number(row.count ?? 0)]),
  );
  return (["active", "pending", "review", "delayed"] as const)
    .map((key) => ({ key, value: byBucket.get(key) ?? 0, color: colors[key] }))
    .filter((item) => item.value > 0);
}

function buildPmPerformance(
  projects: Array<{
    pm: string | null;
    status: string;
    health: string;
    budgetCents: number;
  }>,
) {
  const grouped = new Map<
    string,
    { projects: number; onTime: number; revenue: number }
  >();
  for (const project of projects) {
    const name = project.pm ?? "Unassigned";
    const current = grouped.get(name) ?? { projects: 0, onTime: 0, revenue: 0 };
    const delayed =
      project.status === "delayed" ||
      ["delayed", "blocked", "at_risk"].includes(project.health);
    current.projects += 1;
    current.onTime += delayed ? 0 : 1;
    current.revenue += centsToCurrency(project.budgetCents);
    grouped.set(name, current);
  }

  return Array.from(grouped, ([name, value]) => {
    const onTime = value.projects
      ? Math.round((value.onTime / value.projects) * 100)
      : 0;
    return {
      name,
      projects: value.projects,
      onTime,
      satisfaction: value.projects
        ? Number(Math.min(5, 4.1 + onTime / 120).toFixed(1))
        : 0,
      revenue: Math.round(value.revenue),
    };
  }).sort((a, b) => b.projects - a.projects);
}

function buildSystemSplit(projects: Array<{ system: string }>) {
  const colors: Record<string, string> = {
    maxima: "#1d4ed8",
    octanorm: "#c2410c",
    custom: "#2f7d3a",
  };
  const counts = new Map<string, number>();
  for (const project of projects) {
    const system = project.system.toLowerCase();
    counts.set(system, (counts.get(system) ?? 0) + 1);
  }
  const total = Math.max(1, projects.length);
  return Array.from(counts, ([name, count]) => ({
    name: toTitle(name),
    value: Math.round((count / total) * 100),
    color: colors[name] ?? "#64748b",
  }));
}

function buildBottlenecks(
  projects: Array<{
    name: string;
    status: string;
    health: string;
    updatedAt: string;
  }>,
) {
  return projects
    .filter(
      (project) =>
        project.status === "client_review" ||
        project.status === "revision" ||
        project.status === "delayed" ||
        ["blocked", "at_risk", "delayed"].includes(project.health),
    )
    .map((project) => ({
      name: project.name,
      waitDays: Math.max(
        1,
        Math.round(
          (Date.now() - new Date(project.updatedAt).getTime()) / 86_400_000,
        ),
      ),
      stage: toTitle(project.status),
    }))
    .sort((a, b) => b.waitDays - a.waitDays)
    .slice(0, 8);
}

function lastMonthStarts(months: number) {
  const now = new Date();
  return Array.from(
    { length: months },
    (_, index) =>
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - months + index + 1,
          1,
        ),
      ),
  );
}

function monthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shortMonth(date: Date) {
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function centsToCurrency(value: number | string | null | undefined) {
  const cents =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return Number.isFinite(cents) ? cents / 100 : 0;
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
      (select count(*)::int from clients c where c.organization_id = ${organizationId}::uuid and c.deleted_at is null and (${canSeeAll}::boolean or c.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
        select 1 from projects p2 where p2.client_id = c.id and p2.deleted_at is null and (
          p2.assigned_pm_user_id = ${auth.user.id}::uuid
          or exists (select 1 from project_members pm2 where pm2.project_id = p2.id and pm2.user_id = ${auth.user.id}::uuid)
        )
      ))) as clients,
      (select count(*)::int from projects p where p.organization_id = ${organizationId}::uuid and p.deleted_at is null and (${canSeeAll}::boolean or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
        select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
      ))) as projects,
      (select count(distinct user_id)::int from memberships where organization_id = ${organizationId}::uuid and role::text = 'pm') as "projectManagers",
      (select count(*)::int from projects p where p.organization_id = ${organizationId}::uuid and (p.status::text = 'delayed' or p.health::text in ('delayed', 'blocked', 'at_risk')) and p.deleted_at is null and (${canSeeAll}::boolean or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
        select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
      ))) as "delayedProjects",
      (select count(*)::int from approvals a where a.organization_id = ${organizationId}::uuid and a.status::text in ('requested', 'under_review', 'revision_requested') and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = a.project_id and pm2.user_id = ${auth.user.id}::uuid
      ) or exists (
        select 1 from projects p2 where p2.id = a.project_id and p2.assigned_pm_user_id = ${auth.user.id}::uuid
      ))) as "pendingApprovals",
      (select count(*)::int from booth_designs bd where bd.organization_id = ${organizationId}::uuid and bd.deleted_at is null and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = bd.project_id and pm2.user_id = ${auth.user.id}::uuid
      ) or exists (
        select 1 from projects p2 where p2.id = bd.project_id and p2.assigned_pm_user_id = ${auth.user.id}::uuid
      ))) as "activeWorkspaces",
      (select count(*)::int from documents d where d.organization_id = ${organizationId}::uuid and d.deleted_at is null and (${canSeeAll}::boolean or d.project_id is null or exists (
        select 1 from project_members pm2 where pm2.project_id = d.project_id and pm2.user_id = ${auth.user.id}::uuid
      ) or exists (
        select 1 from projects p2 where p2.id = d.project_id and p2.assigned_pm_user_id = ${auth.user.id}::uuid
      ))) as documents,
      (select count(*)::int from comments c where c.organization_id = ${organizationId}::uuid and c.deleted_at is null and (${canSeeAll}::boolean or exists (
        select 1 from project_members pm2 where pm2.project_id = c.project_id and pm2.user_id = ${auth.user.id}::uuid
      ) or exists (
        select 1 from projects p2 where p2.id = c.project_id and p2.assigned_pm_user_id = ${auth.user.id}::uuid
      ))) as comments,
      (select count(*)::int from projects p where p.organization_id = ${organizationId}::uuid and p.status::text in ('completed', 'approved') and (${canSeeAll}::boolean or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
        select 1 from project_members pm2 where pm2.project_id = p.id and pm2.user_id = ${auth.user.id}::uuid
      ))) as "completedProjects"
  `);

  return (
    rows[0] ?? {
      clients: 0,
      projects: 0,
      projectManagers: 0,
      delayedProjects: 0,
      pendingApprovals: 0,
      activeWorkspaces: 0,
      documents: 0,
      comments: 0,
      completedProjects: 0,
    }
  );
}

type ProjectRow = {
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
  pipelineStage: string | null;
  lifecycleHistory: unknown;
  updatedAt: string;
};

interface ProjectListQuery {
  q: string;
  status: string | null;
  limit: number;
  offset: number;
}

async function getProjects(
  organizationId: string,
  limit: number,
  auth: AuthContext,
) {
  return (
    await getProjectList(
      organizationId,
      { q: "", status: null, limit, offset: 0 },
      auth,
    )
  ).projects;
}

async function getProjectList(
  organizationId: string,
  input: ProjectListQuery,
  auth: AuthContext,
) {
  const canSeeAll = canManageOrganization(auth);
  const conditions: SQL[] = [
    sql`p.organization_id = ${organizationId}::uuid`,
    sql`p.deleted_at is null`,
    sql`(${canSeeAll}::boolean or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
      select 1
      from project_members scope_pm
      where scope_pm.project_id = p.id
        and scope_pm.user_id = ${auth.user.id}::uuid
    ))`,
  ];

  const statusCondition = projectStatusCondition(input.status);
  if (statusCondition) {
    conditions.push(statusCondition);
  }

  if (input.q) {
    const q = `%${input.q.toLowerCase()}%`;
    conditions.push(sql`(
      lower(p.name) like ${q}
      or lower(c.company_name) like ${q}
      or lower(coalesce(p.exhibition_name, '')) like ${q}
      or lower(coalesce(p.metadata ->> 'description', '')) like ${q}
      or exists (
        select 1
        from users search_assigned_pm
        where search_assigned_pm.id = p.assigned_pm_user_id
          and lower(search_assigned_pm.name) like ${q}
      )
      or exists (
        select 1
        from project_members search_pm
        join users search_member on search_member.id = search_pm.user_id
        where search_pm.project_id = p.id
          and search_pm.role::text = 'pm'
          and lower(search_member.name) like ${q}
      )
      or exists (
        select 1
        from booth_designs search_bd
        where search_bd.project_id = p.id
          and search_bd.deleted_at is null
          and lower(search_bd.booth_system::text) like ${q}
      )
    )`);
  }

  const whereSql = sql.join(conditions, sql` and `);
  const [rows, countRows, summaryRows] = await Promise.all([
    queryRows<ProjectRow>(
      projectRowsQuery(whereSql, input.limit, input.offset),
    ),
    queryRows<{ count: number }>(sql`
      select count(distinct p.id)::int as count
      from projects p
      join clients c on c.id = p.client_id
      where ${whereSql}
    `),
    queryRows<{
      total: number;
      inDesign: number;
      review: number;
      delayed: number;
    }>(sql`
      select
        count(distinct p.id)::int as total,
        count(distinct p.id) filter (where p.status::text = 'in_design')::int as "inDesign",
        count(distinct p.id) filter (where p.status::text in ('client_review', 'revision'))::int as review,
        count(distinct p.id) filter (where p.status::text = 'delayed' or p.health::text in ('delayed', 'blocked', 'at_risk'))::int as delayed
      from projects p
      join clients c on c.id = p.client_id
      where ${whereSql}
    `),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  const summary = summaryRows[0] ?? {
    total,
    inDesign: 0,
    review: 0,
    delayed: 0,
  };

  return {
    projects: rows.map(mapProjectRow),
    pagination: {
      total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + rows.length < total,
    },
    summary: {
      total: Number(summary.total ?? total),
      inDesign: Number(summary.inDesign ?? 0),
      review: Number(summary.review ?? 0),
      delayed: Number(summary.delayed ?? 0),
    },
  };
}

function projectRowsQuery(whereSql: SQL, limit: number, offset = 0) {
  return sql`
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
      (p.metadata ->> 'pipelineStage') as "pipelineStage",
      (p.metadata -> 'lifecycleHistory') as "lifecycleHistory",
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
    where ${whereSql}
    order by p.updated_at desc
    limit ${limit}
    offset ${offset}
  `;
}

function mapProjectRow(project: ProjectRow) {
  return {
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
    pipelineStage: project.pipelineStage,
    lifecycleHistory: projectLifecycleHistory(project.lifecycleHistory),
    lastUpdate: relativeTime(project.updatedAt),
  };
}

function projectLifecycleHistory(value: unknown) {
  const rows = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? safeJsonArray(value)
      : [];
  return rows
    .map((item) => {
      const row = objectValue(item);
      const toStage = normalizePipelineStage(stringValue(row.toStage));
      const fromStage = normalizePipelineStage(stringValue(row.fromStage));
      const createdAt = stringValue(row.createdAt);
      return {
        id:
          stringValue(row.id) ??
          `${fromStage ?? "unknown"}-${toStage ?? "unknown"}-${createdAt ?? ""}`,
        fromStage,
        toStage: toStage ?? "intake",
        fromStatus: stringValue(row.fromStatus),
        toStatus: stringValue(row.toStatus),
        actorUserId: stringValue(row.actorUserId),
        actorName: stringValue(row.actorName) ?? "Team member",
        createdAt: createdAt ?? new Date().toISOString(),
        time: createdAt ? relativeTime(createdAt) : "Just now",
      };
    })
    .filter((item) => item.id && item.toStage)
    .reverse();
}

async function getClients(
  organizationId: string,
  input: number | ClientListQuery,
  auth: AuthContext,
) {
  const canSeeAll = canManageOrganization(auth);
  const options: ClientListQuery =
    typeof input === "number"
      ? { q: "", status: null, limit: input, offset: 0 }
      : input;
  const conditions: SQL[] = [
    sql`c.organization_id = ${organizationId}::uuid`,
    sql`c.deleted_at is null`,
    sql`(${canSeeAll}::boolean
      or lower(c.contact_email) = lower(${auth.user.email})
      or c.assigned_pm_user_id = ${auth.user.id}::uuid
      or exists (
        select 1
        from projects scoped_p
        where scoped_p.client_id = c.id
          and scoped_p.deleted_at is null
          and (
            scoped_p.assigned_pm_user_id = ${auth.user.id}::uuid
            or exists (
              select 1
              from project_members scoped_pm
              where scoped_pm.project_id = scoped_p.id
                and scoped_pm.user_id = ${auth.user.id}::uuid
            )
          )
      )
    )`,
  ];

  if (options.status) {
    conditions.push(sql`c.status::text = ${options.status}`);
  }

  if (options.q) {
    const q = `%${options.q.toLowerCase()}%`;
    conditions.push(sql`(
      lower(c.company_name) like ${q}
      or lower(c.contact_name) like ${q}
      or lower(c.contact_email) like ${q}
      or lower(coalesce(c.metadata ->> 'exhibition', '')) like ${q}
      or exists (
        select 1
        from projects search_p
        where search_p.client_id = c.id
          and search_p.deleted_at is null
          and lower(coalesce(search_p.exhibition_name, search_p.name, '')) like ${q}
      )
    )`);
  }

  const whereSql = sql.join(conditions, sql` and `);
  const rows = await queryRows<{
    id: string;
    userId: string | null;
    name: string;
    contactName: string;
    contactEmail: string;
    projectId: string | null;
    pm: string | null;
    exhibition: string | null;
    status: string;
    lastActivity: string;
    intakeExhibitionName: string | null;
    intakeBoothSizeSqm: string | null;
    intakeCity: string | null;
    intakeDeadlineAt: string | null;
    intakePreferredSystem: string | null;
    intakeNotes: string | null;
  }>(sql`
    select
      c.id::text,
      client_user.id::text as "userId",
      coalesce(c.company_name, 'Client') as name,
      c.contact_name as "contactName",
      c.contact_email as "contactEmail",
      min(p.id::text) as "projectId",
      coalesce(assigned_pm.name, member_pm.name) as pm,
      coalesce(c.intake_exhibition_name, c.metadata ->> 'exhibition', max(p.exhibition_name)) as exhibition,
      c.status::text as status,
      greatest(c.updated_at, coalesce(max(p.updated_at), c.updated_at))::text as "lastActivity",
      c.intake_exhibition_name as "intakeExhibitionName",
      c.intake_booth_size_sqm::text as "intakeBoothSizeSqm",
      c.intake_city as "intakeCity",
      c.intake_deadline_at::text as "intakeDeadlineAt",
      c.intake_preferred_system::text as "intakePreferredSystem",
      c.intake_notes as "intakeNotes"
    from clients c
    left join users client_user on lower(client_user.email) = lower(c.contact_email)
      and client_user.deleted_at is null
      and client_user.disabled_at is null
      and exists (
        select 1
        from memberships client_membership
        where client_membership.organization_id = c.organization_id
          and client_membership.user_id = client_user.id
          and client_membership.status::text = 'active'
          and client_membership.role::text = 'client'
      )
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
    where ${whereSql}
    group by c.id, client_user.id, assigned_pm.name, member_pm.name
    order by "lastActivity" desc
    limit ${options.limit}
    offset ${options.offset}
  `);

  const [countRows, summaryRows] = await Promise.all([
    queryRows<{ count: number }>(sql`
      select count(distinct c.id)::int as count
      from clients c
      where ${whereSql}
    `),
    queryRows<{
      total: number;
      active: number;
      needsSetup: number;
    }>(sql`
      select
        count(distinct c.id)::int as total,
        count(distinct c.id) filter (where c.status::text = 'active')::int as active,
        count(distinct c.id) filter (where c.status::text in ('lead', 'pending_approval'))::int as "needsSetup"
      from clients c
      where ${whereSql}
    `),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  const summary = summaryRows[0] ?? { total, active: 0, needsSetup: 0 };

  return {
    clients: rows.map((client) => ({
      id: client.id,
      userId: client.userId,
      name: client.name,
      company: client.name,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      projectId: client.projectId,
      pm: client.pm ?? "Unassigned",
      exhibition: client.exhibition ?? "No active exhibition",
      status: toTitle(client.status),
      lastActivity: relativeTime(client.lastActivity),
      intake: {
        exhibitionName: client.intakeExhibitionName,
        boothSizeSqm: client.intakeBoothSizeSqm
          ? Number(client.intakeBoothSizeSqm)
          : null,
        city: client.intakeCity,
        deadlineAt: client.intakeDeadlineAt,
        preferredSystem: client.intakePreferredSystem,
        notes: client.intakeNotes,
      },
    })),
    pagination: {
      total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + rows.length < total,
    },
    summary: {
      total: Number(summary.total ?? total),
      active: Number(summary.active ?? 0),
      needsSetup: Number(summary.needsSetup ?? 0),
    },
  };
}

type PmTaskStatus = "todo" | "in_progress" | "blocked" | "done";
type PmTaskPriority = "low" | "normal" | "high" | "urgent";

interface PmTaskInput {
  title: string;
  projectId: string;
  status: PmTaskStatus;
  priority: PmTaskPriority;
  deadline: string | null;
  notes: string | null;
}

interface PmTaskPatch {
  title?: string;
  projectId?: string;
  status?: PmTaskStatus;
  priority?: PmTaskPriority;
  deadline?: string | null;
  notes?: string | null;
}

async function getPmTaskBoard(auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const taskRows = await queryRows<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    deadline: string | null;
    projectId: string | null;
    project: string | null;
    client: string | null;
  }>(sql`
    select
      t.id::text,
      t.title,
      t.description,
      t.status::text as status,
      t.priority::text as priority,
      t.due_at::text as deadline,
      p.id::text as "projectId",
      p.name as project,
      c.company_name as client
    from tasks t
    left join projects p on p.id = t.project_id and p.deleted_at is null
    left join clients c on c.id = p.client_id
    where t.organization_id = ${auth.organization.id}::uuid
      and t.status::text <> 'cancelled'
      and (
        ${canSeeAll}::boolean
        or t.assigned_to_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members pm
          where pm.project_id = t.project_id
            and pm.user_id = ${auth.user.id}::uuid
        )
      )
    order by
      case t.priority::text when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
      t.due_at nulls last,
      t.updated_at desc
    limit 200
  `);

  const projectRows = await queryRows<{
    id: string;
    name: string;
    client: string;
  }>(sql`
    select
      p.id::text,
      p.name,
      c.company_name as client
    from projects p
    join clients c on c.id = p.client_id
    where p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (
        ${canSeeAll}::boolean
        or p.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members pm
          where pm.project_id = p.id
            and pm.user_id = ${auth.user.id}::uuid
        )
      )
    order by p.updated_at desc
    limit 100
  `);

  return {
    tasks: taskRows.map((task) => ({
      id: task.id,
      title: task.title,
      client: task.client ?? "Client",
      project: task.project ?? "Unassigned project",
      projectId: task.projectId,
      priority: taskPriorityLabel(task.priority),
      deadline: task.deadline?.slice(0, 10) ?? "",
      col: taskStatusLabel(task.status),
      notes: task.description ?? "",
    })),
    projects: projectRows,
  };
}

async function createPmTask(auth: AuthContext, input: PmTaskInput) {
  if (!(await canAccessProject(auth, input.projectId)))
    return "project_not_found" as const;

  await db.execute(sql`
    insert into tasks (
      organization_id,
      project_id,
      assigned_to_user_id,
      created_by_user_id,
      title,
      description,
      status,
      priority,
      due_at
    )
    values (
      ${auth.organization.id}::uuid,
      ${input.projectId}::uuid,
      ${auth.user.id}::uuid,
      ${auth.user.id}::uuid,
      ${input.title},
      ${input.notes},
      ${input.status}::task_status,
      ${input.priority}::task_priority,
      ${input.deadline}::timestamptz
    )
  `);

  await auditEvent(
    auth.organization.id,
    auth.user.id,
    "task_created",
    `created task ${input.title}`,
    {
      projectId: input.projectId,
    },
  );

  return "created" as const;
}

async function updatePmTask(
  auth: AuthContext,
  taskId: string,
  input: PmTaskPatch,
) {
  if (input.projectId && !(await canAccessProject(auth, input.projectId)))
    return false;

  const rows = await queryRows<{ id: string; title: string }>(sql`
    update tasks t
    set
      title = coalesce(${input.title ?? null}, t.title),
      project_id = case
        when ${Object.prototype.hasOwnProperty.call(input, "projectId")}::boolean then ${input.projectId ?? null}::uuid
        else t.project_id
      end,
      description = case
        when ${Object.prototype.hasOwnProperty.call(input, "notes")}::boolean then ${input.notes ?? null}
        else t.description
      end,
      status = coalesce(${input.status ?? null}::task_status, t.status),
      priority = coalesce(${input.priority ?? null}::task_priority, t.priority),
      due_at = case
        when ${Object.prototype.hasOwnProperty.call(input, "deadline")}::boolean then ${input.deadline ?? null}::timestamptz
        else t.due_at
      end,
      completed_at = case
        when coalesce(${input.status ?? null}::task_status, t.status)::text = 'done' then coalesce(t.completed_at, now())
        when ${input.status ?? null}::text is not null then null
        else t.completed_at
      end,
      updated_at = now()
    where t.id = ${taskId}::uuid
      and t.organization_id = ${auth.organization.id}::uuid
      and t.status::text <> 'cancelled'
      and (
        ${canManageOrganization(auth)}::boolean
        or t.assigned_to_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members pm
          where pm.project_id = t.project_id
            and pm.user_id = ${auth.user.id}::uuid
        )
      )
    returning t.id::text, t.title
  `);

  if (!rows[0]) return false;
  await auditEvent(
    auth.organization.id,
    auth.user.id,
    "task_updated",
    `updated task ${rows[0].title}`,
    { taskId },
  );
  return true;
}

async function deletePmTask(auth: AuthContext, taskId: string) {
  const rows = await queryRows<{ id: string; title: string }>(sql`
    delete from tasks t
    where t.id = ${taskId}::uuid
      and t.organization_id = ${auth.organization.id}::uuid
      and (
        ${canManageOrganization(auth)}::boolean
        or t.assigned_to_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members pm
          where pm.project_id = t.project_id
            and pm.user_id = ${auth.user.id}::uuid
        )
      )
    returning t.id::text, t.title
  `);

  if (!rows[0]) return false;
  await auditEvent(
    auth.organization.id,
    auth.user.id,
    "task_deleted",
    `deleted task ${rows[0].title}`,
    { taskId },
  );
  return true;
}

async function canAccessProject(auth: AuthContext, projectId: string) {
  const rows = await queryRows<{ id: string }>(sql`
    select p.id::text
    from projects p
    where p.id = ${projectId}::uuid
      and p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (
        ${canManageOrganization(auth)}::boolean
        or p.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members pm
          where pm.project_id = p.id
            and pm.user_id = ${auth.user.id}::uuid
        )
      )
    limit 1
  `);

  return Boolean(rows[0]);
}

function taskStatusLabel(status: string): PmTaskStatus {
  if (status === "done") return "done";
  if (status === "blocked") return "blocked";
  if (status === "in_progress") return "in_progress";
  return "todo";
}

function taskPriorityLabel(priority: string) {
  if (priority === "urgent" || priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

type PmRequestStatus = "Pending" | "In Progress" | "Resolved" | "Declined";
type PmRequestPriority = "High" | "Medium" | "Low";

interface PmRequestComment {
  id: string;
  text: string;
  author: string;
  authorUserId: string | null;
  time: string;
  createdAt: string;
}

interface PmRequestListQuery {
  q: string;
  status: PmRequestStatus | null;
  limit: number;
  offset: number;
}

async function getPmRequests(auth: AuthContext, input: PmRequestListQuery) {
  const canSeeAll = canManageOrganization(auth);
  const baseConditions: SQL[] = [
    sql`a.organization_id = ${auth.organization.id}::uuid`,
    sql`a.status::text <> 'cancelled'`,
    sql`p.deleted_at is null`,
    sql`(
      ${canSeeAll}::boolean
      or p.assigned_pm_user_id = ${auth.user.id}::uuid
      or exists (
        select 1
        from project_members pm
        where pm.project_id = p.id
          and pm.user_id = ${auth.user.id}::uuid
      )
    )`,
  ];

  if (input.q) {
    const q = `%${input.q.toLowerCase()}%`;
    baseConditions.push(sql`(
      lower(c.company_name) like ${q}
      or lower(p.name) like ${q}
      or lower(coalesce(p.exhibition_name, '')) like ${q}
      or lower(coalesce(a.message, '')) like ${q}
      or exists (
        select 1
        from comments search_cm
        where search_cm.organization_id = a.organization_id
          and search_cm.project_id = a.project_id
          and search_cm.deleted_at is null
          and lower(search_cm.body) like ${q}
      )
    )`);
  }

  const listConditions = [...baseConditions];
  const statusCondition = pmRequestStatusCondition(input.status);
  if (statusCondition) listConditions.push(statusCondition);

  const whereSql = sql.join(listConditions, sql` and `);
  const summaryWhereSql = sql.join(baseConditions, sql` and `);

  const [rows, countRows, summaryRows] = await Promise.all([
    queryRows<{
      id: string;
      client: string;
      project: string;
      request: string | null;
      status: string;
      requestedAt: string;
      dueAt: string | null;
      projectHealth: string;
      comments: unknown;
      history: unknown;
    }>(sql`
    select
      a.id::text,
      c.company_name as client,
      p.name as project,
      a.message as request,
      a.status::text as status,
      a.requested_at::text as "requestedAt",
      a.due_at::text as "dueAt",
      p.health::text as "projectHealth",
      coalesce((
        select json_agg(json_build_object(
          'id', cm.id::text,
          'text', cm.body,
          'author', coalesce(cu.name, 'Client'),
          'authorUserId', cm.author_user_id::text,
          'createdAt', cm.created_at::text
        ) order by cm.created_at asc)
        from comments cm
        left join users cu on cu.id = cm.author_user_id
        where cm.organization_id = a.organization_id
          and cm.project_id = a.project_id
          and cm.deleted_at is null
          and (cm.booth_version_id = a.booth_version_id or cm.booth_version_id is null)
      ), '[]'::json) as comments
      ,
      coalesce((
        select json_agg(json_build_object(
          'id', ae.id::text,
          'type', ae.event_type,
          'message', ae.message,
          'actor', coalesce(au.name, 'System'),
          'actorUserId', ae.actor_user_id::text,
          'createdAt', ae.created_at::text
        ) order by ae.created_at desc)
        from activity_events ae
        left join users au on au.id = ae.actor_user_id
        where ae.organization_id = a.organization_id
          and ae.metadata ->> 'requestId' = a.id::text
      ), '[]'::json) as history
    from approvals a
    join projects p on p.id = a.project_id
    join clients c on c.id = p.client_id
    where ${whereSql}
    order by
      case a.status::text
        when 'revision_requested' then 0
        when 'requested' then 1
        when 'under_review' then 2
        when 'rejected' then 3
        else 4
      end,
      a.requested_at desc
    limit ${input.limit}
    offset ${input.offset}
  `),
    queryRows<{ count: number }>(sql`
      select count(distinct a.id)::int as count
      from approvals a
      join projects p on p.id = a.project_id
      join clients c on c.id = p.client_id
      where ${whereSql}
    `),
    queryRows<{
      total: number;
      pending: number;
      inProgress: number;
      resolved: number;
      declined: number;
    }>(sql`
      select
        count(distinct a.id)::int as total,
        count(distinct a.id) filter (where a.status::text in ('requested', 'revision_requested'))::int as pending,
        count(distinct a.id) filter (where a.status::text = 'under_review')::int as "inProgress",
        count(distinct a.id) filter (where a.status::text = 'approved')::int as resolved,
        count(distinct a.id) filter (where a.status::text = 'rejected')::int as declined
      from approvals a
      join projects p on p.id = a.project_id
      join clients c on c.id = p.client_id
      where ${summaryWhereSql}
    `),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  const summary = summaryRows[0] ?? {
    total,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    declined: 0,
  };

  return {
    requests: rows.map((row) => ({
      id: row.id,
      client: row.client,
      project: row.project,
      request: row.request ?? `Review request for ${row.project}`,
      timestamp: relativeTime(row.requestedAt),
      status: pmRequestStatus(row.status),
      priority: pmRequestPriority(row.status, row.projectHealth, row.dueAt),
      history: pmRequestHistory(row.history, row.requestedAt, auth.user.id),
      comments: pmRequestComments(row.comments).map((comment) => ({
        id: comment.id,
        text: comment.text,
        author: comment.author,
        isMe: comment.authorUserId === auth.user.id,
        time: relativeTime(comment.createdAt),
      })),
    })),
    pagination: {
      total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + rows.length < total,
    },
    summary: {
      total: Number(summary.total ?? total),
      pending: Number(summary.pending ?? 0),
      inProgress: Number(summary.inProgress ?? 0),
      resolved: Number(summary.resolved ?? 0),
      declined: Number(summary.declined ?? 0),
    },
  };
}

async function updatePmRequestStatus(
  auth: AuthContext,
  requestId: string,
  status: PmRequestStatus,
) {
  const approvalStatus = pmRequestStatusToApproval(status);
  const currentRows = await queryRows<{
    id: string;
    projectId: string;
    boothVersionId: string;
    currentStatus: string;
  }>(sql`
    select
      a.id::text,
      a.project_id::text as "projectId",
      a.booth_version_id::text as "boothVersionId",
      a.status::text as "currentStatus"
    from approvals a
    join projects p on p.id = a.project_id
    where a.id = ${requestId}::uuid
      and a.organization_id = ${auth.organization.id}::uuid
      and a.status::text <> 'cancelled'
      and p.deleted_at is null
      and (
        ${canManageOrganization(auth)}::boolean
        or p.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members pm
          where pm.project_id = p.id
            and pm.user_id = ${auth.user.id}::uuid
        )
      )
    limit 1
  `);

  const current = currentRows[0];
  if (!current) return false;

  const currentStatus = pmRequestStatus(current.currentStatus);
  if (!canTransitionPmRequest(currentStatus, status))
    return "invalid_transition" as const;
  if (currentStatus === status) return true;

  const rows = await queryRows<{
    id: string;
    projectId: string;
    boothVersionId: string;
  }>(sql`
    update approvals a
    set
      status = ${approvalStatus}::approval_status,
      responded_by_user_id = case
        when ${approvalStatus}::text in ('approved', 'rejected') then ${auth.user.id}::uuid
        else a.responded_by_user_id
      end,
      responded_at = case
        when ${approvalStatus}::text in ('approved', 'rejected') then now()
        when ${approvalStatus}::text in ('requested', 'under_review') then null
        else a.responded_at
      end
    from projects p
    where a.id = ${requestId}::uuid
      and a.project_id = p.id
      and a.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
    returning a.id::text, a.project_id::text as "projectId", a.booth_version_id::text as "boothVersionId"
  `);

  const row = rows[0];
  if (!row) return false;

  await db.execute(sql`
    update booth_versions
    set
      status = case
        when ${approvalStatus}::text = 'approved' then 'approved'::booth_version_status
        when ${approvalStatus}::text = 'rejected' then 'rejected'::booth_version_status
        when ${approvalStatus}::text = 'under_review' then 'under_review'::booth_version_status
        else status
      end
    where id = ${row.boothVersionId}::uuid
      and organization_id = ${auth.organization.id}::uuid
  `);

  await auditEvent(
    auth.organization.id,
    auth.user.id,
    "pm_request_status_updated",
    `updated request to ${status}`,
    {
      requestId,
      status,
      projectId: row.projectId,
    },
  );

  await notifyPmRequestRequester(auth, requestId, {
    title: "Revision request updated",
    body: (projectName) =>
      `${auth.user.name} marked ${projectName} as ${status}.`,
  });
  return true;
}

function canTransitionPmRequest(
  current: PmRequestStatus,
  next: PmRequestStatus,
) {
  if (current === next) return true;
  if (current === "Pending")
    return next === "In Progress" || next === "Resolved" || next === "Declined";
  if (current === "In Progress")
    return next === "Resolved" || next === "Declined";
  return false;
}

async function createPmRequestReply(
  auth: AuthContext,
  requestId: string,
  body: string,
) {
  const rows = await queryRows<{
    id: string;
    projectId: string;
    boothVersionId: string;
  }>(sql`
    select a.id::text, a.project_id::text as "projectId", a.booth_version_id::text as "boothVersionId"
    from approvals a
    join projects p on p.id = a.project_id
    where a.id = ${requestId}::uuid
      and a.organization_id = ${auth.organization.id}::uuid
      and a.status::text <> 'cancelled'
      and p.deleted_at is null
      and (
        ${canManageOrganization(auth)}::boolean
        or p.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members pm
          where pm.project_id = p.id
            and pm.user_id = ${auth.user.id}::uuid
        )
      )
    limit 1
  `);

  const request = rows[0];
  if (!request) return false;

  await db.execute(sql`
    insert into comments (organization_id, project_id, booth_version_id, author_user_id, body)
    values (${auth.organization.id}::uuid, ${request.projectId}::uuid, ${request.boothVersionId}::uuid, ${auth.user.id}::uuid, ${body})
  `);

  await db.execute(sql`
    update approvals
    set status = case when status::text = 'requested' then 'under_review'::approval_status else status end
    where id = ${requestId}::uuid
      and organization_id = ${auth.organization.id}::uuid
  `);

  await auditEvent(
    auth.organization.id,
    auth.user.id,
    "pm_request_replied",
    "replied to revision request",
    {
      requestId,
      projectId: request.projectId,
    },
  );

  await notifyPmRequestRequester(auth, requestId, {
    title: "Revision request reply",
    body: (projectName) => `${auth.user.name} replied to ${projectName}.`,
  });
  return true;
}

async function notifyPmRequestRequester(
  auth: AuthContext,
  requestId: string,
  message: { title: string; body: (projectName: string) => string },
) {
  const context = await getPmRequestNotificationContext(
    auth.organization.id,
    requestId,
  );
  if (!context?.requestedByUserId || context.requestedByUserId === auth.user.id)
    return;

  await createNotification(
    auth.organization.id,
    context.requestedByUserId,
    message.title,
    message.body(context.projectName),
    pmRequestNotificationHref(context.requesterRole),
    "milestones",
  );
}

async function getPmRequestNotificationContext(
  organizationId: string,
  requestId: string,
) {
  const rows = await queryRows<{
    requestedByUserId: string | null;
    projectName: string;
    requesterRole: string | null;
  }>(sql`
    select
      a.requested_by_user_id::text as "requestedByUserId",
      coalesce(p.exhibition_name, p.name) as "projectName",
      coalesce(m.role::text, u.role::text) as "requesterRole"
    from approvals a
    join projects p on p.id = a.project_id
    left join users u on u.id = a.requested_by_user_id and u.deleted_at is null
    left join memberships m on m.organization_id = a.organization_id and m.user_id = a.requested_by_user_id
    where a.id = ${requestId}::uuid
      and a.organization_id = ${organizationId}::uuid
    limit 1
  `);

  return rows[0] ?? null;
}

function pmRequestNotificationHref(role: string | null) {
  if (role === "client") return "/client/approvals";
  if (role === "pm") return "/pm/requests";
  return "/chief/projects";
}

function pmRequestComments(value: unknown): PmRequestComment[] {
  const rows = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? safeJsonArray(value)
      : [];
  return rows
    .map((item) => {
      const row = objectValue(item);
      return {
        id: stringValue(row.id) ?? "",
        text: stringValue(row.text) ?? "",
        author: stringValue(row.author) ?? "Client",
        authorUserId: stringValue(row.authorUserId),
        createdAt: stringValue(row.createdAt) ?? new Date().toISOString(),
        time: "",
      };
    })
    .filter((item) => item.id && item.text);
}

function pmRequestHistory(
  value: unknown,
  requestedAt: string,
  authUserId: string,
) {
  const rows = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? safeJsonArray(value)
      : [];
  const baseline = {
    id: `requested-${requestedAt}`,
    type: "requested",
    message: "Request received",
    actor: "Client",
    isMe: false,
    createdAt: requestedAt,
    time: relativeTime(requestedAt),
  };

  const events = rows
    .map((item) => {
      const row = objectValue(item);
      const createdAt = stringValue(row.createdAt);
      return {
        id: stringValue(row.id) ?? "",
        type: stringValue(row.type) ?? "activity",
        message: stringValue(row.message) ?? "Request updated",
        actor: stringValue(row.actor) ?? "System",
        isMe: stringValue(row.actorUserId) === authUserId,
        createdAt: createdAt ?? new Date().toISOString(),
        time: createdAt ? relativeTime(createdAt) : "Just now",
      };
    })
    .filter((item) => item.id);

  return [baseline, ...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pmRequestStatus(status: string): PmRequestStatus {
  if (status === "approved") return "Resolved";
  if (status === "rejected") return "Declined";
  if (status === "under_review") return "In Progress";
  return "Pending";
}

function pmRequestStatusToApproval(status: PmRequestStatus) {
  if (status === "Resolved") return "approved";
  if (status === "Declined") return "rejected";
  if (status === "In Progress") return "under_review";
  return "requested";
}

function pmRequestStatusCondition(status: PmRequestStatus | null) {
  if (!status) return null;
  if (status === "Pending")
    return sql`a.status::text in ('requested', 'revision_requested')`;
  return sql`a.status::text = ${pmRequestStatusToApproval(status)}`;
}

function pmRequestPriority(
  status: string,
  health: string,
  dueAt: string | null,
): PmRequestPriority {
  if (
    status === "revision_requested" ||
    health === "blocked" ||
    health === "delayed" ||
    health === "at_risk"
  )
    return "High";
  if (!dueAt) return "Low";

  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 1) return "High";
  if (days <= 3) return "Medium";
  return "Low";
}

async function createProject(
  organizationId: string,
  auth: AuthContext,
  input: {
    name: string;
    client: string;
    system: "octanorm" | "maxima" | "custom";
    widthM: number;
    depthM: number;
    deadline: string | null;
  },
) {
  const pm =
    auth.user.role === "pm"
      ? { id: auth.user.id, name: auth.user.name }
      : await getFirstProjectManager(organizationId);
  const clientId = await findOrCreateProjectClient(
    organizationId,
    auth,
    input.client,
    pm?.id ?? null,
  );
  if (clientId === "client_not_accessible") return clientId;

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
      ${auth.user.id}::uuid,
      ${input.name},
      ${input.name},
      'planning',
      'on_track',
      0,
      'EUR',
      ${input.deadline}::timestamptz,
      ${JSON.stringify({ pipelineStage: "intake" })}::jsonb
    )
    returning id::text
  `);

  const projectId = projectRows[0]?.id;

  if (!projectId) {
    throw new Error("Project insert did not return an id");
  }

  if (pm?.id) {
    await db.execute(sql`
      insert into project_members (project_id, user_id, role)
      values (${projectId}::uuid, ${pm.id}::uuid, 'pm')
      on conflict (project_id, user_id) do nothing
    `);
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
      ${auth.user.id}::uuid
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
      ${auth.user.id}::uuid
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
      ${auth.user.id}::uuid,
      ${projectId}::uuid,
      'project_created',
      'created project',
      '{}'::jsonb
    )
  `);

  const project = await getProjectById(organizationId, projectId);
  if (!project)
    throw new Error("Project was created but could not be read back");
  return project;
}

async function ensureClientIntakeProject(
  organizationId: string,
  actorUserId: string,
  client: {
    id: string;
    companyName: string;
    contactEmail: string;
    intakeExhibitionName: string | null;
    intakeBoothSizeSqm: string | null;
    intakeCity: string | null;
    intakeDeadlineAt: string | null;
    intakePreferredSystem: "octanorm" | "maxima" | "custom" | null;
  },
  managerId: string,
  executor: SqlExecutor = databaseExecutor,
) {
  const existing = await queryRows<{ id: string }>(
    sql`
    select id::text
    from projects
    where organization_id = ${organizationId}::uuid
      and client_id = ${client.id}::uuid
      and deleted_at is null
    limit 1
  `,
    executor,
  );
  if (existing[0]?.id) {
    await reassignProjectManager(
      organizationId,
      actorUserId,
      existing[0].id,
      managerId,
      "Assigned at client approval",
      executor,
    );
    return existing[0].id;
  }

  const sqm = Number(client.intakeBoothSizeSqm);
  const safeSqm = Number.isFinite(sqm) && sqm > 0 ? sqm : 18;
  const widthM = Math.max(3, Math.round(Math.sqrt(safeSqm * 2)));
  const depthM = Math.max(2, Number((safeSqm / widthM).toFixed(1)));
  const widthMm = Math.round(widthM * 1000);
  const depthMm = Math.round(depthM * 1000);
  const system = client.intakePreferredSystem ?? "octanorm";
  const heightMm = system === "maxima" ? 4000 : 2500;
  const exhibitionName =
    client.intakeExhibitionName ?? `${client.companyName} Exhibition`;
  const projectName = `${exhibitionName} - ${client.companyName}`;

  const projectRows = await queryRows<{ id: string }>(
    sql`
    insert into projects (
      organization_id,
      client_id,
      assigned_pm_user_id,
      created_by_user_id,
      name,
      exhibition_name,
      city,
      status,
      health,
      budget_cents,
      currency,
      deadline_at,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${client.id}::uuid,
      ${managerId}::uuid,
      ${actorUserId}::uuid,
      ${projectName},
      ${exhibitionName},
      ${client.intakeCity},
      'planning',
      'on_track',
      0,
      'EUR',
      ${client.intakeDeadlineAt}::timestamptz,
      ${JSON.stringify({ pipelineStage: "intake", source: "client_signup_approval", boothSizeSqm: safeSqm })}::jsonb
    )
    returning id::text
  `,
    executor,
  );
  const projectId = projectRows[0]?.id;
  if (!projectId)
    throw new Error("Client intake project insert did not return an id");

  await executor.execute(sql`
    insert into project_members (project_id, user_id, role)
    values (${projectId}::uuid, ${managerId}::uuid, 'pm')
    on conflict (project_id, user_id) do nothing
  `);

  const clientUserRows = await queryRows<{ id: string }>(
    sql`
    select u.id::text
    from users u
    join memberships m on m.user_id = u.id
      and m.organization_id = ${organizationId}::uuid
      and m.role::text = 'client'
    where lower(u.email) = lower(${client.contactEmail})
      and u.deleted_at is null
    limit 1
  `,
    executor,
  );
  if (clientUserRows[0]?.id) {
    await executor.execute(sql`
      insert into project_members (project_id, user_id, role)
      values (${projectId}::uuid, ${clientUserRows[0].id}::uuid, 'client')
      on conflict (project_id, user_id) do nothing
    `);
  }

  const designRows = await queryRows<{ id: string }>(
    sql`
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
      ${`${client.companyName} booth design`},
      ${system}::booth_system,
      'inline',
      ${widthMm},
      ${depthMm},
      ${heightMm},
      1000,
      'metric',
      1,
      ${actorUserId}::uuid
    )
    returning id::text
  `,
    executor,
  );
  const designId = designRows[0]?.id;
  if (!designId)
    throw new Error("Client intake booth design insert did not return an id");

  await executor.execute(sql`
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
      'Initial intake layout',
      ${JSON.stringify({
        gridMm: 1000,
        boothSystem: system,
        dimensions: { widthMm, depthMm, heightMm },
        objects: [],
      })}::jsonb,
      '{}'::jsonb,
      0,
      ${actorUserId}::uuid
    )
  `);

  await auditEvent(
    organizationId,
    actorUserId,
    "project_created_from_client_intake",
    `created project for ${client.companyName}`,
    {
      clientId: client.id,
      projectId,
      managerId,
      exhibitionName,
    },
    executor,
  );

  return projectId;
}

async function getProjectById(organizationId: string, projectId: string) {
  const whereSql = sql.join(
    [
      sql`p.organization_id = ${organizationId}::uuid`,
      sql`p.id = ${projectId}::uuid`,
      sql`p.deleted_at is null`,
    ],
    sql` and `,
  );
  const rows = await queryRows<ProjectRow>(projectRowsQuery(whereSql, 1));
  return rows[0] ? mapProjectRow(rows[0]) : null;
}

async function updateProjectRecord(
  organizationId: string,
  auth: AuthContext,
  projectId: string,
  input: {
    name: string;
    client: string;
    exhibition: string | null;
    managerId?: string | null;
    system: "octanorm" | "maxima" | "custom";
    widthM: number;
    depthM: number;
    deadline: string | null;
    description: string;
  },
) {
  const canManage = canManageOrganization(auth);
  if (!canManage && input.managerId !== undefined) {
    return "not_authorized" as const;
  }

  if (input.managerId) {
    const targetName = await getAssignmentTargetName(
      organizationId,
      input.managerId,
    );
    if (!targetName) return "invalid_manager" as const;
  }

  const existing = await queryRows<{ id: string }>(sql`
    select id::text
    from projects
    where id = ${projectId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
      and (${canManage}::boolean or assigned_pm_user_id = ${auth.user.id}::uuid or exists (
        select 1
        from project_members scoped_pm
        where scoped_pm.project_id = projects.id
          and scoped_pm.user_id = ${auth.user.id}::uuid
      ))
    limit 1
  `);
  if (!existing[0]?.id)
    return canManage ? ("not_found" as const) : ("not_authorized" as const);

  const clientId = await findOrCreateClient(organizationId, input.client);
  const rows = await queryRows<{ id: string; name: string }>(sql`
    update projects
    set
      client_id = ${clientId}::uuid,
      name = ${input.name},
      exhibition_name = ${input.exhibition ?? input.name},
      deadline_at = ${input.deadline}::timestamptz,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('description', ${input.description}::text),
      updated_at = now()
    where id = ${projectId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
    returning id::text, name
  `);

  const project = rows[0];
  if (!project)
    return canManage ? ("not_found" as const) : ("not_authorized" as const);

  if (input.managerId !== undefined) {
    await reassignProjectManager(
      organizationId,
      auth.user.id,
      projectId,
      input.managerId,
    );
  }
  await updateProjectBoothDesign(
    organizationId,
    auth.user.id,
    projectId,
    input.name,
    input.system,
    input.widthM,
    input.depthM,
  );

  await auditEvent(
    organizationId,
    auth.user.id,
    "project_updated",
    `updated project ${project.name}`,
    {
      projectId,
      client: input.client,
      managerId: input.managerId,
      system: input.system,
      widthM: input.widthM,
      depthM: input.depthM,
    },
  );

  const updated = await getProjectById(organizationId, projectId);
  if (!updated) return "not_found" as const;
  return updated;
}

async function removeProjectRecord(
  organizationId: string,
  auth: AuthContext,
  projectId: string,
) {
  const canManage = canManageOrganization(auth);
  const rows = await queryRows<{ id: string; name: string }>(sql`
    update projects p
    set deleted_at = now(), updated_at = now()
    where p.id = ${projectId}::uuid
      and p.organization_id = ${organizationId}::uuid
      and p.deleted_at is null
      and (${canManage}::boolean
        or p.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members scoped_member
          where scoped_member.project_id = p.id
            and scoped_member.user_id = ${auth.user.id}::uuid
            and scoped_member.role::text = 'pm'
        )
      )
    returning p.id::text, p.name
  `);

  const project = rows[0];
  if (!project) {
    const exists = await queryRows<{ id: string }>(sql`
      select id::text
      from projects
      where id = ${projectId}::uuid
        and organization_id = ${organizationId}::uuid
        and deleted_at is null
      limit 1
    `);
    return exists[0] ? ("not_authorized" as const) : ("not_found" as const);
  }

  await auditEvent(
    organizationId,
    auth.user.id,
    "project_removed",
    `removed project ${project.name}`,
    {
      projectId,
      projectName: project.name,
    },
  );
  return "removed" as const;
}

async function updateProjectBoothDesign(
  organizationId: string,
  actorUserId: string,
  projectId: string,
  projectName: string,
  system: "octanorm" | "maxima" | "custom",
  widthM: number,
  depthM: number,
) {
  const widthMm = Math.round(widthM * 1000);
  const depthMm = Math.round(depthM * 1000);
  const heightMm = system === "maxima" ? 4000 : 2500;
  const currentDesign = await queryRows<{ id: string }>(sql`
    select id::text
    from booth_designs
    where organization_id = ${organizationId}::uuid
      and project_id = ${projectId}::uuid
      and deleted_at is null
    order by updated_at desc
    limit 1
  `);

  const designId = currentDesign[0]?.id;
  if (designId) {
    await db.execute(sql`
      update booth_designs
      set
        name = ${`${projectName} booth design`},
        booth_system = ${system}::booth_system,
        width_mm = ${widthMm},
        depth_mm = ${depthMm},
        height_mm = ${heightMm},
        updated_at = now()
      where id = ${designId}::uuid
        and organization_id = ${organizationId}::uuid
    `);
    return;
  }

  await db.execute(sql`
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
      ${`${projectName} booth design`},
      ${system}::booth_system,
      'inline',
      ${widthMm},
      ${depthMm},
      ${heightMm},
      1000,
      'metric',
      1,
      ${actorUserId}::uuid
    )
  `);
}

async function updateProjectPipelineStage(
  organizationId: string,
  auth: AuthContext,
  projectId: string,
  stage: PipelineStage,
) {
  const canManage = canManageOrganization(auth);
  const status = pipelineStageToProject(stage);
  const snapshotRows = await queryRows<{
    id: string;
    name: string;
    status: string;
    health: string;
    pipelineStage: string | null;
    canAccess: boolean;
  }>(sql`
    select
      p.id::text,
      p.name,
      p.status::text as status,
      p.health::text as health,
      (p.metadata ->> 'pipelineStage') as "pipelineStage",
      (
        ${canManage}::boolean
        or p.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from project_members scoped_pm
          where scoped_pm.project_id = p.id
            and scoped_pm.user_id = ${auth.user.id}::uuid
        )
      ) as "canAccess"
    from projects p
    where p.id = ${projectId}::uuid
      and p.organization_id = ${organizationId}::uuid
      and p.deleted_at is null
    limit 1
  `);

  const snapshot = snapshotRows[0];
  if (!snapshot) return "not_found" as const;
  if (!snapshot.canAccess) return "not_authorized" as const;

  const previousStage =
    normalizePipelineStage(snapshot.pipelineStage) ??
    pipelineStageFromProjectStatus(snapshot.status);
  if (previousStage === stage) {
    return { id: snapshot.id, name: snapshot.name, unchanged: true };
  }

  const rows = await queryRows<{ id: string; name: string }>(sql`
    update projects
    set
      status = ${status.status}::project_status,
      health = ${status.health}::project_health,
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb) || jsonb_build_object('pipelineStage', ${stage}::text),
        '{lifecycleHistory}',
        (
          case
            when jsonb_typeof(coalesce(metadata, '{}'::jsonb) -> 'lifecycleHistory') = 'array'
              then coalesce(metadata, '{}'::jsonb) -> 'lifecycleHistory'
            else '[]'::jsonb
          end
          || jsonb_build_array(jsonb_build_object(
            'id', gen_random_uuid()::text,
            'fromStage', ${previousStage}::text,
            'toStage', ${stage}::text,
            'fromStatus', ${snapshot.status}::text,
            'toStatus', ${status.status}::text,
            'fromHealth', ${snapshot.health}::text,
            'toHealth', ${status.health}::text,
            'actorUserId', ${auth.user.id}::text,
            'actorName', ${auth.user.name}::text,
            'createdAt', now()
          ))
        ),
        true
      ),
      updated_at = now()
    where id = ${projectId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
    returning id::text, name
  `);

  const project = rows[0];
  if (!project) return "not_found" as const;

  await auditEvent(
    organizationId,
    auth.user.id,
    "project_pipeline_stage_updated",
    `moved ${project.name} to ${stage}`,
    {
      projectId,
      previousStage,
      stage,
    },
  );

  return project;
}

function pipelineStageToProject(stage: PipelineStage) {
  if (stage === "closed") return { status: "completed", health: "on_track" };
  if (stage === "production")
    return { status: "in_production", health: "on_track" };
  if (stage === "review")
    return { status: "client_review", health: "on_track" };
  if (stage === "design") return { status: "in_design", health: "on_track" };
  return { status: "planning", health: "on_track" };
}

function pipelineStageFromProjectStatus(status: string): PipelineStage {
  if (status === "completed" || status === "approved") return "closed";
  if (status === "in_production") return "production";
  if (status === "client_review" || status === "revision") return "review";
  if (status === "in_design") return "design";
  return "intake";
}

function normalizePipelineStage(stage: string | null): PipelineStage | null {
  if (
    stage === "intake" ||
    stage === "design" ||
    stage === "review" ||
    stage === "production" ||
    stage === "closed"
  ) {
    return stage;
  }
  return null;
}

function parseProjectListQuery(
  query: Record<string, unknown>,
): ProjectListQuery {
  const limit = Math.min(
    100,
    Math.max(1, Math.floor(numberValue(query.limit) ?? 25)),
  );
  const offset = Math.max(0, Math.floor(numberValue(query.offset) ?? 0));

  return {
    q: stringValue(query.q) ?? "",
    status: projectStatusValue(query.status),
    limit,
    offset,
  };
}

function projectStatusValue(value: unknown) {
  const normalized =
    stringValue(value)
      ?.toLowerCase()
      .replace(/[\s-]+/g, "_") ?? null;
  if (
    normalized === "active" ||
    normalized === "pending" ||
    normalized === "delayed" ||
    normalized === "completed" ||
    normalized === "completed_or_approved" ||
    normalized === "draft" ||
    normalized === "planning" ||
    normalized === "in_design" ||
    normalized === "client_review" ||
    normalized === "revision" ||
    normalized === "in_production" ||
    normalized === "approved"
  ) {
    return normalized;
  }
  return null;
}

function projectStatusCondition(status: string | null) {
  if (!status) return null;
  if (status === "active")
    return sql`p.status::text in ('in_design', 'client_review', 'revision', 'in_production')`;
  if (status === "pending") return sql`p.status::text in ('draft', 'planning')`;
  if (status === "delayed")
    return sql`(p.status::text = 'delayed' or p.health::text in ('delayed', 'blocked', 'at_risk'))`;
  if (status === "completed" || status === "completed_or_approved")
    return sql`p.status::text in ('completed', 'approved')`;
  return sql`p.status::text = ${status}`;
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

async function findOrCreateProjectClient(
  organizationId: string,
  auth: AuthContext,
  companyName: string,
  assignedPmUserId: string | null,
) {
  const existing = await queryRows<{ id: string; canAccess: boolean }>(sql`
    select
      c.id::text,
      (
        ${canManageOrganization(auth)}::boolean
        or c.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from projects p
          where p.client_id = c.id
            and p.deleted_at is null
            and (
              p.assigned_pm_user_id = ${auth.user.id}::uuid
              or exists (
                select 1
                from project_members pm
                where pm.project_id = p.id
                  and pm.user_id = ${auth.user.id}::uuid
              )
            )
        )
      ) as "canAccess"
    from clients c
    where c.organization_id = ${organizationId}::uuid
      and lower(c.company_name) = lower(${companyName})
      and c.deleted_at is null
    limit 1
  `);

  const client = existing[0];
  if (client?.id)
    return client.canAccess ? client.id : ("client_not_accessible" as const);

  const inserted = await queryRows<{ id: string }>(sql`
    insert into clients (
      organization_id,
      assigned_pm_user_id,
      company_name,
      contact_name,
      contact_email,
      status,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${auth.user.role === "pm" ? assignedPmUserId : null}::uuid,
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

async function createClientRecord(
  organizationId: string,
  input: {
    companyName: string;
    contactName: string;
    contactEmail: string | null;
    exhibition: string | null;
  },
) {
  const existing = await queryRows<{ id: string }>(sql`
    select id::text
    from clients
    where organization_id = ${organizationId}::uuid
      and lower(company_name) = lower(${input.companyName})
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
      activated_at,
      intake_exhibition_name,
      metadata
    )
    values (
      ${organizationId}::uuid,
      ${input.companyName},
      ${input.contactName},
      ${input.contactEmail ?? `${slugify(input.companyName)}@pending.local`},
      'active',
      now(),
      ${input.exhibition},
      ${JSON.stringify({ exhibition: input.exhibition })}::jsonb
    )
    returning id::text
  `);

  const id = inserted[0]?.id;
  if (!id) throw new Error("Client insert did not return an id");
  return id;
}

async function updateClientRecord(
  organizationId: string,
  actorUserId: string,
  clientId: string,
  input: {
    companyName: string;
    contactName: string;
    contactEmail: string | null;
    exhibition: string | null;
  },
) {
  const duplicates = await queryRows<{ id: string }>(sql`
    select id::text
    from clients
    where organization_id = ${organizationId}::uuid
      and id <> ${clientId}::uuid
      and lower(company_name) = lower(${input.companyName})
      and deleted_at is null
    limit 1
  `);

  if (duplicates[0]?.id) return "duplicate" as const;

  const rows = await queryRows<{ id: string; companyName: string }>(sql`
    update clients
    set
      company_name = ${input.companyName},
      contact_name = ${input.contactName},
      contact_email = ${input.contactEmail ?? `${slugify(input.companyName)}@pending.local`},
      intake_exhibition_name = ${input.exhibition},
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('exhibition', ${input.exhibition}::text),
      updated_at = now()
    where id = ${clientId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
    returning id::text, company_name as "companyName"
  `);

  const client = rows[0];
  if (!client) return "not_found" as const;

  await auditEvent(
    organizationId,
    actorUserId,
    "client_updated",
    `updated client ${client.companyName}`,
    {
      clientId,
      companyName: client.companyName,
    },
  );

  return "updated" as const;
}

async function updateClientStatus(
  organizationId: string,
  auth: AuthContext,
  clientId: string,
  status: "lead" | "pending_approval" | "active" | "inactive" | "archived",
) {
  const canManage = canManageOrganization(auth);
  const rows = await queryRows<{ id: string; companyName: string }>(sql`
    update clients c
    set status = ${status}::client_status, updated_at = now()
    where c.id = ${clientId}::uuid
      and c.organization_id = ${organizationId}::uuid
      and c.deleted_at is null
      and (${canManage}::boolean
        or c.assigned_pm_user_id = ${auth.user.id}::uuid
        or exists (
          select 1
          from projects scoped_project
          where scoped_project.client_id = c.id
            and scoped_project.deleted_at is null
            and (
              scoped_project.assigned_pm_user_id = ${auth.user.id}::uuid
              or exists (
                select 1
                from project_members scoped_member
                where scoped_member.project_id = scoped_project.id
                  and scoped_member.user_id = ${auth.user.id}::uuid
                  and scoped_member.role::text = 'pm'
              )
            )
        )
      )
    returning c.id::text, c.company_name as "companyName"
  `);

  const client = rows[0];
  if (!client) {
    const exists = await queryRows<{ id: string }>(sql`
      select id::text
      from clients
      where id = ${clientId}::uuid
        and organization_id = ${organizationId}::uuid
        and deleted_at is null
      limit 1
    `);
    return exists[0] ? ("not_authorized" as const) : ("not_found" as const);
  }

  await auditEvent(
    organizationId,
    auth.user.id,
    "client_status_updated",
    `changed ${client.companyName} to ${status}`,
    {
      clientId,
      status,
    },
  );
  return "updated" as const;
}

async function removeClientRecord(
  organizationId: string,
  actorUserId: string,
  clientId: string,
) {
  const projectRows = await queryRows<{
    id: string;
    name: string;
    status: string;
    deadline: string | null;
  }>(sql`
    select id::text, name, status::text, deadline_at::text as deadline
    from projects
    where organization_id = ${organizationId}::uuid
      and client_id = ${clientId}::uuid
      and deleted_at is null
    order by updated_at desc
    limit 20
  `);

  if (projectRows.length > 0) {
    return {
      status: "has_projects" as const,
      projects: projectRows.map((project) => ({
        id: project.id,
        name: project.name,
        status: toTitle(project.status),
        deadline: project.deadline?.slice(0, 10) ?? null,
      })),
    };
  }

  const rows = await queryRows<{ id: string; companyName: string }>(sql`
    update clients
    set deleted_at = now(), updated_at = now()
    where id = ${clientId}::uuid
      and organization_id = ${organizationId}::uuid
      and deleted_at is null
    returning id::text, company_name as "companyName"
  `);

  const client = rows[0];
  if (!client) return { status: "not_found" as const };

  await auditEvent(
    organizationId,
    actorUserId,
    "client_removed",
    `removed client ${client.companyName}`,
    {
      clientId,
      companyName: client.companyName,
    },
  );

  return { status: "removed" as const };
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
  return zParse(createProjectSchema, body);
}

function parseUpdateProjectInput(body: unknown) {
  return zParse(updateProjectSchema, body);
}

type PipelineStage = "intake" | "design" | "review" | "production" | "closed";

function parsePipelineStageInput(body: unknown) {
  return zParse(pipelineStageSchema, body);
}

function parseAccountSettingsInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const profile = objectValue(data.profile);
  if ("avatarUrl" in profile || "avatarTone" in profile) {
    const avatar = parseAvatarInput({
      avatarUrl: profile.avatarUrl,
      avatarTone: profile.avatarTone,
    });
    if (!avatar.ok) return avatar;
    profile.avatarUrl = avatar.value.avatarUrl;
    profile.avatarTone = avatar.value.avatarTone;
  }

  return {
    ok: true as const,
    value: {
      profile,
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

  if (
    avatarUrl &&
    !avatarUrl.startsWith("data:image/") &&
    !avatarUrl.startsWith("https://") &&
    !avatarUrl.startsWith("/")
  ) {
    return {
      ok: false as const,
      error: "Avatar must be a data URL, HTTPS URL, or local path",
    };
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

  if (!currentPassword)
    return { ok: false as const, error: "Current password is required" };
  if (!newPassword || newPassword.length < 8)
    return {
      ok: false as const,
      error: "New password must be at least 8 characters",
    };

  return { ok: true as const, value: { currentPassword, newPassword } };
}

function parseInviteManagerInput(body: unknown) {
  return zParse(inviteManagerSchema, body);
}

function parseCreateClientInput(body: unknown) {
  return zParse(createClientSchema, body);
}

function parseUpdateClientInput(body: unknown) {
  return zParse(updateClientSchema, body);
}

type ClientStatus =
  | "lead"
  | "pending_approval"
  | "active"
  | "inactive"
  | "archived";

interface ClientListQuery {
  q: string;
  status: ClientStatus | null;
  limit: number;
  offset: number;
}

function parseClientListQuery(query: Record<string, unknown>): ClientListQuery {
  const limit = Math.min(
    100,
    Math.max(1, Math.floor(numberValue(query.limit) ?? 25)),
  );
  const offset = Math.max(0, Math.floor(numberValue(query.offset) ?? 0));
  return {
    q: stringValue(query.q) ?? "",
    status: clientStatusValue(query.status),
    limit,
    offset,
  };
}

function clientStatusValue(value: unknown): ClientStatus | null {
  const normalized = stringValue(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    normalized === "lead" ||
    normalized === "pending_approval" ||
    normalized === "active" ||
    normalized === "inactive" ||
    normalized === "archived"
  ) {
    return normalized;
  }
  return null;
}

type CalendarEventInput = {
  name: string;
  client: string;
  pm: string;
  status: "Active" | "Completed" | "Delayed" | "Pending";
  startDate: string;
  endDate: string;
  location: string;
  standType: string;
};

function parseCalendarEventInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const name = stringValue(data.name);
  const client = stringValue(data.client) ?? "Unassigned Client";
  const pm = stringValue(data.pm) ?? "Unassigned";
  const rawStatus = stringValue(data.status) ?? "Pending";
  const startDate = stringValue(data.startDate);
  const endDate = stringValue(data.endDate);
  const location = stringValue(data.location) ?? "Location TBD";
  const standType = stringValue(data.standType) ?? "Custom";

  if (!name)
    return { ok: false as const, error: "Exhibition name is required" };
  if (!startDate || !isIsoDate(startDate))
    return { ok: false as const, error: "Valid start date is required" };
  if (!endDate || !isIsoDate(endDate))
    return { ok: false as const, error: "Valid end date is required" };
  if (startDate > endDate)
    return { ok: false as const, error: "End date must be after start date" };

  const status: CalendarEventInput["status"] =
    rawStatus === "Active" ||
    rawStatus === "Completed" ||
    rawStatus === "Delayed" ||
    rawStatus === "Pending"
      ? rawStatus
      : "Pending";

  return {
    ok: true as const,
    value: {
      name,
      client,
      pm,
      status,
      startDate,
      endDate,
      location,
      standType,
    },
  };
}

function parseAssignmentsInput(body: unknown) {
  return zParse(assignmentsSchema, body);
}

function parseManagerAssignmentItemsQuery(
  query: Record<string, unknown>,
): ManagerAssignmentItemsQuery {
  const managerId = stringValue(query.managerId);
  return {
    managerId: managerId && isUuid(managerId) ? managerId : null,
    clientQ: stringValue(query.clientQ ?? query.q) ?? "",
    projectQ: stringValue(query.projectQ ?? query.q) ?? "",
    clientLimit: Math.min(
      100,
      Math.max(
        1,
        Math.floor(numberValue(query.clientLimit ?? query.limit) ?? 20),
      ),
    ),
    clientOffset: Math.max(
      0,
      Math.floor(numberValue(query.clientOffset ?? query.offset) ?? 0),
    ),
    projectLimit: Math.min(
      100,
      Math.max(
        1,
        Math.floor(numberValue(query.projectLimit ?? query.limit) ?? 20),
      ),
    ),
    projectOffset: Math.max(
      0,
      Math.floor(numberValue(query.projectOffset ?? query.offset) ?? 0),
    ),
  };
}

function parsePmTaskInput(body: unknown) {
  return zParse(pmTaskSchema, body);
}

function parsePmTaskPatch(body: unknown) {
  return zParse(pmTaskPatchSchema, body);
}

function pmTaskStatusValue(value: unknown): PmTaskStatus | null {
  const normalized = stringValue(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    normalized === "todo" ||
    normalized === "in_progress" ||
    normalized === "blocked" ||
    normalized === "done"
  )
    return normalized;
  if (normalized === "inprogress") return "in_progress";
  if (normalized === "review") return "blocked";
  return null;
}

function pmTaskPriorityValue(value: unknown): PmTaskPriority | null {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === "low") return "low";
  if (normalized === "medium" || normalized === "normal") return "normal";
  if (normalized === "high") return "high";
  if (normalized === "urgent") return "urgent";
  return null;
}

function parsePmRequestListQuery(
  query: Record<string, unknown>,
): PmRequestListQuery {
  return {
    q: stringValue(query.q) ?? "",
    status: pmRequestStatusValue(query.status),
    limit: Math.min(
      100,
      Math.max(1, Math.floor(numberValue(query.limit) ?? 20)),
    ),
    offset: Math.max(0, Math.floor(numberValue(query.offset) ?? 0)),
  };
}

function parsePmRequestStatusInput(body: unknown) {
  const data = objectValue(body);
  const status = pmRequestStatusValue(data.status);
  if (!status) {
    return { ok: false as const, error: "Request status is invalid" };
  }

  return { ok: true as const, value: { status } };
}

function parsePmRequestReplyInput(body: unknown) {
  const data = objectValue(body);
  const bodyText = stringValue(data.body);
  if (!bodyText) {
    return { ok: false as const, error: "Reply cannot be empty" };
  }
  if (bodyText.length > 4000) {
    return { ok: false as const, error: "Reply is too long" };
  }

  return { ok: true as const, value: { body: bodyText } };
}

function pmRequestStatusValue(value: unknown): PmRequestStatus | null {
  const normalized = stringValue(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "pending") return "Pending";
  if (
    normalized === "in_progress" ||
    normalized === "inprogress" ||
    normalized === "started"
  )
    return "In Progress";
  if (normalized === "resolved" || normalized === "approved") return "Resolved";
  if (normalized === "declined" || normalized === "rejected") return "Declined";
  return null;
}

function parseManagerReminderInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  return {
    ok: true as const,
    value: {
      itemCount: Math.max(0, Math.round(numberValue(data.itemCount) ?? 0)),
      delayedCount: Math.max(
        0,
        Math.round(numberValue(data.delayedCount) ?? 0),
      ),
      urgentCount: Math.max(0, Math.round(numberValue(data.urgentCount) ?? 0)),
    },
  };
}

function parseAssignmentRow(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const clientId = stringValue(data.clientId ?? data.projectId);
  const rawManagerId = stringValue(data.managerId);

  if (!clientId || !isUuid(clientId)) return null;
  const managerId = rawManagerId === "unassigned" ? null : rawManagerId;
  if (managerId && !isUuid(managerId)) return null;

  return {
    clientId,
    managerId,
  };
}

function isAssignmentRow(
  value: ReturnType<typeof parseAssignmentRow>,
): value is { clientId: string; managerId: string | null } {
  return value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
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
  executor: SqlExecutor = databaseExecutor,
) {
  await executor.execute(sql`
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
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "client"
  );
}

async function getActivity(
  organizationId: string,
  limit: number,
  auth: AuthContext,
) {
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
        and (${canSeeAll}::boolean or ae.project_id is null or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
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
        and (${canSeeAll}::boolean or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
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
        and (${canSeeAll}::boolean or p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
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
    activity: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
      (day, index) => ({
        day,
        projects:
          index === 6
            ? metrics.projects
            : Math.max(0, metrics.projects - (6 - index)),
      }),
    ),
    distribution: [
      {
        name: "Active",
        value:
          metrics.projects -
          metrics.completedProjects -
          metrics.delayedProjects,
        color: "#3b82f6",
      },
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

function normalizeClientStatus(value: string | null) {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "pending") return "pending_approval" as const;
  if (
    ["lead", "pending_approval", "active", "inactive", "archived"].includes(
      normalized,
    )
  ) {
    return normalized as
      | "lead"
      | "pending_approval"
      | "active"
      | "inactive"
      | "archived";
  }
  return null;
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

function minutesSince(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
}

function canManageOrganization(auth: AuthContext) {
  return ["admin", "owner", "chief"].includes(auth.user.role);
}

export default router;
