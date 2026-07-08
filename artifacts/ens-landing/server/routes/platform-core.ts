import { Router, type Request } from "express";
import { z } from "zod";
import { authenticatedUserFromRequest, createInvitedUser } from "./auth.js";
import { readJsonStore, writeJsonStore } from "../storage.js";
import { sendInvitationEmail, sendResendInvitationEmail } from "../email.js";
import { configReadiness, resendConfigured } from "../config-readiness.js";
import { saveWorkspaceAsset } from "../workspace-assets.js";

interface Project {
  id: string;
  name: string;
  client: string;
  pm: string;
  managerId?: string | null;
  status: string;
  health: string;
  progress: number;
  deadline: string | null;
  system: string;
  dimensions: string;
  exhibition: string;
  standType: string;
  description: string;
  pipelineStage?: string | null;
  lifecycleHistory?: unknown[];
  lastUpdate: string;
}

interface Client {
  id: string;
  name: string;
  company: string;
  contactName: string;
  contactEmail: string;
  projectId?: string | null;
  pm: string;
  managerId?: string | null;
  exhibition: string;
  boothWidthM?: number | null;
  boothDepthM?: number | null;
  preferredSystem?: string;
  venueCity?: string;
  targetDate?: string;
  intakeNotes?: string;
  status: string;
  lastActivity: string;
}

type ActorRole = "chief" | "pm" | "client" | "anonymous";

interface CoreStore {
  projects: Project[];
  clients: Client[];
  activity: Array<{ id: string; type: string; user: string; action: string; project: string; time: string }>;
  exhibitions?: Exhibition[];
  workspaces?: Record<string, StoredProjectWorkspace>;
  managerOverrides?: Record<string, { status?: string; rating?: number }>;
  invitations?: ManagerInvitation[];
  notifications?: Record<string, PlatformNotification[]>;
  calendarEvents?: CalendarEvent[];
  tasks?: PmTask[];
  requests?: PmRequestItem[];
}

interface Exhibition {
  id: string;
  name: string;
  venue?: string;
  city?: string;
  startDate?: string | null;
  endDate?: string | null;
  status: "Draft" | "Active" | "Closed";
  createdAt: string;
  agency?: string;
}

interface ManagerInvitation {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  emailStatus?: "pending" | "sent" | "failed";
  emailWarning?: string | null;
  token?: string;
  inviteUrl?: string;
  expiresAt: string;
  createdAt: string;
}

interface StoredWorkspaceVersion {
  id: string;
  versionNumber: number;
  status: "draft" | "submitted" | "viewed" | "approved" | "revision_requested" | "locked";
  title: string;
  snapshotUrl: string | null;
  assetSummary: Record<string, unknown>;
  costEstimateCents: number;
  submittedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  workspace: unknown;
}

interface StoredWorkspaceComment {
  id: string;
  user: string;
  initials: string;
  text: string;
  type: "comment" | "change" | "pin";
  pin?: { x: number; y: number; z?: number } | null;
  status: "open" | "resolved";
  resolvedAt: string | null;
  createdAt: string;
}

interface StoredProjectWorkspace {
  designId: string;
  designName: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  currentVersionId: string;
  versions: StoredWorkspaceVersion[];
  revisionCount: number;
  revisionLimit: number;
  elementStatus: Record<string, "approved" | "pending" | "rejected">;
  approved: boolean;
  comments: StoredWorkspaceComment[];
}

interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  read: boolean;
  createdAt: string;
  time: string;
}

interface CalendarEvent {
  id: string;
  name: string;
  client: string;
  pm: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  standType: string;
  agency?: string;
}

type PmTaskColumn = "todo" | "in_progress" | "blocked" | "done";
type PmTaskPriority = "High" | "Medium" | "Low";
type PmRequestStatus = "Pending" | "In Progress" | "Resolved" | "Declined";
type PmRequestPriority = "High" | "Medium" | "Low";

const PM_ACTIVE_PROJECT_CAPACITY = 3;
const PM_CLIENT_CAPACITY = 8;
const PM_OVERLOAD_THRESHOLD = 85;

interface PmTask {
  id: string;
  title: string;
  client: string;
  project: string;
  projectId: string | null;
  priority: PmTaskPriority;
  deadline: string;
  col: PmTaskColumn;
  notes?: string;
}

interface PmRequestComment {
  id: string;
  text: string;
  author: string;
  isMe: boolean;
  time: string;
}

interface PmRequestHistoryItem {
  id: string;
  type: string;
  message: string;
  actor: string;
  isMe: boolean;
  createdAt: string;
  time: string;
}

interface PmRequestItem {
  id: string;
  client: string;
  project: string;
  request: string;
  timestamp: string;
  status: PmRequestStatus;
  priority: PmRequestPriority;
  history?: PmRequestHistoryItem[];
  comments: PmRequestComment[];
}

const router = Router();
const STORE_KEY = "core";

const emptyStore: CoreStore = {
  projects: [],
  clients: [],
  activity: [],
  exhibitions: [],
  workspaces: {},
  managerOverrides: {},
  invitations: [],
  notifications: {},
  calendarEvents: [],
  tasks: [],
  requests: [],
};

const seedStore: CoreStore = {
  projects: [
    {
      id: "p1",
      name: "TechCon 2024 - Global Exhibit",
      client: "TechCorp Industries",
      pm: "Project Manager",
      status: "Active",
      health: "On Track",
      progress: 75,
      deadline: "2026-08-15",
      system: "Maxima",
      dimensions: "10 x 10 m",
      exhibition: "TechCon 2024",
      standType: "Maxima",
      description: "Premium modular stand with client graphics and lighting.",
      pipelineStage: "design",
      lifecycleHistory: [],
      lastUpdate: "2 hours ago",
    },
    {
      id: "p2",
      name: "HealthExpo Booth",
      client: "MediLife",
      pm: "Project Manager",
      status: "Client Review",
      health: "On Track",
      progress: 58,
      deadline: "2026-07-20",
      system: "Octanorm",
      dimensions: "6 x 3 m",
      exhibition: "HealthExpo",
      standType: "Octanorm",
      description: "Standard modular booth with custom graphics.",
      pipelineStage: "review",
      lifecycleHistory: [],
      lastUpdate: "1 day ago",
    },
    {
      id: "p3",
      name: "AutoShow Premium Stand",
      client: "FastCars Co",
      pm: "Unassigned",
      status: "Delayed",
      health: "At Risk",
      progress: 24,
      deadline: "2026-07-01",
      system: "Maxima",
      dimensions: "12 x 8 m",
      exhibition: "AutoShow",
      standType: "Maxima",
      description: "Large vehicle display stand awaiting manager assignment.",
      pipelineStage: "brief",
      lifecycleHistory: [],
      lastUpdate: "3 days ago",
    },
  ],
  clients: [
    { id: "c1", name: "TechCorp Industries", company: "TechCorp Industries", contactName: "Client Reviewer", contactEmail: "demo.client@example.com", projectId: "p1", pm: "Project Manager", exhibition: "TechCon 2024", status: "Active", lastActivity: "2 hours ago" },
    { id: "c2", name: "MediLife", company: "MediLife", contactName: "MediLife Reviewer", contactEmail: "medilife@example.com", projectId: "p2", pm: "Project Manager", exhibition: "HealthExpo", status: "Active", lastActivity: "1 day ago" },
    { id: "c3", name: "FastCars Co", company: "FastCars Co", contactName: "FastCars Reviewer", contactEmail: "fastcars@example.com", projectId: "p3", pm: "Unassigned", exhibition: "AutoShow", status: "Pending", lastActivity: "3 days ago" },
  ],
  activity: [
    { id: "a1", type: "message", user: "Client Reviewer", action: "sent a message", project: "TechCon 2024", time: "Just now" },
    { id: "a2", type: "update", user: "Project Manager", action: "updated workspace", project: "TechCon 2024", time: "2 hours ago" },
    { id: "a3", type: "alert", user: "System", action: "flagged delayed project", project: "AutoShow", time: "3 days ago" },
  ],
};

const DEFAULT_ELEMENT_STATUS: Record<string, "approved" | "pending" | "rejected"> = {
  structure: "pending",
  furniture: "pending",
  branding: "pending",
  lighting: "pending",
};

const boundedNumber = (min: number, max: number) => z.number().finite().min(min).max(max);
const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const dataImageSchema = z.string().regex(/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i).max(2_500_000);
const uploadDataImageSchema = z.string().regex(/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i).max(6_800_000);
const workspaceImageUrlSchema = z.union([
  dataImageSchema,
  z.string().trim().regex(/^\/workspace-assets\/[a-z0-9%._/-]+$/i).max(1000),
]);
const workspaceBoothSchema = z.object({
  width: boundedNumber(1, 30),
  depth: boundedNumber(1, 20),
  height: boundedNumber(2, 6),
  system: z.enum(["octanorm", "maxima"]),
  companyName: z.string().trim().max(120),
  openFront: z.boolean(),
  openBack: z.boolean(),
  openLeft: z.boolean(),
  openRight: z.boolean(),
  fasciaEnabled: z.boolean().optional(),
  fasciaOption: z.enum(["classic", "full", "custom"]).optional(),
}).passthrough();
const workspacePlacedItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  catalogId: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(240),
  sku: z.string().trim().max(120).default(""),
  qty: z.number().int().min(1).max(99),
  w: boundedNumber(0.01, 20),
  d: boundedNumber(0.01, 20),
  h: boundedNumber(0.01, 10),
  color: z.string().trim().max(80),
  weight: boundedNumber(0, 10000),
  x: boundedNumber(-50, 50).optional(),
  z: boundedNumber(-50, 50).optional(),
  rotation: boundedNumber(-360, 360).optional(),
  rotationX: boundedNumber(-360, 360).optional(),
  rotationY: boundedNumber(-360, 360).optional(),
  rotationZ: boundedNumber(-360, 360).optional(),
  kind: z.enum(["furniture", "light", "structure", "fascia", "asset"]).optional(),
  shape: z.string().trim().max(80).optional(),
  modelUrl: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(120).optional(),
}).passthrough();
const workspaceRoomSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  width: boundedNumber(0.2, 20),
  depth: boundedNumber(0.2, 20),
  height: boundedNumber(1, 6),
  x: boundedNumber(-50, 50),
  z: boundedNumber(-50, 50),
  hasDoor: z.boolean(),
  hasCeiling: z.boolean(),
  doorPosition: z.enum(["left", "center", "right"]),
  doorSwing: z.enum(["left-in", "right-in", "left-out", "right-out"]),
  doorOpen: z.boolean(),
}).passthrough();
const workspaceNoteSchema = z.object({
  id: z.string().trim().min(1).max(120),
  text: z.string().trim().max(1000),
  color: z.string().trim().max(80),
  createdAt: z.string().trim().max(80),
}).passthrough();
const panelOverrideSchema = z.object({
  color: hexColorSchema.optional(),
  brandText: z.string().trim().max(120).optional(),
  brandColor: hexColorSchema.optional(),
  designImageUrl: workspaceImageUrlSchema.optional(),
  opacity: boundedNumber(0, 1).optional(),
}).passthrough();
const workspaceStateSchema = z.object({
  booth: workspaceBoothSchema,
  themeIdx: z.number().int().min(0).max(50),
  wallFinishIdx: z.number().int().min(0).max(50).optional(),
  frameFinishIdx: z.number().int().min(0).max(50).optional(),
  fasciaFinishIdx: z.number().int().min(0).max(50).optional(),
  carpetIdx: z.number().int().min(0).max(50),
  lightingPreset: z.enum(["neutral", "exhibition", "accent", "spotlight", "ambient"]).optional(),
  placedItems: z.array(workspacePlacedItemSchema).max(500),
  rooms: z.array(workspaceRoomSchema).max(100).optional(),
  notes: z.array(workspaceNoteSchema).max(200),
  panelOverrides: z.record(z.string(), panelOverrideSchema).optional(),
  frontSupportPositions: z.array(boundedNumber(0, 30)).max(50).optional(),
}).passthrough();
const workspacePayloadSchema = z.object({
  workspace: workspaceStateSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
});
const workspaceVersionPayloadSchema = workspacePayloadSchema.extend({
  status: z.enum(["draft", "submitted"]).optional(),
});
const workspaceAssetPayloadSchema = z.object({
  dataUrl: uploadDataImageSchema,
  name: z.string().trim().max(240).optional(),
  purpose: z.enum(["panel", "room", "fascia", "logo", "snapshot", "workspace"]).default("workspace"),
});
const changeRequestPayloadSchema = z.object({
  changeText: z.string().trim().min(1).max(4000),
});
const workspaceCommentPayloadSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  type: z.enum(["comment", "change", "pin"]).optional(),
  pin: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  }).nullable().optional(),
});
const commentStatusPayloadSchema = z.object({
  status: z.enum(["open", "resolved"]),
});
const elementStatusPayloadSchema = z.object({
  elementStatus: z.record(z.string(), z.enum(["approved", "pending", "rejected"])),
});
const managerAssignmentsPayloadSchema = z.object({
  clientAssignments: z.array(z.object({
    clientId: z.string().trim().min(1),
    managerId: z.string().trim().min(1).nullable(),
  })).default([]),
  projectAssignments: z.array(z.object({
    projectId: z.string().trim().min(1),
    managerId: z.string().trim().min(1).nullable(),
  })).default([]),
  cascadeClientProjects: z.boolean().default(false),
});
const managerInvitationPayloadSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254),
});
const inviteAcceptPayloadSchema = z.object({
  token: z.string().trim().min(1),
  name: z.string().trim().max(120).optional(),
  password: z.string().min(8).optional(),
});
const managerStatusPayloadSchema = z.object({
  status: z.enum(["active", "suspended"]),
});
const managerRatingPayloadSchema = z.object({
  rating: z.number().min(1).max(5),
});
const managerReminderPayloadSchema = z.object({
  itemCount: z.number().int().min(0).optional(),
  delayedCount: z.number().int().min(0).optional(),
  urgentCount: z.number().int().min(0).optional(),
});
const exhibitionPayloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  venue: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
  startDate: z.string().trim().max(40).nullable().optional(),
  endDate: z.string().trim().max(40).nullable().optional(),
  status: z.enum(["Draft", "Active", "Closed"]).optional(),
});
const projectCreatePayloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  client: z.string().trim().max(160).optional(),
  clientId: z.string().trim().max(160).nullable().optional(),
  system: z.string().trim().min(1).max(120),
  widthM: z.number().finite().min(1).max(50),
  depthM: z.number().finite().min(1).max(50),
  deadline: z.string().trim().max(40).nullable().optional(),
  exhibition: z.string().trim().max(160).optional(),
  managerId: z.string().trim().min(1).nullable().optional(),
});
const projectUpdatePayloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  client: z.string().trim().min(1).max(160),
  managerId: z.string().trim().min(1).nullable().optional(),
  deadline: z.string().trim().max(40).nullable().optional(),
  system: z.string().trim().min(1).max(120),
  widthM: z.number().finite().min(1).max(50),
  depthM: z.number().finite().min(1).max(50),
  exhibition: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
});
const projectStagePayloadSchema = z.object({
  stage: z.string().trim().min(1).max(80),
});
const clientPayloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  company: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(254),
  exhibition: z.string().trim().max(160).optional(),
  boothWidthM: z.number().finite().min(1).max(50).nullable().optional(),
  boothDepthM: z.number().finite().min(1).max(50).nullable().optional(),
  preferredSystem: z.string().trim().max(120).optional(),
  venueCity: z.string().trim().max(120).optional(),
  targetDate: z.string().trim().max(40).nullable().optional(),
  intakeNotes: z.string().trim().max(2000).optional(),
});
const clientAccessPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(2).max(120).optional(),
});
const clientStatusPayloadSchema = z.object({
  status: z.string().trim().min(1).max(80),
});
const taskPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).nullable(),
  priority: z.enum(["High", "Medium", "Low"]),
  deadline: z.string().trim().max(40),
  status: z.enum(["todo", "in_progress", "blocked", "done"]),
  notes: z.string().trim().max(2000).optional(),
});
const taskUpdatePayloadSchema = taskPayloadSchema.partial();
const requestStatusPayloadSchema = z.object({
  status: z.enum(["Pending", "In Progress", "Resolved", "Declined"]),
});
const requestReplyPayloadSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
const subscriptionPayloadSchema = z.object({
  plan: z.string().trim().min(1).max(80),
});
const notificationIdParamSchema = z.string().trim().min(1).max(160);
const reportExportPayloadSchema = z.object({
  report: z.string().trim().min(1).max(120),
  range: z.string().trim().max(40).optional(),
  format: z.string().trim().min(1).max(20),
});
const chiefReportRangeSchema = z.enum(["3M", "6M", "12M"]).default("6M");
const pmReportPeriodSchema = z.enum(["this_week", "last_week", "this_month", "last_month", "this_quarter"]).default("this_month");
const calendarEventPayloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  client: z.string().trim().min(1).max(160),
  pm: z.string().trim().min(1).max(160),
  status: z.string().trim().min(1).max(80),
  startDate: z.string().trim().min(1).max(40),
  endDate: z.string().trim().min(1).max(40),
  location: z.string().trim().min(1).max(160),
  standType: z.string().trim().min(1).max(120),
});

