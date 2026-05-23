import { chartData, mockActivity, mockClients, mockMessages, mockProjects } from "@/lib/mock-data";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api").replace(/\/+$/, "");
const ORGANIZATION_SLUG = import.meta.env.VITE_ORGANIZATION_SLUG ?? "ens-demo-agency";
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";
const MOCK_AUTH_STORAGE_KEY = "ens-mock-auth-user";
const MOCK_ACCOUNT_SETTINGS_PREFIX = "ens-mock-account-settings";
const MOCK_ACCOUNT_SESSIONS_PREFIX = "ens-mock-account-sessions";

export const ACCOUNT_SETTINGS_EVENT = "ens-account-settings-updated";

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
  lastUpdate: string;
}

export interface PlatformClient {
  id: string;
  name: string;
  company: string;
  contactName: string;
  contactEmail: string;
  pm: string;
  exhibition: string;
  status: string;
  lastActivity: string;
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
  carpetIdx: number;
  placedItems: WorkspacePlacedItem[];
  notes: WorkspaceNote[];
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
  senderUserId: string;
  isMe: boolean;
  read: boolean;
  createdAt: string;
  time: string;
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

export interface ManagerInvitation {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
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

export async function getPlatformOverview() {
  if (USE_MOCK_API) return mockPlatformOverview();
  return apiGet<PlatformOverview>("/platform/overview");
}

export async function getPlatformProjects() {
  if (USE_MOCK_API) return { projects: mockPlatformProjects() };
  return apiGet<{ projects: PlatformProject[] }>("/platform/projects");
}

export async function createPlatformProject(input: {
  name: string;
  client: string;
  system: string;
  width: string;
  depth: string;
  deadline: string;
}) {
  if (USE_MOCK_API) {
    return {
      project: {
        id: `mock-project-${Date.now()}`,
        name: input.name,
        client: input.client,
        pm: "Project Manager",
        status: "Pending",
        health: "On Track",
        progress: 0,
        deadline: input.deadline || null,
        system: input.system,
        dimensions: `${input.width}x${input.depth}m`,
        exhibition: input.name,
        standType: input.system,
        description: "Local mock project.",
        lastUpdate: "Just now",
      },
    };
  }

  return apiJson<{ project: PlatformProject }>("/platform/projects", {
    name: input.name,
    client: input.client,
    system: input.system,
    widthM: Number(input.width),
    depthM: Number(input.depth),
    deadline: input.deadline || null,
  });
}

export async function getPlatformClients() {
  if (USE_MOCK_API) return { clients: mockPlatformClients() };
  return apiGet<{ clients: PlatformClient[] }>("/platform/clients");
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

export async function createProjectWorkspaceVersion(projectId: string, workspace: WorkspaceState, title: string) {
  if (USE_MOCK_API) return { ...mockProjectWorkspace(projectId), workspace };
  return apiJsonWithMethod<ProjectWorkspace>("POST", `/platform/projects/${projectId}/workspace/versions`, {
    title,
    workspace,
  });
}

export async function getMessageContacts() {
  if (USE_MOCK_API) return { contacts: mockMessageContacts() };
  return apiGet<{ contacts: MessageContact[] }>("/platform/messages/contacts");
}

export async function getConversationMessages(contactId: string, context?: MessageContext) {
  if (USE_MOCK_API) return { conversationId: mockConversationId(contactId, context), messages: mockConversationMessages(contactId, context) };
  const params = messageContextSearchParams(context);
  return apiGet<{ conversationId: string; messages: DirectMessage[] }>(`/platform/messages/${contactId}${params}`);
}

export async function sendConversationMessage(contactId: string, body: string, context?: MessageContext) {
  if (USE_MOCK_API) {
    const current = mockConversationMessages(contactId, context);
    const message = {
      id: `mock-message-${Date.now()}`,
      body,
      text: body,
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

  return apiJson<{ message: DirectMessage }>(`/platform/messages/${contactId}`, { body, context });
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

export async function invitePlatformManager(input: { name: string; email: string }) {
  if (USE_MOCK_API) {
    const workspace = mockManagerWorkspace();
    const invitation: ManagerInvitation = {
      id: `mock-invite-${Date.now()}`,
      name: input.name,
      email: input.email,
      role: "pm",
      status: "Pending",
      token: `mock-token-${Date.now()}`,
      inviteUrl: `/signup?invite=mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    saveMockManagerWorkspace({ ...workspace, invitations: [invitation, ...workspace.invitations] });
    return { invitation };
  }
  return apiJson<{ invitation: ManagerInvitation }>("/platform/managers/invitations", input);
}

export async function updateManagerAssignments(input: {
  clientAssignments: Array<{ clientId: string; managerId: string | null }>;
  projectAssignments: Array<{ projectId: string; managerId: string | null }>;
  cascadeClientProjects: boolean;
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

export async function getPlatformCalendar() {
  if (USE_MOCK_API) return { events: mockCalendarEvents() };
  return apiGet<{ events: CalendarEvent[] }>("/platform/calendar");
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path, {
    credentials: "include",
    headers: {
      accept: "application/json",
      "x-organization-slug": ORGANIZATION_SLUG,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function apiJson<T>(path: string, body: unknown): Promise<T> {
  return apiJsonWithMethod<T>("POST", path, body);
}

async function apiJsonWithMethod<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method,
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-organization-slug": ORGANIZATION_SLUG,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
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
      "x-organization-slug": ORGANIZATION_SLUG,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function apiDelete<T>(path: string): Promise<T> {
  const response = await apiFetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: {
      accept: "application/json",
      "x-organization-slug": ORGANIZATION_SLUG,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function apiFetch(path: string, init: RequestInit, retried = false): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (response.status !== 401 || retried) return response;

  const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-organization-slug": ORGANIZATION_SLUG,
    },
  });

  if (!refreshed.ok) return response;
  return apiFetch(path, init, true);
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

function mockPlatformProjects(): PlatformProject[] {
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

function mockPlatformClients(): PlatformClient[] {
  return mockClients.map((client) => ({
    id: client.id,
    name: client.name,
    company: client.name,
    contactName: client.name,
    contactEmail: `${client.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.com`,
    pm: client.pm,
    exhibition: client.exhibition,
    status: client.status,
    lastActivity: client.lastActivity,
  }));
}

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
  };
}

function mockMessageContacts(): MessageContact[] {
  const role = readMockAuthUser()?.role ?? "chief";

  if (role === "pm") {
    return [{
      id: "mock-chief",
      name: "Owner Chief",
      email: "owner@ens.test",
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

function readMockAuthUser(): { id?: string; name?: string; email?: string; role?: string; systemRole?: string } | null {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as { id?: string; name?: string; email?: string; role?: string; systemRole?: string } : null;
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
  if (role === "pm") return "pm@ens.test";
  if (role === "client") return "client@ens.test";
  return "owner@ens.test";
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
    { id: "m1", name: "John Doe", email: "john.doe@ens.test", role: "Project Manager", status: "Active", rating: 4.8, avatarUrl: "", avatarTone: "blue", workload: 76, activeProjects: 1, delayedProjects: 0, urgentProjects: 0, clients: 1, nextDeadline: "2026-06-04", joinedAt: "2026-01-10" },
    { id: "m2", name: "Jane Smith", email: "jane.smith@ens.test", role: "Project Manager", status: "Active", rating: 4.9, avatarUrl: "", avatarTone: "green", workload: 66, activeProjects: 1, delayedProjects: 1, urgentProjects: 1, clients: 1, nextDeadline: "2026-06-12", joinedAt: "2026-01-12" },
    { id: "m3", name: "Mike Ross", email: "mike.ross@ens.test", role: "Project Manager", status: "On Leave", rating: 4.5, avatarUrl: "", avatarTone: "amber", workload: 35, activeProjects: 1, delayedProjects: 0, urgentProjects: 0, clients: 1, nextDeadline: "2026-09-01", joinedAt: "2026-02-01" },
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

function mockCalendarEvents(): CalendarEvent[] {
  const workspace = mockManagerWorkspace();
  return workspace.projects.map((project) => ({
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
}
