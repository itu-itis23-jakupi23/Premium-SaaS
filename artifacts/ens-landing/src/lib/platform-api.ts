import { chartData, mockActivity, mockClients, mockMessages, mockProjects } from "@/lib/mock-data";
import { getRequestPortal } from "@/lib/portal";
import { fetchWithSessionRefresh } from "@/lib/auth-session";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api").replace(/\/+$/, "");
const ORGANIZATION_SLUG = import.meta.env.VITE_ORGANIZATION_SLUG ?? "ens-demo-agency";
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";
if (import.meta.env.PROD && USE_MOCK_API) {
  throw new Error(
    "[platform-api] VITE_USE_MOCK_API=true must not be set in production builds. " +
    "Use mock mode only for explicit local demo builds."
  );
}
const USE_REAL_MESSAGES = envFlag(import.meta.env.VITE_USE_REAL_MESSAGES, !USE_MOCK_API);
if (import.meta.env.PROD && !USE_MOCK_API && !USE_REAL_MESSAGES) {
  throw new Error(
    "[platform-api] VITE_USE_REAL_MESSAGES=false must not be set in production builds when the real API is enabled. " +
    "This flag must only be false in local development or explicit demo builds."
  );
}
const USE_REAL_CORE = envFlag(import.meta.env.VITE_USE_REAL_CORE, !USE_MOCK_API);
const MOCK_AUTH_STORAGE_KEY = "ens-mock-auth-user";
const MOCK_ACCOUNT_SETTINGS_PREFIX = "ens-mock-account-settings";
const MOCK_ACCOUNT_SESSIONS_PREFIX = "ens-mock-account-sessions";
const MOCK_NOTIFICATIONS_PREFIX = "ens-mock-notifications";
const MOCK_CALENDAR_PREFIX = "ens-mock-calendar-events";
const MOCK_PM_REQUESTS_KEY         = "ens-mock-pm-requests";
const MOCK_PROJECTS_KEY            = "ens-mock-projects";
const MOCK_CLIENT_STATUSES_KEY     = "ens-mock-client-statuses";
const MOCK_PM_TASKS_KEY            = "ens-mock-pm-tasks";