async function readStore(): Promise<CoreStore> {
  const defaultStore = process.env.ENABLE_DEMO_SEED === "true" ? seedStore : emptyStore;
  const store = await readJsonStore<CoreStore>(STORE_KEY, defaultStore);
  store.projects ??= [];
  store.clients ??= [];
  store.activity ??= [];
  store.exhibitions ??= [];
  store.workspaces ??= {};
  store.managerOverrides ??= {};
  store.invitations ??= [];
  store.notifications ??= {};
  store.calendarEvents ??= [];
  store.tasks ??= [];
  store.requests ??= [];
  store.clients = (store.clients ?? []).map((client) => {
    const hasAssignedPm = Boolean(client.pm && client.pm !== "Unassigned");
    const hasLinkedProject = Boolean(client.projectId);
    if (client.status === "Pending" && (hasAssignedPm || hasLinkedProject)) {
      return { ...client, status: "Active" };
    }
    return client;
  });
  return store;
}

async function writeStore(store: CoreStore) {
  await writeJsonStore(STORE_KEY, store);
}

function nowIso() {
  return new Date().toISOString();
}

function projectHasAssignedManager(project: Pick<Project, "pm" | "managerId">) {
  return Boolean(project.managerId || (project.pm && project.pm !== "Unassigned"));
}

function advanceProjectAfterAssignment(project: Project) {
  if (!projectHasAssignedManager(project)) return;
  project.progress = Math.max(project.progress || 0, 20);
  if (project.status === "Pending" || project.status === "Planning") {
    project.status = "In Design";
    project.pipelineStage = "design";
    project.lastUpdate = "Just now";
  }
}

function badRequest(res: { status(code: number): { json(body: unknown): unknown } }, error: z.ZodError) {
  return res.status(400).json({
    error: "Invalid request body.",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function validateBody<T>(schema: z.ZodType<T>, body: unknown) {
  return schema.safeParse(body);
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseDimensions(project: Project) {
  const match = project.dimensions.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  const widthM = match ? Number(match[1]) : 6;
  const depthM = match ? Number(match[2]) : 3;
  return {
    widthMm: Math.round(widthM * 1000),
    depthMm: Math.round(depthM * 1000),
    heightMm: 3000,
  };
}

function defaultWorkspace(project: Project) {
  const dims = parseDimensions(project);
  return {
    booth: {
      width: dims.widthMm / 1000,
      depth: dims.depthMm / 1000,
      height: dims.heightMm / 1000,
      system: project.system.toLowerCase().includes("maxima") ? "maxima" : "octanorm",
      companyName: project.client,
      openFront: true,
      openBack: false,
      openLeft: false,
      openRight: false,
      fasciaEnabled: true,
      fasciaOption: "classic",
    },
    themeIdx: 0,
    wallFinishIdx: 0,
    frameFinishIdx: 0,
    fasciaFinishIdx: 0,
    carpetIdx: 0,
    lightingPreset: "exhibition",
    placedItems: [],
    rooms: [],
    notes: [],
    panelOverrides: {},
    frontSupportPositions: [],
  };
}

function ensureWorkspace(store: CoreStore, project: Project): StoredProjectWorkspace {
  store.workspaces ??= {};
  const existing = store.workspaces[project.id];
  if (existing) return existing;

  const dims = parseDimensions(project);
  const createdAt = nowIso();
  const version: StoredWorkspaceVersion = {
    id: `${project.id}-v1`,
    versionNumber: 1,
    status: project.status === "Client Review" ? "submitted" : "draft",
    title: project.status === "Client Review" ? "Submitted design" : "Initial draft",
    snapshotUrl: null,
    assetSummary: {},
    costEstimateCents: 0,
    submittedAt: project.status === "Client Review" ? createdAt : null,
    lockedAt: null,
    createdAt,
    workspace: defaultWorkspace(project),
  };

  const workspace: StoredProjectWorkspace = {
    designId: `${project.id}-design`,
    designName: `${project.name} Design`,
    widthMm: dims.widthMm,
    depthMm: dims.depthMm,
    heightMm: dims.heightMm,
    currentVersionId: version.id,
    versions: [version],
    revisionCount: 0,
    revisionLimit: 2,
    elementStatus: { ...DEFAULT_ELEMENT_STATUS },
    approved: false,
    comments: [],
  };
  store.workspaces[project.id] = workspace;
  return workspace;
}

function currentVersion(workspace: StoredProjectWorkspace): StoredWorkspaceVersion | undefined {
  return workspace.versions.find((version) => version.id === workspace.currentVersionId) ?? workspace.versions[workspace.versions.length - 1];
}

function projectWorkspaceResponse(project: Project, workspace: StoredProjectWorkspace) {
  const current = currentVersion(workspace);
  return {
    project: {
      id: project.id,
      name: project.name,
      client: project.client,
      exhibition: project.exhibition,
      status: project.status,
      health: project.health,
    },
    design: {
      id: workspace.designId,
      name: workspace.designName,
      system: project.system,
      widthMm: workspace.widthMm,
      depthMm: workspace.depthMm,
      heightMm: workspace.heightMm,
      currentVersionNumber: current?.versionNumber ?? 1,
    },
    currentVersion: current ? { ...current, workspace: undefined } : null,
    versions: workspace.versions,
    workspace: current?.workspace ?? defaultWorkspace(project),
    readonly: current?.status === "approved" || current?.status === "locked",
    revisionCount: workspace.revisionCount,
    revisionLimit: workspace.revisionLimit,
    elementStatus: workspace.elementStatus,
    approved: workspace.approved,
    permissions: {
      can_edit: current?.status !== "approved" && current?.status !== "locked",
      can_save: current?.status !== "approved" && current?.status !== "locked",
      can_send_arrangement: current?.status === "draft" || current?.status === "revision_requested",
      arrangement_round_limit: workspace.revisionLimit,
      arrangement_rounds_used: workspace.revisionCount,
      arrangement_rounds_remaining: Math.max(0, workspace.revisionLimit - workspace.revisionCount),
      total_round_limit: workspace.revisionLimit,
      subscription_active: false,
      subscription_unlimited: false,
      subscription_status: "inactive",
      subscription_pending: false,
      subscription_required: workspace.revisionCount >= workspace.revisionLimit,
      subscription_plan: null,
      subscription_plan_label: null,
      subscription_price: 0,
      subscription_currency: "USD",
      edit_disabled_reason: current?.status === "approved" || current?.status === "locked" ? "Approved workspaces are locked for client review." : null,
    },
  };
}

function formatComment(comment: StoredWorkspaceComment) {
  return {
    ...comment,
    time: timeAgo(comment.createdAt),
  };
}

function activityId() {
  return `a-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

function addActivity(store: CoreStore, type: string, user: string, action: string, project: Project) {
  store.activity = [
    { id: activityId(), type, user, action, project: project.exhibition || project.name, time: "Just now" },
    ...store.activity,
  ].slice(0, 100);
}

function notificationKey(actor: { id: string; email: string; role: ActorRole }) {
  return actor.id || actor.email || `dev-${actor.role}`;
}

function notificationResponse(notifications: PlatformNotification[]) {
  const normalized = notifications.map((notification) => ({
    ...notification,
    read: Boolean(notification.readAt),
    time: timeAgo(notification.createdAt),
  }));
  return {
    unread: normalized.filter((notification) => !notification.readAt).length,
    notifications: normalized,
  };
}

function ensureNotifications(store: CoreStore, actor: { id: string; email: string; role: ActorRole }) {
  store.notifications ??= {};
  const key = notificationKey(actor);
  if (!store.notifications[key]) {
    store.notifications[key] = defaultNotificationsForActor(store, actor);
  }
  return store.notifications[key];
}

function defaultNotificationsForActor(store: CoreStore, actor: { role: ActorRole }): PlatformNotification[] {
  const delayed = store.projects.find((project) => statusParam(project.status) === "delayed" || project.health.toLowerCase().includes("risk"));
  const review = store.projects.find((project) => project.status === "Client Review" || project.status === "Revision");
  const now = nowIso();
  const notifications: PlatformNotification[] = [];
  if (actor.role === "chief" && delayed) {
    notifications.push({
      id: `notification-${Date.now()}-chief-delay`,
      title: "Project needs attention",
      body: `${delayed.name} is currently ${delayed.health.toLowerCase()}.`,
      href: "/chief/workspaces",
      readAt: null,
      read: false,
      createdAt: now,
      time: "Just now",
    });
  }
  if (actor.role === "pm" && review) {
    notifications.push({
      id: `notification-${Date.now()}-pm-review`,
      title: "Client review pending",
      body: `${review.name} is waiting in ${review.status}.`,
      href: "/pm/workspace",
      readAt: null,
      read: false,
      createdAt: now,
      time: "Just now",
    });
  }
  if (actor.role === "client") {
    notifications.push({
      id: `notification-${Date.now()}-client-approval`,
      title: "Workspace is ready",
      body: "Open your assigned booth workspace to review the latest design.",
      href: "/client/approvals",
      readAt: null,
      read: false,
      createdAt: now,
      time: "Just now",
    });
  }
  return notifications;
}

function pushNotification(
  store: CoreStore,
  actor: { id: string; email: string; role: ActorRole },
  notification: Omit<PlatformNotification, "id" | "readAt" | "read" | "createdAt" | "time">,
) {
  const current = ensureNotifications(store, actor);
  current.unshift({
    id: `notification-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    ...notification,
    readAt: null,
    read: false,
    createdAt: nowIso(),
    time: "Just now",
  });
  store.notifications![notificationKey(actor)] = current.slice(0, 100);
}

async function pushNotificationToAccount(
  store: CoreStore,
  emailOrId: string | null | undefined,
  role: ActorRole,
  notification: Omit<PlatformNotification, "id" | "readAt" | "read" | "createdAt" | "time">,
) {
  if (!emailOrId || emailOrId === "Unassigned") return false;
  const lookup = emailOrId.toLowerCase();
  const authStore = await readJsonStore<{ users: Array<{ id: string; email: string; role: ActorRole }> }>("auth", { users: [] });
  const user = authStore.users.find((item) => (
    item.id === emailOrId ||
    String(item.email || "").toLowerCase() === lookup
  ));
  if (!user) return false;
  pushNotification(store, { id: user.id, email: user.email, role }, notification);
  return true;
}

async function markWorkspaceViewedByClient(store: CoreStore, actor: { role: ActorRole; name: string }, project: Project, workspace: StoredProjectWorkspace) {
  const current = currentVersion(workspace);
  if (actor.role !== "client" || current.status !== "submitted") return false;
  current.status = "viewed";
  project.lastUpdate = "Just now";
  addActivity(store, "approval", actor.name, "viewed workspace", project);
  await pushNotificationToAccount(store, project.managerId ?? project.pm, "pm", {
    title: "Client viewed workspace",
    body: `${project.client} opened the latest design for ${project.name}.`,
    href: `/pm/workspace?projectId=${encodeURIComponent(project.id)}`,
  });
  return true;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}
function normalizeRole(value: string | undefined, fallbackRole: ActorRole): ActorRole {
  return value === "chief" || value === "pm" || value === "client" ? value : fallbackRole;
}

async function actorFromReq(req: Request, fallbackRole: ActorRole = "pm") {
  const sessionUser = await authenticatedUserFromRequest(req);
  if (sessionUser) {
    return {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      company: sessionUser.company || "ENS Demo Agency",
      initials: initialsFromName(sessionUser.name),
    };
  }
  const demoAccessEnabled = process.env.ENABLE_DEMO_ACCESS === "true" || process.env.VITE_ENABLE_DEMO_ACCESS === "true";
  if (process.env.NODE_ENV === "production" || !demoAccessEnabled) {
    return {
      id: "anonymous",
      name: "Unauthenticated",
      email: "",
      role: "anonymous" as ActorRole,
      company: "",
      initials: "U",
    };
  }
  const role = normalizeRole(req.header("x-user-role"), fallbackRole);
  const fallbackName = role === "client" ? "Client Reviewer" : role === "chief" ? "Chief Manager" : "Project Manager";
  const encodedName = req.header("x-user-name") || "";
  let name = fallbackName;
  try {
    name = encodedName ? decodeURIComponent(encodedName) : fallbackName;
  } catch {
    name = encodedName || fallbackName;
  }
  return {
    id: req.header("x-user-id") || `dev-${role}`,
    name,
    email: req.header("x-user-email") || "",
    role,
    company: req.header("x-user-company") || "ENS Demo Agency",
    initials: initialsFromName(name),
  };
}

function requireRole(
  res: { status(code: number): { json(body: unknown): unknown } },
  actor: { role: ActorRole },
  allowedRoles: ActorRole[],
) {
  if (actor.role === "anonymous") {
    res.status(401).json({
      error: "Unauthorized.",
      message: "Authentication is required.",
    });
    return false;
  }
  if (allowedRoles.includes(actor.role)) return true;
  res.status(403).json({
    error: "Forbidden.",
    message: `This action requires one of these roles: ${allowedRoles.join(", ")}.`,
  });
  return false;
}

function clientForProject(store: CoreStore, project: Project) {
  return store.clients.find((client) => client.projectId === project.id)
    ?? store.clients.find((client) => client.name === project.client || client.company === project.client)
    ?? null;
}

function isAssignedPm(actor: { role: ActorRole; name?: string; email?: string; id?: string }, managerName: string | null | undefined) {
  if (actor.role !== "pm") return false;
  const assignedName = String(managerName || "").trim();
  if (!assignedName || assignedName === "Unassigned") return false;
  return assignedName.toLowerCase() === String(actor.name || "").trim().toLowerCase()
    || managerIdFromName(assignedName) === actor.id;
}

function canAccessProject(store: CoreStore, actor: { role: ActorRole; email: string; id: string; name?: string; company?: string }, project: Project) {
  if (actor.role === "anonymous") return false;
  if (actor.role === "chief") return true;
  if (actor.role === "pm") {
    const actorCompany = actor.company || "ENS Demo Agency";
    const projectAgency = (project as any).agency || "ENS Demo Agency";
    if (actorCompany.trim().toLowerCase() !== projectAgency.trim().toLowerCase()) return false;
    return isAssignedPm(actor, project.pm);
  }
  const client = clientForProject(store, project);
  if (!client) return false;
  const actorEmail = actor.email.trim().toLowerCase();
  return Boolean(actorEmail) && client.contactEmail.trim().toLowerCase() === actorEmail;
}

function visibleProjectsForActor(store: CoreStore, actor: { role: ActorRole; email: string; id: string; name?: string; company?: string }) {
  if (actor.role === "anonymous") return [];
  if (actor.role === "client") {
    return store.projects.filter((project) => canAccessProject(store, actor, project));
  }

  const actorCompany = actor.company || "ENS Demo Agency";
  const companyProjects = store.projects.filter((project) => {
    const projectAgency = (project as any).agency || "ENS Demo Agency";
    return projectAgency.trim().toLowerCase() === actorCompany.trim().toLowerCase();
  });
  return actor.role === "chief"
    ? companyProjects
    : companyProjects.filter((project) => canAccessProject(store, actor, project));
}

function requireProjectAccess(
  res: { status(code: number): { json(body: unknown): unknown } },
  store: CoreStore,
  actor: { role: ActorRole; email: string; id: string },
  project: Project,
) {
  if (actor.role === "anonymous") {
    res.status(401).json({
      error: "Unauthorized.",
      message: "Authentication is required.",
    });
    return false;
  }
  if (canAccessProject(store, actor, project)) return true;
  res.status(403).json({
    error: "Forbidden.",
    message: "This account is not assigned to this project.",
  });
  return false;
}

function managerIdFromName(name: string) {
  if (!name || name === "Unassigned") return null;
  return `pm-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "manager"}`;
}

async function managerNameFromId(managerId: string | null | undefined) {
  if (!managerId || managerId === "Unassigned") return "Unassigned";
  const authStore = await readJsonStore<{ users: any[] }>("auth", { users: [], sessions: [], loginAttempts: [] });
  const user = authStore.users.find((u) => u.id === managerId);
  if (user) return user.name;
  
  if (managerId.startsWith("pm-")) {
    const rawName = managerId.slice(3).replace(/-/g, " ");
    return rawName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return "Unassigned";
}

function projectManagerName(project: Project) {
  return project.pm && project.pm !== "Unassigned" ? project.pm : "Unassigned";
}

function monthLabels(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - count + index + 1);
    return date.toLocaleString("en-US", { month: "short" });
  });
}

