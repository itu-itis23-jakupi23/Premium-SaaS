import { sql, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";

const router: IRouter = Router();

router.use("/platform", requireAuth, requireTenant);

async function queryRows<T>(statement: SQL) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

router.get("/platform/workspace/current", async (req, res) => {
  const project = await getCurrentProject(req.auth!);

  if (!project) {
    res.status(404).json({
      error: {
        code: "workspace_not_found",
        message: "No accessible workspace was found.",
      },
    });
    return;
  }

  const workspace = await loadWorkspace(req.auth!, project.id);
  res.json(workspace);
});

router.get("/platform/projects/:projectId/workspace", async (req, res) => {
  const workspace = await loadWorkspace(req.auth!, req.params.projectId);

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

    const saved = await createWorkspaceVersion(req.auth!, access, input.value.workspace, input.value.title);
    res.status(201).json(saved);
  },
);

async function getCurrentProject(auth: AuthContext) {
  const canSeeAll = canManageOrganization(auth);
  const rows = await queryRows<{ id: string }>(sql`
    select p.id::text as id
    from projects p
    where p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (${canSeeAll}::boolean or exists (
        select 1
        from project_members pm
        where pm.project_id = p.id
          and pm.user_id = ${auth.user.id}::uuid
      ))
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
  };
}

async function saveDraftWorkspace(
  auth: AuthContext,
  access: ProjectAccess,
  workspace: WorkspaceState,
  title: string,
) {
  const latest = await getLatestVersion(access.designId);
  const nextVersionNumber = latest?.status === "draft" ? latest.versionNumber : access.currentVersionNumber + 1;

  if (latest?.status === "draft") {
    await db.execute(sql`
      update booth_versions
      set
        title = ${title},
        layout_json = ${JSON.stringify(workspace)}::jsonb,
        asset_summary = ${JSON.stringify(buildAssetSummary(workspace))}::jsonb
      where id = ${latest.id}::uuid
    `);
  } else {
    await insertVersion(auth, access, nextVersionNumber, title, workspace, "draft");
  }

  await updateDesignFromWorkspace(access, workspace, nextVersionNumber);
  await auditWorkspaceEvent(auth, access.projectId, "workspace_saved", `saved booth workspace v${nextVersionNumber}`);

  return loadWorkspace(auth, access.projectId);
}

async function createWorkspaceVersion(
  auth: AuthContext,
  access: ProjectAccess,
  workspace: WorkspaceState,
  title: string,
) {
  const latest = await getLatestVersion(access.designId);
  const nextVersionNumber = (latest?.versionNumber ?? access.currentVersionNumber) + 1;

  await insertVersion(auth, access, nextVersionNumber, title, workspace, "draft");
  await updateDesignFromWorkspace(access, workspace, nextVersionNumber);
  await auditWorkspaceEvent(auth, access.projectId, "workspace_version_created", `created booth workspace v${nextVersionNumber}`);

  return loadWorkspace(auth, access.projectId);
}

async function insertVersion(
  auth: AuthContext,
  access: ProjectAccess,
  versionNumber: number,
  title: string,
  workspace: WorkspaceState,
  status: "draft" | "submitted",
) {
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
      ${auth.organization.id}::uuid,
      ${access.designId}::uuid,
      ${access.projectId}::uuid,
      ${versionNumber},
      ${status}::booth_version_status,
      ${title},
      ${JSON.stringify(workspace)}::jsonb,
      ${JSON.stringify(buildAssetSummary(workspace))}::jsonb,
      ${estimateCostCents(workspace)},
      ${auth.user.id}::uuid
    )
  `);
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
      bd.id::text as "designId",
      bd.name as "designName",
      bd.booth_system::text as "boothSystem",
      bd.width_mm as "widthMm",
      bd.depth_mm as "depthMm",
      bd.height_mm as "heightMm",
      bd.current_version_number as "currentVersionNumber"
    from projects p
    join clients c on c.id = p.client_id
    join booth_designs bd on bd.project_id = p.id and bd.deleted_at is null
    where p.id = ${projectId}::uuid
      and p.organization_id = ${auth.organization.id}::uuid
      and p.deleted_at is null
      and (${canSeeAll}::boolean or exists (
        select 1
        from project_members pm
        where pm.project_id = p.id
          and pm.user_id = ${auth.user.id}::uuid
      ))
    order by bd.updated_at desc
    limit 1
  `);

  return rows[0] ?? null;
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

function parseWorkspaceInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { ok: false as const, error: "Request body must be an object" };
  }

  const data = body as Record<string, unknown>;
  const workspace = normalizeWorkspace(data.workspace, null);
  const title = stringValue(data.title) ?? "Workspace draft";

  if (workspace.booth.width < 1 || workspace.booth.width > 100) return { ok: false as const, error: "Width must be between 1 and 100 meters" };
  if (workspace.booth.depth < 1 || workspace.booth.depth > 100) return { ok: false as const, error: "Depth must be between 1 and 100 meters" };
  if (workspace.booth.height < 1.5 || workspace.booth.height > 12) return { ok: false as const, error: "Height must be between 1.5 and 12 meters" };

  return { ok: true as const, value: { workspace, title } };
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
    },
    themeIdx: integerValue(data.themeIdx, 0, 0, 3),
    carpetIdx: integerValue(data.carpetIdx, 0, 0, 5),
    placedItems: Array.isArray(data.placedItems) ? data.placedItems.map(normalizePlacedItem).filter(Boolean) as WorkspacePlacedItem[] : [],
    notes: Array.isArray(data.notes) ? data.notes.map(normalizeNote).filter(Boolean) as WorkspaceNote[] : [],
  };
}

function normalizePlacedItem(value: unknown): WorkspacePlacedItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = stringValue(item.id);
  const catalogId = stringValue(item.catalogId);
  const name = stringValue(item.name);
  const sku = stringValue(item.sku);
  if (!id || !catalogId || !name || !sku) return null;

  return {
    id,
    catalogId,
    name,
    sku,
    qty: Math.max(1, Math.min(999, integerValue(item.qty, 1, 1, 999))),
    w: numberValue(item.w) ?? 1,
    d: numberValue(item.d) ?? 1,
    h: numberValue(item.h) ?? 1,
    color: stringValue(item.color) ?? "#888888",
    weight: numberValue(item.weight) ?? 0,
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
  designId: string;
  designName: string;
  boothSystem: "octanorm" | "maxima" | "custom";
  widthMm: number;
  depthMm: number;
  heightMm: number;
  currentVersionNumber: number;
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
  };
  themeIdx: number;
  carpetIdx: number;
  placedItems: WorkspacePlacedItem[];
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
}

interface WorkspaceNote {
  id: string;
  text: string;
  color: string;
  createdAt: string;
}

export default router;
