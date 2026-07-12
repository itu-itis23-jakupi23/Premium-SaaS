import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { workspaceInputSchema } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { deliverNotification } from "../lib/notifications";
import { sendDesignApprovedEmail, sendRevisionRequestedEmail } from "../lib/email";
import { getStorageProvider } from "../lib/storage";

const router: IRouter = Router();

router.use("/platform", requireAuth, requireTenant);

async function queryRows<T>(statement: SQL) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

router.get("/platform/workspace/current", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const auth = req.auth!;

  // Client who hasn't been approved yet gets a clear activation-required response
  // rather than a generic 404.
  if (auth.user.role === "client") {
    const clientRows = await queryRows<{ status: string }>(sql`
      select status::text
      from clients
      where organization_id = ${auth.organization.id}::uuid
        and lower(contact_email) = lower(${auth.user.email})
        and deleted_at is null
      limit 1
    `);
    const clientStatus = clientRows[0]?.status;
    if (!clientStatus || clientStatus !== "active") {
      res.status(403).json({
        error: {
          code: "client_not_activated",
          message: "Your account is pending approval. You will receive access once your agency reviews your request.",
          clientStatus: clientStatus ?? "unknown",
        },
      });
      return;
    }
  }

  const project = await getCurrentProject(auth);

  if (!project) {
    res.status(404).json({
      error: {
        code: "workspace_not_found",
        message: "No accessible workspace was found.",
      },
    });
    return;
  }

  const workspace = await loadWorkspace(auth, project.id);
  res.json(workspace);
});

router.get("/platform/projects/:projectId/workspace", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const workspace = await loadWorkspace(req.auth!, paramValue(req.params.projectId));

  if (!workspace) {
    res.status(404).json({
      error: {
        code: "workspace_not_found",
        message: "Workspace was not found.",
      },
    });
    return;
  }

  res.json(workspace);
});

// Called by the client once after viewing a submitted design — transitions booth version to under_review.
// Kept separate from GET to preserve HTTP GET idempotency.
router.post("/platform/projects/:projectId/workspace/viewed", requireRoles(["client"]), async (req, res) => {
  const auth = req.auth!;
  const projectId = paramValue(req.params.projectId);
  const access = projectId ? await getProjectAccess(auth, projectId) : null;
  if (!access) {
    res.status(404).json({ error: { code: "workspace_not_found", message: "Workspace was not found." } });
    return;
  }
  const versions = await getVersions(access.designId);
  const currentVersion = versions[0];
  if (currentVersion?.status === "submitted") {
    await db.execute(sql`
      update booth_versions
      set status = 'under_review'::booth_version_status
      where id = ${currentVersion.id}::uuid
        and organization_id = ${auth.organization.id}::uuid
    `);
    await auditWorkspaceEvent(auth, access.projectId, "workspace_viewed", `Client viewed booth workspace v${currentVersion.versionNumber}`);
  }
  res.json({ ok: true });
});

router.put(
  "/platform/projects/:projectId/workspace",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const input = parseWorkspaceInput(req.body);

    if (!input.ok) {
      res.status(400).json({
        error: {
          code: "invalid_workspace",
          message: input.error,
        },
      });
      return;
    }

    const access = await getProjectAccess(req.auth!, paramValue(req.params.projectId));

    if (!access) {
      res.status(404).json({
        error: {
          code: "workspace_not_found",
          message: "Workspace was not found.",
        },
      });
      return;
    }

    const saved = await saveDraftWorkspace(req.auth!, access, input.value.workspace, input.value.title);
    res.json(saved);
  },
);

router.post(
  "/platform/projects/:projectId/workspace/versions",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const input = parseWorkspaceInput(req.body);

    if (!input.ok) {
      res.status(400).json({
        error: {
          code: "invalid_workspace",
          message: input.error,
        },
      });
      return;
    }

    const access = await getProjectAccess(req.auth!, paramValue(req.params.projectId));

    if (!access) {
      res.status(404).json({
        error: {
          code: "workspace_not_found",
          message: "Workspace was not found.",
        },
      });
      return;
    }

    const saved = await createWorkspaceVersion(req.auth!, access, input.value.workspace, input.value.title, input.value.status);
    res.status(201).json(saved);
  },
);

// ── Client comments, annotations and approvals ────────────────────────────────────────

router.get("/platform/projects/:projectId/comments", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const projectId = paramValue(req.params.projectId);
  const auth = req.auth!;

  const access = await getProjectAccess(auth, projectId);
  if (!access) {
    res.status(404).json({ error: { code: "project_not_found", message: "Project not found" } });
    return;
  }

  const rows = await queryRows<{
    id: string;
    body: string;
    pin: unknown;
    authorName: string;
    authorRole: string;
    authorUserId: string;
    createdAt: string;
    resolvedAt: string | null;
  }>(sql`
    select
      c.id::text,
      c.body,
      c.pin,
      coalesce(u.name, 'Client') as "authorName",
      coalesce(u.role::text, 'client') as "authorRole",
      c.author_user_id::text as "authorUserId",
      c.created_at::text as "createdAt",
      c.resolved_at::text as "resolvedAt"
    from comments c
    left join users u on u.id = c.author_user_id
    where c.project_id = ${projectId}::uuid
      and c.organization_id = ${auth.organization.id}::uuid
      and c.deleted_at is null
    order by c.created_at asc
  `);

  const commentsList = rows.map(row => {
    const isMe = row.authorUserId === auth.user.id;
    let pinParsed: { x: number; y: number; z?: number } | null = null;
    if (row.pin && typeof row.pin === 'object') {
      const p = row.pin as Record<string, unknown>;
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        pinParsed = {
          x: p.x,
          y: p.y,
          z: typeof p.z === 'number' ? p.z : undefined,
        };
      }
    }

    const isChange = row.body.startsWith("[Change Request]") || row.body.startsWith("📍 Pin Annotation");

    return {
      id: row.id,
      user: isMe ? "You" : row.authorName + (row.authorRole !== 'client' ? ` (${row.authorRole.toUpperCase()})` : ''),
      initials: getInitials(row.authorName),
      text: row.body,
      time: relativeTime(row.createdAt),
      type: pinParsed ? "pin" : isChange ? "change" : "comment",
      pin: pinParsed,
      status: row.resolvedAt ? "resolved" : "open",
      resolvedAt: row.resolvedAt,
    };
  });

  res.json({ comments: commentsList });
});