function envFlag(value: unknown, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export const ACCOUNT_SETTINGS_EVENT   = "ens-account-settings-updated";
export const PM_REQUESTS_UPDATED_EVENT = "ens-pm-requests-updated";

export interface PlatformMetrics {
  clients: number;
  projects: number;
  projectManagers: number;
  delayedProjects: number;
  pendingApprovals: number;
  activeWorkspaces: number;
  documents: number;
  comments: number;
  completedProjects: number;
}

export interface PlatformProject {
  id: string;
  clientId?: string | null;
  name: string;
  client: string;
  pm: string;
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
  lifecycleHistory?: PlatformProjectLifecycleHistoryItem[];
  lastUpdate: string;
}

export type ExhibitionStatus =
  | "planned" | "confirmed" | "in_production" | "on_site" | "live" | "completed" | "cancelled";

/** A show's own calendar. Internal deadlines are planned backwards from these. */
export interface PlatformExhibition {
  id: string;
  name: string;
  venue?: string | null;
  city?: string | null;
  country?: string | null;
  hall?: string | null;
  standNumber?: string | null;
  status: ExhibitionStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  moveInAt?: string | null;
  moveOutAt?: string | null;
  freightDeadlineAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  projectCount?: number;
  leadTime?: ExhibitionLeadTime;
}

export interface ExhibitionLeadTime {
  hasRunway: boolean;
  runwayDays: number | null;
  shortfallDays: number;
  feasible: boolean;
}

export interface PlatformProjectLifecycleHistoryItem {
  id: string;
  fromStage?: string | null;
  toStage: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  actorName: string;
  createdAt: string;
  time: string;
}

export interface PlatformProjectUpdateInput {
  name: string;
  client: string;
  managerId?: string | null;
  deadline: string;
  system: string;
  widthM: number;
  depthM: number;
  exhibition: string;
  description?: string;
}

export interface PlatformClient {
  id: string;
  userId?: string | null;
  name: string;
  company: string;
  contactName: string;
  contactEmail: string;
  projectId?: string | null;
  pm: string;
  exhibition: string;
  status: string;
  lastActivity: string;
}

export interface PlatformPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PlatformProjectListParams {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PlatformClientListParams {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PlatformProjectSummary {
  total: number;
  inDesign: number;
  review: number;
  delayed: number;
}

export interface PlatformClientSummary {
  total: number;
  active: number;
  needsSetup: number;
}

export type PmTaskColumn = "todo" | "in_progress" | "blocked" | "done";
export type PmTaskPriority = "High" | "Medium" | "Low";

export interface PmTask {
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

export interface PmTaskProjectOption {
  id: string;
  name: string;
  client: string;
}

export interface PmTaskBoard {
  tasks: PmTask[];
  projects: PmTaskProjectOption[];
}

export type PmRequestStatus = "Pending" | "In Progress" | "Resolved" | "Declined";
export type PmRequestPriority = "High" | "Medium" | "Low";

export interface PmRequestComment {
  id: string;
  text: string;
  author: string;
  isMe: boolean;
  time: string;
}

export interface PmRequestHistoryItem {
  id: string;
  type: string;
  message: string;
  actor: string;
  isMe: boolean;
  createdAt: string;
  time: string;
}

export interface PmRequestItem {
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

export interface PmRequestSummary {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  declined: number;
}

export interface PmRequestListParams {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export type PmReportPeriod = "this_week" | "last_week" | "this_month" | "last_month" | "this_quarter";

export interface PmReportPayload {
  period: PmReportPeriod;
  stats: {
    completionRate: number;
    completionRateDelta: number;
    satisfaction: number | null;
    satisfactionDelta: number | null;
    activeClients: number;
    activeClientsDelta: number;
    avgResponseHours: number;
    avgResponseHoursDelta: number;
  };
  weeklyData: Array<{ key: string; tasks: number; revisions: number; approvals: number }>;
  projectEfficiency: Array<{ name: string; efficiency: number; onTime: number }>;
  revisionTrend: Array<{ month: string; revisions: number; changes: number }>;
  statusPie: Array<{ key: string; value: number; color: string }>;
}

export interface ClientArchiveBlocker {
  id: string;
  name: string;
  status: string;
  deadline: string | null;
}

export class ClientArchiveBlockedError extends Error {
  projects: ClientArchiveBlocker[];

  constructor(message: string, projects: ClientArchiveBlocker[]) {
    super(message);
    this.name = "ClientArchiveBlockedError";
    this.projects = projects;
  }
}

export interface PlatformActivity {
  id: string;
  type: string;
  user: string;
  action: string;
  project: string;
  time: string;
}

export interface WorkspaceBoothState {
  width: number;
  depth: number;
  height: number;
  system: "octanorm" | "maxima";
  companyName: string;
  openFront: boolean;
  openBack: boolean;
  openLeft: boolean;
  openRight: boolean;
  fasciaEnabled?: boolean;
  fasciaOption?: "classic" | "full" | "custom";
}

export interface WorkspacePlacedItem {
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
  x?: number;
  z?: number;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  locked?: boolean;
  kind?: "furniture" | "light" | "structure" | "fascia" | "asset";
  shape?: string;
  modelUrl?: string;
  source?: string;
}

export interface WorkspaceRoom {
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
  wallFinish?: "white" | "frosted" | "glass" | "dark";
  floorColor?: string;
  locked?: boolean;
  designImageUrl?: string;
  designImageName?: string;
  designOpacity?: number;
}

export interface WorkspaceNote {
  id: string;
  text: string;
  color: string;
  createdAt: string;
}

export interface WorkspaceState {
  booth: WorkspaceBoothState;
  themeIdx: number;
  wallFinishIdx?: number;
  frameFinishIdx?: number;
  fasciaFinishIdx?: number;
  carpetIdx: number;
  lightingPreset?: "neutral" | "exhibition" | "accent" | "spotlight" | "ambient";
  placedItems: WorkspacePlacedItem[];
  rooms?: WorkspaceRoom[];
  notes: WorkspaceNote[];
  /** Canonical quote in USD cents from the PM BOM model; server persists per version. */
  quoteTotalCents?: number;
}

export interface WorkspaceVersion {
  id: string;
  versionNumber: number;
  status: string;
  title: string;
  snapshotUrl: string | null;
  assetSummary: Record<string, unknown>;
  costEstimateCents: number;
  submittedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  workspace: WorkspaceState;
}

export interface ClientArrangementPermissions {
  can_edit: boolean;
  can_save: boolean;
  can_send_arrangement: boolean;
  arrangement_round_limit: number;
  arrangement_rounds_used: number;
  arrangement_rounds_remaining: number | null;
  total_round_limit: number | null;
  subscription_active: boolean;
  subscription_unlimited: boolean;
  subscription_status: string;
  subscription_pending: boolean;
  subscription_required: boolean;
  subscription_plan: string | null;
  subscription_plan_label: string | null;
  subscription_price: number;
  subscription_currency: string;
  edit_disabled_reason: string | null;
}

export interface ProjectWorkspace {
  project: {
    id: string;
    name: string;
    client: string;
    exhibition: string | null;
    status: string;
    health: string;
  };
  design: {
    id: string;
    name: string;
    system: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
    currentVersionNumber: number;
  };
  currentVersion: Omit<WorkspaceVersion, "workspace"> | null;
  versions: WorkspaceVersion[];
  workspace: WorkspaceState;
  readonly: boolean;
  /** Number of change requests the client has already submitted */
  revisionCount: number;
  /** Maximum change requests allowed (business rule: 2) */
  revisionLimit: number;
  elementStatus?: Record<string, "approved" | "pending" | "rejected">;
  approved?: boolean;
  permissions?: ClientArrangementPermissions;
}

export type WorkspaceApprovalStage = "draft" | "sent" | "viewed" | "approved" | "revision_requested" | "locked";

export function workspaceApprovalStage(record: ProjectWorkspace | null | undefined): WorkspaceApprovalStage {
  const projectStatus = record?.project.status?.toLowerCase() ?? "";
  const versionStatus = record?.currentVersion?.status?.toLowerCase() ?? "";

  if (record?.currentVersion?.lockedAt) return "locked";
  if (record?.approved || projectStatus.includes("approved") || versionStatus.includes("approved")) return "approved";
  if (projectStatus.includes("revision") || versionStatus.includes("revision")) return "revision_requested";
  if (versionStatus.includes("viewed") || versionStatus.includes("under_review")) return "viewed";
  if (record?.currentVersion?.submittedAt || versionStatus.includes("submitted")) return "sent";
  return "draft";
}

export function workspaceApprovalStageLabel(stage: WorkspaceApprovalStage) {
  const labels: Record<WorkspaceApprovalStage, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    approved: "Approved",
    revision_requested: "Revision Requested",
    locked: "Locked",
  };
  return labels[stage];
}

export interface PlatformOverview {
  organization: { id: string; name: string; slug: string; plan: string } | null;
  metrics: PlatformMetrics;
  projects: PlatformProject[];
  clients: PlatformClient[];
  activity: PlatformActivity[];
  charts: {
    activity: Array<{ day: string; projects: number }>;
    distribution: Array<{ name: string; value: number; color: string }>;
    activityCount: number;
  };
  workflow?: ChiefWorkflowSummary | null;
}

export interface ChiefWorkflowSummary {
  unassignedClients: Array<{ id: string; name: string; contactEmail: string; exhibition: string; status: string; lastActivity: string }>;
  unassignedProjects: Array<{ id: string; name: string; client: string; exhibition: string; status: string; deadline: string | null }>;
  newProjectManagers: Array<{ id: string; name: string; email: string; company: string; createdAt: string | null }>;
  approvalAging: Array<{ id: string; name: string; client: string; status: string; waitingDays: number }>;
  workloadAlerts: Array<{
    id: string;
    name: string;
    activeProjects: number;
    clients: number;
    delayedProjects: number;
    workload: number;
    projectCapacity: number;
    clientCapacity: number;
    remainingProjects: number;
    remainingClients: number;
    overloaded: boolean;
  }>;
  counts: {
    pendingClientApprovals: number;
    unassignedClients: number;
    unassignedProjects: number;
    newProjectManagers: number;
    stalledApprovals: number;
    overloadedManagers: number;
  };
}

function normalizeChiefWorkflowSummary(value: ChiefWorkflowSummary): ChiefWorkflowSummary {
  const workflow = value as Partial<ChiefWorkflowSummary>;
  const counts = workflow.counts as Partial<ChiefWorkflowSummary["counts"]> | undefined;

  return {
    unassignedClients: Array.isArray(workflow.unassignedClients) ? workflow.unassignedClients : [],
    unassignedProjects: Array.isArray(workflow.unassignedProjects) ? workflow.unassignedProjects : [],
    newProjectManagers: Array.isArray(workflow.newProjectManagers) ? workflow.newProjectManagers : [],
    approvalAging: Array.isArray(workflow.approvalAging) ? workflow.approvalAging : [],
    workloadAlerts: Array.isArray(workflow.workloadAlerts) ? workflow.workloadAlerts : [],
    counts: {
      pendingClientApprovals: Number(counts?.pendingClientApprovals ?? 0),
      unassignedClients: Number(counts?.unassignedClients ?? 0),
      unassignedProjects: Number(counts?.unassignedProjects ?? 0),
      newProjectManagers: Number(counts?.newProjectManagers ?? 0),
      stalledApprovals: Number(counts?.stalledApprovals ?? 0),
      overloadedManagers: Number(counts?.overloadedManagers ?? 0),
    },
  };
}

function normalizePlatformOverview(value: PlatformOverview): PlatformOverview {
  const overview = value && typeof value === "object"
    ? value as Partial<PlatformOverview>
    : {};
  const metrics = overview.metrics as Partial<PlatformMetrics> | undefined;
  const charts = overview.charts as Partial<PlatformOverview["charts"]> | undefined;

  return {
    organization: overview.organization && typeof overview.organization === "object"
      ? overview.organization
      : null,
    metrics: {
      clients: finiteNumber(metrics?.clients),
      projects: finiteNumber(metrics?.projects),
      projectManagers: finiteNumber(metrics?.projectManagers),
      delayedProjects: finiteNumber(metrics?.delayedProjects),
      pendingApprovals: finiteNumber(metrics?.pendingApprovals),
      activeWorkspaces: finiteNumber(metrics?.activeWorkspaces),
      documents: finiteNumber(metrics?.documents),
      comments: finiteNumber(metrics?.comments),
      completedProjects: finiteNumber(metrics?.completedProjects),
    },
    projects: Array.isArray(overview.projects) ? overview.projects : [],
    clients: Array.isArray(overview.clients) ? overview.clients : [],
    activity: Array.isArray(overview.activity) ? overview.activity : [],
    charts: {
      activity: Array.isArray(charts?.activity) ? charts.activity : [],
      distribution: Array.isArray(charts?.distribution) ? charts.distribution : [],
      activityCount: finiteNumber(charts?.activityCount),
    },
    workflow: overview.workflow ? normalizeChiefWorkflowSummary(overview.workflow) : null,
  };
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export interface MessageContact {
  id: string;
  name: string;
  email: string;
  role: string;
  lastMessage: string;
  lastMessageAt: string | null;
  time: string;
  unread: number;
  online: boolean;
}

export interface DirectMessage {
  id: string;
  body: string;
  text: string;
  attachments?: DirectMessageAttachment[];
  senderUserId: string;
  isMe: boolean;
  read: boolean;
  createdAt: string;
  time: string;
}

export interface DirectMessageAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface MessageContext {
  exhibitionId?: string;
  exhibitionName?: string;
  projectId?: string;
}

export interface AccountProfile {
  name: string;
  email: string;
  phone: string;
  role: string;
  avatarTone: string;
  avatarUrl: string;
}

export interface AccountSettings {
  profile: AccountProfile;
  notifications: {
    assignments: boolean;
    milestones: boolean;
    reports: boolean;
    system: boolean;
  };
  appearance: {
    theme: "light" | "dark" | "system";
    compact: boolean;
    language: string;
  };
  security: {
    twoFactorEnabled: boolean;
    recoveryCodes: string[];
  };
}

export interface AccountSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  expiresAt?: string;
  current: boolean;
}

export interface SystemReadiness {
  ready: boolean;
  mode: "development" | "production" | "mock" | string;
  checks: Record<string, boolean>;
  limits?: {
    apiJsonLimit?: string;
  };
  storage?: {
    assetStorageProvider?: string;
    workspaceAssetDirConfigured?: boolean;
  };
  operational?: {
    pendingClients: number;
    unassignedProjects: number;
    failedInvitations: number;
    stalledReviews: number;
    overloadedPMs: number;
  };
  recentActivity?: Array<{
    id: string;
    eventType: string;
    message: string;
    actorName: string | null;
    projectName: string | null;
    createdAt: string;
  }>;
  warnings: string[];
}

export interface PlatformManager {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  rating: number;
  avatarUrl: string;
  avatarTone: string;
  workload: number;
  activeProjects: number;
  delayedProjects: number;
  urgentProjects: number;
  clients: number;
  capacity?: {
    activeProjects: number;
    clients: number;
    remainingProjects: number;
    remainingClients: number;
    overloaded: boolean;
  };
  nextDeadline: string | null;
  joinedAt: string;
}

export interface ManagedClient {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  managerId: string | null;
  managerName: string;
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

export interface ManagedProject {
  id: string;
  name: string;
  clientId: string;
  client: string;
  managerId: string | null;
  managerName: string;
  exhibition: string;
  status: string;
  health: string;
  progress: number;
  deadline: string | null;
  system: string;
}

export interface WorkspaceMonitorProject {
  id: string;
  name: string;
  client: string;
  system: string;
  status: "live" | "pending" | "review" | "blocked";
  version: string;
  dims: string;
  pm: string;
  managerId: string | null;
  lastActionMins: number;
  currentAction: string;
  waitingDays: number;
  progress: number;
}

export interface ManagerInvitation {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  emailStatus?: "pending" | "sent" | "failed" | "skipped";
  emailWarning?: string | null;
  token?: string;
  inviteUrl?: string;
  expiresAt: string;
  createdAt: string;
}

export interface ManagerWorkspace {
  managers: PlatformManager[];
  clients: ManagedClient[];
  projects: ManagedProject[];
  audit: PlatformActivity[];
  invitations: ManagerInvitation[];
}

export interface ManagerAssignmentItemsParams {
  managerId?: string | null;
  clientQ?: string;
  projectQ?: string;
  clientLimit?: number;
  clientOffset?: number;
  projectLimit?: number;
  projectOffset?: number;
}

export interface ManagerAssignmentItems {
  clients: ManagedClient[];
  projects: ManagedProject[];
  clientPagination: PlatformPagination;
  projectPagination: PlatformPagination;
}

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  read: boolean;
  createdAt: string;
  time: string;
}

export interface NotificationCenterPayload {
  unread: number;
  notifications: PlatformNotification[];
}

export interface ChiefReportPayload {
  range: "3M" | "6M" | "12M";
  revenueData: Array<{ month: string; revenue: number; target: number; projects: number }>;
  pmPerformance: Array<{ name: string; projects: number; satisfaction: number; onTime: number; revenue: number }>;
  systemSplit: Array<{ name: string; value: number; color: string }>;
  bottlenecks: Array<{ name: string; waitDays: number; stage: string }>;
  monthlyTrend: Array<{ month: string; revenue: number; projects: number; satisfaction: number }>;
}

export interface CalendarEvent {
  id: string;
  name: string;
  client: string;
  pm: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  standType: string;
}

export type CalendarEventInput = Omit<CalendarEvent, "id">;

export async function getPlatformOverview() {
  const overview = USE_MOCK_API && !USE_REAL_CORE
    ? mockPlatformOverview()
    : await apiGet<PlatformOverview>("/platform/overview");

  return normalizePlatformOverview(overview);
}

export async function getPlatformProjects(params: PlatformProjectListParams = {}) {
  if (USE_MOCK_API && !USE_REAL_CORE) {
    const limit = params.limit ?? 25;
    const offset = params.offset ?? 0;
    const q = params.q?.trim().toLowerCase() ?? "";
    const status = params.status?.trim();
    const filtered = mockPlatformProjects().filter((project) => {
      const matchesSearch = !q || [project.name, project.client, project.pm, project.exhibition, project.system]
        .some((value) => value.toLowerCase().includes(q));
      const matchesStatus = !status || chiefStatusParam(project.status) === chiefStatusParam(status) || project.status === status;
      return matchesSearch && matchesStatus;
    });
    const summary = projectSummary(filtered);
    return {
      projects: filtered.slice(offset, offset + limit),
      pagination: {
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length,
      },
      summary,
    };
  }

  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiGet<{ projects: PlatformProject[]; pagination: PlatformPagination; summary: PlatformProjectSummary }>(`/platform/projects${suffix}`);
}

export async function getPlatformExhibitions() {
  if (USE_MOCK_API && !USE_REAL_CORE) {
    const names = Array.from(new Set(mockPlatformProjects().map((project) => project.exhibition).filter(Boolean)));
    return {
      exhibitions: names.map((name, index) => ({
        id: `mock-exhibition-${index + 1}`,
        name,
        status: "confirmed" as const,
        createdAt: new Date().toISOString(),
      })),
    };
  }
  return apiGet<{ exhibitions: PlatformExhibition[] }>("/platform/exhibitions");
}

export async function createPlatformExhibition(input: {
  name: string;
  venue?: string;
  city?: string;
  country?: string;
  hall?: string;
  standNumber?: string;
  opensAt?: string | null;
  closesAt?: string | null;
  moveInAt?: string | null;
  moveOutAt?: string | null;
  freightDeadlineAt?: string | null;
}) {
  if (USE_MOCK_API && !USE_REAL_CORE) {
    return {
      exhibition: {
        id: `mock-exhibition-${Date.now()}`,
        name: input.name,
        venue: input.venue || null,
        city: input.city || null,
        opensAt: input.opensAt || null,
        closesAt: input.closesAt || null,
        moveInAt: input.moveInAt || null,
        status: "planned" as const,
        createdAt: new Date().toISOString(),
      },
    };
  }
  return apiJson<{ exhibition: PlatformExhibition; leadTime: ExhibitionLeadTime }>("/platform/exhibitions", input);
}

export async function createPlatformProject(input: {
  name: string;
  client?: string;
  clientId?: string;
  system: string;
  width: string;
  depth: string;
  deadline: string;
  exhibition?: string;
  managerId?: string;
}) {
  const client = input.client?.trim() || "Unassigned client";
  const exhibition = input.exhibition?.trim() || input.name;
  if (USE_MOCK_API) {
    const newProject: PlatformProject = {
      id: `mock-project-${Date.now()}`,
      name: input.name,
      client,
      pm: "Project Manager",
      status: "Planning",
      health: "On Track",
      progress: 0,
      deadline: input.deadline || null,
      system: input.system,
      dimensions: `${input.width} x ${input.depth} m`,
      exhibition,
      standType: input.system,
      description: "",
      lastUpdate: "Just now",
    };
    saveMockPlatformProjects([newProject, ...mockPlatformProjects()]);
    return { project: newProject };
  }

  return apiJson<{ project: PlatformProject }>("/platform/projects", {
    name: input.name,
    client,
    clientId: input.clientId?.trim() || null,
    system: input.system,
    widthM: Number(input.width),
    depthM: Number(input.depth),
    deadline: input.deadline || null,
    exhibition,
    managerId: input.managerId && input.managerId !== "unassigned" ? input.managerId : null,
  });
}

export async function updatePlatformProjectStage(projectId: string, stage: string) {
  if (USE_MOCK_API) {
    const projects = mockPlatformProjects().map((project) =>
      project.id === projectId
        ? {
            ...project,
            pipelineStage: stage,
            status: stage === "closed" ? "Completed" : stage === "review" ? "Active" : stage === "production" ? "Active" : "Pending",
            lastUpdate: "Just now",
          }
        : project,
    );
    saveMockPlatformProjects(projects);
    return { ok: true, project: projects.find((project) => project.id === projectId) ?? null, projects };
  }
  return apiJsonWithMethod<{ ok: boolean; project: { id: string; name: string }; projects: PlatformProject[] }>(
    "PUT",
    `/platform/projects/${projectId}/pipeline-stage`,
    { stage },
  );
}

export async function updatePlatformProject(projectId: string, input: PlatformProjectUpdateInput) {
  if (USE_MOCK_API) {
    const manager = input.managerId ? mockManagerWorkspace().managers.find((item) => item.id === input.managerId) : null;
    const projects = mockPlatformProjects().map((project) =>
      project.id === projectId
        ? {
            ...project,
            name: input.name,
            client: input.client,
            pm: input.managerId === undefined ? project.pm : manager?.name ?? "Unassigned",
            deadline: input.deadline || null,
            system: input.system,
            dimensions: `${input.widthM} x ${input.depthM} m`,
            exhibition: input.exhibition || input.name,
            description: input.description ?? project.description,
            lastUpdate: "Just now",
          }
        : project,
    );
    saveMockPlatformProjects(projects);
    return { ok: true, project: projects.find((project) => project.id === projectId) ?? projects[0], projects };
  }

  return apiJsonWithMethod<{ ok: boolean; project: PlatformProject; projects: PlatformProject[] }>(
    "PUT",
    `/platform/projects/${projectId}`,
    input,
  );
}

export async function deletePlatformProject(projectId: string) {
  if (USE_MOCK_API) {
    const projects = mockPlatformProjects().filter((p) => p.id !== projectId);
    saveMockPlatformProjects(projects);
    return { ok: true, projects };
  }
  return apiDelete<{ ok: boolean; projects: PlatformProject[] }>(`/platform/projects/${projectId}`);
}

// ── Mock task store helpers ────────────────────────────────────────────────────
function mockPmTasksStore(): PmTask[] {
  const raw = localStorage.getItem(MOCK_PM_TASKS_KEY);
  if (raw) {
    try { return JSON.parse(raw) as PmTask[]; } catch { /* fall through */ }
  }
  return [];
}

function saveMockPmTasks(tasks: PmTask[]): PmTask[] {
  localStorage.setItem(MOCK_PM_TASKS_KEY, JSON.stringify(tasks));
  return tasks;
}

function mockTaskBoard(): PmTaskBoard {
  return {
    tasks: mockPmTasksStore(),
    projects: mockPlatformProjects().slice(0, 20).map((project) => ({
      id: project.id,
      name: project.name,
      client: project.client,
    })),
  };
}

export async function getPmTaskBoard() {
  if (USE_MOCK_API) return mockTaskBoard();
  return apiGet<PmTaskBoard>("/platform/tasks");
}

export async function createPmTask(input: {
  title: string;
  projectId: string;
  priority: PmTaskPriority;
  deadline: string;
  status: PmTaskColumn;
  notes?: string;
}) {
  if (USE_MOCK_API) {
    const projects = mockPlatformProjects();
    const project = projects.find((p) => p.id === input.projectId);
    const newTask: PmTask = {
      id: `task-${Date.now()}`,
      title: input.title,
      client: project?.client ?? "",
      project: project?.name ?? "",
      projectId: input.projectId,
      priority: input.priority,
      deadline: input.deadline,
      col: input.status,
      notes: input.notes?.trim() || undefined,
    };
    saveMockPmTasks([...mockPmTasksStore(), newTask]);
    return mockTaskBoard();
  }
  return apiJson<PmTaskBoard>("/platform/tasks", input);
}

export async function updatePmTask(taskId: string, input: Partial<{
  title: string;
  projectId: string;
  priority: PmTaskPriority;
  deadline: string | null;
  status: PmTaskColumn;
  notes: string | null;
}>) {
  if (USE_MOCK_API) {
    const tasks = mockPmTasksStore();
    const projects = mockPlatformProjects();
    const updated = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const project = input.projectId ? projects.find((p) => p.id === input.projectId) : null;
      return {
        ...task,
        ...(input.title !== undefined && { title: input.title }),
        ...(input.projectId !== undefined && { projectId: input.projectId }),
        ...(project && { client: project.client, project: project.name }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.deadline !== undefined && { deadline: input.deadline ?? "" }),
        ...(input.status !== undefined && { col: input.status }),
        ...(input.notes !== undefined && { notes: input.notes ?? undefined }),
      } as PmTask;
    });
    saveMockPmTasks(updated);
    return mockTaskBoard();
  }
  return apiPatch<PmTaskBoard>(`/platform/tasks/${taskId}`, input);
}

export async function deletePmTask(taskId: string) {
  if (USE_MOCK_API) {
    saveMockPmTasks(mockPmTasksStore().filter((task) => task.id !== taskId));
    return mockTaskBoard();
  }
  return apiDelete<PmTaskBoard>(`/platform/tasks/${taskId}`);
}

export async function getPmRequests(params: PmRequestListParams = {}) {
  if (USE_MOCK_API) {
    const stored = mockPmRequestsStore();
    const q = params.q?.trim().toLowerCase() ?? "";
    const status = params.status?.trim();
    const filtered = stored.filter((req) => {
      const matchesSearch = !q || [req.client, req.project, req.request].some((v) => v.toLowerCase().includes(q));
      const matchesStatus = !status || req.status === status;
      return matchesSearch && matchesStatus;
    });
    const limit = params.limit ?? 10;
    const offset = params.offset ?? 0;
    const page = filtered.slice(offset, offset + limit);
    const pending    = stored.filter((r) => r.status === "Pending").length;
    const inProgress = stored.filter((r) => r.status === "In Progress").length;
    const resolved   = stored.filter((r) => r.status === "Resolved").length;
    const declined   = stored.filter((r) => r.status === "Declined").length;
    return {
      requests: page,
      pagination: { total: filtered.length, limit, offset, hasMore: offset + limit < filtered.length },
      summary: { total: stored.length, pending, inProgress, resolved, declined },
    };
  }
  return apiGet<{ requests: PmRequestItem[]; pagination: PlatformPagination; summary: PmRequestSummary }>(`/platform/requests${pmRequestQuerySuffix(params)}`);
}

export async function updatePmRequestStatus(requestId: string, status: PmRequestStatus, params: PmRequestListParams = {}) {
  if (USE_MOCK_API) {
    const stored = mockPmRequestsStore();
    saveMockPmRequests(stored.map((r) => r.id === requestId ? { ...r, status } : r));
    window.dispatchEvent(new Event(PM_REQUESTS_UPDATED_EVENT));
    return getPmRequests(params);
  }
  const result = await apiPatch<{ requests: PmRequestItem[]; pagination: PlatformPagination; summary: PmRequestSummary }>(`/platform/requests/${requestId}/status${pmRequestQuerySuffix(params)}`, { status });
  window.dispatchEvent(new Event(PM_REQUESTS_UPDATED_EVENT));
  return result;
}

export async function replyPmRequest(requestId: string, body: string, params: PmRequestListParams = {}) {
  if (USE_MOCK_API) {
    const stored = mockPmRequestsStore();
    const comment: PmRequestComment = {
      id: `mock-comment-${Date.now()}`,
      text: body,
      author: "PM",
      isMe: true,
      time: "Just now",
    };
    saveMockPmRequests(stored.map((r) => r.id === requestId ? { ...r, comments: [...r.comments, comment] } : r));
    return getPmRequests(params);
  }
  return apiJson<{ requests: PmRequestItem[]; pagination: PlatformPagination; summary: PmRequestSummary }>(`/platform/requests/${requestId}/replies${pmRequestQuerySuffix(params)}`, { body });
}

function pmRequestQuerySuffix(params: PmRequestListParams) {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  return query.toString() ? `?${query.toString()}` : "";
}

export async function getPlatformClients(params: PlatformClientListParams = {}) {
  if (USE_MOCK_API && !USE_REAL_CORE) {
    const limit = params.limit ?? 25;
    const offset = params.offset ?? 0;
    const q = params.q?.trim().toLowerCase() ?? "";
    const status = params.status?.trim();
    const filtered = mockPlatformClients().filter((client) => {
      const matchesStatus = !status || client.status === status;
      const matchesSearch = !q || [client.name, client.company, client.contactEmail, client.exhibition, client.pm]
        .some((value) => value.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
    const summary = clientSummary(filtered);
    return {
      clients: filtered.slice(offset, offset + limit),
      pagination: {
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length,
      },
      summary,
    };
  }

  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiGet<{ clients: PlatformClient[]; pagination: PlatformPagination; summary: PlatformClientSummary }>(`/platform/clients${suffix}`);
}

export async function createPlatformClient(input: {
  name: string;
  company: string;
  email: string;
  exhibition: string;
}) {
  if (USE_MOCK_API) {
    return {
      clients: [
        {
          id: `client-${Date.now()}`,
          name: input.name,
          company: input.company || input.name,
          contactName: input.name,
          contactEmail: input.email || "pending@email.local",
          pm: "Unassigned",
          exhibition: input.exhibition || "New Exhibition",
          status: "Pending",
          lastActivity: "Just now",
        },
        ...mockPlatformClients(),
      ],
    };
  }
  return apiJson<{ clients: PlatformClient[] }>("/platform/clients", {
    name: input.name,
    company: input.company,
    email: input.email,
    exhibition: input.exhibition,
  });
}

export async function updatePlatformClient(clientId: string, input: {
  name: string;
  company: string;
  email: string;
  exhibition: string;
}) {
  if (USE_MOCK_API) {
    return {
      ok: true,
      clients: mockPlatformClients().map((client) =>
        client.id === clientId
          ? {
              ...client,
              name: input.company || input.name,
              company: input.company || input.name,
              contactName: input.name,
              contactEmail: input.email || "pending@email.local",
              exhibition: input.exhibition || "No active exhibition",
              lastActivity: "Just now",
            }
          : client,
      ),
    };
  }
  return apiJsonWithMethod<{ ok: boolean; clients: PlatformClient[] }>("PUT", `/platform/clients/${clientId}`, {
    name: input.name,
    company: input.company,
    email: input.email,
    exhibition: input.exhibition,
  });
}

export async function deletePlatformClient(clientId: string) {
  if (USE_MOCK_API) {
    return {
      ok: true,
      clients: mockPlatformClients().filter((client) => client.id !== clientId),
    };
  }
  const response = await apiFetch(`/platform/clients/${clientId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await readApiBody<{ error?: string; projects?: ClientArchiveBlocker[] }>(response);
    if (response.status === 409 && body?.projects?.length) {
      throw new ClientArchiveBlockedError(body.error ?? "Client has active projects and cannot be archived", body.projects);
    }
    throw new Error(apiErrorMessage(body, response));
  }

  return response.json() as Promise<{ ok: boolean; clients: PlatformClient[] }>;
}

export async function updatePlatformClientStatus(clientId: string, status: string) {
  if (USE_MOCK_API) {
    saveMockClientStatus(clientId, status);
    return { ok: true, clients: mockPlatformClients() };
  }
  return apiJsonWithMethod<{ ok: boolean; clients: PlatformClient[] }>(
    "PUT",
    `/platform/clients/${clientId}/status`,
    { status },
  );
}

export async function approvePlatformClient(clientId: string, input: {
  managerId: string;
  note?: string;
  confirmOverCapacity?: boolean;
  overrideReason?: string | null;
}) {
  if (USE_MOCK_API) {
    const manager = mockManagerWorkspace().managers.find((item) => item.id === input.managerId);
    return {
      ok: true,
      clients: mockPlatformClients().map((client) => client.id === clientId
        ? { ...client, status: "Active", pm: manager?.name ?? "Assigned" }
        : client),
    };
  }
  return apiPatch<{ ok: boolean; clients: PlatformClient[] }>(`/platform/clients/${clientId}/approve`, input);
}

export async function rejectPlatformClient(clientId: string, reason: string) {
  if (USE_MOCK_API) {
    return {
      ok: true,
      clients: mockPlatformClients().map((client) => client.id === clientId
        ? { ...client, status: "Archived" }
        : client),
    };
  }
  return apiPatch<{ ok: boolean; clients: PlatformClient[] }>(`/platform/clients/${clientId}/reject`, { reason });
}

export async function getCurrentWorkspace() {
  if (USE_MOCK_API) return mockProjectWorkspace();
  return apiGet<ProjectWorkspace>("/platform/workspace/current");
}

export async function getProjectWorkspace(projectId: string) {
  if (USE_MOCK_API) return mockProjectWorkspace(projectId);
  return apiGet<ProjectWorkspace>(`/platform/projects/${projectId}/workspace`);
}

export async function saveProjectWorkspace(projectId: string, workspace: WorkspaceState, title = "Workspace draft") {
  if (USE_MOCK_API) return { ...mockProjectWorkspace(projectId), workspace };
  return apiJsonWithMethod<ProjectWorkspace>("PUT", `/platform/projects/${projectId}/workspace`, {
    title,
    workspace,
  });
}

export interface WorkspaceComment {
  id: string;
  user: string;
  initials: string;
  text: string;
  time: string;
  type: "comment" | "change" | "pin";
  pin?: { x: number; y: number; z?: number } | null;
  status?: "open" | "resolved";
  resolvedAt?: string | null;
}

export async function getWorkspaceComments(projectId: string): Promise<{ comments: WorkspaceComment[] }> {
  if (USE_MOCK_API) return { comments: [] };
  return apiGet<{ comments: WorkspaceComment[] }>(`/platform/projects/${projectId}/comments`);
}

export async function createWorkspaceComment(
  projectId: string,
  body: string,
  pin?: { x: number; y: number; z?: number } | null,
  type?: "comment" | "change" | "pin"
): Promise<{ comment: WorkspaceComment }> {
  if (USE_MOCK_API) {
    return {
      comment: {
        id: `mock-comment-${Date.now()}`,
        user: "You",
        initials: "YO",
        text: body,
        time: "Just now",
        type: pin ? "pin" : type || "comment",
        pin: pin || null,
        status: "open",
        resolvedAt: null,
      }
    };
  }
  return apiJson<{ comment: WorkspaceComment }>(`/platform/projects/${projectId}/comments`, { body, pin, type });
}

export async function updateWorkspaceCommentStatus(
  projectId: string,
  commentId: string,
  status: "open" | "resolved",
): Promise<{ comment: Pick<WorkspaceComment, "id" | "status" | "resolvedAt"> }> {
  if (USE_MOCK_API) {
    return {
      comment: {
        id: commentId,
        status,
        resolvedAt: status === "resolved" ? new Date().toISOString() : null,
      },
    };
  }
  return apiJsonWithMethod("PUT", `/platform/projects/${projectId}/comments/${commentId}/status`, { status });
}

export async function deleteWorkspaceComment(projectId: string, commentId: string): Promise<{ ok: boolean }> {
  if (USE_MOCK_API) return { ok: true };
  return apiJsonWithMethod("DELETE", `/platform/projects/${projectId}/comments/${commentId}`, undefined);
}

export async function saveElementStatus(
  projectId: string,
  elementStatus: Record<string, string>
): Promise<{ ok: boolean; elementStatus: Record<string, string> }> {
  if (USE_MOCK_API) return { ok: true, elementStatus };
  return apiJsonWithMethod("PUT", `/platform/projects/${projectId}/element-status`, { elementStatus });
}

export async function approveProjectWorkspace(projectId: string): Promise<ProjectWorkspace> {
  if (USE_MOCK_API) return mockProjectWorkspace(projectId);
  return apiJsonWithMethod("POST", `/platform/projects/${projectId}/approve`, {});
}

export async function createProjectWorkspaceVersion(projectId: string, workspace: WorkspaceState, title: string, status: "draft" | "submitted" = "draft") {
  if (USE_MOCK_API) return { ...mockProjectWorkspace(projectId), workspace };
  return apiJsonWithMethod<ProjectWorkspace>("POST", `/platform/projects/${projectId}/workspace/versions`, {
    title,
    status,
    workspace,
  });
}

export interface WorkspaceAssetUpload {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export async function uploadWorkspaceAsset(
  projectId: string,
  input: { dataUrl: string; name?: string; purpose?: "panel" | "room" | "fascia" | "logo" | "snapshot" | "workspace" },
): Promise<{ asset: WorkspaceAssetUpload }> {
  if (USE_MOCK_API) {
    return {
      asset: {
        id: `mock-asset-${Date.now()}`,
        url: input.dataUrl,
        mimeType: input.dataUrl.slice(5, input.dataUrl.indexOf(";")) || "image/png",
        size: input.dataUrl.length,
        originalName: input.name || "workspace-image",
      },
    };
  }
  return apiJson<{ asset: WorkspaceAssetUpload }>(`/platform/projects/${projectId}/workspace/assets`, input);
}

export async function createWorkspaceSubscriptionRequest(projectId: string, plan: string): Promise<{ checkout_url: string; already_active?: boolean }> {
  if (USE_MOCK_API) {
    return { checkout_url: `http://localhost:5000/api/platform/workspace/billing/simulation?reference=mock-${projectId}&plan=${plan}&client_id=demo-client-id&redirect=${encodeURIComponent(window.location.href)}` };
  }
  return apiJson<{ checkout_url: string; already_active?: boolean }>(`/platform/projects/${projectId}/workspace/subscription-request`, { plan });
}

/**
 * Client submits a change request for a workspace version.
 * Enforces a hard limit of `revisionLimit` requests per project.
 * Returns the updated ProjectWorkspace so the UI can reflect the new count.
 */
export async function submitClientChangeRequest(
  projectId: string,
  changeText: string,
): Promise<ProjectWorkspace> {
  if (USE_MOCK_API) {
    const current = mockProjectWorkspace(projectId);
    if (current.revisionCount >= current.revisionLimit) {
      throw new Error(
        `Revision limit reached (${current.revisionLimit}/${current.revisionLimit}). No further change requests are allowed.`,
      );
    }
    const revisionKey = `${MOCK_REVISION_COUNT_PREFIX}:${projectId}`;
    const next = current.revisionCount + 1;
    localStorage.setItem(revisionKey, String(next));
    // Persist the change text as a note for the PM to see
    const pmRequestsKey = "ens-mock-pm-requests";
    const raw = localStorage.getItem(pmRequestsKey);
    const existing: PmRequestItem[] = raw ? (JSON.parse(raw) as PmRequestItem[]) : [];
    const newRequest: PmRequestItem = {
      id: `req-client-${Date.now()}`,
      client: current.project.client,
      project: current.project.name,
      priority: "High",
      timestamp: "Just now",
      status: "Pending",
      request: changeText,
      comments: [],
    };
    localStorage.setItem(pmRequestsKey, JSON.stringify([newRequest, ...existing]));
    return mockProjectWorkspace(projectId);
  }
  return apiJson<ProjectWorkspace>(`/platform/projects/${projectId}/change-requests`, { changeText });
}

export async function getMessageContacts() {
  if (USE_MOCK_API || !USE_REAL_MESSAGES) return { contacts: mockMessageContacts() };
  return apiGet<{ contacts: MessageContact[] }>("/platform/messages/contacts");
}

export async function getConversationMessages(contactId: string, context?: MessageContext) {
  if (USE_MOCK_API || !USE_REAL_MESSAGES) return { conversationId: mockConversationId(contactId, context), messages: mockConversationMessages(contactId, context) };
  const params = messageContextSearchParams(context);
  return apiGet<{ conversationId: string; messages: DirectMessage[] }>(`/platform/messages/${contactId}${params}`);
}

export async function sendConversationMessage(
  contactId: string,
  body: string,
  context?: MessageContext,
  attachments: DirectMessageAttachment[] = [],
) {
  if (USE_MOCK_API || !USE_REAL_MESSAGES) {
    const current = mockConversationMessages(contactId, context);
    const message = {
      id: `mock-message-${Date.now()}`,
      body,
      text: body,
      attachments,
      senderUserId: "mock-current-user",
      isMe: true,
      read: true,
      createdAt: new Date().toISOString(),
      time: "Just now",
    };
    localStorage.setItem(mockConversationStorageKey(contactId, context), JSON.stringify([...current, message]));
    return {
      message,
    };
  }

  return apiJson<{ message: DirectMessage }>(`/platform/messages/${contactId}`, { body, context, attachments });
}

export async function uploadConversationAttachment(file: File) {
  if (USE_MOCK_API || !USE_REAL_MESSAGES) {
    return {
      attachment: {
        id: `mock-attachment-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      },
    };
  }

  const response = await apiFetch("/platform/messages/attachments", {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
      ...actorHeaders(),
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<{ attachment: DirectMessageAttachment }>;
}

export function messageAttachmentHref(attachment: DirectMessageAttachment) {
  const url = attachment.url ?? `/platform/messages/attachments/${attachment.id}`;
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
}

export async function getAccountSettings() {
  if (USE_MOCK_API) return mockAccountSettings();
  return apiGet<AccountSettings>("/platform/account/settings");
}

export async function saveAccountSettings(input: Partial<AccountSettings>) {
  if (USE_MOCK_API) return saveMockAccountSettings(input);
  const settings = await apiJsonWithMethod<AccountSettings>("PUT", "/platform/account/settings", input);
  notifyAccountSettingsUpdated(settings);
  return settings;
}

export async function saveAccountAvatar(input: { avatarUrl: string; avatarTone: string }) {
  if (USE_MOCK_API) return saveMockAccountSettings({ profile: input } as Partial<AccountSettings>);
  const settings = await apiJsonWithMethod<AccountSettings>("PUT", "/platform/account/avatar", input);
  notifyAccountSettingsUpdated(settings);
  return settings;
}

// ── Two-factor authentication (TOTP) ──────────────────────────────────────────
export interface TwoFactorStatus {
  enabled: boolean;
  pending: boolean;
  backupCodesRemaining: number;
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return apiGet<TwoFactorStatus>("/auth/2fa/status");
}

export async function startTwoFactorSetup(): Promise<{ secret: string; otpauthUri: string }> {
  return apiJsonWithMethod("POST", "/auth/2fa/setup", {});
}

export async function enableTwoFactor(code: string): Promise<{ enabled: boolean; backupCodes: string[] }> {
  return apiJsonWithMethod("POST", "/auth/2fa/enable", { code });
}

export async function disableTwoFactor(code: string): Promise<{ enabled: boolean }> {
  return apiJsonWithMethod("POST", "/auth/2fa/disable", { code });
}

// ── Public lead intake ("Request a quote") ────────────────────────────────────
export interface LeadIntakeInput {
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  exhibitionName?: string;
  boothSize?: string;
  budget?: string;
  timeline?: string;
  message?: string;
}

export async function submitLead(input: LeadIntakeInput): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/leads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    let message = "Could not submit your request. Please try again.";
    try {
      const body = await response.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
}

// ── Quotes / proposals ────────────────────────────────────────────────────────
export interface QuoteLineItem {
  description: string;
  sku?: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  kind?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  title: string | null;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "revised";
  currency: string;
  lineItems: QuoteLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  terms: string | null;
  validUntil: string | null;
  clientId: string | null;
  projectId: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteInput {
  clientId?: string;
  projectId?: string;
  title?: string;
  currency?: string;
  discountCents?: number;
  taxCents?: number;
  notes?: string;
  terms?: string;
  validUntil?: string;
  lineItems: Array<{ description: string; sku?: string; quantity: number; unitPriceCents: number; kind?: string }>;
}

export async function listQuotes(params?: { status?: string; projectId?: string }): Promise<Quote[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.projectId) qs.set("projectId", params.projectId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const body = await apiGet<{ quotes: Quote[] }>(`/platform/quotes${suffix}`);
  return body.quotes;
}

export async function getQuote(id: string): Promise<Quote> {
  const body = await apiGet<{ quote: Quote }>(`/platform/quotes/${id}`);
  return body.quote;
}

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const body = await apiJsonWithMethod<{ quote: Quote }>("POST", "/platform/quotes", input);
  return body.quote;
}

export async function updateQuote(id: string, input: Partial<CreateQuoteInput>): Promise<Quote> {
  const body = await apiJsonWithMethod<{ quote: Quote }>("PUT", `/platform/quotes/${id}`, input);
  return body.quote;
}

export async function sendQuote(id: string): Promise<Quote> {
  const body = await apiJsonWithMethod<{ quote: Quote }>("POST", `/platform/quotes/${id}/send`, {});
  return body.quote;
}

export async function respondToQuote(id: string, decision: "accept" | "reject", note?: string): Promise<Quote> {
  const body = await apiJsonWithMethod<{ quote: Quote }>("POST", `/platform/quotes/${id}/respond`, { decision, note });
  return body.quote;
}

export async function deleteQuote(id: string): Promise<void> {
  await apiJsonWithMethod("DELETE", `/platform/quotes/${id}`, {});
}

// ── Invoices / billing ────────────────────────────────────────────────────────
export interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string | null;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  currency: string;
  lineItems: QuoteLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  notes: string | null;
  dueAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  clientId: string | null;
  projectId: string | null;
  quoteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  clientId?: string;
  projectId?: string;
  quoteId?: string;
  title?: string;
  currency?: string;
  discountCents?: number;
  taxCents?: number;
  notes?: string;
  dueAt?: string;
  lineItems?: Array<{ description: string; sku?: string; quantity: number; unitPriceCents: number; kind?: string }>;
}

export async function listInvoices(params?: { status?: string }): Promise<Invoice[]> {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
  const body = await apiGet<{ invoices: Invoice[] }>(`/platform/invoices${qs}`);
  return body.invoices;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const body = await apiGet<{ invoice: Invoice }>(`/platform/invoices/${id}`);
  return body.invoice;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const body = await apiJsonWithMethod<{ invoice: Invoice }>("POST", "/platform/invoices", input);
  return body.invoice;
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const body = await apiJsonWithMethod<{ invoice: Invoice }>("POST", `/platform/invoices/${id}/send`, {});
  return body.invoice;
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  const body = await apiJsonWithMethod<{ invoice: Invoice }>("POST", `/platform/invoices/${id}/mark-paid`, {});
  return body.invoice;
}

export async function voidInvoice(id: string): Promise<Invoice> {
  const body = await apiJsonWithMethod<{ invoice: Invoice }>("POST", `/platform/invoices/${id}/void`, {});
  return body.invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiJsonWithMethod("DELETE", `/platform/invoices/${id}`, {});
}

// ── CRM lead pipeline ─────────────────────────────────────────────────────────
export type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export interface PipelineLead {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string | null;
  status: string;
  leadStage: LeadStage;
  leadValueCents: number;
  leadStageChangedAt: string | null;
  nextFollowUpAt: string | null;
  lostReason: string | null;
  assignedPmUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineColumn { leads: PipelineLead[]; count: number; valueCents: number; }
export interface Pipeline { stages: LeadStage[]; columns: Record<LeadStage, PipelineColumn>; }

export async function getPipeline(): Promise<Pipeline> {
  return apiGet<Pipeline>("/platform/pipeline");
}

export async function updateLeadStage(clientId: string, stage: LeadStage, lostReason?: string): Promise<PipelineLead> {
  const body = await apiJsonWithMethod<{ lead: PipelineLead }>("PATCH", `/platform/leads/${clientId}/stage`, { stage, lostReason });
  return body.lead;
}

export async function updateLead(
  clientId: string,
  input: { leadValueCents?: number; nextFollowUpAt?: string | null; assignedPmUserId?: string | null },
): Promise<PipelineLead> {
  const body = await apiJsonWithMethod<{ lead: PipelineLead }>("PATCH", `/platform/leads/${clientId}`, input);
  return body.lead;
}

export async function updateAccountPassword(input: { currentPassword: string; newPassword: string }) {
  if (USE_MOCK_API) return undefined;
  await apiJsonWithMethod<void>("PUT", "/platform/account/password", input);
}

export async function getAccountSessions() {
  if (USE_MOCK_API) return { sessions: mockAccountSessions() };
  return apiGet<{ sessions: AccountSession[] }>("/platform/account/sessions");
}

export async function revokeAccountSession(sessionId: string) {
  if (USE_MOCK_API) {
    const next = mockAccountSessions().filter((session) => session.id === sessionId ? session.current : true);
    localStorage.setItem(mockAccountSessionsKey(), JSON.stringify(next));
    return { revoked: 1 };
  }
  return apiDelete<{ revoked: number }>(`/platform/account/sessions/${sessionId}`);
}

export async function getManagerWorkspace() {
  if (USE_MOCK_API) return mockManagerWorkspace();
  return apiGet<ManagerWorkspace>("/platform/managers");
}

export async function getManagerAssignmentItems(params: ManagerAssignmentItemsParams = {}) {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const clientLimit = params.clientLimit ?? 20;
    const projectLimit = params.projectLimit ?? 20;
    const clientOffset = params.clientOffset ?? 0;
    const projectOffset = params.projectOffset ?? 0;
    const managerId = params.managerId ?? null;
    const clientQ = params.clientQ?.trim().toLowerCase() ?? "";
    const projectQ = params.projectQ?.trim().toLowerCase() ?? "";
    const clients = workspace.clients.filter((client) => {
      const matchesManager = !managerId || client.managerId === managerId || !client.managerId;
      const matchesSearch = !clientQ || [client.name, client.contactName, client.contactEmail, client.exhibition, client.managerName]
        .some((value) => value.toLowerCase().includes(clientQ));
      return matchesManager && matchesSearch;
    });
    const projects = workspace.projects.filter((project) => {
      const matchesManager = !managerId || project.managerId === managerId || !project.managerId;
      const matchesSearch = !projectQ || [project.name, project.client, project.exhibition, project.system, project.managerName]
        .some((value) => value.toLowerCase().includes(projectQ));
      return matchesManager && matchesSearch;
    });
    return {
      clients: clients.slice(clientOffset, clientOffset + clientLimit),
      projects: projects.slice(projectOffset, projectOffset + projectLimit),
      clientPagination: {
        total: clients.length,
        limit: clientLimit,
        offset: clientOffset,
        hasMore: clientOffset + clientLimit < clients.length,
      },
      projectPagination: {
        total: projects.length,
        limit: projectLimit,
        offset: projectOffset,
        hasMore: projectOffset + projectLimit < projects.length,
      },
    };
  }

  const query = new URLSearchParams();
  if (params.managerId) query.set("managerId", params.managerId);
  if (params.clientQ?.trim()) query.set("clientQ", params.clientQ.trim());
  if (params.projectQ?.trim()) query.set("projectQ", params.projectQ.trim());
  if (params.clientLimit) query.set("clientLimit", String(params.clientLimit));
  if (params.clientOffset) query.set("clientOffset", String(params.clientOffset));
  if (params.projectLimit) query.set("projectLimit", String(params.projectLimit));
  if (params.projectOffset) query.set("projectOffset", String(params.projectOffset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiGet<ManagerAssignmentItems>(`/platform/managers/assignment-items${suffix}`);
}

export async function getWorkspaceMonitor() {
  if (USE_MOCK_API) {
    return {
      projects: mockWorkspaceMonitorProjects(),
      managers: mockManagerWorkspace().managers,
    };
  }
  return apiGet<{ projects: WorkspaceMonitorProject[]; managers: PlatformManager[] }>("/platform/workspaces/monitor");
}

export async function getSystemReadiness() {
  if (USE_MOCK_API) {
    return {
      ready: false,
      mode: "mock",
      checks: {
        databaseConfigured: false,
        emailConfigured: false,
        appUrlConfigured: false,
        staffAccessConfigured: false,
        authSecretConfigured: false,
        assetStorageConfigured: false,
        productionMode: false,
      },
      limits: { apiJsonLimit: "mock" },
      storage: { assetStorageProvider: "mock", workspaceAssetDirConfigured: false },
      operational: {
        pendingClients: 0,
        unassignedProjects: 0,
        failedInvitations: 0,
        stalledReviews: 0,
        overloadedPMs: 0,
      },
      recentActivity: [],
      warnings: ["Mock mode is active. This is not production-ready."],
    } satisfies SystemReadiness;
  }
  return apiGet<SystemReadiness>("/platform/system/readiness");
}

export async function invitePlatformManager(input: { name: string; email: string }): Promise<{ invitation: ManagerInvitation }> {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const invitation: ManagerInvitation = {
      id: `mock-invite-${Date.now()}`,
      name: input.name,
      email: input.email,
      role: "pm",
      status: "Pending",
      emailStatus: "sent",
      emailWarning: null,
      token: `mock-token-${Date.now()}`,
      inviteUrl: `/pm/join?token=mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    saveMockManagerWorkspace({ ...workspace, invitations: [invitation, ...workspace.invitations] });
    return { invitation };
  }
  return apiJson<{ invitation: ManagerInvitation }>("/platform/managers/invitations", input);
}

export async function resendManagerInvitation(invitationId: string): Promise<{ invitation: ManagerInvitation }> {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const invitations: ManagerInvitation[] = workspace.invitations.map((invitation) => (
      invitation.id === invitationId
        ? {
            ...invitation,
            status: "Pending",
            emailStatus: "sent",
            emailWarning: null,
            token: `mock-token-${Date.now()}`,
            inviteUrl: `/pm/join?token=mock-token-${Date.now()}`,
            expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          }
        : invitation
    ));
    const invitation = invitations.find((item) => item.id === invitationId);
    saveMockManagerWorkspace({ ...workspace, invitations });
    if (!invitation) throw new Error("Invitation was not found");
    return { invitation };
  }
  return apiJson<{ invitation: ManagerInvitation }>(`/platform/managers/invitations/${invitationId}/resend`, {});
}

export async function revokeManagerInvitation(invitationId: string) {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const invitations = workspace.invitations.map((invitation) => (
      invitation.id === invitationId ? { ...invitation, status: "Revoked" } : invitation
    ));
    saveMockManagerWorkspace({ ...workspace, invitations });
    return { ok: true, invitations };
  }
  return apiDelete<{ ok: boolean; invitations: ManagerInvitation[] }>(`/platform/managers/invitations/${invitationId}`);
}

export async function updateManagerAssignments(input: {
  clientAssignments: Array<{ clientId: string; managerId: string | null }>;
  projectAssignments: Array<{ projectId: string; managerId: string | null }>;
  cascadeClientProjects: boolean;
  confirmOverCapacity?: boolean;
  overrideReason?: string | null;
}) {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const clients = workspace.clients.map((client) => {
      const assignment = input.clientAssignments.find((item) => item.clientId === client.id);
      if (!assignment) return client;
      const manager = workspace.managers.find((item) => item.id === assignment.managerId);
      return { ...client, managerId: assignment.managerId, managerName: manager?.name ?? "Unassigned" };
    });
    const projects = workspace.projects.map((project) => {
      const direct = input.projectAssignments.find((item) => item.projectId === project.id);
      const cascaded = input.cascadeClientProjects
        ? input.clientAssignments.find((item) => item.clientId === project.clientId)
        : undefined;
      const assignment = direct ?? cascaded;
      if (!assignment) return project;
      const manager = workspace.managers.find((item) => item.id === assignment.managerId);
      return { ...project, managerId: assignment.managerId, managerName: manager?.name ?? "Unassigned" };
    });
    const next = { ...workspace, clients, projects };
    saveMockManagerWorkspace(next);
    return next;
  }
  return apiJsonWithMethod<ManagerWorkspace>("PUT", "/platform/managers/assignments", input);
}

export async function updateManagerStatus(managerId: string, status: "active" | "suspended") {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const next = {
      ...workspace,
      managers: workspace.managers.map((manager) => manager.id === managerId ? { ...manager, status: status === "active" ? "Active" : "On Leave" } : manager),
    };
    saveMockManagerWorkspace(next);
    return { ok: true };
  }
  return apiPatch<{ ok: boolean }>(`/platform/managers/${managerId}/status`, { status });
}

export async function updateManagerRating(managerId: string, rating: number) {
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const next = {
      ...workspace,
      managers: workspace.managers.map((manager) =>
        manager.id === managerId ? { ...manager, rating: Math.round(rating * 10) / 10 } : manager
      ),
    };
    saveMockManagerWorkspace(next);
    return { ok: true };
  }
  return apiPatch<{ ok: boolean }>(`/platform/managers/${managerId}/rating`, { rating });
}

export async function sendManagerReminder(managerId: string, input: { itemCount: number; delayedCount: number; urgentCount: number }) {
  if (USE_MOCK_API) return { ok: true };
  return apiJson<{ ok: boolean }>(`/platform/managers/${managerId}/reminders`, input);
}

export async function getNotifications() {
  if (USE_MOCK_API) return mockNotifications();
  return apiGet<NotificationCenterPayload>("/platform/notifications");
}

export async function markNotificationRead(notificationId: string) {
  if (USE_MOCK_API) return markMockNotificationRead(notificationId);
  return apiPatch<{ ok: boolean } & NotificationCenterPayload>(`/platform/notifications/${notificationId}/read`, {});
}

export async function markAllNotificationsRead() {
  if (USE_MOCK_API) return markAllMockNotificationsRead();
  return apiPatch<{ updated: number } & NotificationCenterPayload>("/platform/notifications/read-all", {});
}

export async function recordReportExport(input: { report: string; range?: string; format: string; href?: string }) {
  if (USE_MOCK_API) {
    const current = mockNotifications().notifications;
    saveMockNotifications([
      {
        id: `mock-report-export-${Date.now()}`,
        title: "Report exported",
        body: `${input.report} was exported as ${input.format.toUpperCase()}.`,
        href: input.href ?? "/chief/reports",
        readAt: null,
        read: false,
        createdAt: new Date().toISOString(),
        time: "Just now",
      },
      ...current,
    ]);
    return { ok: true };
  }
  return apiJson<{ ok: boolean }>("/platform/reports/export-audit", input);
}

export interface PipelineFlowReport {
  stages: { stage: string; projects: number; avgDays: number }[];
  slowest: { projectId: string; name: string; stage: string; days: number }[];
}

export async function getPipelineFlowReport() {
  return apiGet<PipelineFlowReport>("/platform/reports/pipeline-flow");
}

export async function getChiefReport(range: "3M" | "6M" | "12M") {
  if (USE_MOCK_API) return mockChiefReport(range);
  return apiGet<ChiefReportPayload>(`/platform/reports/chief?range=${encodeURIComponent(range)}`);
}

export async function getPmReport(period: PmReportPeriod) {
  if (USE_MOCK_API) return mockPmReport(period);
  return apiGet<PmReportPayload>(`/platform/reports/pm?period=${encodeURIComponent(period)}`);
}

export async function getPlatformCalendar() {
  if (USE_MOCK_API) return { events: mockCalendarEvents() };
  return apiGet<{ events: CalendarEvent[] }>("/platform/calendar");
}

export async function createCalendarEvent(input: CalendarEventInput) {
  if (USE_MOCK_API) {
    const events = [{ id: `mock-calendar-${Date.now()}`, ...input }, ...mockCalendarEvents()];
    return { event: events[0], ...saveMockCalendarEvents(events) };
  }
  return apiJson<{ event: CalendarEvent; events: CalendarEvent[] }>("/platform/calendar/events", input);
}

export async function updateCalendarEvent(eventId: string, input: CalendarEventInput) {
  if (USE_MOCK_API) {
    const events = mockCalendarEvents().map((event) => event.id === eventId ? { id: eventId, ...input } : event);
    const event = events.find((item) => item.id === eventId);
    if (!event) throw new Error("Calendar event was not found");
    return { event, ...saveMockCalendarEvents(events) };
  }
  return apiJsonWithMethod<{ event: CalendarEvent; events: CalendarEvent[] }>("PUT", `/platform/calendar/events/${eventId}`, input);
}

export async function deleteCalendarEvent(eventId: string) {
  if (USE_MOCK_API) {
    return { ok: true, ...saveMockCalendarEvents(mockCalendarEvents().filter((event) => event.id !== eventId)) };
  }
  return apiDelete<{ ok: boolean; events: CalendarEvent[] }>(`/platform/calendar/events/${eventId}`);
}

// ---------------------------------------------------------------------------
// Invitation acceptance (PM join flow)
// ---------------------------------------------------------------------------

export interface InviteTokenPayload {
  valid: boolean;
  email: string;
  name: string | null;
  expiresAt: string;
  role: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

export function invitationTokenFromInput(input: string): string {
  const value = input.trim();
  if (!value) return "";

  try {
    const url = new URL(value, "http://localhost");
    const token = url.searchParams.get("token") ?? url.searchParams.get("invite");
    if (token?.trim()) return token.trim();
  } catch {
    // A raw invitation code is valid input and does not need URL parsing.
  }

  return value.replace(/\s+/g, "");
}

export async function validateInviteToken(token: string): Promise<InviteTokenPayload> {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const invitation = workspace.invitations.find((inv) => inv.token === token);
    if (!invitation || invitation.status === "Revoked") {
      throw new Error("This invitation link is invalid. Please ask your administrator for a new one.");
    }
    if (invitation.status === "Accepted") {
      throw new Error("This invitation has already been used. Please log in with your credentials.");
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error("This invitation link has expired. Please ask your administrator to resend the invitation.");
    }
    return {
      valid: true,
      email: invitation.email,
      name: invitation.name ?? null,
      expiresAt: invitation.expiresAt,
      role: invitation.role,
      organization: {
        id: "mock-organization",
        name: "ENS Demo Agency",
        slug: "ens-demo-agency",
      },
    };
  }
  return apiGet<InviteTokenPayload>(`/platform/managers/invitations/validate?token=${encodeURIComponent(token)}`);
}

export async function acceptManagerInvitation(token: string, input: { name: string; password: string }): Promise<{ ok: boolean }> {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const invitation = workspace.invitations.find((inv) => inv.token === token);
    if (!invitation || invitation.status !== "Pending") {
      throw new Error("Invalid or already used invitation link.");
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error("This invitation link has expired.");
    }
    const invitations = workspace.invitations.map((inv) =>
      inv.id === invitation.id ? { ...inv, status: "Accepted", name: input.name } : inv
    );
    saveMockManagerWorkspace({ ...workspace, invitations });
    return { ok: true };
  }
  return apiJson<{ ok: boolean }>("/platform/managers/invitations/accept", { token, ...input });
}

// ── Client Documents ─────────────────────────────────────────────────────────

export interface ClientDocument {
  id: string;
  projectId: string | null;
  clientId: string | null;
  kind: string;
  visibility: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  uploadedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export async function getClientDocuments(projectId?: string): Promise<ClientDocument[]> {
  if (USE_MOCK_API) return [];
  const params = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const data = await apiGet<{ documents: ClientDocument[] }>(`/platform/documents${params}`);
  return data.documents;
}

export function getDocumentDownloadUrl(documentId: string): string {
  return `${API_BASE_URL}/platform/documents/${documentId}/download`;
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiJson<{ ok: boolean }>("/auth/forgot-password", { email, organizationSlug: ORGANIZATION_SLUG });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiJson<{ ok: boolean }>("/auth/reset-password", { token, password });
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path, {
    credentials: "include",
    headers: {
      accept: "application/json",
      ...actorHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function apiJson<T>(path: string, body: unknown): Promise<T> {
  return apiJsonWithMethod<T>("POST", path, body);
}

async function apiJsonWithMethod<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method,
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...actorHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...actorHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

async function apiDelete<T>(path: string): Promise<T> {
  const response = await apiFetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: {
      accept: "application/json",
      ...actorHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  return fetchWithSessionRefresh(API_BASE_URL, path, init);
}

async function readApiError(response: Response) {
  const body = await readApiBody<{ error?: string | { message?: string } }>(response);
  return apiErrorMessage(body, response);
}

async function readApiBody<T>(response: Response) {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

function apiErrorMessage(body: { error?: string | { message?: string } } | null, response: Response) {
  if (typeof body?.error === "string") return body.error;
  if (body?.error && typeof body.error === "object" && body.error.message) return body.error.message;
  return `API request failed: ${response.status} ${response.statusText}`;
}

function actorHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ens-portal": getRequestPortal(),
  };
  const user = readMockAuthUser();
  if (!user) return headers;
  return {
    ...headers,
    "x-user-id": String(user.id),
    "x-user-name": encodeURIComponent(String(user.name ?? "")),
    "x-user-email": String(user.email ?? ""),
    "x-user-role": String(user.role ?? ""),
    "x-user-company": String(user.company ?? ""),
  };
}

function mockPlatformOverview(): PlatformOverview {
  const projects = mockPlatformProjects();

  return {
    organization: { id: "mock-org", name: "ENS Demo Agency", slug: ORGANIZATION_SLUG, plan: "Demo" },
    metrics: {
      clients: mockClients.length,
      projects: projects.length,
      projectManagers: new Set(projects.map((project) => project.pm)).size,
      delayedProjects: projects.filter((project) => project.status === "Delayed").length,
      pendingApprovals: projects.filter((project) => project.status === "Pending").length,
      activeWorkspaces: projects.filter((project) => project.status === "Active").length,
      documents: 12,
      comments: mockMessages.length,
      completedProjects: projects.filter((project) => project.status === "Completed").length,
    },
    projects,
    clients: mockPlatformClients(),
    activity: mockActivity.map((item) => ({
      id: String(item.id),
      type: item.type,
      user: item.user,
      action: item.action,
      project: item.project,
      time: item.time,
    })),
    charts: {
      activity: chartData.activity,
      distribution: chartData.distribution,
      activityCount: mockActivity.length,
    },
  };
}

function mockPlatformProjectsSeed(): PlatformProject[] {
  return mockProjects.map((project) => ({
    id: project.id,
    name: project.name,
    client: project.client,
    pm: project.pm,
    status: project.status,
    health: project.status === "Delayed" ? "At Risk" : "On Track",
    progress: project.progress,
    deadline: project.deadline,
    system: project.system,
    dimensions: project.dimensions,
    exhibition: project.exhibition,
    standType: project.standType,
    description: project.description,
    lastUpdate: project.lastUpdate,
  }));
}

function mockPlatformProjects(): PlatformProject[] {
  try {
    const raw = localStorage.getItem(MOCK_PROJECTS_KEY);
    if (raw) return JSON.parse(raw) as PlatformProject[];
  } catch { /* ignore */ }
  return mockPlatformProjectsSeed();
}

function saveMockPlatformProjects(projects: PlatformProject[]) {
  localStorage.setItem(MOCK_PROJECTS_KEY, JSON.stringify(projects));
}

function projectSummary(projects: PlatformProject[]): PlatformProjectSummary {
  return {
    total: projects.length,
    inDesign: projects.filter((project) => project.status === "In Design").length,
    review: projects.filter((project) => project.status === "Client Review" || project.status === "Revision").length,
    delayed: projects.filter((project) => project.status === "Delayed" || project.health.toLowerCase().includes("risk")).length,
  };
}

function chiefStatusParam(status: string) {
  const value = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (value.includes("delay")) return "delayed";
  if (value.includes("complete") || value.includes("approved")) return "completed";
  if (value.includes("active") || value.includes("review") || value.includes("design") || value.includes("production")) return "active";
  return "pending";
}

function readMockClientStatuses(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MOCK_CLIENT_STATUSES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveMockClientStatus(clientId: string, status: string) {
  const current = readMockClientStatuses();
  current[clientId] = status;
  localStorage.setItem(MOCK_CLIENT_STATUSES_KEY, JSON.stringify(current));
}

function mockPlatformClients(): PlatformClient[] {
  const projectsByClient = mockPlatformProjects();
  const statusOverrides = readMockClientStatuses();
  return mockClients.map((client) => ({
    id: client.id,
    name: client.name,
    company: client.name,
    contactName: client.name,
    contactEmail: `${client.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.com`,
    projectId: projectsByClient.find((project) => project.client === client.name)?.id ?? null,
    pm: client.pm,
    exhibition: client.exhibition,
    status: statusOverrides[client.id] ?? client.status,
    lastActivity: client.lastActivity,
  }));
}

function clientSummary(clients: PlatformClient[]): PlatformClientSummary {
  return {
    total: clients.length,
    active: clients.filter((client) => client.status === "Active").length,
    needsSetup: clients.filter((client) => client.status === "Lead" || client.status === "Pending").length,
  };
}

function mockChiefReport(range: "3M" | "6M" | "12M"): ChiefReportPayload {
  const months = range === "3M" ? 3 : range === "12M" ? 12 : 6;
  const projects = mockPlatformProjects();
  const monthLabels = Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - months + index + 1);
    return date.toLocaleString("en-US", { month: "short" });
  });
  const revenueData = monthLabels.map((month, index) => {
    const count = Math.max(1, Math.round(projects.length / months) + (index % 2));
    const revenue = count * 38_000 + index * 4_200;
    return { month, revenue, target: Math.round(revenue * 0.92), projects: count };
  });
  const pmNames = Array.from(new Set(projects.map((project) => project.pm || "Unassigned")));
  const pmPerformance = pmNames.map((name) => {
    const pmProjects = projects.filter((project) => (project.pm || "Unassigned") === name);
    const delayed = pmProjects.filter((project) => project.status === "Delayed").length;
    const onTime = pmProjects.length ? Math.round(((pmProjects.length - delayed) / pmProjects.length) * 100) : 0;
    return {
      name,
      projects: pmProjects.length,
      satisfaction: Number(Math.min(5, 4.1 + onTime / 120).toFixed(1)),
      onTime,
      revenue: pmProjects.length * 42_000,
    };
  });
  const systems = Array.from(new Set(projects.map((project) => project.system || "Custom")));
  const systemSplit = systems.map((system, index) => ({
    name: system,
    value: Math.round((projects.filter((project) => project.system === system).length / Math.max(1, projects.length)) * 100),
    color: index === 0 ? "#1d4ed8" : index === 1 ? "#c2410c" : "#2f7d3a",
  }));
  const bottlenecks = projects
    .filter((project) => project.status === "Delayed" || project.status === "Pending")
    .slice(0, 6)
    .map((project, index) => ({ name: project.name, waitDays: 2 + index, stage: project.status }));

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
      satisfaction: Number((4.1 + item.projects / 20).toFixed(1)),
    })),
  };
}