function scopedStoreForActor(store: CoreStore, actor: { role: ActorRole; email: string; id: string; name?: string; company?: string }): CoreStore {
  const projects = visibleProjectsForActor(store, actor);
  const actorCompany = actor.company || "ENS Demo Agency";
  const clients = store.clients.filter((client) => matchesCompany(client, actorCompany));
  return { ...store, projects, clients };
}

function chiefReport(store: CoreStore, range: "3M" | "6M" | "12M") {
  const months = range === "3M" ? 3 : range === "12M" ? 12 : 6;
  const projects = store.projects;
  const labels = monthLabels(months);
  const revenueData = labels.map((month, index) => {
    const isCurrentMonth = index === labels.length - 1;
    return {
      month,
      revenue: 0,
      target: 0,
      projects: isCurrentMonth ? projects.length : 0,
    };
  });
  const pmNames = Array.from(new Set(projects.map((project) => projectManagerName(project))));
  const pmPerformance = pmNames.map((name) => {
    const pmProjects = projects.filter((project) => projectManagerName(project) === name);
    const delayed = pmProjects.filter((project) => statusParam(project.status) === "delayed" || project.health.toLowerCase().includes("risk")).length;
    const onTime = pmProjects.length ? Math.round(((pmProjects.length - delayed) / pmProjects.length) * 100) : 0;
    return {
      name,
      projects: pmProjects.length,
      satisfaction: 0,
      onTime,
      revenue: 0,
    };
  });
  const systems = Array.from(new Set(projects.map((project) => project.system || "Custom")));
  const systemSplit = systems.map((system, index) => ({
    name: system,
    value: Math.round((projects.filter((project) => project.system === system).length / Math.max(1, projects.length)) * 100),
    color: index === 0 ? "#1d4ed8" : index === 1 ? "#c2410c" : "#2f7d3a",
  }));
  const bottlenecks = projects
    .filter((project) => statusParam(project.status) === "delayed" || statusParam(project.status) === "pending")
    .slice(0, 6)
    .map((project) => ({ name: project.name, waitDays: waitDaysFromLastUpdate(project.lastUpdate), stage: project.status }));

  return {
    range,
    revenueData,
    pmPerformance,
    systemSplit,
    bottlenecks,
    monthlyTrend: revenueData.map((item) => ({
      month: item.month,
      revenue: item.revenue,
      projects: item.projects,
      satisfaction: 0,
    })),
  };
}

function waitDaysFromLastUpdate(lastUpdate: string | null | undefined) {
  const match = String(lastUpdate || "").match(/(\d+)\s+day/i);
  if (match) return Number(match[1]) || 0;
  return 0;
}

type PmReportPeriod = "this_week" | "last_week" | "this_month" | "last_month" | "this_quarter";

function pmReport(store: CoreStore, period: PmReportPeriod) {
  const projects = store.projects;
  const active = projects.filter((project) => statusParam(project.status) !== "completed");
  const delayed = projects.filter((project) => statusParam(project.status) === "delayed" || project.health.toLowerCase().includes("risk"));
  const keys = period === "this_week" || period === "last_week"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : period === "this_month" || period === "last_month"
      ? ["W1", "W2", "W3", "W4"]
      : ["Jan", "Feb", "Mar"];
  const completionRate = projects.length
    ? Math.round((projects.filter((project) => statusParam(project.status) === "completed").length / projects.length) * 100)
    : 0;
  const deltaBySeed: Record<PmReportPeriod, number> = {
    this_week: 2.4,
    last_week: -1.1,
    this_month: 5.8,
    last_month: 3.2,
    this_quarter: 8.1,
  };
  return {
    period,
    stats: {
      completionRate,
      completionRateDelta: deltaBySeed[period] ?? 0,
      satisfaction: null,
      satisfactionDelta: null,
      activeClients: clientSummary(store.clients).active,
      activeClientsDelta: 0,
      avgResponseHours: period === "this_week" ? 3.2 : period === "this_month" ? 4.1 : 3.8,
      avgResponseHoursDelta: 0,
    },
    weeklyData: keys.map((key, index) => ({
      key,
      tasks: Math.max(0, projects.length - (index % 3)),
      revisions: (index + 1) % 3,
      approvals: index % 2,
    })),
    projectEfficiency: projects.slice(0, 8).map((project) => ({
      name: project.name,
      efficiency: project.progress,
      onTime: delayed.some((item) => item.id === project.id) ? 0 : 100,
    })),
    revisionTrend: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, index) => ({
      month,
      revisions: index % 4,
      changes: index % 5,
    })),
    statusPie: [
      { key: "active", value: active.length, color: "#2f7d3a" },
      { key: "pending", value: projects.filter((project) => statusParam(project.status) === "pending").length, color: "#d97706" },
      { key: "review", value: projects.filter((project) => project.status === "Client Review" || project.status === "Revision").length, color: "#1d4ed8" },
      { key: "delayed", value: delayed.length, color: "#dc2626" },
    ].filter((item) => item.value > 0),
  };
}

function ensureCalendarEvents(store: CoreStore) {
  if (!store.calendarEvents) {
    store.calendarEvents = store.projects.map((project) => ({
      id: `event-${project.id}`,
      name: project.exhibition || project.name,
      client: project.client,
      pm: projectManagerName(project),
      status: project.status,
      startDate: project.deadline ?? new Date().toISOString().slice(0, 10),
      endDate: project.deadline ?? new Date().toISOString().slice(0, 10),
      location: "Location TBD",
      standType: project.system,
      agency: (project as any).agency || "ENS Demo Agency",
    }));
  }
  return store.calendarEvents;
}

function visibleCalendarEventsForActor(store: CoreStore, actor: { role: ActorRole; name?: string; id?: string; company?: string }) {
  const actorCompany = actor.company || "ENS Demo Agency";
  return ensureCalendarEvents(store).filter((event) => {
    if (!matchesCompany(event, actorCompany)) return false;
    if (actor.role === "chief") return true;
    return isAssignedPm({ role: actor.role, name: actor.name, id: actor.id }, event.pm);
  });
}