router.post("/platform/projects/:projectId/comments", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  const projectId = paramValue(req.params.projectId);
  const auth = req.auth!;
  const { body, pin, type } = req.body;

  if (!body || typeof body !== 'string') {
    res.status(400).json({ error: "Comment body is required" });
    return;
  }

  const access = await getProjectAccess(auth, projectId);
  if (!access) {
    res.status(404).json({ error: { code: "project_not_found", message: "Project not found" } });
    return;
  }

  const latestVersion = await getLatestVersion(access.designId);
  const boothVersionId = latestVersion?.id ?? null;

  const insertResult = await db.execute(sql`
    insert into comments (organization_id, project_id, booth_version_id, author_user_id, body, pin)
    values (
      ${auth.organization.id}::uuid,
      ${projectId}::uuid,
      ${boothVersionId}::uuid,
      ${auth.user.id}::uuid,
      ${body},
      ${pin ? JSON.stringify(pin) : null}::jsonb
    )
    returning id::text, created_at::text as "createdAt"
  `);

  const inserted = (insertResult as unknown as { rows: { id: string; createdAt: string }[] }).rows[0];

  res.status(201).json({
    comment: {
      id: inserted.id,
      user: "You",
      initials: getInitials(auth.user.name),
      text: body,
      time: "Just now",
      type: pin ? "pin" : type || "comment",
      pin: pin || null,
      status: "open",
      resolvedAt: null,
    }
  });
});

router.put("/platform/projects/:projectId/comments/:commentId/status", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const projectId = paramValue(req.params.projectId);
  const commentId = paramValue(req.params.commentId);
  const auth = req.auth!;
  const { status } = req.body;

  if (status !== "open" && status !== "resolved") {
    res.status(400).json({ error: "status must be open or resolved" });
    return;
  }

  const access = await getProjectAccess(auth, projectId);
  if (!access) {
    res.status(404).json({ error: { code: "project_not_found", message: "Project not found" } });
    return;
  }

  const rows = await queryRows<{ id: string; resolvedAt: string | null }>(sql`
    update comments
    set
      resolved_at = case when ${status === "resolved"}::boolean then coalesce(resolved_at, now()) else null end,
      updated_at = now()
    where id = ${commentId}::uuid
      and project_id = ${projectId}::uuid
      and organization_id = ${auth.organization.id}::uuid
      and deleted_at is null
    returning id::text, resolved_at::text as "resolvedAt"
  `);

  const updated = rows[0];
  if (!updated) {
    res.status(404).json({ error: { code: "comment_not_found", message: "Comment not found" } });
    return;
  }

  res.json({
    comment: {
      id: updated.id,
      status,
      resolvedAt: updated.resolvedAt,
    },
  });
});

router.post("/platform/projects/:projectId/change-requests", requireRoles(["client", "admin", "owner", "chief"]), async (req, res) => {
  const projectId = paramValue(req.params.projectId);
  const auth = req.auth!;
  const { changeText } = req.body;

  if (!changeText || typeof changeText !== 'string' || !changeText.trim()) {
    res.status(400).json({ error: "changeText is required" });
    return;
  }

  const access = await getProjectAccess(auth, projectId);
  if (!access) {
    res.status(404).json({ error: { code: "project_not_found", message: "Project not found" } });
    return;
  }

  if (!["client_review", "in_design"].includes(access.projectStatus)) {
    res.status(409).json({
      error: { code: "not_reviewable", message: `Project must be in client review to request changes (current: ${access.projectStatus})` },
    });
    return;
  }

  const countResult = await queryRows<{ count: number }>(sql`
    select count(*)::int as count
    from approvals
    where project_id = ${projectId}::uuid
      and status::text = 'revision_requested'
  `);
  const revisionCount = countResult[0]?.count ?? 0;
  const revisionLimit = 2;

  if (revisionCount >= revisionLimit) {
    res.status(400).json({
      error: {
        code: "revision_limit_reached",
        message: `Revision limit reached (${revisionLimit}/${revisionLimit}). No further change requests are allowed.`
      }
    });
    return;
  }

  const latestVersion = await getLatestVersion(access.designId);
  if (!latestVersion) {
    res.status(400).json({ error: "No design version exists to request changes on." });
    return;
  }

  await db.execute(sql`
    insert into approvals (organization_id, project_id, booth_version_id, requested_by_user_id, status, message)
    values (
      ${auth.organization.id}::uuid,
      ${projectId}::uuid,
      ${latestVersion.id}::uuid,
      ${auth.user.id}::uuid,
      'revision_requested'::approval_status,
      ${changeText}
    )
  `);

  await db.execute(sql`
    insert into comments (organization_id, project_id, booth_version_id, author_user_id, body)
    values (
      ${auth.organization.id}::uuid,
      ${projectId}::uuid,
      ${latestVersion.id}::uuid,
      ${auth.user.id}::uuid,
      ${`[Change Request] ${changeText}`}
    )
  `);

  await db.execute(sql`
    update projects
    set status = 'revision'::project_status, updated_at = now()
    where id = ${projectId}::uuid
  `);

  await auditWorkspaceEvent(auth, projectId, "client_change_request", `Client requested revision on v${latestVersion.versionNumber}`);

  if (access.assignedPmUserId) {
    await deliverNotification(
      auth.organization.id,
      access.assignedPmUserId,
      "Revision requested",
      `Client requested revision on project "${access.projectName}"`,
      "/pm/requests",
      "milestones",
    );
  }
  if (access.assignedPmEmail) {
    await sendRevisionRequestedEmail({
      to: access.assignedPmEmail,
      pmName: access.assignedPmName ?? "Project Manager",
      projectName: access.projectName,
      workspaceUrl: `${process.env.APP_URL ?? "http://localhost:5173"}/pm/requests`,
    });
  }

  const workspace = await loadWorkspace(auth, projectId);
  res.json(workspace);
});