function mockPmReport(period: PmReportPeriod): PmReportPayload {
  const projects = mockPlatformProjects();
  const active = projects.filter((project) => project.status !== "Completed");
  const delayed = projects.filter((project) => project.status === "Delayed" || project.health.toLowerCase().includes("risk"));

  // Build the weekly-activity axis differently per period
  const isWeekly = period === "this_week" || period === "last_week";
  const isMonthly = period === "this_month" || period === "last_month";
  const activityKeys: string[] = isWeekly
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : isMonthly
      ? ["W1", "W2", "W3", "W4"]
      : ["Jan", "Feb", "Mar"]; // quarter

  const weeklyData = activityKeys.map((key, index) => ({
    key,
    tasks: Math.max(0, projects.length - (index % 3)),
    revisions: (index + 1) % 3,
    approvals: index % 2,
  }));

  // Completion-rate delta varies by period to show something meaningful
  const completionRate = projects.length
    ? Math.round((projects.filter((project) => project.status === "Completed").length / projects.length) * 100)
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
      activeClients: clientSummary(mockPlatformClients()).active,
      activeClientsDelta: 0,
      avgResponseHours: period === "this_week" ? 3.2 : period === "this_month" ? 4.1 : 3.8,
      avgResponseHoursDelta: 0,
    },
    weeklyData,
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
      { key: "pending", value: projects.filter((project) => project.status === "Pending").length, color: "#d97706" },
      { key: "review", value: projects.filter((project) => project.status === "Client Review" || project.status === "Revision").length, color: "#1d4ed8" },
      { key: "delayed", value: delayed.length, color: "#dc2626" },
    ].filter((item) => item.value > 0),
  };
}

