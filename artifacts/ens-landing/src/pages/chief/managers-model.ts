import type { PlatformPagination } from "@/lib/platform-api";

// Data model for the chief's manager-workload screen — types and tuning
// constants split out of ChiefManagers.tsx so the component carries behaviour,
// not shape definitions.

export type ManagerStatus = "Active" | "Pending" | "On Leave";
export type WorkStatus = "Active" | "Pending" | "Delayed" | "Completed";
export type StatusFilter = "all" | ManagerStatus | "High Load";
export type ViewMode = "cards" | "table";
export type SortMode = "workload-desc" | "workload-asc" | "projects-desc" | "rating-desc";

export interface SavedManagerView {
  id: string;
  name: string;
  search: string;
  statusFilter: StatusFilter;
  sortMode: SortMode;
  viewMode: ViewMode;
  isDefault?: boolean;
}

export interface Manager {
  id: string;
  name: string;
  email: string;
  role: string;
  rating: number;
  status: ManagerStatus;
  avatarUrl?: string;
  avatarTone?: string;
}

export interface ManagedClient {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  exhibition: string;
  boothWidthM?: number | null;
  boothDepthM?: number | null;
  preferredSystem?: string;
  venueCity?: string;
  targetDate?: string;
  intakeNotes?: string;
  managerId: string | null;
  status: WorkStatus;
  lastActivity: string;
}

export interface ManagedProject {
  id: string;
  name: string;
  clientId: string;
  exhibition: string;
  managerId: string | null;
  status: WorkStatus;
  progress: number;
  deadline: string;
  system: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  time: string;
  managerId?: string;
  tone: "info" | "success" | "warning";
}

export interface ManagerSummary extends Manager {
  workload: number;
  activeProjects: ManagedProject[];
  allProjects: ManagedProject[];
  clients: ManagedClient[];
  delayedCount: number;
  urgentCount: number;
  nextDeadline: string | null;
}

export interface RebalancePreview {
  project: ManagedProject;
  source: ManagerSummary;
  target: ManagerSummary;
}

export const AUDIT_PAGE_SIZE = 6;
export const ASSIGNMENT_PAGE_SIZE = 20;
export const PM_ACTIVE_PROJECT_CAPACITY = 200;
export const PM_CLIENT_CAPACITY = 200;
export const EMPTY_ASSIGNMENT_PAGINATION: PlatformPagination = {
  total: 0,
  limit: ASSIGNMENT_PAGE_SIZE,
  offset: 0,
  hasMore: false,
};
export const MANAGER_STATUS_OPTIONS: StatusFilter[] = ["all", "Active", "Pending", "On Leave", "High Load"];
export const SAVED_MANAGER_VIEWS_KEY = "ens-chief-manager-saved-views";
export const DEFAULT_MANAGER_VIEW_DEFS = [
  { id: "default-all-managers", nameKey: "chief.managers.filters.allManagers", search: "", statusFilter: "all" as StatusFilter, sortMode: "workload-desc" as SortMode, viewMode: "cards" as ViewMode, isDefault: true },
  { id: "default-high-load",    nameKey: "chief.managers.filters.highLoad",    search: "", statusFilter: "High Load" as StatusFilter, sortMode: "workload-desc" as SortMode, viewMode: "cards" as ViewMode, isDefault: true },
  { id: "default-on-leave",     nameKey: "chief.common.status.onLeave",        search: "", statusFilter: "On Leave"  as StatusFilter, sortMode: "workload-desc" as SortMode, viewMode: "table" as ViewMode, isDefault: true },
];

export const DEFAULT_MANAGER_VIEWS = DEFAULT_MANAGER_VIEW_DEFS.map((def) => ({ ...def, name: def.nameKey }));