// Real checkout-session creation lives in routes/billing.ts (Stripe-backed, with
// a simulation fallback for dev/staging). This route only serves the dev-mode
// simulation landing page that billing.ts's fallback redirects to.
router.get("/platform/workspace/billing/simulation", requireRoles(["admin", "owner", "chief", "pm", "client"]), async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { reference, plan, client_id, redirect } = req.query;

  if (!reference || !plan || !client_id) {
    res.status(400).send("Missing parameters for checkout simulation.");
    return;
  }

  const isUnlimited = plan === "unlimited";
  const extraRounds = plan === "starter" ? 3 : plan === "pro" ? 8 : 0;

  await db.execute(sql`
    update clients
    set
      workspace_editor_subscription_active = ${isUnlimited},
      workspace_editor_subscription_plan = ${plan as string},
      workspace_editor_subscription_status = 'active',
      workspace_editor_extra_revision_rounds = workspace_editor_extra_revision_rounds + ${extraRounds},
      workspace_editor_subscription_updated_at = now()
    where id = ${client_id as string}::uuid
  `);

  const projRows = await queryRows<{ id: string }>(sql`
    select id::text from projects where client_id = ${client_id as string}::uuid limit 1
  `);
  const projectId = projRows[0]?.id;
  if (projectId) {
    await db.execute(sql`
      insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, metadata)
      values (
        (select organization_id from clients where id = ${client_id as string}::uuid),
        null,
        ${projectId}::uuid,
        'workspace_saved',
        ${`Payment verified for ${plan} revision plan`},
        '{}'::jsonb
      )
    `);
  }

  res.send(`
    <html>
      <head>
        <title>Payment Simulation Successful</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; background: #f3f1ec; color: #181613; }
          .card { background: white; padding: 40px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .btn { background: #1d4ed8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1 style="color: #2f7d3a;">✓ Payment Successful!</h1>
          <p>Your simulated checkout of the <strong>${plan}</strong> plan has completed successfully.</p>
          <p>Extra revisions have been credited to your client profile.</p>
          <a class="btn" href="${redirect as string || '#'}">Return to Workspace</a>
        </div>
      </body>
    </html>
  `);
});

router.put("/platform/projects/:projectId/element-status", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const projectId = paramValue(req.params.projectId);
  const auth = req.auth!;
  const { elementStatus } = req.body;

  if (!elementStatus || typeof elementStatus !== 'object') {
    res.status(400).json({ error: "elementStatus object is required" });
    return;
  }

  const access = await getProjectAccess(auth, projectId);
  if (!access) {
    res.status(404).json({ error: { code: "project_not_found", message: "Project not found" } });
    return;
  }

  const projRows = await queryRows<{ metadata: Record<string, unknown> }>(sql`
    select metadata
    from projects
    where id = ${projectId}::uuid
  `);
  const currentMetadata = projRows[0]?.metadata ?? {};
  const updatedMetadata = { ...currentMetadata, elementStatus };

  await db.execute(sql`
    update projects
    set metadata = ${JSON.stringify(updatedMetadata)}::jsonb, updated_at = now()
    where id = ${projectId}::uuid
  `);

  res.json({ ok: true, elementStatus });
});