const MOCK_REVISION_COUNT_PREFIX = "ens-mock-revision-count";

function mockProjectWorkspace(projectId = "p1"): ProjectWorkspace {
  const project = mockPlatformProjects().find((item) => item.id === projectId) ?? mockPlatformProjects()[0];
  const workspace: WorkspaceState = {
    booth: {
      width: 6,
      depth: 3,
      height: 3,
      system: project.system.toLowerCase().includes("maxima") ? "maxima" : "octanorm",
      companyName: project.client,
      openFront: true,
      openBack: false,
      openLeft: false,
      openRight: false,
    },
    themeIdx: 0,
    carpetIdx: 0,
    placedItems: [],
    notes: [],
  };

  const revisionKey = `${MOCK_REVISION_COUNT_PREFIX}:${project.id}`;
  const revisionCount = Number(localStorage.getItem(revisionKey) ?? "0");

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
      id: "mock-design",
      name: `${project.name} Design`,
      system: project.system,
      widthMm: 6000,
      depthMm: 3000,
      heightMm: 3000,
      currentVersionNumber: 1,
    },
    currentVersion: null,
    versions: [],
    workspace,
    readonly: false,
    revisionCount,
    revisionLimit: 2,
  };
}


function mockMessageContacts(): MessageContact[] {
  const role = readMockAuthUser()?.role ?? "chief";

  if (role === "pm") {
    return [{
      id: "demo-chief",
      name: "Owner Chief",
      email: "owner@demo.example",
      role: "chief",
      lastMessage: "Review the latest workspace notes when ready.",
      lastMessageAt: new Date().toISOString(),
      time: "1 day ago",
      unread: 1,
      online: false,
    }];
  }

  return mockManagerWorkspace().managers.map((manager, index) => ({
    id: manager.id,
    name: manager.name,
    email: manager.email,
    role: "pm",
    lastMessage: index === 0 ? mockMessages[0]?.text ?? "No messages yet." : "No messages yet.",
    lastMessageAt: index === 0 ? new Date().toISOString() : null,
    time: index === 0 ? "2 hours ago" : "",
    unread: 0,
    online: manager.status === "Active",
  }));
}