function buildManagers(store: CoreStore) {
  const names = Array.from(new Set(store.projects.map(projectManagerName).filter((name) => name !== "Unassigned")));
  const safeNames = names.length > 0 ? names : ["Project Manager"];
  return safeNames.map((name, index) => {
    const projects = store.projects.filter((project) => projectManagerName(project) === name);
    const delayedProjects = projects.filter((project) => statusParam(project.status) === "delayed" || project.health.toLowerCase().includes("risk")).length;
    const urgentProjects = projects.filter((project) => project.deadline && new Date(project.deadline).getTime() - Date.now() < 14 * 86400000).length;
    const activeProjects = projects.filter((project) => statusParam(project.status) === "active").length;
    const pmClients = store.clients.filter((client) => client.pm && client.pm.toLowerCase() === name.toLowerCase()).length;
    const nextDeadline = projects
      .map((project) => project.deadline)
      .filter((deadline): deadline is string => Boolean(deadline))
      .sort()[0] ?? null;
    const id = managerIdFromName(name) ?? `pm-${index + 1}`;
    const overrides = store.managerOverrides?.[id] ?? {};
    return {
      id,
      name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "") || "project.manager"}@example.com`,
      role: "Project Manager",
      status: overrides.status ?? "Active",
      rating: overrides.rating ?? Math.max(3.8, Math.round((4.8 - delayedProjects * 0.35) * 10) / 10),
      avatarUrl: "",
      avatarTone: ["blue", "violet", "emerald", "amber"][index % 4],
      workload: Math.min(100, activeProjects * 28 + urgentProjects * 12 + delayedProjects * 18),
      activeProjects,
      delayedProjects,
      urgentProjects,
      clients: pmClients,
      nextDeadline,
      joinedAt: "2026-01-15",
    };
  });
}

function buildManagedClients(store: CoreStore) {
  return store.clients.map((client) => ({
    id: client.id,
    name: client.name,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    managerId: managerIdFromName(client.pm),
    managerName: client.pm && client.pm !== "Unassigned" ? client.pm : "Unassigned",
    exhibition: client.exhibition,
    status: client.status,
    lastActivity: client.lastActivity,
  }));
}

function buildManagedProjects(store: CoreStore) {
  return store.projects.map((project) => {
    const client = store.clients.find((item) => item.projectId === project.id || item.name === project.client);
    return {
      id: project.id,
      name: project.name,
      clientId: client?.id ?? project.client.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      client: project.client,
      managerId: managerIdFromName(project.pm),
      managerName: projectManagerName(project),
      exhibition: project.exhibition,
      status: project.status,
      health: project.health,
      progress: project.progress,
      deadline: project.deadline,
      system: project.system,
    };
  });
}

function workspaceMonitorStatus(project: Project): "live" | "pending" | "review" | "blocked" {
  const status = project.status.toLowerCase();
  if (status.includes("delay") || project.health.toLowerCase().includes("risk")) return "blocked";
  if (status.includes("review") || status.includes("revision")) return "review";
  if (status.includes("pending") || project.pm === "Unassigned") return "pending";
  return "live";
}

function workspaceMonitorAction(project: Project, workspace: StoredProjectWorkspace) {
  const current = currentVersion(workspace);
  if (!current) return "Workspace not started";
  if (current.status === "approved") return "Approved for production";
  if (current.status === "revision_requested" || project.status === "Revision") return "Revision requested by client";
  if (current.status === "submitted" || project.status === "Client Review") return "Waiting for client approval";
  if (project.status === "Delayed") return "Blocked, needs chief attention";
  return "Workspace being edited";
}

function minutesFromLastUpdate(project: Project, index: number) {
  const numeric = Number(project.lastUpdate.match(/\d+/)?.[0] ?? 0);
  if (project.lastUpdate.includes("day")) return Math.max(1440, numeric * 1440);
  if (project.lastUpdate.includes("hour")) return Math.max(60, numeric * 60);
  if (project.lastUpdate.includes("min")) return numeric;
  return index * 12;
}

function matchesCompany(record: unknown, companyName: string | null) {
  if (!companyName) return true;
  const agency = (record as { agency?: string }).agency || "ENS Demo Agency";
  return agency.trim().toLowerCase() === companyName.trim().toLowerCase();
}

async function managerWorkspaceResponse(store: CoreStore, actor: { role?: ActorRole; company?: string; name?: string }) {
  const actorCompany = actor.company || "ENS Demo Agency";
  const managers = await buildManagersForCompany(store, actorCompany);
  return {
    managers,
    clients: await buildManagedClientsForCompany(store, actorCompany),
    projects: await buildManagedProjectsForCompany(store, actorCompany),
    audit: actor.role === "chief" ? store.activity : store.activity.filter((item) => {
      const project = store.projects.find((p) => p.name === item.project);
      if (!project) return (item.user === actor.name) || (item.project === "Workspace");
      return matchesCompany(project, actorCompany);
    }),
    invitations: (store.invitations ?? []).filter((inv: any) => {
      if (actor.role === "chief") return true;
      return matchesCompany(inv, actorCompany);
    }),
  };
}

async function buildManagersForCompany(store: CoreStore, companyName: string | null) {
  const authStore = await readJsonStore<{ users: any[] }>("auth", { users: [], sessions: [], loginAttempts: [] });
  const companyPMs = authStore.users.filter((user) => 
    user.role === "pm" && 
    (!companyName || String(user.company || user.agency || "").trim().toLowerCase() === companyName.trim().toLowerCase())
  );
  
  const companyProjects = store.projects.filter((project) => matchesCompany(project, companyName));
  
  const projectPmNames = Array.from(new Set(companyProjects.map(projectManagerName).filter((name) => name !== "Unassigned")));
  const allPMsMap = new Map<string, { id: string; name: string; email: string }>();
  
  for (const pm of companyPMs) {
    allPMsMap.set(pm.name.toLowerCase(), {
      id: pm.id,
      name: pm.name,
      email: pm.email,
    });
  }
  
  for (const name of projectPmNames) {
    if (!allPMsMap.has(name.toLowerCase())) {
      const pmId = managerIdFromName(name) ?? `pm-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      allPMsMap.set(name.toLowerCase(), {
        id: pmId,
        name,
        email: "",
      });
    }
  }

  const companyClients = store.clients.filter((client) => matchesCompany(client, companyName));

  return Array.from(allPMsMap.values()).map((pm, index) => {
    const projects = companyProjects.filter((project) => projectManagerName(project) === pm.name);
    const delayedProjects = projects.filter((project) => statusParam(project.status) === "delayed" || project.health.toLowerCase().includes("risk")).length;
    const urgentProjects = projects.filter((project) => project.deadline && new Date(project.deadline).getTime() - Date.now() < 14 * 86400000).length;
    const activeProjects = projects.filter((project) => statusParam(project.status) === "active").length;
    const clients = companyClients.filter((client) => client.pm.toLowerCase() === pm.name.toLowerCase()).length;
    const nextDeadline = projects
      .map((project) => project.deadline)
      .filter((deadline): deadline is string => Boolean(deadline))
      .sort()[0] ?? null;
    const overrides = store.managerOverrides?.[pm.id] ?? {};
    return {
      id: pm.id,
      name: pm.name,
      email: pm.email,
      role: "Project Manager",
      status: overrides.status ?? "Active",
      rating: overrides.rating ?? Math.max(3.8, Math.round((4.8 - delayedProjects * 0.35) * 10) / 10),
      avatarUrl: "",
      avatarTone: ["blue", "violet", "emerald", "amber"][index % 4],
      workload: Math.min(100, activeProjects * 28 + urgentProjects * 12 + delayedProjects * 18),
      activeProjects,
      delayedProjects,
      urgentProjects,
      clients,
      capacity: {
        activeProjects: PM_ACTIVE_PROJECT_CAPACITY,
        clients: PM_CLIENT_CAPACITY,
        remainingProjects: Math.max(0, PM_ACTIVE_PROJECT_CAPACITY - activeProjects),
        remainingClients: Math.max(0, PM_CLIENT_CAPACITY - clients),
        overloaded: activeProjects >= PM_ACTIVE_PROJECT_CAPACITY || clients >= PM_CLIENT_CAPACITY || Math.min(100, activeProjects * 28 + urgentProjects * 12 + delayedProjects * 18) >= PM_OVERLOAD_THRESHOLD,
      },
      nextDeadline,
      joinedAt: "2026-01-15",
    };
  });
}

async function buildManagedClientsForCompany(store: CoreStore, companyName: string | null) {
  const authStore = await readJsonStore<{ users: any[] }>("auth", { users: [], sessions: [], loginAttempts: [] });
  const companyClients = store.clients.filter((client) => matchesCompany(client, companyName));
  const companyKey = companyName?.trim().toLowerCase() ?? "";
  return companyClients.map((client) => {
    const pmUser = authStore.users.find((u) => {
      if (u.role !== "pm") return false;
      if (u.name.toLowerCase() !== String(client.pm || "").trim().toLowerCase()) return false;
      if (!companyKey) return true;
      return String(u.company || u.agency || "").trim().toLowerCase() === companyKey;
    });
    const managerId = client.managerId ?? (pmUser ? pmUser.id : managerIdFromName(client.pm));
    return {
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      managerId,
      managerName: client.pm && client.pm !== "Unassigned" ? client.pm : "Unassigned",
      exhibition: client.exhibition,
      boothWidthM: client.boothWidthM ?? null,
      boothDepthM: client.boothDepthM ?? null,
      preferredSystem: client.preferredSystem ?? "",
      venueCity: client.venueCity ?? "",
      targetDate: client.targetDate ?? "",
      intakeNotes: client.intakeNotes ?? "",
      status: client.status,
      lastActivity: client.lastActivity,
    };
  });
}

async function buildManagedProjectsForCompany(store: CoreStore, companyName: string | null) {
  const authStore = await readJsonStore<{ users: any[] }>("auth", { users: [], sessions: [], loginAttempts: [] });
  const companyProjects = store.projects.filter((project) => matchesCompany(project, companyName));
  const companyKey = companyName?.trim().toLowerCase() ?? "";
  return companyProjects.map((project, index) => {
    const pmUser = authStore.users.find((u) => {
      if (u.role !== "pm") return false;
      if (u.name.toLowerCase() !== String(project.pm || "").trim().toLowerCase()) return false;
      if (!companyKey) return true;
      return String(u.company || u.agency || "").trim().toLowerCase() === companyKey;
    });
    const managerId = project.managerId ?? (pmUser ? pmUser.id : managerIdFromName(project.pm));
    return {
      id: project.id,
      name: project.name,
      client: project.client,
      exhibition: project.exhibition || "Exhibition TBD",
      system: project.system,
      managerId,
      managerName: project.pm && project.pm !== "Unassigned" ? project.pm : "Unassigned",
      lastActionMins: minutesFromLastUpdate(project, index),
      status: workspaceMonitorStatus(project),
      currentAction: workspaceMonitorAction(project, store.workspaces?.[project.id] ?? {
        designId: `design-${project.id}`,
        designName: `${project.name} design`,
        widthMm: 6000,
        depthMm: 4000,
        heightMm: 2500,
        currentVersionId: `v-${project.id}`,
        versions: [],
        revisionCount: 0,
        revisionLimit: 3,
        elementStatus: {},
        approved: false,
        comments: [],
      }),
    };
  });
}

function statusParam(status: string) {
  const value = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (value.includes("delay")) return "delayed";
  if (value.includes("complete") || value.includes("approved")) return "completed";
  if (value.includes("active") || value.includes("review") || value.includes("design") || value.includes("production")) return "active";
  return "pending";
}

function stageToStatus(stage: string) {
  const normalized = stage.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "closed" || normalized === "complete" || normalized === "completed") return "Completed";
  if (normalized === "review" || normalized === "client_review") return "Client Review";
  if (normalized === "production") return "Production";
  if (normalized === "design" || normalized === "in_design") return "In Design";
  if (normalized === "brief" || normalized === "planning") return "Planning";
  return "Pending";
}