router.post("/platform/projects/:projectId/approve", requireRoles(["client", "admin", "owner", "chief"]), async (req, res) => {
  const projectId = paramValue(req.params.projectId);
  const auth = req.auth!;

  const access = await getProjectAccess(auth, projectId);
  if (!access) {
    res.status(404).json({ error: { code: "project_not_found", message: "Project not found" } });
    return;
  }

  if (!["client_review", "in_design", "revision"].includes(access.projectStatus)) {
    res.status(409).json({
      error: { code: "not_in_review", message: `Project must be in client review to approve (current: ${access.projectStatus})` },
    });
    return;
  }

  const latestVersion = await getLatestVersion(access.designId);
  if (!latestVersion) {
    res.status(400).json({ error: "No design version exists to approve." });
    return;
  }

  await db.execute(sql`
    insert into approvals (organization_id, project_id, booth_version_id, requested_by_user_id, status, message)
    values (
      ${auth.organization.id}::uuid,
      ${projectId}::uuid,
      ${latestVersion.id}::uuid,
      ${auth.user.id}::uuid,
      'approved'::approval_status,
      'Design approved'
    )
  `);

  await db.execute(sql`
    update booth_versions
    set status = 'approved'::booth_version_status, locked_at = now()
    where id = ${latestVersion.id}::uuid
  `);

  await db.execute(sql`
    update projects
    set status = 'approved'::project_status, updated_at = now()
    where id = ${projectId}::uuid
  `);

  await auditWorkspaceEvent(auth, projectId, "client_approved", `Client approved booth workspace v${latestVersion.versionNumber}`);

  if (access.assignedPmUserId) {
    await deliverNotification(
      auth.organization.id,
      access.assignedPmUserId,
      "Design approved",
      `Client approved booth design for project "${access.projectName}"`,
      `/pm/workspace?projectId=${projectId}`,
      "milestones",
    );
  }
  if (access.assignedPmEmail) {
    await sendDesignApprovedEmail({
      to: access.assignedPmEmail,
      pmName: access.assignedPmName ?? "Project Manager",
      projectName: access.projectName,
      workspaceUrl: `${process.env.APP_URL ?? "http://localhost:5173"}/pm/workspace?projectId=${projectId}`,
    });
  }

  const workspace = await loadWorkspace(auth, projectId);
  res.json(workspace);
});

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map(p => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(isoString: string) {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

async function getCurrentProject(auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const isClient = auth.user.role === "client";
  const rows = await queryRows<{ id: string }>(sql`
    select p.id::text as id
    from projects p
    left join clients cli on cli.id = p.client_id
    where p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (${canSeeAll}::boolean
        or exists (
          select 1
          from project_members pm
          where pm.project_id = p.id
            and pm.user_id = ${auth.user.id}::uuid
        )
        or (${isClient}::boolean
          and cli.deleted_at is null
          and lower(cli.contact_email) = lower(${auth.user.email})
          and cli.status::text = 'active'
        )
      )
    order by p.updated_at desc
    limit 1
  `);

  return rows[0] ?? null;
}

async function loadWorkspace(auth: AuthContext, projectId: string | undefined) {
  if (!projectId) return null;

  const access = await getProjectAccess(auth, projectId);
  if (!access) return null;

  const versions = await getVersions(access.designId);
  const currentVersion = versions[0] ?? null;
  const workspace = normalizeWorkspace(currentVersion?.layoutJson, access);

  const countResult = await queryRows<{ count: number }>(sql`
    select count(*)::int as count
    from approvals
    where project_id = ${access.projectId}::uuid
      and status::text = 'revision_requested'
  `);
  const revisionCount = countResult[0]?.count ?? 0;

  const unlimitedAccess = !!access.workspaceEditorSubscriptionActive;
  const extraRounds = access.workspaceEditorExtraRevisionRounds ?? 0;
  const roundsLimit = 2;
  const totalRoundLimit = unlimitedAccess ? null : (roundsLimit + extraRounds);
  const roundsRemaining = unlimitedAccess ? null : Math.max(0, (totalRoundLimit ?? 0) - revisionCount);
  const subscriptionRequired = !unlimitedAccess && (roundsRemaining !== null && roundsRemaining <= 0);
  const subscriptionStatus = access.workspaceEditorSubscriptionStatus || "inactive";
  const subscriptionPending = subscriptionStatus === "pending";
  const subscriptionPlan = access.workspaceEditorSubscriptionPlan;

  const planLabel = subscriptionPlan === "starter" ? "Starter" : subscriptionPlan === "pro" ? "Pro" : subscriptionPlan === "unlimited" ? "Unlimited" : null;
  const planPrice = subscriptionPlan === "starter" ? 2.99 : subscriptionPlan === "pro" ? 9.99 : subscriptionPlan === "unlimited" ? 11.99 : 0.00;

  const canRequestChanges = !subscriptionRequired && access.projectStatus !== "approved";
  const revisionLimit = unlimitedAccess ? 9999 : (2 + extraRounds);

  const projRows = await queryRows<{ metadata: Record<string, unknown> }>(sql`
    select metadata
    from projects
    where id = ${access.projectId}::uuid
  `);
  const metadata = projRows[0]?.metadata ?? {};
  const elementStatus = metadata.elementStatus ?? {
    structure: "pending",
    furniture: "pending",
    branding: "pending",
    lighting: "pending",
  };

  const approvedResult = await queryRows<{ approved: boolean }>(sql`
    select exists (
      select 1
      from approvals
      where project_id = ${access.projectId}::uuid
        and status::text = 'approved'
    ) as approved
  `);
  const approved = approvedResult[0]?.approved ?? false;

  return {
    project: {
      id: access.projectId,
      name: access.projectName,
      client: access.clientName,
      exhibition: access.exhibitionName,
      status: toTitle(access.projectStatus),
      health: toTitle(access.projectHealth),
    },
    design: {
      id: access.designId,
      name: access.designName,
      system: access.boothSystem,
      widthMm: access.widthMm,
      depthMm: access.depthMm,
      heightMm: access.heightMm,
      currentVersionNumber: access.currentVersionNumber,
    },
    currentVersion: currentVersion ? toVersionSummary(currentVersion) : null,
    versions: versions.map((version) => ({
      ...toVersionSummary(version),
      workspace: normalizeWorkspace(version.layoutJson, access),
    })),
    workspace,
    readonly: auth.user.role === "client",
    revisionCount,
    revisionLimit,
    elementStatus,
    approved,
    permissions: {
      can_edit: auth.user.role !== "client" || canRequestChanges,
      can_save: auth.user.role !== "client" || canRequestChanges,
      can_send_arrangement: auth.user.role !== "client" || canRequestChanges,
      arrangement_round_limit: roundsLimit,
      arrangement_rounds_used: revisionCount,
      arrangement_rounds_remaining: roundsRemaining,
      total_round_limit: totalRoundLimit,
      subscription_active: unlimitedAccess || (subscriptionPlan !== null && extraRounds > 0),
      subscription_unlimited: unlimitedAccess,
      subscription_status: subscriptionStatus,
      subscription_pending: subscriptionPending,
      subscription_required: subscriptionRequired,
      subscription_plan: subscriptionPlan,
      subscription_plan_label: planLabel,
      subscription_price: planPrice,
      subscription_currency: "USD",
      edit_disabled_reason: subscriptionRequired
        ? (subscriptionPending
            ? "Payment verification is still pending. Revision access will activate after server-side confirmation."
            : "You have used the 2 included arrangement rounds. Choose a plan to continue.")
        : null
    }
  };
}

async function saveDraftWorkspace(
  auth: AuthContext,
  access: ProjectAccess,
  workspace: WorkspaceState,
  title: string,
) {
  const latest = await getLatestVersion(access.designId);

  let savedVersionNumber: number;
  if (latest?.status === "draft") {
    // Overwrite the existing draft in-place — no new version row needed.
    await db.execute(sql`
      update booth_versions
      set
        title = ${title},
        layout_json = ${JSON.stringify(workspace)}::jsonb,
        asset_summary = ${JSON.stringify(buildAssetSummary(workspace))}::jsonb
      where id = ${latest.id}::uuid
    `);
    savedVersionNumber = latest.versionNumber;
  } else {
    savedVersionNumber = await insertVersion(auth, access, null, title, workspace, "draft");
  }

  await updateDesignFromWorkspace(access, workspace, savedVersionNumber);
  await auditWorkspaceEvent(auth, access.projectId, "workspace_saved", `saved booth workspace v${savedVersionNumber}`);

  return loadWorkspace(auth, access.projectId);
}

async function createWorkspaceVersion(
  auth: AuthContext,
  access: ProjectAccess,
  workspace: WorkspaceState,
  title: string,
  status: "draft" | "submitted" = "draft",
) {
  // Pass null so insertVersion computes the next version atomically in the DB,
  // avoiding a JS read-then-write race condition on concurrent saves.
  const savedVersionNumber = await insertVersion(auth, access, null, title, workspace, status);
  await updateDesignFromWorkspace(access, workspace, savedVersionNumber);
  if (status === "submitted") {
    await db.execute(sql`
      update projects
      set status = 'client_review'::project_status, updated_at = now()
      where id = ${access.projectId}::uuid
        and organization_id = ${auth.organization.id}::uuid
        and status::text <> 'approved'
    `);
  }
  await auditWorkspaceEvent(auth, access.projectId, status === "submitted" ? "workspace_submitted" : "workspace_version_created", `${status === "submitted" ? "submitted" : "created"} booth workspace v${savedVersionNumber}`);

  return loadWorkspace(auth, access.projectId);
}

async function insertVersion(
  auth: AuthContext,
  access: ProjectAccess,
  versionNumber: number | null,
  title: string,
  workspace: WorkspaceState,
  status: "draft" | "submitted",
): Promise<number> {
  // Compute version_number atomically in the DB to avoid the JS read-then-write
  // race condition that could produce duplicate version numbers under concurrent saves.
  const rows = await queryRows<{ versionNumber: number }>(sql`
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
      submitted_at,
      created_by_user_id
    )
    select
      ${auth.organization.id}::uuid,
      ${access.designId}::uuid,
      ${access.projectId}::uuid,
      coalesce(${versionNumber}, (select coalesce(max(bv.version_number), 0) + 1 from booth_versions bv where bv.design_id = ${access.designId}::uuid)),
      ${status}::booth_version_status,
      ${title},
      ${JSON.stringify(workspace)}::jsonb,
      ${JSON.stringify(buildAssetSummary(workspace))}::jsonb,
      ${estimateCostCents(workspace)},
      case when ${status === "submitted"}::boolean then now() else null end,
      ${auth.user.id}::uuid
    returning version_number as "versionNumber"
  `);
  return rows[0]?.versionNumber ?? versionNumber ?? 1;
}

async function updateDesignFromWorkspace(access: ProjectAccess, workspace: WorkspaceState, versionNumber: number) {
  await db.execute(sql`
    update booth_designs
    set
      booth_system = ${workspace.booth.system}::booth_system,
      width_mm = ${Math.round(workspace.booth.width * 1000)},
      depth_mm = ${Math.round(workspace.booth.depth * 1000)},
      height_mm = ${Math.round(workspace.booth.height * 1000)},
      current_version_number = ${versionNumber},
      updated_at = now()
    where id = ${access.designId}::uuid
  `);

  await db.execute(sql`
    update projects
    set updated_at = now()
    where id = ${access.projectId}::uuid
  `);
}

async function getProjectAccess(auth: AuthContext, projectId: string) {
  const canSeeAll = canManageOrganization(auth);
  const rows = await queryRows<ProjectAccess>(sql`
    select
      p.id::text as "projectId",
      p.name as "projectName",
      p.exhibition_name as "exhibitionName",
      p.status::text as "projectStatus",
      p.health::text as "projectHealth",
      c.company_name as "clientName",
      c.id::text as "clientId",
      c.status::text as "clientStatus",
      c.workspace_editor_subscription_active as "workspaceEditorSubscriptionActive",
      c.workspace_editor_subscription_plan as "workspaceEditorSubscriptionPlan",
      c.workspace_editor_subscription_status as "workspaceEditorSubscriptionStatus",
      c.workspace_editor_extra_revision_rounds as "workspaceEditorExtraRevisionRounds",
      c.workspace_editor_subscription_reference as "workspaceEditorSubscriptionReference",
      c.workspace_editor_subscription_updated_at::text as "workspaceEditorSubscriptionUpdatedAt",
      bd.id::text as "designId",
      bd.name as "designName",
      bd.booth_system::text as "boothSystem",
      bd.width_mm as "widthMm",
      bd.depth_mm as "depthMm",
      bd.height_mm as "heightMm",
      bd.current_version_number as "currentVersionNumber",
      p.assigned_pm_user_id::text as "assignedPmUserId",
      pm_user.email as "assignedPmEmail",
      pm_user.name as "assignedPmName"
    from projects p
    join clients c on c.id = p.client_id
    join booth_designs bd on bd.project_id = p.id and bd.deleted_at is null
    left join users pm_user on pm_user.id = p.assigned_pm_user_id
    where p.id = ${projectId}::uuid
      and p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (${canSeeAll}::boolean
        or exists (
          select 1
          from project_members pm
          where pm.project_id = p.id
            and pm.user_id = ${auth.user.id}::uuid
        )
        or (${auth.user.role === "client"}::boolean
          and c.deleted_at is null
          and lower(c.contact_email) = lower(${auth.user.email})
        )
      )
    order by bd.updated_at desc
    limit 1
  `);

  const access = rows[0] ?? null;

  // Clients who haven't been activated yet must not see workspace data.
  if (access && auth.user.role === "client" && access.clientStatus !== "active") {
    return null;
  }

  return access;
}

async function getVersions(designId: string) {
  return queryRows<WorkspaceVersionRow>(sql`
    select
      id::text,
      version_number as "versionNumber",
      status::text,
      title,
      layout_json as "layoutJson",
      snapshot_url as "snapshotUrl",
      asset_summary as "assetSummary",
      cost_estimate_cents as "costEstimateCents",
      submitted_at::text as "submittedAt",
      locked_at::text as "lockedAt",
      created_at::text as "createdAt"
    from booth_versions
    where design_id = ${designId}::uuid
    order by version_number desc
  `);
}

async function getLatestVersion(designId: string) {
  const rows = await queryRows<WorkspaceVersionRow>(sql`
    select
      id::text,
      version_number as "versionNumber",
      status::text,
      title,
      layout_json as "layoutJson",
      snapshot_url as "snapshotUrl",
      asset_summary as "assetSummary",
      cost_estimate_cents as "costEstimateCents",
      submitted_at::text as "submittedAt",
      locked_at::text as "lockedAt",
      created_at::text as "createdAt"
    from booth_versions
    where design_id = ${designId}::uuid
    order by version_number desc
    limit 1
  `);

  return rows[0] ?? null;
}

const WORKSPACE_JSON_MAX_BYTES = 1_500_000; // 1.5 MB — images belong in /documents/upload

function parseWorkspaceInput(body: unknown) {
  const jsonSize = Buffer.byteLength(JSON.stringify(body ?? null), "utf8");
  if (jsonSize > WORKSPACE_JSON_MAX_BYTES) {
    return {
      ok: false as const,
      error: `Workspace payload is too large (${Math.round(jsonSize / 1024)} KB). Upload images via the document API instead of embedding them in the workspace.`,
    };
  }

  const parsed = workspaceInputSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid workspace payload" };
  }

  const data = parsed.data;
  const workspace = normalizeWorkspace(data.workspace, null);
  const title = data.title ?? "Workspace draft";
  const status = data.status ?? "draft";

  if (workspace.booth.width < 1 || workspace.booth.width > 100) return { ok: false as const, error: "Width must be between 1 and 100 meters" };
  if (workspace.booth.depth < 1 || workspace.booth.depth > 100) return { ok: false as const, error: "Depth must be between 1 and 100 meters" };
  if (workspace.booth.height < 1.5 || workspace.booth.height > 12) return { ok: false as const, error: "Height must be between 1.5 and 12 meters" };

  return { ok: true as const, value: { workspace, title, status } };
}

function normalizeWorkspace(value: unknown, access: ProjectAccess | null): WorkspaceState {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const boothRaw = data.booth && typeof data.booth === "object" ? data.booth as Record<string, unknown> : {};
  const dimensionsRaw = data.dimensions && typeof data.dimensions === "object" ? data.dimensions as Record<string, unknown> : {};

  const width = numberValue(boothRaw.width) ?? mmToM(numberValue(dimensionsRaw.widthMm)) ?? mmToM(access?.widthMm) ?? 6;
  const depth = numberValue(boothRaw.depth) ?? mmToM(numberValue(dimensionsRaw.depthMm)) ?? mmToM(access?.depthMm) ?? 3;
  const height = numberValue(boothRaw.height) ?? mmToM(numberValue(dimensionsRaw.heightMm)) ?? mmToM(access?.heightMm) ?? 2.5;
  const systemRaw = stringValue(boothRaw.system) ?? stringValue(data.boothSystem) ?? access?.boothSystem ?? "octanorm";
  const system = systemRaw === "maxima" ? "maxima" : "octanorm";
  const companyName = stringValue(boothRaw.companyName) ?? access?.clientName?.toUpperCase().slice(0, 22) ?? "COMPANY NAME";

  return {
    booth: {
      width,
      depth,
      height,
      system,
      companyName,
      openFront: booleanValue(boothRaw.openFront, true),
      openBack: booleanValue(boothRaw.openBack, false),
      openLeft: booleanValue(boothRaw.openLeft, false),
      openRight: booleanValue(boothRaw.openRight, false),
      fasciaEnabled: booleanValue(boothRaw.fasciaEnabled, true),
      fasciaOption: normalizeFasciaOption(boothRaw.fasciaOption),
    },
    themeIdx: integerValue(data.themeIdx, 0, 0, 3),
    wallFinishIdx: integerValue(data.wallFinishIdx, 0, 0, 3),
    frameFinishIdx: integerValue(data.frameFinishIdx, 0, 0, 3),
    fasciaFinishIdx: integerValue(data.fasciaFinishIdx, 0, 0, 3),
    carpetIdx: integerValue(data.carpetIdx, 0, 0, 5),
    lightingPreset: normalizeLightingPreset(data.lightingPreset),
    placedItems: Array.isArray(data.placedItems) ? data.placedItems.map((item) => normalizePlacedItem(item, width, depth)).filter(Boolean) as WorkspacePlacedItem[] : [],
    rooms: Array.isArray(data.rooms) ? data.rooms.map((room) => normalizeRoom(room, width, depth, height)).filter(Boolean) as WorkspaceRoom[] : [],
    notes: Array.isArray(data.notes) ? data.notes.map(normalizeNote).filter(Boolean) as WorkspaceNote[] : [],
  };
}

function normalizePlacedItem(value: unknown, boothWidth: number, boothDepth: number): WorkspacePlacedItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = stringValue(item.id);
  const catalogId = stringValue(item.catalogId);
  const name = stringValue(item.name);
  const sku = stringValue(item.sku);
  if (!id || !catalogId || !name || !sku) return null;

  const w = clamp(numberValue(item.w) ?? 1, 0.05, Math.max(0.05, boothWidth));
  const d = clamp(numberValue(item.d) ?? 1, 0.05, Math.max(0.05, boothDepth));
  const minX = w / 2;
  const maxX = Math.max(minX, boothWidth - w / 2);
  const minZ = d / 2;
  const maxZ = Math.max(minZ, boothDepth - d / 2);

  return {
    id,
    catalogId,
    name,
    sku,
    qty: Math.max(1, Math.min(999, integerValue(item.qty, 1, 1, 999))),
    w,
    d,
    h: clamp(numberValue(item.h) ?? 1, 0.05, 12),
    color: stringValue(item.color) ?? "#888888",
    weight: numberValue(item.weight) ?? 0,
    x: clamp(numberValue(item.x) ?? boothWidth / 2, minX, maxX),
    z: clamp(numberValue(item.z) ?? boothDepth / 2, minZ, maxZ),
    rotation: numberValue(item.rotation) ?? 0,
    kind: normalizeItemKind(item.kind),
    shape: stringValue(item.shape) ?? undefined,
    modelUrl: stringValue(item.modelUrl) ?? undefined,
    source: stringValue(item.source) ?? undefined,
  };
}