function mockConversationMessages(contactId: string, context?: MessageContext): DirectMessage[] {
  const raw = localStorage.getItem(mockConversationStorageKey(contactId, context));
  if (raw) {
    try {
      return JSON.parse(raw) as DirectMessage[];
    } catch {
      localStorage.removeItem(mockConversationStorageKey(contactId, context));
    }
  }

  const exhibitionName = context?.exhibitionName ?? "this exhibition";
  const seed = [
    {
      id: "seed-1",
      sender: contactId,
      text: `I have the latest workspace notes ready for ${exhibitionName}.`,
      time: "2 hours ago",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isMe: false,
    },
    {
      id: "seed-2",
      sender: "mock-current-user",
      text: `Keep all updates in this thread for ${exhibitionName}.`,
      time: "1 hour ago",
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      isMe: true,
    },
  ];

  return seed.map((message) => ({
    id: message.id,
    body: message.text,
    text: message.text,
    senderUserId: message.sender,
    isMe: message.isMe,
    read: true,
    createdAt: message.createdAt,
    time: message.time,
  }));
}

function mockConversationId(contactId: string, context?: MessageContext) {
  return `mock-${contactId}-${context?.exhibitionId ?? "general"}`;
}

function mockConversationStorageKey(contactId: string, context?: MessageContext) {
  return `ens-mock-conversation:${mockAccountId()}:${contactId}:${context?.exhibitionId ?? "general"}`;
}