function addProjectLifecycle(project: Project, actor: { id: string; name: string }, nextStage: string, nextStatus: string) {
  const previousStage = project.pipelineStage ?? null;
  const previousStatus = project.status ?? null;
  project.lifecycleHistory = [
    {
      id: `history-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      fromStage: previousStage,
      toStage: nextStage,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      actorUserId: actor.id,
      actorName: actor.name,
      createdAt: nowIso(),
      time: "Just now",
    },
    ...((project.lifecycleHistory ?? []) as unknown[]),
  ].slice(0, 50);
}

function projectNameFromClient(client: Client) {
  const exhibition = client.exhibition?.trim() || "Pending Exhibition";
  const company = client.company?.trim() || client.name?.trim() || "Client";
  return `${exhibition} - ${company}`;
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function projectDimensionsFromClient(client: Client) {
  const widthM = numberOrDefault(client.boothWidthM, 6);
  const depthM = numberOrDefault(client.boothDepthM, 3);
  return `${widthM} x ${depthM} m`;
}

function ensureProjectForClient(store: CoreStore, client: Client, actor: { id: string; name: string; company?: string }) {
  const company = client.company?.trim() || client.name?.trim();
  const exhibition = client.exhibition?.trim() || "Pending Exhibition";
  const assigned = Boolean(client.managerId || (client.pm && client.pm !== "Unassigned"));
  const existing = (client.projectId ? store.projects.find((project) => project.id === client.projectId) : null)
    ?? store.projects.find((project) => {
      const sameCompany = project.client.trim().toLowerCase() === company.trim().toLowerCase();
      const sameExhibition = (project.exhibition || "").trim().toLowerCase() === exhibition.trim().toLowerCase();
      const sameAgency = String((project as any).agency || actor.company || "ENS Demo Agency").trim().toLowerCase()
        === String((client as any).agency || actor.company || "ENS Demo Agency").trim().toLowerCase();
      return sameCompany && sameExhibition && sameAgency;
    });

  if (existing) {
    existing.name = projectNameFromClient(client);
    existing.client = company;
    existing.exhibition = exhibition;
    existing.dimensions = projectDimensionsFromClient(client);
    existing.system = client.preferredSystem?.trim() || existing.system || "Octanorm";
    existing.standType = existing.system;
    existing.deadline = client.targetDate || existing.deadline || null;
    if (client.managerId || (client.pm && client.pm !== "Unassigned")) {
      existing.managerId = client.managerId ?? existing.managerId ?? null;
      existing.pm = client.pm || existing.pm;
      advanceProjectAfterAssignment(existing);
    }
    (existing as any).agency = (client as any).agency || (existing as any).agency || actor.company;
    client.projectId = existing.id;
    return existing;
  }

  const project: Project = {
    id: `p-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: projectNameFromClient(client),
    client: company,
    pm: assigned ? client.pm : "Unassigned",
    managerId: assigned ? client.managerId ?? null : null,
    status: assigned ? "In Design" : "Pending",
    health: "On Track",
    progress: assigned ? 20 : 5,
    deadline: client.targetDate || null,
    system: client.preferredSystem?.trim() || "Octanorm",
    dimensions: projectDimensionsFromClient(client),
    exhibition,
    standType: client.preferredSystem?.trim() || "Octanorm",
    description: client.intakeNotes?.trim() || `Client intake project for ${company}.`,
    pipelineStage: assigned ? "design" : "brief",
    lifecycleHistory: [],
    lastUpdate: "Just now",
  };
  (project as any).agency = (client as any).agency || actor.company;
  (project as any).source = "client_intake";
  addProjectLifecycle(project, actor, project.pipelineStage || "brief", project.status);
  store.projects.unshift(project);
  client.projectId = project.id;
  return project;
}

function ensureExhibition(store: CoreStore, input: { name: string; agency?: string; city?: string; venue?: string; startDate?: string | null; endDate?: string | null; status?: Exhibition["status"] }) {
  store.exhibitions ??= [];
  const name = input.name.trim();
  const agency = input.agency || "ENS Demo Agency";
  const existing = store.exhibitions.find((item) => (
    item.name.trim().toLowerCase() === name.toLowerCase()
    && String(item.agency || "ENS Demo Agency").trim().toLowerCase() === agency.trim().toLowerCase()
  ));
  if (existing) {
    existing.city = input.city ?? existing.city;
    existing.venue = input.venue ?? existing.venue;
    existing.startDate = input.startDate ?? existing.startDate ?? null;
    existing.endDate = input.endDate ?? existing.endDate ?? null;
    existing.status = input.status ?? existing.status;
    return existing;
  }
  const exhibition: Exhibition = {
    id: `exh-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name,
    venue: input.venue || "",
    city: input.city || "",
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    status: input.status || "Active",
    createdAt: nowIso(),
    agency,
  };
  store.exhibitions.unshift(exhibition);
  return exhibition;
}

function projectSummary(projects: Project[]) {
  return {
    total: projects.length,
    inDesign: projects.filter((project) => project.pipelineStage === "design" || project.status === "In Design").length,
    review: projects.filter((project) => project.status === "Client Review" || project.status === "Revision").length,
    delayed: projects.filter((project) => project.status === "Delayed" || project.health.toLowerCase().includes("risk")).length,
  };
}

function taskBoardResponse(store: CoreStore, actor?: { role: ActorRole; email: string; id: string; name?: string }) {
  ensureTasks(store);
  const projects = actor ? visibleProjectsForActor(store, actor) : store.projects;
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = actor?.role === "chief" || !actor
    ? store.tasks ?? []
    : (store.tasks ?? []).filter((task) => task.projectId ? projectIds.has(task.projectId) : false);
  return {
    tasks,
    projects: projects.slice(0, 50).map((project) => ({
      id: project.id,
      name: project.name,
      client: project.client,
    })),
  };
}

function ensureTasks(store: CoreStore) {
  store.tasks ??= [];
  return store.tasks;
}

function ensureRequests(store: CoreStore) {
  if (!store.requests) {
    store.requests = store.projects
      .filter((project) => project.status === "Revision" || project.status === "Client Review")
      .map((project, index) => ({
        id: `req-${project.id}`,
        client: project.client,
        project: project.name,
        request: project.status === "Revision" ? "Client requested a workspace revision." : "Client review is waiting for PM follow-up.",
        timestamp: index === 0 ? "Just now" : `${index + 1}h ago`,
        status: project.status === "Revision" ? "Pending" : "In Progress",
        priority: index === 0 ? "High" : "Medium",
        history: [],
        comments: [],
      }));
  }
  return store.requests;
}

function requestListResponse(
  store: CoreStore,
  query: { q?: unknown; status?: unknown; limit?: unknown; offset?: unknown },
  actor?: { role: ActorRole; email: string; id: string; name?: string },
) {
  const requests = ensureRequests(store);
  const projects = actor ? visibleProjectsForActor(store, actor) : store.projects;
  const visibleProjectKeys = new Set(projects.flatMap((project) => [project.name, project.client].filter(Boolean)));
  const q = String(query.q || "").trim().toLowerCase();
  const status = String(query.status || "").trim();
  const limit = Math.max(1, Number(query.limit || 10));
  const offset = Math.max(0, Number(query.offset || 0));
  const visible = actor?.role === "chief" || !actor
    ? requests
    : requests.filter((request) => visibleProjectKeys.has(request.project) || visibleProjectKeys.has(request.client));
  const filtered = visible.filter((request) => {
    const matchesSearch = !q || [request.client, request.project, request.request].some((value) => value.toLowerCase().includes(q));
    const matchesStatus = !status || request.status === status;
    return matchesSearch && matchesStatus;
  });
  return {
    requests: filtered.slice(offset, offset + limit),
    pagination: { total: filtered.length, limit, offset, hasMore: offset + limit < filtered.length },
    summary: {
      total: visible.length,
      pending: visible.filter((request) => request.status === "Pending").length,
      inProgress: visible.filter((request) => request.status === "In Progress").length,
      resolved: visible.filter((request) => request.status === "Resolved").length,
      declined: visible.filter((request) => request.status === "Declined").length,
    },
  };
}

async function deliverInvitationEmail(
  invitation: ManagerInvitation,
  mode: "create" | "resend",
) {
  invitation.emailStatus = "pending";
  invitation.emailWarning = null;
  if (!resendConfigured()) {
    invitation.emailStatus = "failed";
    invitation.emailWarning = "Resend email is not configured.";
    return;
  }
  try {
    const send = mode === "resend" ? sendResendInvitationEmail : sendInvitationEmail;
    const result = await send({
      to: invitation.email,
      name: invitation.name ?? "",
      inviteUrl: invitation.inviteUrl ?? "",
      expiresAt: invitation.expiresAt,
    });
    if ("error" in result && result.error) {
      invitation.emailStatus = "failed";
      invitation.emailWarning = result.error.message;
      return;
    }
    invitation.emailStatus = "sent";
  } catch (error) {
    invitation.emailStatus = "failed";
    invitation.emailWarning = error instanceof Error ? error.message : "Email delivery failed.";
  }
}

function clientSummary(clients: Client[]) {
  return {
    total: clients.length,
    active: clients.filter((client) => client.status === "Active").length,
    needsSetup: clients.filter((client) => client.status === "Lead" || client.status === "Pending").length,
  };
}

function canAccessClient(actor: { role: ActorRole; email: string; id: string; name?: string; company?: string }, client: Client) {
  if (actor.role === "anonymous") return false;
  const actorCompany = actor.company || "ENS Demo Agency";
  const clientAgency = (client as any).agency || "ENS Demo Agency";
  if (clientAgency.trim().toLowerCase() !== actorCompany.trim().toLowerCase()) {
    return false;
  }
  if (actor.role === "chief") return true;
  if (actor.role === "pm") return isAssignedPm(actor, client.pm);
  return client.contactEmail.trim().toLowerCase() === actor.email.trim().toLowerCase();
}

function visibleClientsForActor(store: CoreStore, actor: { role: ActorRole; email: string; id: string; name?: string; company?: string }) {
  if (actor.role === "anonymous") return [];
  const actorCompany = actor.company || "ENS Demo Agency";
  const companyClients = store.clients.filter((client) => {
    const clientAgency = (client as any).agency || "ENS Demo Agency";
    return clientAgency.trim().toLowerCase() === actorCompany.trim().toLowerCase();
  });
  return actor.role === "chief"
    ? companyClients
    : companyClients.filter((client) => canAccessClient(actor, client));
}

async function workflowSummary(store: CoreStore, company?: string) {
  const authStore = await readJsonStore<{ users: Array<{ id: string; name: string; email: string; role: string; company?: string; createdAt?: string }> }>("auth", { users: [] });
  const companyKey = company?.trim().toLowerCase();
  const inCompany = (record: { agency?: string }) => {
    if (!companyKey) return true;
    return (record.agency || "ENS Demo Agency").trim().toLowerCase() === companyKey;
  };
  const projects = store.projects.filter((project) => inCompany(project as Project & { agency?: string }));
  const clients = store.clients.filter((client) => inCompany(client as Client & { agency?: string }));
  const pmUsers = authStore.users.filter((user) => {
    if (user.role !== "pm") return false;
    if (!companyKey) return true;
    return (user.company || "").trim().toLowerCase() === companyKey;
  });
  const assignedPmNames = new Set(projects.map((project) => project.pm).filter((pm) => pm && pm !== "Unassigned").map((pm) => pm.toLowerCase()));
  const newProjectManagers = pmUsers
    .filter((user) => !assignedPmNames.has(user.name.toLowerCase()))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company || "",
      createdAt: user.createdAt ?? null,
    }));
  const unassignedClients = clients
    .filter((client) => !client.pm || client.pm === "Unassigned")
    .map((client) => ({
      id: client.id,
      name: client.name,
      contactEmail: client.contactEmail,
      exhibition: client.exhibition,
      status: client.status,
      lastActivity: client.lastActivity,
    }));
  const unassignedProjects = projects
    .filter((project) => !project.pm || project.pm === "Unassigned")
    .map((project) => ({
      id: project.id,
      name: project.name,
      client: project.client,
      exhibition: project.exhibition,
      status: project.status,
      deadline: project.deadline,
    }));
  const approvalAging = projects
    .filter((project) => project.status === "Client Review" || project.status === "Revision")
    .map((project) => ({
      id: project.id,
      name: project.name,
      client: project.client,
      status: project.status,
      waitingDays: project.lastUpdate.includes("day") ? Number(project.lastUpdate.match(/\d+/)?.[0] ?? 1) : 0,
    }))
    .sort((a, b) => b.waitingDays - a.waitingDays);
  const workload = pmUsers.map((user) => {
    const managerProjects = projects.filter((project) => project.pm.toLowerCase() === user.name.toLowerCase());
    const activeProjects = managerProjects.filter((project) => ["active", "in design", "client review", "revision"].includes(project.status.toLowerCase())).length;
    const managerClients = clients.filter((client) => client.pm.toLowerCase() === user.name.toLowerCase()).length;
    const delayedProjects = managerProjects.filter((project) => statusParam(project.status) === "delayed" || project.health.toLowerCase().includes("risk")).length;
    const workload = Math.min(100, activeProjects * 28 + delayedProjects * 18);
    return {
      id: user.id,
      name: user.name,
      activeProjects,
      clients: managerClients,
      delayedProjects,
      workload,
      projectCapacity: PM_ACTIVE_PROJECT_CAPACITY,
      clientCapacity: PM_CLIENT_CAPACITY,
      remainingProjects: Math.max(0, PM_ACTIVE_PROJECT_CAPACITY - activeProjects),
      remainingClients: Math.max(0, PM_CLIENT_CAPACITY - managerClients),
      overloaded: activeProjects >= PM_ACTIVE_PROJECT_CAPACITY || managerClients >= PM_CLIENT_CAPACITY || workload >= PM_OVERLOAD_THRESHOLD,
    };
  });
  return {
    unassignedClients,
    unassignedProjects,
    newProjectManagers,
    approvalAging,
    workloadAlerts: workload.filter((item) => item.overloaded),
    counts: {
      unassignedClients: unassignedClients.length,
      unassignedProjects: unassignedProjects.length,
      newProjectManagers: newProjectManagers.length,
      stalledApprovals: approvalAging.filter((item) => item.waitingDays >= 3).length,
      overloadedManagers: workload.filter((item) => item.overloaded).length,
    },
  };
}

router.get("/overview", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief", "client"])) return;
  const actorCompany = actor.company || "ENS Demo Agency";
  const projects = visibleProjectsForActor(store, actor);
  const clients = visibleClientsForActor(store, actor);
  const authStore = await readJsonStore<{ users: Array<{ role: string }> }>("auth", { users: [] });
  const companyKey = actor.company?.trim().toLowerCase();
  const projectManagerCount = actor.role === "chief"
    ? authStore.users.filter((user) => {
      if (user.role !== "pm") return false;
      if (!companyKey) return true;
      return ((user as { company?: string }).company || "").trim().toLowerCase() === companyKey;
    }).length
    : new Set(projects.map((project) => project.pm).filter((pm) => pm && pm !== "Unassigned")).size;
  const workflow = actor.role === "chief" ? await workflowSummary(store, actor.company) : null;
  const visibleProjectKeys = new Set(projects.flatMap((project) => [project.id, project.name, project.client].filter(Boolean)));
  const activity = actor.role === "chief" ? store.activity : store.activity.filter((item) => visibleProjectKeys.has(item.project));
  const distribution = [
    { name: "Active", value: projects.filter((project) => statusParam(project.status) === "active").length, color: "#3b82f6" },
    { name: "Pending", value: projects.filter((project) => statusParam(project.status) === "pending").length, color: "#eab308" },
    { name: "Delayed", value: projects.filter((project) => statusParam(project.status) === "delayed").length, color: "#ef4444" },
    { name: "Completed", value: projects.filter((project) => statusParam(project.status) === "completed").length, color: "#22c55e" },
  ];
  res.json({
    organization: { id: "dev-org", name: actorCompany, slug: actorCompany.toLowerCase().replace(/\s+/g, '-'), plan: "Dev" },
    metrics: {
      clients: clients.length,
      projects: projects.length,
      projectManagers: projectManagerCount,
      delayedProjects: projects.filter((project) => statusParam(project.status) === "delayed").length,
      pendingApprovals: projects.filter((project) => project.status === "Client Review" || project.status === "Pending").length,
      activeWorkspaces: projects.filter((project) => statusParam(project.status) === "active").length,
      documents: 0,
      comments: activity.filter((item) => item.type === "message").length,
      completedProjects: projects.filter((project) => statusParam(project.status) === "completed").length,
    },
    projects,
    clients,
    activity,
    charts: {
      activity: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => ({ day, projects: Math.max(0, projects.length - Math.abs(3 - index)) })),
      distribution,
      activityCount: activity.length,
    },
    workflow,
  });
});

router.get("/system/readiness", async (_req, res) => {
  res.json(configReadiness());
});

router.get("/exhibitions", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const actorCompany = actor.company || "ENS Demo Agency";
  const agencyKey = actorCompany.trim().toLowerCase();
  const explicit = (store.exhibitions ?? []).filter((item) => String(item.agency || "ENS Demo Agency").trim().toLowerCase() === agencyKey);
  const inferred = store.projects
    .filter((project) => String((project as any).agency || "ENS Demo Agency").trim().toLowerCase() === agencyKey)
    .map((project) => project.exhibition)
    .filter(Boolean);
  const known = new Set(explicit.map((item) => item.name.trim().toLowerCase()));
  for (const name of inferred) {
    if (!known.has(name.trim().toLowerCase())) {
      explicit.push({
        id: `inferred-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        status: "Active",
        createdAt: nowIso(),
        agency: actorCompany,
      });
      known.add(name.trim().toLowerCase());
    }
  }
  res.json({
    exhibitions: explicit.sort((a, b) => a.name.localeCompare(b.name)),
  });
});