function normalizeRoom(value: unknown, boothWidth: number, boothDepth: number, boothHeight: number): WorkspaceRoom | null {
  if (!value || typeof value !== "object") return null;
  const room = value as Record<string, unknown>;
  const id = stringValue(room.id);
  if (!id) return null;

  const width = clamp(numberValue(room.width) ?? 3, 1, Math.max(1, boothWidth));
  const depth = clamp(numberValue(room.depth) ?? 3, 1, Math.max(1, boothDepth));
  const height = clamp(numberValue(room.height) ?? 2.4, 1.8, Math.max(1.8, boothHeight));

  return {
    id,
    name: stringValue(room.name) ?? "Room",
    width,
    depth,
    height,
    x: clamp(numberValue(room.x) ?? boothWidth / 2, width / 2, Math.max(width / 2, boothWidth - width / 2)),
    z: clamp(numberValue(room.z) ?? boothDepth / 2, depth / 2, Math.max(depth / 2, boothDepth - depth / 2)),
    hasDoor: booleanValue(room.hasDoor, true),
    hasCeiling: booleanValue(room.hasCeiling, false),
    doorPosition: normalizeDoorPosition(room.doorPosition),
    doorSwing: normalizeDoorSwing(room.doorSwing),
    doorOpen: booleanValue(room.doorOpen, false),
  };
}