function messageContextSearchParams(context?: MessageContext) {
  const params = new URLSearchParams();
  if (context?.exhibitionId) params.set("exhibitionId", context.exhibitionId);
  if (context?.exhibitionName) params.set("exhibitionName", context.exhibitionName);
  if (context?.projectId) params.set("projectId", context.projectId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function mockAccountSettings(): AccountSettings {
  const key = mockAccountSettingsKey();
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw) as AccountSettings;
    } catch {
      localStorage.removeItem(key);
    }
  }

  const user = readMockAuthUser();
  const role = user?.role ?? "chief";
  return {
    profile: {
      name: user?.name ?? defaultMockName(role),
      email: user?.email ?? defaultMockEmail(role),
      phone: "",
      role: user?.systemRole ?? role,
      avatarTone: role === "pm" ? "blue" : role === "client" ? "green" : "primary",
      avatarUrl: "",
    },
    notifications: {
      assignments: true,
      milestones: true,
      reports: true,
      system: true,
    },
    appearance: {
      theme: "dark",
      compact: false,
      language: "English (US)",
    },
    security: {
      twoFactorEnabled: false,
      recoveryCodes: [],
    },
  };
}

function saveMockAccountSettings(input: Partial<AccountSettings>): AccountSettings {
  const current = mockAccountSettings();
  const next: AccountSettings = {
    profile: { ...current.profile, ...input.profile },
    notifications: { ...current.notifications, ...input.notifications },
    appearance: { ...current.appearance, ...input.appearance },
    security: { ...current.security, ...input.security },
  };
  localStorage.setItem(mockAccountSettingsKey(), JSON.stringify(next));
  notifyAccountSettingsUpdated(next);
  return next;
}