router.post("/exhibitions", async (req, res) => {
  const parsed = validateBody(exhibitionPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const exhibition = ensureExhibition(store, { ...parsed.data, agency: actor.company || "ENS Demo Agency" });
  store.activity = [
    { id: activityId(), type: "update", user: actor.name, action: "created exhibition", project: exhibition.name, time: "Just now" },
    ...store.activity,
  ].slice(0, 100);
  await writeStore(store);
  res.status(201).json({ exhibition, exhibitions: store.exhibitions ?? [] });
});

router.get("/projects", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief", "client"])) return;
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim();
  const limit = Math.max(1, Number(req.query.limit || 25));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const visible = visibleProjectsForActor(store, actor);
  const filtered = visible.filter((project) => {
    const matchesSearch = !q || [project.name, project.client, project.pm, project.exhibition, project.system].some((value) => value.toLowerCase().includes(q));
    const matchesStatus = !status || statusParam(project.status) === statusParam(status) || project.status === status;
    return matchesSearch && matchesStatus;
  });
  res.json({
    projects: filtered.slice(offset, offset + limit),
    pagination: { total: filtered.length, limit, offset, hasMore: offset + limit < filtered.length },
    summary: projectSummary(filtered),
  });
});

router.post("/projects", async (req, res) => {
  const parsed = validateBody(projectCreatePayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const assignedManager = actor.role === "pm"
    ? actor.name
    : await managerNameFromId(parsed.data.managerId);
  const project: Project = {
    id: `p-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: parsed.data.name,
    client: parsed.data.client?.trim() || "Unassigned client",
    pm: assignedManager === "Unassigned" ? "Unassigned" : assignedManager,
    managerId: actor.role === "pm" ? actor.id : parsed.data.managerId ?? null,
    status: assignedManager === "Unassigned" ? "Pending" : "In Design",
    health: "On Track",
    progress: 0,
    deadline: parsed.data.deadline || null,
    system: parsed.data.system,
    dimensions: `${parsed.data.widthM} x ${parsed.data.depthM} m`,
    exhibition: parsed.data.exhibition?.trim() || parsed.data.name,
    standType: parsed.data.system,
    description: "",
    pipelineStage: assignedManager === "Unassigned" ? "brief" : "design",
    lifecycleHistory: [],
    lastUpdate: "Just now",
  };
  (project as any).agency = actor.company;
  ensureExhibition(store, { name: project.exhibition, agency: actor.company || "ENS Demo Agency", status: "Active" });
  addProjectLifecycle(project, actor, "brief", project.status);
  const linkedClient = parsed.data.clientId
    ? store.clients.find((client) => client.id === parsed.data.clientId)
    : store.clients.find((client) => client.name.trim().toLowerCase() === project.client.trim().toLowerCase());
  if (linkedClient) {
    linkedClient.projectId = project.id;
    linkedClient.exhibition = project.exhibition || linkedClient.exhibition;
    if (project.pm !== "Unassigned") {
      linkedClient.pm = project.pm;
      linkedClient.managerId = project.managerId ?? null;
    }
    linkedClient.lastActivity = "Just now";
  }
  store.projects.unshift(project);
  addActivity(store, "update", actor.name, "created project", project);
  await writeStore(store);
  res.status(201).json({ project });
});

router.put("/projects/:projectId/pipeline-stage", async (req, res) => {
  const parsed = validateBody(projectStagePayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const stage = parsed.data.stage;
  const status = stageToStatus(stage);
  addProjectLifecycle(project, actor, stage, status);
  project.pipelineStage = stage;
  project.status = status;
  project.progress = status === "Completed" ? 100 : Math.max(project.progress, stage === "production" ? 85 : stage === "review" ? 60 : 10);
  project.lastUpdate = "Just now";
  addActivity(store, "update", actor.name, `moved project to ${stage}`, project);
  await writeStore(store);
  res.json({ ok: true, project: { id: project.id, name: project.name }, projects: visibleProjectsForActor(store, actor) });
});

router.put("/projects/:projectId", async (req, res) => {
  const parsed = validateBody(projectUpdatePayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  project.name = parsed.data.name;
  project.client = parsed.data.client;
  project.pm = actor.role === "chief" && parsed.data.managerId !== undefined
    ? await managerNameFromId(parsed.data.managerId)
    : project.pm;
  if (actor.role === "chief" && parsed.data.managerId !== undefined) {
    project.managerId = parsed.data.managerId ?? null;
    advanceProjectAfterAssignment(project);
  }
  project.deadline = parsed.data.deadline || null;
  project.system = parsed.data.system;
  project.dimensions = `${parsed.data.widthM} x ${parsed.data.depthM} m`;
  project.exhibition = parsed.data.exhibition || parsed.data.name;
  project.standType = parsed.data.system;
  project.description = parsed.data.description ?? project.description;
  project.lastUpdate = "Just now";
  const workspace = store.workspaces?.[project.id];
  if (workspace) {
    workspace.widthMm = Math.round(parsed.data.widthM * 1000);
    workspace.depthMm = Math.round(parsed.data.depthM * 1000);
  }
  const client = clientForProject(store, project);
  if (client) {
    client.name = project.client;
    client.company = project.client;
    client.pm = project.pm;
    client.managerId = project.managerId ?? null;
    client.exhibition = project.exhibition;
    client.lastActivity = "Just now";
  }
  addActivity(store, "update", actor.name, "updated project details", project);
  await writeStore(store);
  res.json({ ok: true, project, projects: visibleProjectsForActor(store, actor) });
});

router.delete("/projects/:projectId", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  store.projects = store.projects.filter((item) => item.id !== project.id);
  store.clients = store.clients.map((client) => client.projectId === project.id ? { ...client, projectId: null, status: "Pending", lastActivity: "Just now" } : client);
  if (store.workspaces) delete store.workspaces[project.id];
  store.tasks = (store.tasks ?? []).filter((task) => task.projectId !== project.id);
  addActivity(store, "update", actor.name, "deleted project", project);
  await writeStore(store);
  res.json({ ok: true, projects: store.projects });
});

router.get("/clients", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim();
  const limit = Math.max(1, Number(req.query.limit || 25));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const visible = visibleClientsForActor(store, actor);
  const filtered = visible.filter((client) => {
    const matchesSearch = !q || [client.name, client.company, client.contactName, client.contactEmail, client.pm, client.exhibition].some((value) => value.toLowerCase().includes(q));
    const matchesStatus = !status || client.status.toLowerCase() === status.toLowerCase();
    return matchesSearch && matchesStatus;
  });
  res.json({
    clients: filtered.slice(offset, offset + limit),
    pagination: { total: filtered.length, limit, offset, hasMore: offset + limit < filtered.length },
    summary: clientSummary(filtered),
  });
});

router.post("/clients", async (req, res) => {
  const parsed = validateBody(clientPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const client: Client = {
    id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: parsed.data.company || parsed.data.name,
    company: parsed.data.company || parsed.data.name,
    contactName: parsed.data.name,
    contactEmail: parsed.data.email.toLowerCase(),
    projectId: null,
    pm: actor.role === "pm" ? actor.name : "Unassigned",
    exhibition: parsed.data.exhibition || "New Exhibition",
    boothWidthM: parsed.data.boothWidthM ?? undefined,
    boothDepthM: parsed.data.boothDepthM ?? undefined,
    preferredSystem: parsed.data.preferredSystem || undefined,
    venueCity: parsed.data.venueCity || undefined,
    targetDate: parsed.data.targetDate || undefined,
    intakeNotes: parsed.data.intakeNotes || undefined,
    status: "Pending",
    lastActivity: "Just now",
  };
  if (actor.role === "pm") {
    client.managerId = actor.id;
  }
  (client as any).agency = actor.company;
  store.clients.unshift(client);
  const project = ensureProjectForClient(store, client, actor);
  store.activity = [
    { id: activityId(), type: "update", user: actor.name, action: `created client ${client.company}`, project: project.name, time: "Just now" },
    ...store.activity,
  ].slice(0, 100);
  await writeStore(store);
  const clients = visibleClientsForActor(store, actor);
  res.status(201).json({ clients, summary: clientSummary(clients) });
});

router.put("/clients/:clientId", async (req, res) => {
  const parsed = validateBody(clientPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const client = store.clients.find((item) => item.id === req.params.clientId);
  if (!client) return res.status(404).json({ error: "Client not found." });
  if (!canAccessClient(actor, client)) return res.status(403).json({ error: "Forbidden." });
  client.name = parsed.data.company || parsed.data.name;
  client.company = parsed.data.company || parsed.data.name;
  client.contactName = parsed.data.name;
  client.contactEmail = parsed.data.email.toLowerCase();
  client.exhibition = parsed.data.exhibition || client.exhibition;
  client.boothWidthM = parsed.data.boothWidthM ?? client.boothWidthM;
  client.boothDepthM = parsed.data.boothDepthM ?? client.boothDepthM;
  client.preferredSystem = parsed.data.preferredSystem || client.preferredSystem;
  client.venueCity = parsed.data.venueCity || client.venueCity;
  client.targetDate = parsed.data.targetDate || client.targetDate;
  client.intakeNotes = parsed.data.intakeNotes || client.intakeNotes;
  client.lastActivity = "Just now";
  ensureProjectForClient(store, client, actor);
  await writeStore(store);
  const clients = visibleClientsForActor(store, actor);
  res.json({ ok: true, clients, summary: clientSummary(clients) });
});

router.delete("/clients/:clientId", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const client = store.clients.find((item) => item.id === req.params.clientId);
  if (!client) return res.status(404).json({ error: "Client not found." });
  const linkedProjects = store.projects.filter((project) => project.client === client.name || project.client === client.company || project.id === client.projectId);
  const archiveableIntakeProjects = linkedProjects.filter((project) => (project as any).source === "client_intake" && !store.workspaces?.[project.id]);
  const archiveableIds = new Set(archiveableIntakeProjects.map((project) => project.id));
  const activeProjects = linkedProjects
    .filter((project) => !archiveableIds.has(project.id))
    .filter((project) => !["Completed", "Approved"].includes(project.status));
  if (activeProjects.length) {
    return res.status(409).json({
      error: "Client has active projects and cannot be archived.",
      projects: activeProjects.map((project) => ({ id: project.id, name: project.name, status: project.status, deadline: project.deadline })),
    });
  }
  store.clients = store.clients.filter((item) => item.id !== client.id);
  if (archiveableIds.size) {
    store.projects = store.projects.filter((project) => !archiveableIds.has(project.id));
  }
  await writeStore(store);
  res.json({ ok: true, clients: store.clients });
});

router.put("/clients/:clientId/status", async (req, res) => {
  const parsed = validateBody(clientStatusPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const client = store.clients.find((item) => item.id === req.params.clientId);
  if (!client) return res.status(404).json({ error: "Client not found." });
  if (!canAccessClient(actor, client)) return res.status(403).json({ error: "Forbidden." });
  client.status = parsed.data.status;
  client.lastActivity = "Just now";
  await writeStore(store);
  const clients = visibleClientsForActor(store, actor);
  res.json({ ok: true, clients, summary: clientSummary(clients) });
});

router.get("/tasks", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  res.json(taskBoardResponse(store, actor));
});

router.post("/tasks", async (req, res) => {
  const parsed = validateBody(taskPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = parsed.data.projectId ? store.projects.find((item) => item.id === parsed.data.projectId) : null;
  if (project && !requireProjectAccess(res, store, actor, project)) return;
  const task: PmTask = {
    id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    title: parsed.data.title,
    client: project?.client ?? "",
    project: project?.name ?? "",
    projectId: parsed.data.projectId,
    priority: parsed.data.priority,
    deadline: parsed.data.deadline,
    col: parsed.data.status,
    notes: parsed.data.notes || undefined,
  };
  ensureTasks(store).push(task);
  await writeStore(store);
  res.status(201).json(taskBoardResponse(store, actor));
});

router.patch("/tasks/:taskId", async (req, res) => {
  const parsed = validateBody(taskUpdatePayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const tasks = ensureTasks(store);
  const task = tasks.find((item) => item.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "Task not found." });
  const currentProject = task.projectId ? store.projects.find((item) => item.id === task.projectId) : null;
  if (currentProject && !requireProjectAccess(res, store, actor, currentProject)) return;
  const project = parsed.data.projectId ? store.projects.find((item) => item.id === parsed.data.projectId) : null;
  if (project && !requireProjectAccess(res, store, actor, project)) return;
  if (parsed.data.title !== undefined) task.title = parsed.data.title;
  if (parsed.data.projectId !== undefined) task.projectId = parsed.data.projectId;
  if (project) {
    task.client = project.client;
    task.project = project.name;
  }
  if (parsed.data.priority !== undefined) task.priority = parsed.data.priority;
  if (parsed.data.deadline !== undefined) task.deadline = parsed.data.deadline;
  if (parsed.data.status !== undefined) task.col = parsed.data.status;
  if (parsed.data.notes !== undefined) task.notes = parsed.data.notes || undefined;
  await writeStore(store);
  res.json(taskBoardResponse(store, actor));
});

router.delete("/tasks/:taskId", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const task = ensureTasks(store).find((item) => item.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "Task not found." });
  const project = task.projectId ? store.projects.find((item) => item.id === task.projectId) : null;
  if (project && !requireProjectAccess(res, store, actor, project)) return;
  store.tasks = ensureTasks(store).filter((item) => item.id !== req.params.taskId);
  await writeStore(store);
  res.json(taskBoardResponse(store, actor));
});

router.get("/requests", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  await writeStore(store);
  res.json(requestListResponse(store, req.query, actor));
});

router.patch("/requests/:requestId/status", async (req, res) => {
  const parsed = validateBody(requestStatusPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const request = ensureRequests(store).find((item) => item.id === req.params.requestId);
  if (!request) return res.status(404).json({ error: "Request not found." });
  const project = store.projects.find((item) => item.name === request.project || item.client === request.client);
  if (project && !requireProjectAccess(res, store, actor, project)) return;
  request.status = parsed.data.status;
  request.history = [
    { id: `history-${Date.now()}`, type: "status", message: `Status changed to ${parsed.data.status}`, actor: actor.name, isMe: true, createdAt: nowIso(), time: "Just now" },
    ...(request.history ?? []),
  ].slice(0, 50);
  await writeStore(store);
  res.json(requestListResponse(store, req.query, actor));
});

router.post("/requests/:requestId/replies", async (req, res) => {
  const parsed = validateBody(requestReplyPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const request = ensureRequests(store).find((item) => item.id === req.params.requestId);
  if (!request) return res.status(404).json({ error: "Request not found." });
  const project = store.projects.find((item) => item.name === request.project || item.client === request.client);
  if (project && !requireProjectAccess(res, store, actor, project)) return;
  request.comments.push({ id: `comment-${Date.now()}`, text: parsed.data.body, author: actor.name, isMe: true, time: "Just now" });
  await writeStore(store);
  res.status(201).json(requestListResponse(store, req.query, actor));
});

  router.get("/managers", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  res.json(await managerWorkspaceResponse(store, actor));
});

router.get("/managers/assignment-items", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const actorCompany = actor.company || "ENS Demo Agency";
  const managerId = String(req.query.managerId || "").trim();
  const clientQ = String(req.query.clientQ || "").trim().toLowerCase();
  const projectQ = String(req.query.projectQ || "").trim().toLowerCase();
  const clientLimit = Math.max(1, Number(req.query.clientLimit || 20));
  const clientOffset = Math.max(0, Number(req.query.clientOffset || 0));
  const projectLimit = Math.max(1, Number(req.query.projectLimit || 20));
  const projectOffset = Math.max(0, Number(req.query.projectOffset || 0));

  const companyClients = await buildManagedClientsForCompany(store, actorCompany);
  const clients = companyClients.filter((client) => {
    const matchesManager = !managerId || client.managerId === managerId || !client.managerId;
    const matchesSearch = !clientQ || [client.name, client.contactName, client.contactEmail, client.exhibition, client.managerName]
      .some((value) => value.toLowerCase().includes(clientQ));
    return matchesManager && matchesSearch;
  });
  const companyProjects = await buildManagedProjectsForCompany(store, actorCompany);
  const projects = companyProjects.filter((project) => {
    const matchesManager = !managerId || project.managerId === managerId || !project.managerId;
    const matchesSearch = !projectQ || [project.name, project.client, project.exhibition, project.system, project.managerName]
      .some((value) => value.toLowerCase().includes(projectQ));
    return matchesManager && matchesSearch;
  });

  res.json({
    clients: clients.slice(clientOffset, clientOffset + clientLimit),
    projects: projects.slice(projectOffset, projectOffset + projectLimit),
    clientPagination: { total: clients.length, limit: clientLimit, offset: clientOffset, hasMore: clientOffset + clientLimit < clients.length },
    projectPagination: { total: projects.length, limit: projectLimit, offset: projectOffset, hasMore: projectOffset + projectLimit < projects.length },
  });
});

router.put("/managers/assignments", async (req, res) => {
  const parsed = validateBody(managerAssignmentsPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const { clientAssignments, projectAssignments, cascadeClientProjects } = parsed.data;
  const authStore = await readJsonStore<{ users: Array<{ id: string; name: string; email: string; role: ActorRole }> }>("auth", { users: [] });
  const notifyUser = (emailOrId: string | null | undefined, role: ActorRole, title: string, body: string, href: string | null) => {
    if (!emailOrId || emailOrId === "Unassigned") return;
    const lookup = emailOrId.toLowerCase();
    const user = authStore.users.find((item) => (
      item.id === emailOrId ||
      String(item.email || "").toLowerCase() === lookup ||
      String(item.name || "").toLowerCase() === lookup
    ));
    if (!user) return;
    pushNotification(store, { id: user.id, email: user.email, role }, { title, body, href });
  };

  for (const assignment of clientAssignments) {
    const client = store.clients.find((item) => item.id === assignment.clientId);
    if (!client) continue;
    if (!matchesCompany(client, actor.company || "ENS Demo Agency")) continue;
    const managerName = await managerNameFromId(assignment.managerId);
    client.pm = managerName;
    client.managerId = assignment.managerId ?? null;
    if (managerName !== "Unassigned") client.status = "Active";
    client.lastActivity = "Just now";
    notifyUser(assignment.managerId ?? managerName, "pm", "New client assigned", `${client.name} was assigned to you by Chief Manager.`, "/pm/clients");
    notifyUser(client.contactEmail, "client", "Project manager assigned", `${managerName} is now your project manager.`, "/client");
    if (cascadeClientProjects) {
      store.projects
        .filter((project) => project.client === client.name || project.client === client.company || project.id === client.projectId)
        .filter((project) => matchesCompany(project, actor.company || "ENS Demo Agency"))
        .forEach((project) => {
          project.pm = client.pm;
          project.managerId = client.managerId ?? null;
          advanceProjectAfterAssignment(project);
          notifyUser(assignment.managerId ?? managerName, "pm", "New project assigned", `${project.name} was assigned to you by Chief Manager.`, `/pm/workspace?projectId=${encodeURIComponent(project.id)}`);
        });
    }
  }

  for (const assignment of projectAssignments) {
    const project = store.projects.find((item) => item.id === assignment.projectId);
    if (!project) continue;
    if (!matchesCompany(project, actor.company || "ENS Demo Agency")) continue;
    const managerName = await managerNameFromId(assignment.managerId);
    project.pm = managerName;
    project.managerId = assignment.managerId ?? null;
    advanceProjectAfterAssignment(project);
    notifyUser(assignment.managerId ?? managerName, "pm", "New project assigned", `${project.name} was assigned to you by Chief Manager.`, `/pm/workspace?projectId=${encodeURIComponent(project.id)}`);
    const client = store.clients.find((item) => item.projectId === project.id || item.name === project.client);
    if (client) {
      client.pm = project.pm;
      client.managerId = project.managerId ?? null;
      if (project.pm !== "Unassigned") client.status = "Active";
      client.lastActivity = "Just now";
      notifyUser(client.contactEmail, "client", "Project manager assigned", `${managerName} is now assigned to your project ${project.name}.`, "/client");
    }
  }

  store.activity = [
    { id: activityId(), type: "update", user: actor.name, action: "updated manager assignments", project: "Manager workspace", time: "Just now" },
    ...store.activity,
  ].slice(0, 100);
  await writeStore(store);
  res.json(await managerWorkspaceResponse(store, actor));
});

router.post("/managers/invitations", async (req, res) => {
  const parsed = validateBody(managerInvitationPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const email = parsed.data.email.toLowerCase();
  const name = parsed.data.name ?? "";
  const token = `invite-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const invitation: ManagerInvitation = {
    id: `invite-${Date.now()}`,
    email,
    name: name || undefined,
    role: "pm",
    status: "Pending",
    emailStatus: "pending",
    emailWarning: null,
    token,
    inviteUrl: `/pm/join?token=${encodeURIComponent(token)}`,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: nowIso(),
    agency: actor.company,
  } as any;
  await deliverInvitationEmail(invitation, "create");
  store.invitations = [invitation, ...(store.invitations ?? [])];
  store.activity = [
    { id: activityId(), type: "update", user: actor.name, action: `invited ${email} as project manager`, project: "Manager workspace", time: "Just now" },
    ...store.activity,
  ].slice(0, 100);
  await writeStore(store);
  res.status(201).json({ invitation });
});

router.get("/managers/invitations/validate", async (req, res) => {
  const store = await readStore();
  const token = String(req.query.token || "");
  const invitation = (store.invitations ?? []).find((item) => item.token === token);
  if (!invitation || invitation.status === "Revoked") return res.status(404).json({ error: "Invitation was not found." });
  if (invitation.status === "Accepted") return res.status(409).json({ error: "Invitation has already been accepted." });
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return res.status(410).json({ error: "Invitation has expired." });
  res.json({ valid: true, email: invitation.email, name: invitation.name ?? null, expiresAt: invitation.expiresAt, role: invitation.role });
});

router.post("/managers/invitations/accept", async (req, res) => {
  const parsed = validateBody(inviteAcceptPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const token = parsed.data.token;
  const name = parsed.data.name ?? "";
  const invitation = (store.invitations ?? []).find((item) => item.token === token);
  if (!invitation || invitation.status !== "Pending") return res.status(404).json({ error: "Invitation was not found." });
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return res.status(410).json({ error: "Invitation has expired." });
  try {
    await createInvitedUser({
      name: name || invitation.name || invitation.email.split("@")[0],
      email: invitation.email,
      password: parsed.data.password ?? "",
      role: invitation.role === "chief" ? "chief" : "pm",
      company: (invitation as { agency?: string }).agency || "ENS Demo Agency",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create invited account.";
    return res.status(message.includes("already exists") ? 409 : 400).json({ error: message });
  }
  invitation.status = "Accepted";
  invitation.name = name || invitation.name;
  await writeStore(store);
  res.json({ ok: true });
});

router.post("/managers/invitations/:invitationId/resend", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const invitation = (store.invitations ?? []).find((item) => item.id === req.params.invitationId);
  if (!invitation) return res.status(404).json({ error: "Invitation was not found." });
  const token = `invite-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  invitation.status = "Pending";
  invitation.token = token;
  invitation.inviteUrl = `/pm/join?token=${encodeURIComponent(token)}`;
  invitation.expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  await deliverInvitationEmail(invitation, "resend");
  await writeStore(store);
  res.json({ invitation });
});

router.delete("/managers/invitations/:invitationId", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  store.invitations = (store.invitations ?? []).map((invitation) => (
    invitation.id === req.params.invitationId ? { ...invitation, status: "Revoked" } : invitation
  ));
  await writeStore(store);
  res.json({ ok: true, invitations: store.invitations });
});

router.patch("/managers/:managerId/status", async (req, res) => {
  const parsed = validateBody(managerStatusPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const status = parsed.data.status === "suspended" ? "On Leave" : "Active";
  store.managerOverrides ??= {};
  store.managerOverrides[req.params.managerId] = { ...(store.managerOverrides[req.params.managerId] ?? {}), status };
  await writeStore(store);
  res.json({ ok: true });
});

router.patch("/managers/:managerId/rating", async (req, res) => {
  const parsed = validateBody(managerRatingPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  store.managerOverrides ??= {};
  store.managerOverrides[req.params.managerId] = { ...(store.managerOverrides[req.params.managerId] ?? {}), rating: Math.round(parsed.data.rating * 10) / 10 };
  await writeStore(store);
  res.json({ ok: true });
});

router.post("/managers/:managerId/reminders", async (req, res) => {
  const parsed = validateBody(managerReminderPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const managers = await buildManagersForCompany(store, actor.company || "ENS Demo Agency");
  const manager = managers.find((item) => item.id === req.params.managerId);
  if (!manager) return res.status(404).json({ error: "Manager was not found." });
  store.activity = [
    { id: activityId(), type: "message", user: actor.name, action: `sent workload reminder to ${manager.name}`, project: "Manager workspace", time: "Just now" },
    ...store.activity,
  ].slice(0, 100);
  await writeStore(store);
  res.json({ ok: true });
});

router.get("/workspaces/monitor", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  const actorCompany = (actor.company || "ENS Demo Agency").trim().toLowerCase();
  const projects = store.projects.filter((project) => {
    const projectAgency = ((project as any).agency || "ENS Demo Agency").trim().toLowerCase();
    return projectAgency === actorCompany;
  }).map((project, index) => {
    const workspace = ensureWorkspace(store, project);
    const current = currentVersion(workspace);
    const status = workspaceMonitorStatus(project);
    return {
      id: project.id,
      name: project.name,
      client: project.client,
      system: project.system,
      status,
      version: `v${current.versionNumber}`,
      dims: project.dimensions,
      pm: projectManagerName(project),
      managerId: managerIdFromName(project.pm),
      lastActionMins: minutesFromLastUpdate(project, index),
      currentAction: workspaceMonitorAction(project, workspace),
      waitingDays: status === "blocked" ? 5 : status === "review" ? 1 : 0,
      progress: project.progress,
    };
  });
  await writeStore(store);
  res.json({ projects, managers: await buildManagersForCompany(store, actor.company || "ENS Demo Agency") });
});

router.get("/notifications", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief", "client"])) return;
  const notifications = ensureNotifications(store, actor);
  await writeStore(store);
  res.json(notificationResponse(notifications));
});

router.patch("/notifications/:notificationId/read", async (req, res) => {
  const parsed = notificationIdParamSchema.safeParse(req.params.notificationId);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief", "client"])) return;
  const notifications = ensureNotifications(store, actor);
  const now = nowIso();
  store.notifications![notificationKey(actor)] = notifications.map((notification) => (
    notification.id === parsed.data ? { ...notification, readAt: notification.readAt ?? now, read: true } : notification
  ));
  await writeStore(store);
  res.json({ ok: true, ...notificationResponse(store.notifications![notificationKey(actor)]) });
});

router.patch("/notifications/read-all", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief", "client"])) return;
  const notifications = ensureNotifications(store, actor);
  const now = nowIso();
  const updated = notifications.filter((notification) => !notification.readAt).length;
  store.notifications![notificationKey(actor)] = notifications.map((notification) => ({
    ...notification,
    readAt: notification.readAt ?? now,
    read: true,
  }));
  await writeStore(store);
  res.json({ updated, ...notificationResponse(store.notifications![notificationKey(actor)]) });
});

router.post("/reports/export-audit", async (req, res) => {
  const parsed = validateBody(reportExportPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  pushNotification(store, actor, {
    title: "Report exported",
    body: `${parsed.data.report} was exported as ${parsed.data.format.toUpperCase()}.`,
    href: actor.role === "chief" ? "/chief/reports" : "/pm/reports",
  });
  store.activity = [
    { id: activityId(), type: "update", user: actor.name, action: `exported ${parsed.data.report} report`, project: parsed.data.range ?? "Reports", time: "Just now" },
    ...store.activity,
  ].slice(0, 100);
  await writeStore(store);
  res.json({ ok: true });
});

router.get("/reports/chief", async (req, res) => {
  const range = chiefReportRangeSchema.parse(String(req.query.range || "6M"));
  const store = await readStore();
  const actor = await actorFromReq(req, "chief");
  if (!requireRole(res, actor, ["chief"])) return;
  res.json(chiefReport(scopedStoreForActor(store, actor), range));
});

router.get("/reports/pm", async (req, res) => {
  const period = pmReportPeriodSchema.parse(String(req.query.period || "this_month"));
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  res.json(pmReport(scopedStoreForActor(store, actor), period));
});

router.get("/calendar", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const events = visibleCalendarEventsForActor(store, actor);
  await writeStore(store);
  res.json({ events });
});

router.post("/calendar/events", async (req, res) => {
  const parsed = validateBody(calendarEventPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const events = ensureCalendarEvents(store);
  const event: CalendarEvent = {
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    ...parsed.data,
    agency: actor.company || "ENS Demo Agency",
  };
  if (actor.role === "pm" && !isAssignedPm({ role: actor.role, name: actor.name, id: actor.id }, event.pm)) {
    return res.status(403).json({ error: "Project managers can only create events for themselves." });
  }
  events.unshift(event);
  pushNotification(store, actor, {
    title: "Calendar event created",
    body: `${event.name} was added to the schedule.`,
    href: actor.role === "chief" ? "/chief/calendar" : "/pm/calendar",
  });
  await writeStore(store);
  res.status(201).json({ event, events: visibleCalendarEventsForActor(store, actor) });
});

router.put("/calendar/events/:eventId", async (req, res) => {
  const parsed = validateBody(calendarEventPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const events = ensureCalendarEvents(store);
  const index = events.findIndex((event) => event.id === req.params.eventId);
  if (index < 0) return res.status(404).json({ error: "Calendar event was not found." });
  if (!visibleCalendarEventsForActor(store, actor).some((event) => event.id === req.params.eventId)) {
    return res.status(403).json({ error: "This account is not assigned to this calendar event." });
  }
  const event: CalendarEvent = { id: req.params.eventId, ...parsed.data, agency: events[index].agency || actor.company || "ENS Demo Agency" };
  if (actor.role === "pm" && !isAssignedPm({ role: actor.role, name: actor.name, id: actor.id }, event.pm)) {
    return res.status(403).json({ error: "Project managers can only update their own events." });
  }
  events[index] = event;
  await writeStore(store);
  res.json({ event, events: visibleCalendarEventsForActor(store, actor) });
});

router.delete("/calendar/events/:eventId", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const events = ensureCalendarEvents(store);
  if (!visibleCalendarEventsForActor(store, actor).some((event) => event.id === req.params.eventId)) {
    return res.status(403).json({ error: "This account is not assigned to this calendar event." });
  }
  const before = events.length;
  store.calendarEvents = events.filter((event) => event.id !== req.params.eventId);
  if (before === store.calendarEvents.length) return res.status(404).json({ error: "Calendar event was not found." });
  await writeStore(store);
  res.json({ ok: true, events: visibleCalendarEventsForActor(store, actor) });
});

router.put("/projects/:projectId/client-access", async (req, res) => {
  const parsed = validateBody(clientAccessPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const email = parsed.data.email.toLowerCase();
  const name = parsed.data.name || project.client;
  let client = store.clients.find((item) => item.contactEmail.trim().toLowerCase() === email)
    ?? clientForProject(store, project);
  if (client) {
    const previousProjectId = client.projectId;
    client.contactEmail = email;
    client.contactName = name;
    client.projectId = project.id;
    client.name = client.company || project.client;
    client.company = client.company || project.client;
    client.pm = project.pm;
    client.managerId = project.managerId ?? client.managerId ?? null;
    client.exhibition = project.exhibition || client.exhibition;
    client.agency = (project as any).agency || actor.company;
    client.status = "Active";
    client.lastActivity = "Just now";
    project.client = client.company || project.client;
    project.name = `${project.exhibition || project.name} - ${project.client}`;
    if (previousProjectId && previousProjectId !== project.id) {
      const previousProject = store.projects.find((item) => item.id === previousProjectId);
      if (previousProject && (previousProject as any).source === "client_intake" && !store.workspaces?.[previousProject.id]) {
        store.projects = store.projects.filter((item) => item.id !== previousProject.id);
      }
    }
  } else {
    client = {
      id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: project.client,
      company: project.client,
      contactName: name,
      contactEmail: email,
      projectId: project.id,
      pm: project.pm,
      exhibition: project.exhibition,
      agency: (project as any).agency || actor.company,
      status: "Active",
      lastActivity: "Just now",
    };
    store.clients.push(client);
  }
  addActivity(store, "update", actor.name, `linked client access for ${email}`, project);
  await writeStore(store);
  res.json({ ok: true, client });
});

router.post("/projects/:projectId/workspace/subscription-request", async (req, res) => {
  const parsed = validateBody(subscriptionPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief", "client"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  res.status(503).json({
    error: "Billing is not configured.",
    message: "Workspace subscription requests are disabled until billing is connected.",
    code: "billing_not_configured",
    plan: parsed.data.plan,
  });
});

router.get("/workspace/current", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief", "client"])) return;
  const project = actor.role === "chief"
    ? store.projects[0]
    : store.projects.find((item) => canAccessProject(store, actor, item));
  if (!project) return res.status(404).json({ error: "No assigned workspace found." });
  const workspace = ensureWorkspace(store, project);
  await markWorkspaceViewedByClient(store, actor, project, workspace);
  await writeStore(store);
  res.json(projectWorkspaceResponse(project, workspace));
});

router.get("/projects/:projectId/workspace", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  await markWorkspaceViewedByClient(store, actor, project, workspace);
  await writeStore(store);
  res.json(projectWorkspaceResponse(project, workspace));
});

router.post("/projects/:projectId/workspace/assets", async (req, res) => {
  const parsed = validateBody(workspaceAssetPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  try {
    const asset = await saveWorkspaceAsset({
      projectId: project.id,
      dataUrl: parsed.data.dataUrl,
      originalName: parsed.data.name,
      purpose: parsed.data.purpose,
    });
    addActivity(store, "update", actor.name, `uploaded workspace ${parsed.data.purpose} asset`, project);
    await writeStore(store);
    res.status(201).json({ asset });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not save workspace asset." });
  }
});

router.put("/projects/:projectId/workspace", async (req, res) => {
  const parsed = validateBody(workspacePayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  const current = currentVersion(workspace);
  if (current.status === "approved" || current.status === "locked") {
    return res.status(409).json({ error: "Approved workspaces are locked. Create a revision before editing." });
  }

  current.workspace = parsed.data.workspace ?? current.workspace;
  current.title = parsed.data.title || current.title || "Workspace draft";
  current.status = current.status === "submitted" || current.status === "viewed" ? current.status : "draft";
  project.status = current.status === "submitted" ? "Client Review" : "In Design";
  project.pipelineStage = current.status === "submitted" ? "review" : "design";
  project.lastUpdate = "Just now";
  addActivity(store, "update", actor.name, "saved workspace draft", project);
  await writeStore(store);
  res.json(projectWorkspaceResponse(project, workspace));
});

router.post("/projects/:projectId/workspace/versions", async (req, res) => {
  const parsed = validateBody(workspaceVersionPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  const requestedStatus = parsed.data.status === "submitted" ? "submitted" : "draft";
  const assignedClient = requestedStatus === "submitted" ? clientForProject(store, project) : null;
  if (requestedStatus === "submitted" && !assignedClient?.contactEmail) {
    return res.status(409).json({
      error: "Client access is not linked.",
      message: "Assign or link a real client account before sending this workspace for client review.",
    });
  }
  const createdAt = nowIso();
  const version: StoredWorkspaceVersion = {
    id: `${project.id}-v${workspace.versions.length + 1}-${Date.now()}`,
    versionNumber: workspace.versions.length + 1,
    status: requestedStatus,
    title: parsed.data.title || (requestedStatus === "submitted" ? "Submitted design" : "Workspace draft"),
    snapshotUrl: null,
    assetSummary: {},
    costEstimateCents: 0,
    submittedAt: requestedStatus === "submitted" ? createdAt : null,
    lockedAt: null,
    createdAt,
    workspace: parsed.data.workspace ?? currentVersion(workspace).workspace,
  };
  workspace.versions.unshift(version);
  workspace.currentVersionId = version.id;
  workspace.approved = false;
  workspace.elementStatus = { ...DEFAULT_ELEMENT_STATUS };
  if (requestedStatus === "submitted") {
    project.status = "Client Review";
    project.pipelineStage = "review";
    addActivity(store, "approval", actor.name, "sent workspace to client", project);
    await pushNotificationToAccount(store, assignedClient?.contactEmail, "client", {
      title: "Booth design ready for review",
      body: `${actor.name} sent the latest design for ${project.name}. Open the workspace to approve it or request changes.`,
      href: "/client/workspace",
    });
    if (project.managerId || project.pm !== "Unassigned") {
      await pushNotificationToAccount(store, project.managerId ?? project.pm, "pm", {
        title: "Workspace sent to client",
        body: `${project.name} is now waiting for client approval.`,
        href: `/pm/workspace?projectId=${encodeURIComponent(project.id)}`,
      });
    }
  } else {
    project.status = "In Design";
    project.pipelineStage = "design";
    addActivity(store, "update", actor.name, "created workspace version", project);
  }
  project.lastUpdate = "Just now";
  await writeStore(store);
  res.status(201).json(projectWorkspaceResponse(project, workspace));
});

router.post("/projects/:projectId/approve", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "client");
  if (!requireRole(res, actor, ["client"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  const current = currentVersion(workspace);
  current.status = "approved";
  workspace.approved = true;
  workspace.elementStatus = Object.fromEntries(Object.keys(workspace.elementStatus).map((key) => [key, "approved"])) as StoredProjectWorkspace["elementStatus"];
  project.status = "Approved";
  project.pipelineStage = "production";
  project.progress = Math.max(project.progress, 90);
  project.lastUpdate = "Just now";
  addActivity(store, "approval", actor.name, "approved workspace", project);
  await writeStore(store);
  res.json(projectWorkspaceResponse(project, workspace));
});

router.post("/projects/:projectId/change-requests", async (req, res) => {
  const parsed = validateBody(changeRequestPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "client");
  if (!requireRole(res, actor, ["client"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  if (workspace.revisionCount >= workspace.revisionLimit) {
    return res.status(409).json({ error: `Revision limit reached (${workspace.revisionLimit}/${workspace.revisionLimit}). No further change requests are allowed.` });
  }
  const changeText = parsed.data.changeText;

  workspace.revisionCount += 1;
  workspace.approved = false;
  currentVersion(workspace).status = "revision_requested";
  project.status = "Revision";
  project.pipelineStage = "review";
  project.lastUpdate = "Just now";
  workspace.comments.unshift({
    id: `comment-${Date.now()}`,
    user: actor.name,
    initials: actor.initials,
    text: changeText,
    type: "change",
    pin: null,
    status: "open",
    resolvedAt: null,
    createdAt: nowIso(),
  });
  addActivity(store, "message", actor.name, "requested workspace revision", project);
  await writeStore(store);
  res.status(201).json(projectWorkspaceResponse(project, workspace));
});

router.get("/projects/:projectId/comments", async (req, res) => {
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  await writeStore(store);
  res.json({ comments: workspace.comments.map(formatComment) });
});

router.post("/projects/:projectId/comments", async (req, res) => {
  const parsed = validateBody(workspaceCommentPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "client");
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  const text = parsed.data.body;
  const type = parsed.data.type ?? "comment";
  const comment: StoredWorkspaceComment = {
    id: `comment-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    user: actor.name,
    initials: actor.initials,
    text,
    type,
    pin: parsed.data.pin ?? null,
    status: "open",
    resolvedAt: null,
    createdAt: nowIso(),
  };
  workspace.comments.unshift(comment);
  addActivity(store, "message", comment.user, type === "pin" ? "added workspace pin" : "commented on workspace", project);
  await writeStore(store);
  res.status(201).json({ comment: formatComment(comment) });
});

router.put("/projects/:projectId/comments/:commentId/status", async (req, res) => {
  const parsed = validateBody(commentStatusPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  const comment = workspace.comments.find((item) => item.id === req.params.commentId);
  if (!comment) return res.status(404).json({ error: "Comment not found." });
  const status = parsed.data.status;
  comment.status = status;
  comment.resolvedAt = status === "resolved" ? nowIso() : null;
  addActivity(store, "update", actor.name, `${status === "resolved" ? "resolved" : "reopened"} workspace feedback`, project);
  await writeStore(store);
  res.json({ comment: { id: comment.id, status: comment.status, resolvedAt: comment.resolvedAt } });
});

router.put("/projects/:projectId/element-status", async (req, res) => {
  const parsed = validateBody(elementStatusPayloadSchema, req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const store = await readStore();
  const actor = await actorFromReq(req, "pm");
  if (!requireRole(res, actor, ["pm", "chief"])) return;
  const project = store.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireProjectAccess(res, store, actor, project)) return;
  const workspace = ensureWorkspace(store, project);
  workspace.elementStatus = { ...workspace.elementStatus, ...parsed.data.elementStatus };
  await writeStore(store);
  res.json({ ok: true, elementStatus: workspace.elementStatus });
});

export default router;