function normalizeNote(value: unknown): WorkspaceNote | null {
  if (!value || typeof value !== "object") return null;
  const note = value as Record<string, unknown>;
  const id = stringValue(note.id);
  const text = stringValue(note.text);
  if (!id || !text) return null;

  return {
    id,
    text,
    color: stringValue(note.color) ?? "#1d4ed8",
    createdAt: stringValue(note.createdAt) ?? new Date().toISOString(),
  };
}

function buildAssetSummary(workspace: WorkspaceState) {
  return {
    placedItemCount: workspace.placedItems.reduce((sum, item) => sum + item.qty, 0),
    roomCount: workspace.rooms.length,
    noteCount: workspace.notes.length,
    estimatedWeightKg: workspace.placedItems.reduce((sum, item) => sum + item.weight * item.qty, 0),
  };
}

function estimateCostCents(workspace: WorkspaceState) {
  const floorArea = workspace.booth.width * workspace.booth.depth;
  const systemMultiplier = workspace.booth.system === "maxima" ? 1.65 : 1;
  const placedItems = workspace.placedItems.reduce((sum, item) => sum + item.qty, 0);
  return Math.round((floorArea * 450 * systemMultiplier + placedItems * 180) * 100);
}

function toVersionSummary(version: WorkspaceVersionRow) {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: toTitle(version.status),
    title: version.title,
    snapshotUrl: version.snapshotUrl,
    assetSummary: version.assetSummary,
    costEstimateCents: version.costEstimateCents,
    submittedAt: version.submittedAt,
    lockedAt: version.lockedAt,
    createdAt: version.createdAt,
  };
}