function mockAccountSessions(): AccountSession[] {
  const key = mockAccountSessionsKey();
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw) as AccountSession[];
    } catch {
      localStorage.removeItem(key);
    }
  }

  return [
    { id: "mock-session-current", device: "Chrome on Windows", location: "Local dev", lastActive: "Now", current: true },
    { id: "mock-session-phone", device: "Safari on iPhone", location: "Istanbul, TR", lastActive: "Yesterday", current: false },
  ];
}

function notifyAccountSettingsUpdated(settings: AccountSettings) {
  window.dispatchEvent(new CustomEvent(ACCOUNT_SETTINGS_EVENT, { detail: settings }));
}

function mockAccountSettingsKey() {
  return `${MOCK_ACCOUNT_SETTINGS_PREFIX}:${mockAccountId()}`;
}

function mockAccountSessionsKey() {
  return `${MOCK_ACCOUNT_SESSIONS_PREFIX}:${mockAccountId()}`;
}

function mockAccountId() {
  const user = readMockAuthUser();
  return user?.id ?? user?.email ?? "anonymous";
}

function readMockAuthUser(): { id?: string; name?: string; email?: string; company?: string; role?: string; systemRole?: string } | null {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as { id?: string; name?: string; email?: string; company?: string; role?: string; systemRole?: string } : null;
  } catch {
    return null;
  }
}

function defaultMockName(role: string) {
  if (role === "pm") return "Project Manager";
  if (role === "client") return "Client Reviewer";
  return "Owner Chief";
}

function defaultMockEmail(role: string) {
  if (role === "pm") return "pm@demo.example";
  if (role === "client") return "client@demo.example";
  return "owner@demo.example";
}

function mockManagerWorkspace(): ManagerWorkspace {
  const raw = localStorage.getItem("ens-mock-manager-workspace");
  if (raw) {
    try {
      return JSON.parse(raw) as ManagerWorkspace;
    } catch {
      localStorage.removeItem("ens-mock-manager-workspace");
    }
  }

  const projects: ManagedProject[] = mockPlatformProjects().map((project, index) => ({
    id: project.id,
    name: project.name,
    clientId: `c${index + 1}`,
    client: project.client,
    managerId: index === 0 ? "m1" : index === 1 ? "m2" : "m3",
    managerName: project.pm,
    exhibition: project.exhibition,
    status: project.status,
    health: project.health,
    progress: project.progress,
    deadline: project.deadline,
    system: project.system,
  }));

  const clients: ManagedClient[] = mockPlatformClients().map((client, index) => ({
    ...client,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    managerId: index === 0 ? "m1" : index === 1 ? "m2" : "m3",
    managerName: client.pm,
  }));

  const managers: PlatformManager[] = [
    { id: "m1", name: "John Doe", email: "john.doe@demo.example", role: "Project Manager", status: "Active", rating: 4.8, avatarUrl: "", avatarTone: "blue", workload: 76, activeProjects: 1, delayedProjects: 0, urgentProjects: 0, clients: 1, nextDeadline: "2026-06-04", joinedAt: "2026-01-10" },
    { id: "m2", name: "Jane Smith", email: "jane.smith@demo.example", role: "Project Manager", status: "Active", rating: 4.9, avatarUrl: "", avatarTone: "green", workload: 66, activeProjects: 1, delayedProjects: 1, urgentProjects: 1, clients: 1, nextDeadline: "2026-06-12", joinedAt: "2026-01-12" },
    { id: "m3", name: "Mike Ross", email: "mike.ross@demo.example", role: "Project Manager", status: "On Leave", rating: 4.5, avatarUrl: "", avatarTone: "amber", workload: 35, activeProjects: 1, delayedProjects: 0, urgentProjects: 0, clients: 1, nextDeadline: "2026-09-01", joinedAt: "2026-02-01" },
  ];

  return {
    managers,
    clients,
    projects,
    invitations: [],
    audit: mockActivity.map((item) => ({
      id: String(item.id),
      type: item.type,
      user: item.user,
      action: item.action,
      project: item.project,
      time: item.time,
    })),
  };
}

function saveMockManagerWorkspace(workspace: ManagerWorkspace) {
  localStorage.setItem("ens-mock-manager-workspace", JSON.stringify(workspace));
}

function mockWorkspaceMonitorProjects(): WorkspaceMonitorProject[] {
  const statuses: WorkspaceMonitorProject["status"][] = ["live", "review", "live", "pending", "blocked", "live"];
  return mockManagerWorkspace().projects.map((project, index) => ({
    id: project.id,
    name: project.name,
    client: project.client,
    system: project.system,
    status: statuses[index % statuses.length],
    version: `v${2 + (index % 3)}.0`,
    dims: ["6x3", "8x6", "4x4", "10x5", "6x6"][index % 5],
    pm: project.managerName,
    managerId: project.managerId,
    lastActionMins: [1, 5, 12, 35, 92, 180][index % 6],
    currentAction: project.health === "Delayed" ? "Waiting for recovery action" : "Workspace updated",
    waitingDays: project.health === "Delayed" ? 5 : [0, 0, 2, 1][index % 4],
    progress: project.progress,
  }));
}

function mockNotifications(): NotificationCenterPayload {
  const key = `${MOCK_NOTIFICATIONS_PREFIX}:${mockAccountId()}`;
  const raw = localStorage.getItem(key);
  const notifications = raw
    ? JSON.parse(raw) as PlatformNotification[]
    : [
        {
          id: "mock-notification-1",
          title: "Chief manager reminder",
          body: "Review delayed and due-soon project items.",
          href: "/chief/projects",
          readAt: null,
          read: false,
          createdAt: new Date().toISOString(),
          time: "Just now",
        },
      ];

  localStorage.setItem(key, JSON.stringify(notifications));
  return {
    unread: notifications.filter((notification) => !notification.readAt).length,
    notifications,
  };
}

function saveMockNotifications(notifications: PlatformNotification[]) {
  const key = `${MOCK_NOTIFICATIONS_PREFIX}:${mockAccountId()}`;
  localStorage.setItem(key, JSON.stringify(notifications));
  return {
    unread: notifications.filter((notification) => !notification.readAt).length,
    notifications,
  };
}

function markMockNotificationRead(notificationId: string) {
  const current = mockNotifications().notifications;
  return { ok: true, ...saveMockNotifications(current.map((notification) => (
    notification.id === notificationId ? { ...notification, readAt: new Date().toISOString(), read: true } : notification
  ))) };
}

function markAllMockNotificationsRead() {
  const current = mockNotifications().notifications;
  return {
    updated: current.filter((notification) => !notification.readAt).length,
    ...saveMockNotifications(current.map((notification) => ({ ...notification, readAt: notification.readAt ?? new Date().toISOString(), read: true }))),
  };
}

function mockCalendarEvents(): CalendarEvent[] {
  const key = `${MOCK_CALENDAR_PREFIX}:${mockAccountId()}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw) as CalendarEvent[];
    } catch {
      localStorage.removeItem(key);
    }
  }

  const workspace = mockManagerWorkspace();
  const events = workspace.projects.map((project) => ({
    id: project.id,
    name: project.exhibition || project.name,
    client: project.client,
    pm: project.managerName,
    status: project.status,
    startDate: project.deadline ?? "2026-06-01",
    endDate: project.deadline ?? "2026-06-01",
    location: "Location TBD",
    standType: project.system,
  }));
  saveMockCalendarEvents(events);
  return events;
}

function saveMockCalendarEvents(events: CalendarEvent[]) {
  const key = `${MOCK_CALENDAR_PREFIX}:${mockAccountId()}`;
  localStorage.setItem(key, JSON.stringify(events));
  return { events };
}

// ── PM Requests mock store ─────────────────────────────────────────────────────

const MOCK_REQUESTS_SEED: PmRequestItem[] = [
  {
    id: "req-1",
    client: "TechCorp Industries",
    project: "TechCon 2024",
    priority: "High",
    timestamp: "2h ago",
    status: "Pending",
    request: "Change the back wall to charcoal and add a small storage unit behind the reception desk. Also, can we increase the reception counter width by 20cm?",
    comments: [],
  },
  {
    id: "req-2",
    client: "MediLife",
    project: "HealthExpo Booth",
    priority: "Medium",
    timestamp: "5h ago",
    status: "In Progress",
    request: "Increase the height of the fascia by 20cm to accommodate the new logo size. The logo was recently rebranded and needs more vertical space.",
    comments: [
      { id: "c1", author: "MediLife", isMe: false, time: "6h ago",
        text: "Working on the fascia update now — will send revised render by EOD." },
    ],
  },
  {
    id: "req-3",
    client: "FastCars Co",
    project: "AutoShow Premium Stand",
    priority: "Low",
    timestamp: "1d ago",
    status: "Resolved",
    request: "Add 4 more spotlights to the left display area. The current lighting feels insufficient for the product showcase.",
    comments: [
      { id: "c2", author: "PM", isMe: true, time: "22h ago",
        text: "Spotlights added in v2.3. Client confirmed it looks great." },
    ],
  },
  {
    id: "req-4",
    client: "GreenTech",
    project: "EcoFair Stand",
    priority: "Medium",
    timestamp: "2d ago",
    status: "Pending",
    request: "The carpet color needs to match our brand green. Current dark gray does not align with our sustainability message.",
    comments: [],
  },
  {
    id: "req-5",
    client: "RetailBrand",
    project: "RetailPeak Expo",
    priority: "High",
    timestamp: "3d ago",
    status: "Declined",
    request: "Move the entire stand to a corner configuration with two open sides instead of the original single open-front.",
    comments: [
      { id: "c3", author: "PM", isMe: true, time: "2d ago",
        text: "Unfortunately the venue floor plan does not permit corner configuration at this booth size." },
    ],
  },
];

function mockPmRequestsStore(): PmRequestItem[] {
  const raw = localStorage.getItem(MOCK_PM_REQUESTS_KEY);
  if (raw) {
    try { return JSON.parse(raw) as PmRequestItem[]; } catch { /* fall through */ }
  }
  localStorage.setItem(MOCK_PM_REQUESTS_KEY, JSON.stringify(MOCK_REQUESTS_SEED));
  return MOCK_REQUESTS_SEED;
}

function saveMockPmRequests(requests: PmRequestItem[]): PmRequestItem[] {
  localStorage.setItem(MOCK_PM_REQUESTS_KEY, JSON.stringify(requests));
  return requests;
}