async function auditWorkspaceEvent(auth: AuthContext, projectId: string, type: string, message: string) {
  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, metadata)
    values (${auth.organization.id}::uuid, ${auth.user.id}::uuid, ${projectId}::uuid, ${type}, ${message}, '{}'::jsonb)
  `);
}

function canManageOrganization(auth: AuthContext) {
  return ["admin", "owner", "chief"].includes(auth.user.role);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value: unknown, fallback: number, min: number, max: number) {
  const parsed = numberValue(value);
  if (parsed === null) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeFasciaOption(value: unknown): "classic" | "full" | "custom" {
  return value === "full" || value === "custom" ? value : "classic";
}

function normalizeLightingPreset(value: unknown): "neutral" | "exhibition" | "accent" | "spotlight" | "ambient" {
  return value === "neutral" || value === "accent" || value === "spotlight" || value === "ambient" ? value : "exhibition";
}

function normalizeItemKind(value: unknown): "furniture" | "light" | "structure" | "fascia" | "asset" {
  return value === "light" || value === "structure" || value === "fascia" || value === "asset" ? value : "furniture";
}

function normalizeDoorPosition(value: unknown): "left" | "center" | "right" {
  return value === "left" || value === "right" ? value : "center";
}

function normalizeDoorSwing(value: unknown): "left-in" | "right-in" | "left-out" | "right-out" {
  return value === "right-in" || value === "left-out" || value === "right-out" ? value : "left-in";
}

function mmToM(value: number | null | undefined) {
  return typeof value === "number" ? value / 1000 : null;
}

function toTitle(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

interface ProjectAccess {
  projectId: string;
  projectName: string;
  exhibitionName: string | null;
  projectStatus: string;
  projectHealth: string;
  clientName: string;
  clientId: string;
  clientStatus: string;
  designId: string;
  designName: string;
  boothSystem: "octanorm" | "maxima" | "custom";
  widthMm: number;
  depthMm: number;
  heightMm: number;
  currentVersionNumber: number;
  assignedPmUserId: string | null;
  assignedPmEmail: string | null;
  assignedPmName: string | null;
  workspaceEditorSubscriptionActive: boolean;
  workspaceEditorSubscriptionPlan: string | null;
  workspaceEditorSubscriptionStatus: string;
  workspaceEditorExtraRevisionRounds: number;
  workspaceEditorSubscriptionReference: string | null;
  workspaceEditorSubscriptionUpdatedAt: string | null;
}

interface WorkspaceVersionRow {
  id: string;
  versionNumber: number;
  status: string;
  title: string;
  layoutJson: unknown;
  snapshotUrl: string | null;
  assetSummary: Record<string, unknown>;
  costEstimateCents: number;
  submittedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
}

interface WorkspaceState {
  booth: {
    width: number;
    depth: number;
    height: number;
    system: "octanorm" | "maxima";
    companyName: string;
    openFront: boolean;
    openBack: boolean;
    openLeft: boolean;
    openRight: boolean;
    fasciaEnabled: boolean;
    fasciaOption: "classic" | "full" | "custom";
  };
  themeIdx: number;
  wallFinishIdx: number;
  frameFinishIdx: number;
  fasciaFinishIdx: number;
  carpetIdx: number;
  lightingPreset: "neutral" | "exhibition" | "accent" | "spotlight" | "ambient";
  placedItems: WorkspacePlacedItem[];
  rooms: WorkspaceRoom[];
  notes: WorkspaceNote[];
}

interface WorkspacePlacedItem {
  id: string;
  catalogId: string;
  name: string;
  sku: string;
  qty: number;
  w: number;
  d: number;
  h: number;
  color: string;
  weight: number;
  x: number;
  z: number;
  rotation: number;
  kind: "furniture" | "light" | "structure" | "fascia" | "asset";
  shape?: string;
  modelUrl?: string;
  source?: string;
}

interface WorkspaceRoom {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  x: number;
  z: number;
  hasDoor: boolean;
  hasCeiling: boolean;
  doorPosition: "left" | "center" | "right";
  doorSwing: "left-in" | "right-in" | "left-out" | "right-out";
  doorOpen: boolean;
}

interface WorkspaceNote {
  id: string;
  text: string;
  color: string;
  createdAt: string;
}

// ── Workspace asset upload ────────────────────────────────────────────────────
// Accepts a base64 data URL, validates it, stores the decoded bytes via the
// configured StorageProvider, and returns the validated data URL. The booth
// renderer (THREE.js inside an iframe) loads textures from data URLs directly,
// so we return the data URL rather than an authenticated download URL.
// Max decoded size: 384 KB (matches the 512 KB base64 limit in the Zod schema).

const WORKSPACE_ASSET_MAX_BYTES = 384_000;

router.post(
  "/platform/projects/:projectId/workspace/assets",
  requireRoles(["admin", "owner", "chief", "pm"]),
  async (req, res) => {
    const auth = req.auth!;
    const projectId = paramValue(req.params.projectId);
    const access = projectId ? await getProjectAccess(auth, projectId) : null;
    if (!access) {
      res.status(404).json({ error: { code: "project_not_found", message: "Project was not found." } });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : null;
    const rawName = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "workspace-image";

    if (!dataUrl) {
      res.status(400).json({ error: { code: "invalid_asset", message: "dataUrl is required." } });
      return;
    }

    const headerMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    if (!headerMatch) {
      res.status(400).json({ error: { code: "invalid_asset", message: "dataUrl must be a valid base64-encoded image." } });
      return;
    }

    const mimeType = headerMatch[1];
    const bytes = Buffer.from(dataUrl.slice(headerMatch[0].length), "base64");

    if (bytes.byteLength > WORKSPACE_ASSET_MAX_BYTES) {
      res.status(400).json({
        error: {
          code: "asset_too_large",
          message: `Image must be under 375 KB (got ${Math.round(bytes.byteLength / 1024)} KB). Compress the image before uploading.`,
        },
      });
      return;
    }

    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const fileName = rawName.match(/\.[a-zA-Z0-9]+$/) ? rawName : `${rawName}.${ext}`;
    const documentId = randomUUID();
    const storage = getStorageProvider();
    const stored = await storage.store({ bytes, organizationId: auth.organization.id, documentId, fileName, mimeType });

    await db.execute(sql`
      insert into documents (
        id, organization_id, project_id, uploaded_by_user_id,
        kind, visibility, file_name, mime_type, size_bytes,
        storage_bucket, storage_key, checksum_sha256
      ) values (
        ${documentId}::uuid, ${auth.organization.id}::uuid, ${access.projectId}::uuid, ${auth.user.id}::uuid,
        'asset'::document_kind, 'internal'::file_visibility,
        ${fileName}, ${mimeType}, ${stored.sizeBytes},
        ${stored.bucket}, ${stored.key}, ${stored.checksumSha256}
      )
    `);

    res.status(201).json({
      asset: {
        id: documentId,
        url: dataUrl,
        mimeType,
        size: stored.sizeBytes,
        originalName: fileName,
      },
    });
  },
);

export default router;
