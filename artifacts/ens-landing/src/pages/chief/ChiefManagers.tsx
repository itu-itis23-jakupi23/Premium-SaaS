import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "@/hooks/useDebounce";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import {
  getManagerAssignmentItems,
  getManagerWorkspace,
  invitePlatformManager,
  resendManagerInvitation,
  revokeManagerInvitation,
  sendManagerReminder,
  type ManagerInvitation,
  type ManagerWorkspace,
  type PlatformPagination,
  updateManagerAssignments,
  updateManagerRating,
  updateManagerStatus,
} from "@/lib/platform-api";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  ArrowRightLeft,
  Download,
  Bookmark,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Grid2X2,
  ListFilter,
  Loader2,
  MessageSquare,
  MoreVertical,
  RefreshCcw,
  Save,
  Search,
  Send,
  Star,
  TableProperties,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ManagerStatus = "Active" | "Pending" | "On Leave";
type WorkStatus = "Active" | "Pending" | "Delayed" | "Completed";
type StatusFilter = "all" | ManagerStatus | "High Load";
type ViewMode = "cards" | "table";
type SortMode = "workload-desc" | "workload-asc" | "projects-desc" | "rating-desc";

interface SavedManagerView {
  id: string;
  name: string;
  search: string;
  statusFilter: StatusFilter;
  sortMode: SortMode;
  viewMode: ViewMode;
  isDefault?: boolean;
}

interface Manager {
  id: string;
  name: string;
  email: string;
  role: string;
  rating: number;
  status: ManagerStatus;
  avatarUrl?: string;
  avatarTone?: string;
}

interface ManagedClient {
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

interface ManagedProject {
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

interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  time: string;
  managerId?: string;
  tone: "info" | "success" | "warning";
}

interface ManagerSummary extends Manager {
  workload: number;
  activeProjects: ManagedProject[];
  allProjects: ManagedProject[];
  clients: ManagedClient[];
  delayedCount: number;
  urgentCount: number;
  nextDeadline: string | null;
}

interface RebalancePreview {
  project: ManagedProject;
  source: ManagerSummary;
  target: ManagerSummary;
}

const AUDIT_PAGE_SIZE = 6;
const ASSIGNMENT_PAGE_SIZE = 20;
const PM_ACTIVE_PROJECT_CAPACITY = 200;
const PM_CLIENT_CAPACITY = 200;
const EMPTY_ASSIGNMENT_PAGINATION: PlatformPagination = {
  total: 0,
  limit: ASSIGNMENT_PAGE_SIZE,
  offset: 0,
  hasMore: false,
};
const MANAGER_STATUS_OPTIONS: StatusFilter[] = ["all", "Active", "Pending", "On Leave", "High Load"];
const SAVED_MANAGER_VIEWS_KEY = "ens-chief-manager-saved-views";
const DEFAULT_MANAGER_VIEW_DEFS = [
  { id: "default-all-managers", nameKey: "chief.managers.filters.allManagers", search: "", statusFilter: "all" as StatusFilter, sortMode: "workload-desc" as SortMode, viewMode: "cards" as ViewMode, isDefault: true },
  { id: "default-high-load",    nameKey: "chief.managers.filters.highLoad",    search: "", statusFilter: "High Load" as StatusFilter, sortMode: "workload-desc" as SortMode, viewMode: "cards" as ViewMode, isDefault: true },
  { id: "default-on-leave",     nameKey: "chief.common.status.onLeave",        search: "", statusFilter: "On Leave"  as StatusFilter, sortMode: "workload-desc" as SortMode, viewMode: "table" as ViewMode, isDefault: true },
];

// Resolved at render time with t() — not a module-level constant
function buildDefaultViews(t: (k: string) => string): SavedManagerView[] {
  return DEFAULT_MANAGER_VIEW_DEFS.map((def) => ({ ...def, name: t(def.nameKey) }));
}

const DEFAULT_MANAGER_VIEWS = DEFAULT_MANAGER_VIEW_DEFS.map((def) => ({ ...def, name: def.nameKey }));

export default function ChiefManagers() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentFocusId, setAssignmentFocusId] = useState<string | null>(null);
  const [assignmentClients, setAssignmentClients] = useState<ManagedClient[]>([]);
  const [assignmentProjects, setAssignmentProjects] = useState<ManagedProject[]>([]);
  const [assignmentClientSearch, setAssignmentClientSearch] = useState("");
  const [assignmentProjectSearch, setAssignmentProjectSearch] = useState("");
  const debouncedAssignmentClientSearch = useDebounce(assignmentClientSearch, 250);
  const debouncedAssignmentProjectSearch = useDebounce(assignmentProjectSearch, 250);
  const [assignmentClientPage, setAssignmentClientPage] = useState(0);
  const [assignmentProjectPage, setAssignmentProjectPage] = useState(0);
  const [assignmentClientPagination, setAssignmentClientPagination] = useState<PlatformPagination>(EMPTY_ASSIGNMENT_PAGINATION);
  const [assignmentProjectPagination, setAssignmentProjectPagination] = useState<PlatformPagination>(EMPTY_ASSIGNMENT_PAGINATION);
  const [assignmentOriginalClients, setAssignmentOriginalClients] = useState<Record<string, string>>({});
  const [assignmentOriginalProjects, setAssignmentOriginalProjects] = useState<Record<string, string>>({});
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [clientDraft, setClientDraft] = useState<Record<string, string>>({});
  const [projectDraft, setProjectDraft] = useState<Record<string, string>>({});
  const [assignmentCascade, setAssignmentCascade] = useState(false);
  const [discardAssignmentsOpen, setDiscardAssignmentsOpen] = useState(false);
  const [invitations, setInvitations] = useState<ManagerInvitation[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [invite, setInvite] = useState({ name: "", email: "" });
  const [inviteEmailError, setInviteEmailError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("workload-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [savedViews, setSavedViews] = useState<SavedManagerView[]>(() => readSavedManagerViews(DEFAULT_MANAGER_VIEW_DEFS.map((def) => ({ ...def, name: def.nameKey }))));
  const [activeSavedViewId, setActiveSavedViewId] = useState(DEFAULT_MANAGER_VIEWS[0].id);
  const [savedViewName, setSavedViewName] = useState("");
  const [showAllAudit, setShowAllAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditToneFilter, setAuditToneFilter] = useState<"all" | AuditEntry["tone"]>("all");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingLoadingId, setRatingLoadingId] = useState<string | null>(null);
  // Confirmation dialogs
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [rebalancePreview, setRebalancePreview] = useState<RebalancePreview | null>(null);

  /** Tracks whether this component instance is still mounted. */
  const mountedRef = useRef(true);

  function loadWorkspace(silent = false) {
    if (!silent) setIsLoading(true);
    else setRefreshing(true);
    getManagerWorkspace()
      .then((workspace) => {
        if (!mountedRef.current) return;
        applyManagerWorkspace(workspace);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current) return;
        showToast(error instanceof Error ? error.message : t("chief.managers.toast.loadError"));
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setIsLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    loadWorkspace();
    return () => {
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = t("chief.managers.title");
  }, [t]);

  useEffect(() => {
    if (!assignmentOpen) return;

    let mounted = true;
    setAssignmentLoading(true);
    setAssignmentError("");

    getManagerAssignmentItems({
      managerId: assignmentFocusId,
      clientQ: debouncedAssignmentClientSearch,
      projectQ: debouncedAssignmentProjectSearch,
      clientLimit: ASSIGNMENT_PAGE_SIZE,
      clientOffset: assignmentClientPage * ASSIGNMENT_PAGE_SIZE,
      projectLimit: ASSIGNMENT_PAGE_SIZE,
      projectOffset: assignmentProjectPage * ASSIGNMENT_PAGE_SIZE,
    })
      .then((payload) => {
        if (!mounted) return;
        const nextClients = payload.clients.map((client) => ({
          id: client.id,
          name: client.name,
          contactName: client.contactName,
          contactEmail: client.contactEmail,
          exhibition: client.exhibition,
          boothWidthM: client.boothWidthM,
          boothDepthM: client.boothDepthM,
          preferredSystem: client.preferredSystem,
          venueCity: client.venueCity,
          targetDate: client.targetDate,
          intakeNotes: client.intakeNotes,
          managerId: client.managerId,
          status: normalizeWorkStatus(client.status),
          lastActivity: client.lastActivity,
        }));
        const nextProjects = payload.projects.map((project) => ({
          id: project.id,
          name: project.name,
          clientId: project.clientId,
          exhibition: project.exhibition,
          managerId: project.managerId,
          status: normalizeWorkStatus(project.status),
          progress: project.progress,
          deadline: project.deadline ?? "",
          system: project.system,
        }));

        setAssignmentClients(nextClients);
        setAssignmentProjects(nextProjects);
        setAssignmentClientPagination(payload.clientPagination);
        setAssignmentProjectPagination(payload.projectPagination);
        setAssignmentOriginalClients((current) => mergeAssignmentOriginals(current, nextClients));
        setAssignmentOriginalProjects((current) => mergeAssignmentOriginals(current, nextProjects));
        setClientDraft((current) => mergeAssignmentDrafts(current, nextClients));
        setProjectDraft((current) => mergeAssignmentDrafts(current, nextProjects));
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setAssignmentClients([]);
        setAssignmentProjects([]);
        setAssignmentClientPagination(EMPTY_ASSIGNMENT_PAGINATION);
        setAssignmentProjectPagination(EMPTY_ASSIGNMENT_PAGINATION);
        setAssignmentError(error instanceof Error ? error.message : t("chief.managers.toast.loadError"));
      })
      .finally(() => {
        if (mounted) setAssignmentLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    assignmentClientPage,
    assignmentFocusId,
    assignmentOpen,
    assignmentProjectPage,
    debouncedAssignmentClientSearch,
    debouncedAssignmentProjectSearch,
    t,
  ]);

  const summaries = useMemo(
    () => managers.map((manager) => summarizeManager(manager, clients, projects)),
    [clients, managers, projects],
  );

  const selectedSummary = summaries.find((manager) => manager.id === selectedManagerId) ?? null;
  const pendingToggleManager = managers.find((m) => m.id === pendingToggleId) ?? null;

  const filteredManagers = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const filtered = summaries.filter((manager) => {
      const matchesSearch = !term || [
        manager.name,
        managerEmailLabel(manager),
        manager.role,
        ...manager.clients.map((client) => client.name),
        ...manager.allProjects.map((project) => project.name),
      ].some((value) => value.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "High Load" ? manager.workload >= 80 : manager.status === statusFilter);

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "workload-asc") return a.workload - b.workload;
      if (sortMode === "projects-desc") return b.activeProjects.length - a.activeProjects.length;
      if (sortMode === "rating-desc") return b.rating - a.rating;
      return b.workload - a.workload;
    });
  }, [debouncedSearch, sortMode, statusFilter, summaries]);

  const teamLoad = summaries.length
    ? Math.round(summaries.reduce((sum, manager) => sum + manager.workload, 0) / summaries.length)
    : 0;
  const delayedProjects = projects.filter((project) => project.status === "Delayed").length;
  const unassignedItems = clients.filter((client) => !client.managerId).length + projects.filter((project) => !project.managerId).length;
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "Pending");

  const filteredAudit = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    return audit.filter((entry) => {
      const managerName = managers.find((manager) => manager.id === entry.managerId)?.name ?? "Team";
      const matchesSearch = !term || [entry.action, entry.detail, entry.time, managerName]
        .some((value) => value.toLowerCase().includes(term));
      const matchesTone = auditToneFilter === "all" || entry.tone === auditToneFilter;
      return matchesSearch && matchesTone;
    });
  }, [audit, auditSearch, auditToneFilter, managers]);

  const auditVisible = showAllAudit ? filteredAudit : filteredAudit.slice(0, AUDIT_PAGE_SIZE);

  function addAudit(entry: Omit<AuditEntry, "id" | "time">) {
    setAudit((current) => [
      {
        ...entry,
        id: `a-${Date.now()}`,
        time: t("chief.managers.audit.justNow"),
      },
      ...current,
    ]);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function exportAuditExcel() {
    const managerById = Object.fromEntries(managers.map((manager) => [manager.id, manager.name]));
    downloadExcelWorkbook(`chief-manager-audit-${new Date().toISOString().slice(0, 10)}.xls`, [
      {
        name: "Manager Audit",
        rows: [
          ["Time", "Action", "Detail", "Manager", "Tone"],
          ...filteredAudit.map((entry) => [
            entry.time,
            entry.action,
            entry.detail,
            entry.managerId ? (managerById[entry.managerId] ?? entry.managerId) : t("chief.managers.audit.team"),
            entry.tone,
          ]),
        ],
      },
    ]);
  }

  function applyManagerWorkspace(workspace: ManagerWorkspace) {
    setManagers(workspace.managers.map((manager) => ({
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: manager.role,
      rating: manager.rating,
      status: normalizeManagerStatus(manager.status),
      avatarUrl: manager.avatarUrl,
      avatarTone: manager.avatarTone,
    })));
    setClients(workspace.clients.map((client) => ({
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      exhibition: client.exhibition,
      boothWidthM: client.boothWidthM,
      boothDepthM: client.boothDepthM,
      preferredSystem: client.preferredSystem,
      venueCity: client.venueCity,
      targetDate: client.targetDate,
      intakeNotes: client.intakeNotes,
      managerId: client.managerId,
      status: normalizeWorkStatus(client.status),
      lastActivity: client.lastActivity,
    })));
    setProjects(workspace.projects.map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      exhibition: project.exhibition,
      managerId: project.managerId,
      status: normalizeWorkStatus(project.status),
      progress: project.progress,
      deadline: project.deadline ?? "",
      system: project.system,
    })));
    setAudit(workspace.audit.map((entry) => ({
      id: entry.id,
      action: entry.type,
      detail: `${entry.user} ${entry.action} (${entry.project})`,
      time: entry.time,
      tone: entry.type.includes("delay") || entry.type.includes("reminder") ? "warning" : "info",
    })));
    setInvitations(workspace.invitations);
  }

  function markViewDirty() {
    setActiveSavedViewId("custom");
  }

  function applySavedView(view: SavedManagerView) {
    setSearch(view.search);
    setStatusFilter(view.statusFilter);
    setSortMode(view.sortMode);
    setViewMode(view.viewMode);
    setActiveSavedViewId(view.id);
    showToast(t("chief.managers.toast.viewLoaded", { name: view.name }));
  }

  function saveCurrentView() {
    const filterLabel = statusFilter === "all" ? t("chief.managers.filters.allManagers") :
      statusFilter === "High Load" ? t("chief.managers.filters.highLoad") :
      statusFilter === "On Leave" ? t("chief.common.status.onLeave") :
      statusFilter === "Active" ? t("chief.common.status.active") :
      statusFilter === "Pending" ? t("chief.common.status.pending") : statusFilter;
    const viewLabel = viewMode === "cards" ? t("chief.managers.filters.cardView") : t("chief.managers.filters.tableView");
    const name = savedViewName.trim() || `${filterLabel} ${viewLabel}`;
    const nextView: SavedManagerView = {
      id: `custom-${Date.now()}`,
      name,
      search,
      statusFilter,
      sortMode,
      viewMode,
    };
    const nextViews = [
      ...DEFAULT_MANAGER_VIEWS,
      nextView,
      ...savedViews.filter((view) => !view.isDefault && view.name.toLowerCase() !== name.toLowerCase()),
    ];

    setSavedViews(nextViews);
    persistSavedManagerViews(nextViews);
    setActiveSavedViewId(nextView.id);
    setSavedViewName("");
    showToast(t("chief.managers.toast.viewSaved", { name }));
  }

  function deleteSavedView(id: string) {
    const nextViews = savedViews.filter((view) => view.isDefault || view.id !== id);
    setSavedViews(nextViews);
    persistSavedManagerViews(nextViews);
    if (activeSavedViewId === id) setActiveSavedViewId("custom");
    showToast(t("chief.managers.toast.viewRemoved"));
  }

  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  async function submitInvite() {
    if (!isValidEmail(invite.email)) {
      setInviteEmailError(t("chief.managers.invite.emailInvalid"));
      return;
    }
    setInviteEmailError("");
    const name = invite.name.trim() || invite.email.split("@")[0] || t("chief.managers.invite.defaultName");
    try {
      setBusyAction("invite");
      const { invitation } = await invitePlatformManager({ name, email: invite.email.trim() });
      setInvitations((current) => [invitation, ...current.filter((item) => item.id !== invitation.id)]);
      setInvite({ name: "", email: "" });
      setInviteEmailError("");
      setInviteOpen(false);
      addAudit({
        action: t("chief.managers.audit.action.invitation"),
        detail: t("chief.managers.audit.detail.invited", { name }),
        tone: "success",
      });
      showToast(t("chief.managers.toast.inviteCreated", { name }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.managers.toast.inviteError"));
    } finally {
      setBusyAction(null);
    }
  }

  async function resendInvitation(invitationId: string) {
    try {
      setBusyAction(`invite-resend-${invitationId}`);
      const { invitation } = await resendManagerInvitation(invitationId);
      setInvitations((current) => current.map((item) => item.id === invitationId ? invitation : item));
      showToast(t("chief.managers.toast.inviteResent", { email: invitation.email }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.managers.toast.inviteResendError"));
    } finally {
      setBusyAction(null);
    }
  }

  async function revokeInvitation(invitationId: string) {
    try {
      setBusyAction(`invite-revoke-${invitationId}`);
      const result = await revokeManagerInvitation(invitationId);
      setInvitations(result.invitations);
      showToast(t("chief.managers.toast.inviteRevoked"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.managers.toast.inviteRevokeError"));
    } finally {
      setBusyAction(null);
    }
  }

  function copyInvitationLink(invitation: ManagerInvitation) {
    if (!invitation.inviteUrl) {
      showToast(t("chief.managers.toast.inviteCopyFirst"));
      return;
    }

    const url = new URL(invitation.inviteUrl, window.location.origin).toString();
    navigator.clipboard.writeText(url)
      .then(() => showToast(t("chief.managers.toast.inviteCopied")))
      .catch(() => showToast(t("chief.managers.toast.inviteCopyError")));
  }

  // Opens a confirmation dialog before toggling status
  function requestToggleStatus(id: string) {
    setPendingToggleId(id);
  }

  async function confirmToggleStatus() {
    if (!pendingToggleId) return;
    const manager = managers.find((item) => item.id === pendingToggleId);
    if (!manager) {
      setPendingToggleId(null);
      return;
    }

    const nextStatus: ManagerStatus = manager.status === "Active" ? "On Leave" : "Active";
    const prevStatus = manager.status;
    const toggleId = pendingToggleId;

    // Optimistic update — apply immediately so the UI responds instantly
    setManagers((current) => current.map((item) => (
      item.id === toggleId ? { ...item, status: nextStatus } : item
    )));
    setPendingToggleId(null);

    try {
      setBusyAction(`status-${toggleId}`);
      await updateManagerStatus(toggleId, nextStatus === "Active" ? "active" : "suspended");
      addAudit({
        action: t("chief.managers.audit.action.access"),
        detail: t("chief.managers.audit.detail.statusChanged", { name: manager.name, status: nextStatus.toLowerCase() }),
        managerId: toggleId,
        tone: nextStatus === "Active" ? "success" : "warning",
      });
      showToast(t("chief.managers.toast.statusUpdated"));
    } catch (error) {
      // Roll back on failure
      setManagers((current) => current.map((item) => (
        item.id === toggleId ? { ...item, status: prevStatus } : item
      )));
      showToast(error instanceof Error ? error.message : t("chief.managers.toast.statusError"));
    } finally {
      setBusyAction(null);
      setPendingToggleId(null);
    }
  }

  function openAssignments(managerId?: string) {
    setAssignmentFocusId(managerId ?? null);
    setAssignmentClients([]);
    setAssignmentProjects([]);
    setAssignmentClientSearch("");
    setAssignmentProjectSearch("");
    setAssignmentClientPage(0);
    setAssignmentProjectPage(0);
    setAssignmentClientPagination(EMPTY_ASSIGNMENT_PAGINATION);
    setAssignmentProjectPagination(EMPTY_ASSIGNMENT_PAGINATION);
    setAssignmentOriginalClients({});
    setAssignmentOriginalProjects({});
    setAssignmentError("");
    setClientDraft({});
    setProjectDraft({});
    setAssignmentCascade(false);
    setAssignmentOpen(true);
  }

  function hasAssignmentChanges() {
    return hasDraftChanges(clientDraft, assignmentOriginalClients) ||
      hasDraftChanges(projectDraft, assignmentOriginalProjects);
  }

  function requestCloseAssignments() {
    if (hasAssignmentChanges()) {
      setDiscardAssignmentsOpen(true);
      return;
    }
    setAssignmentOpen(false);
  }

  function discardAssignmentChanges() {
    setDiscardAssignmentsOpen(false);
    setAssignmentOpen(false);
  }

  async function saveAssignments() {
    const managerLabel = (id: string) => managers.find((manager) => manager.id === id)?.name ?? t("chief.common.status.unassigned");
    const changedClients = changedAssignmentRows(clientDraft, assignmentOriginalClients);
    const changedProjects = changedAssignmentRows(projectDraft, assignmentOriginalProjects);

    if (!changedClients.length && !changedProjects.length) {
      setAssignmentOpen(false);
      showToast(t("chief.managers.toast.assignNoChange", { name: assignmentFocusId ? managerLabel(assignmentFocusId) : t("chief.managers.audit.team") }));
      return;
    }

    try {
      setBusyAction("assignments-save");
      const workspace = await updateManagerAssignments({
        clientAssignments: changedClients.map((client) => ({
          clientId: client.id,
          managerId: client.managerId === "unassigned" ? null : client.managerId,
        })),
        projectAssignments: changedProjects.map((project) => ({
          projectId: project.id,
          managerId: project.managerId === "unassigned" ? null : project.managerId,
        })),
        cascadeClientProjects: assignmentCascade,
      });
      applyManagerWorkspace(workspace);
      setAssignmentOpen(false);
      setAssignmentCascade(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.managers.toast.assignError"));
      return;
    } finally {
      setBusyAction((current) => current === "assignments-save" ? null : current);
    }

    if (changedClients.length || changedProjects.length) {
      const focusManager = assignmentFocusId ?? changedProjects[0]?.managerId ?? changedClients[0]?.managerId;
      addAudit({
        action: t("chief.managers.audit.action.assignment"),
        detail: t("chief.managers.audit.detail.assignmentsSaved"),
        managerId: focusManager && focusManager !== "unassigned" ? focusManager : undefined,
        tone: "success",
      });
      showToast(t("chief.managers.toast.assignUpdated"));
      return;
    }
  }

  // Computes rebalance plan and shows a confirmation preview instead of executing immediately
  function requestRebalance(id: string) {
    const source = summaries.find((m) => m.id === id);
    const active = summaries.filter((m) => m.id !== id && m.status === "Active");

    if (!source || !active.length) {
      showToast(t("chief.managers.toast.rebalanceNoTarget"));
      return;
    }

    if (source.workload < 70) {
      showToast(t("chief.managers.toast.rebalanceNormal", { name: source.name, pct: source.workload }));
      return;
    }

    // Score candidates: 60% available capacity + 25% rating quality + 15% fewer current projects
    const maxProjects = Math.max(...active.map((m) => m.activeProjects.length), 1);
    const scored = active
      .filter((m) => m.workload < 85) // never overload a target
      .map((m) => ({
        manager: m,
        score:
          (100 - m.workload) * 0.6 +
          (m.rating / 5) * 100 * 0.25 +
          ((maxProjects - m.activeProjects.length) / maxProjects) * 100 * 0.15,
      }))
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      showToast(t("chief.managers.toast.rebalanceAllLoaded"));
      return;
    }

    const target = scored[0].manager;

    // Move LEAST critical project first so the overloaded PM keeps their urgent work
    const projectToMove = [...source.activeProjects]
      .sort((a, b) => compareProjectRisk(a, b))
      .reverse()[0]; // reverse → ascending risk, pick lowest

    if (!projectToMove) {
      showToast(t("chief.managers.toast.rebalanceNoProject"));
      return;
    }

    setRebalancePreview({ project: projectToMove, source, target });
  }

  async function confirmRebalance() {
    if (!rebalancePreview) return;
    const { project: projectToMove, source, target } = rebalancePreview;

    try {
      setBusyAction("rebalance");
      const workspace = await updateManagerAssignments({
        clientAssignments: [],
        projectAssignments: [{ projectId: projectToMove.id, managerId: target.id }],
        cascadeClientProjects: false,
      });
      applyManagerWorkspace(workspace);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.managers.toast.rebalanceError"));
      setRebalancePreview(null);
      return;
    } finally {
      setBusyAction((current) => current === "rebalance" ? null : current);
    }

    addAudit({
      action: t("chief.managers.audit.action.rebalance"),
      detail: t("chief.managers.audit.detail.rebalanced", { project: projectToMove.name, from: source.name, to: target.name }),
      managerId: target.id,
      tone: "success",
    });
    showToast(t("chief.managers.toast.rebalanceDone"));
    setRebalancePreview(null);
  }

  async function sendReminder(manager: ManagerSummary) {
    const itemCount = manager.delayedCount || manager.urgentCount || manager.activeProjects.length;
    try {
      setBusyAction(`reminder-${manager.id}`);
      await sendManagerReminder(manager.id, {
        itemCount,
        delayedCount: manager.delayedCount,
        urgentCount: manager.urgentCount,
      });
      addAudit({
        action: t("chief.managers.audit.action.reminder"),
        detail: t("chief.managers.audit.detail.reminded", { name: manager.name, count: itemCount }),
        managerId: manager.id,
        tone: manager.delayedCount ? "warning" : "info",
      });
      showToast(t("chief.managers.toast.reminderSent", { name: manager.name }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("chief.managers.toast.reminderError"));
    } finally {
      setBusyAction((current) => current === `reminder-${manager.id}` ? null : current);
    }
  }

  async function handleRateManager(managerId: string, newRating: number) {
    if (ratingLoadingId) return;
    const prevManagers = managers;
    // Optimistic update
    setManagers((list) => list.map((m) => m.id === managerId ? { ...m, rating: newRating } : m));
    setRatingLoadingId(managerId);
    try {
      await updateManagerRating(managerId, newRating);
      addAudit({
        action: t("chief.managers.audit.action.ratingUpdated"),
        detail: t("chief.managers.audit.detail.ratingUpdated", { rating: newRating.toFixed(1) }),
        managerId,
        tone: "info",
      });
      showToast(t("chief.managers.toast.ratingUpdated", { rating: newRating.toFixed(1) }));
    } catch (reason) {
      setManagers(prevManagers);
      showToast(reason instanceof Error ? reason.message : t("chief.managers.error.rating"));
    } finally {
      setRatingLoadingId(null);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="chief">
        <ManagersSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader
          title={t("chief.managers.title")}
          breadcrumbs={[{ label: t("chief.nav.chief"), href: "/chief" }, { label: t("chief.nav.managers") }]}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadWorkspace(true)}
              disabled={busyAction !== null || refreshing}
              title={t("chief.managers.refresh")}
              aria-label={t("chief.managers.refresh")}
            >
              {refreshing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCcw className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={() => openAssignments()}>
              <ArrowRightLeft className="mr-2 h-4 w-4" /> {t("chief.common.assignments")}
            </Button>
            <Button onClick={() => { setInviteOpen(true); setInviteEmailError(""); }} data-testid="button-invite-manager">
              <UserPlus className="mr-2 h-4 w-4" /> {t("chief.common.inviteManager")}
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryTile label={t("chief.managers.tiles.teamLoad")} value={`${teamLoad}%`} icon={Briefcase} tone={teamLoad >= 80 ? "warning" : "info"} />
          <SummaryTile label={t("chief.managers.tiles.activeManagers")} value={String(summaries.filter((manager) => manager.status === "Active").length)} icon={Users} tone="success" />
          <SummaryTile label={t("chief.managers.tiles.delayedProjects")} value={String(delayedProjects)} icon={AlertCircle} tone={delayedProjects ? "warning" : "success"} />
          <SummaryTile label={t("chief.managers.tiles.unassignedItems")} value={String(unassignedItems)} icon={Clock} tone={unassignedItems ? "warning" : "info"} />
          <SummaryTile label={t("chief.managers.tiles.pendingInvites")} value={String(pendingInvitations.length)} icon={UserPlus} tone={pendingInvitations.length ? "info" : "success"} />
        </div>

        <PendingInvitationsPanel
          invitations={pendingInvitations}
          busyAction={busyAction}
          onCopy={copyInvitationLink}
          onResend={resendInvitation}
          onRevoke={revokeInvitation}
        />

        <SavedViewsBar
          views={savedViews.map((v) => ({ ...v, name: v.name.startsWith("chief.") ? t(v.name) : v.name }))}
          activeViewId={activeSavedViewId}
          viewName={savedViewName}
          onViewNameChange={setSavedViewName}
          onApply={applySavedView}
          onSave={saveCurrentView}
          onDelete={deleteSavedView}
        />

        <section className="rounded-lg border bg-card/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_180px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    markViewDirty();
                  }}
                  placeholder={t("chief.managers.filters.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter);
                  markViewDirty();
                }}
              >
                <SelectTrigger>
                  <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGER_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "all" ? t("chief.managers.filters.allStatuses") :
                       option === "High Load" ? t("chief.managers.filters.highLoad") :
                       option === "On Leave" ? t("chief.common.status.onLeave") :
                       option === "Active" ? t("chief.common.status.active") :
                       option === "Pending" ? t("chief.common.status.pending") :
                       option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sortMode}
                onValueChange={(value) => {
                  setSortMode(value as SortMode);
                  markViewDirty();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workload-desc">{t("chief.managers.filters.sortHighest")}</SelectItem>
                  <SelectItem value="workload-asc">{t("chief.managers.filters.sortLowest")}</SelectItem>
                  <SelectItem value="projects-desc">{t("chief.managers.filters.sortProjects")}</SelectItem>
                  <SelectItem value="rating-desc">{t("chief.managers.filters.sortRating")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                size="icon"
                onClick={() => {
                  setViewMode("cards");
                  markViewDirty();
                }}
                aria-label={t("chief.managers.filters.cardView")}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="icon"
                onClick={() => {
                  setViewMode("table");
                  markViewDirty();
                }}
                aria-label={t("chief.managers.filters.tableView")}
              >
                <TableProperties className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {viewMode === "cards" ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredManagers.map((manager) => (
              <ManagerCard
                key={manager.id}
                manager={manager}
                searchTerm={search}
                onAssign={() => openAssignments(manager.id)}
                onCalendar={() => navigate(`/chief/calendar?pm=${encodeURIComponent(manager.name)}`)}
                onDetails={() => setSelectedManagerId(manager.id)}
                onMessage={() => navigate(`/chief/messages?manager=${encodeURIComponent(manager.id)}`)}
                onRebalance={() => requestRebalance(manager.id)}
                onReminder={() => sendReminder(manager)}
                reminderBusy={busyAction === `reminder-${manager.id}`}
                onToggleStatus={() => requestToggleStatus(manager.id)}
                onRate={(rating) => handleRateManager(manager.id, rating)}
                ratingBusy={ratingLoadingId === manager.id}
              />
            ))}
          </div>
        ) : (
          <ManagerTable
            managers={filteredManagers}
            searchTerm={search}
            onAssign={openAssignments}
            onDetails={setSelectedManagerId}
            onMessage={(id) => navigate(`/chief/messages?manager=${encodeURIComponent(id)}`)}
            onRebalance={requestRebalance}
          />
        )}

        {!filteredManagers.length && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("chief.managers.noMatch")}
          </div>
        )}

        {/* Activity Audit */}
        <section className="rounded-lg border bg-card/40">
          {/* Use a div row so the export <Button> is not nested inside a <button> */}
          <div className="flex w-full items-center justify-between p-4">
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-col text-left"
              onClick={() => setShowAllAudit((value) => !value)}
              aria-expanded={showAllAudit}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("chief.managers.audit.title")}</h2>
              <p className="text-sm text-foreground">{t("chief.managers.audit.desc")}</p>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary">{filteredAudit.length}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => exportAuditExcel()}
                disabled={filteredAudit.length === 0}
                title={t("chief.managers.audit.exportExcel")}
                aria-label={t("chief.managers.audit.exportExcel")}
              >
                <Download className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="flex items-center rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllAudit((value) => !value)}
                aria-label={showAllAudit ? t("chief.managers.audit.collapse") : t("chief.managers.audit.expand")}
              >
                {showAllAudit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="border-t p-4">
            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={auditSearch}
                  onChange={(event) => setAuditSearch(event.target.value)}
                  placeholder={t("chief.managers.audit.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <Select value={auditToneFilter} onValueChange={(value) => setAuditToneFilter(value as typeof auditToneFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("chief.managers.audit.allActivity")}</SelectItem>
                  <SelectItem value="success">{t("chief.managers.audit.success")}</SelectItem>
                  <SelectItem value="warning">{t("chief.managers.audit.warnings")}</SelectItem>
                  <SelectItem value="info">{t("chief.managers.audit.info")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AuditList entries={auditVisible} managers={managers} />
            {filteredAudit.length > AUDIT_PAGE_SIZE && (
              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAllAudit((v) => !v)}
              >
                {showAllAudit
                  ? t("chief.managers.audit.showLess", { count: AUDIT_PAGE_SIZE })
                  : t("chief.managers.audit.showAll", { count: filteredAudit.length })}
              </button>
            )}
          </div>
        </section>

        {/* Invite Manager Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.managers.invite.title")}</DialogTitle>
              <DialogDescription>{t("chief.managers.invite.desc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="manager-name">{t("chief.managers.invite.nameLabel")}</Label>
                <Input
                  id="manager-name"
                  value={invite.name}
                  onChange={(event) => setInvite((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t("chief.managers.invite.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager-email">{t("chief.managers.invite.emailLabel")}</Label>
                <Input
                  id="manager-email"
                  value={invite.email}
                  onChange={(event) => {
                    setInvite((current) => ({ ...current, email: event.target.value }));
                    if (inviteEmailError) setInviteEmailError("");
                  }}
                  placeholder={t("chief.managers.invite.emailPlaceholder")}
                  className={inviteEmailError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {inviteEmailError && (
                  <p className="text-xs text-destructive">{inviteEmailError}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteEmailError(""); }}>{t("chief.common.cancel")}</Button>
              <Button onClick={submitInvite} disabled={!invite.email.trim() || busyAction === "invite" || !isValidEmail(invite.email)}>
                {busyAction === "invite" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("chief.managers.invite.sendInvite")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Status Toggle Confirmation Dialog */}
        <Dialog open={!!pendingToggleId} onOpenChange={(open) => { if (!open) setPendingToggleId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.managers.statusChange.title")}</DialogTitle>
              <DialogDescription>
                {pendingToggleManager && (
                  <>
                    {t("chief.managers.statusChange.confirmPrefix")}{" "}
                    <span className="font-semibold text-foreground">{pendingToggleManager.name}</span>{" "}
                    {t("chief.managers.statusChange.confirmSuffix")}{" "}
                    <span className="font-semibold text-foreground">
                      {pendingToggleManager.status === "Active" ? t("chief.common.status.onLeave") : t("chief.common.status.active")}
                    </span>
                    ?{pendingToggleManager.status === "Active" && (
                      <> {t("chief.managers.statusChange.onLeaveNote")}</>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingToggleId(null)}>{t("chief.common.cancel")}</Button>
              <Button onClick={confirmToggleStatus} disabled={!!pendingToggleId && busyAction === `status-${pendingToggleId}`}>
                {!!pendingToggleId && busyAction === `status-${pendingToggleId}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pendingToggleManager?.status === "Active" ? t("chief.managers.statusChange.markOnLeave") : t("chief.managers.statusChange.markActive")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rebalance Preview Dialog */}
        <Dialog open={!!rebalancePreview} onOpenChange={(open) => { if (!open) setRebalancePreview(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.managers.rebalance.title")}</DialogTitle>
              <DialogDescription>{t("chief.managers.rebalance.desc")}</DialogDescription>
            </DialogHeader>
            {rebalancePreview && (
              <div className="space-y-3 py-2">
                <div className="rounded-lg border bg-card/50 p-3 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("chief.managers.rebalance.projectToMove")}</p>
                  <p className="text-sm font-semibold">{rebalancePreview.project.name}</p>
                  <p className="text-xs text-muted-foreground">{rebalancePreview.project.exhibition} / {rebalancePreview.project.system}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{t("chief.managers.rebalance.from")}</p>
                    <p className="text-sm font-semibold">{rebalancePreview.source.name}</p>
                    <p className="text-xs text-red-400">{rebalancePreview.source.workload}% {t("chief.managers.table.workload")}</p>
                  </div>
                  <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{t("chief.managers.rebalance.to")}</p>
                    <p className="text-sm font-semibold">{rebalancePreview.target.name}</p>
                    <p className="text-xs text-green-400">{rebalancePreview.target.workload}% {t("chief.managers.table.workload")}</p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRebalancePreview(null)}>{t("chief.common.cancel")}</Button>
              <Button onClick={confirmRebalance} disabled={busyAction === "rebalance"}>
                {busyAction === "rebalance" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("chief.managers.rebalance.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={discardAssignmentsOpen} onOpenChange={setDiscardAssignmentsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.managers.discard.title")}</DialogTitle>
              <DialogDescription>
                {t("chief.managers.discard.desc")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDiscardAssignmentsOpen(false)}>{t("chief.common.keepEditing")}</Button>
              <Button variant="destructive" onClick={discardAssignmentChanges}>{t("chief.common.discardChanges")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assignments Sheet - clients + projects */}
        <AssignmentSheet
          open={assignmentOpen}
          focusManagerId={assignmentFocusId}
          managers={managers}
          clients={assignmentClients}
          projects={assignmentProjects}
          clientDraft={clientDraft}
          projectDraft={projectDraft}
          clientSearch={assignmentClientSearch}
          projectSearch={assignmentProjectSearch}
          clientPagination={assignmentClientPagination}
          projectPagination={assignmentProjectPagination}
          loading={assignmentLoading}
          error={assignmentError}
          cascadeClientProjects={assignmentCascade}
          onCascadeClientProjectsChange={setAssignmentCascade}
          onClientSearchChange={(value) => {
            setAssignmentClientSearch(value);
            setAssignmentClientPage(0);
          }}
          onProjectSearchChange={(value) => {
            setAssignmentProjectSearch(value);
            setAssignmentProjectPage(0);
          }}
          onClientPageChange={setAssignmentClientPage}
          onProjectPageChange={setAssignmentProjectPage}
          onClientDraftChange={(clientId, managerId) => setClientDraft((current) => ({ ...current, [clientId]: managerId }))}
          onProjectDraftChange={(projectId, managerId) => setProjectDraft((current) => ({ ...current, [projectId]: managerId }))}
          onClose={requestCloseAssignments}
          onSave={saveAssignments}
          saving={busyAction === "assignments-save"}
        />

        <ManagerDetailsSheet
          manager={selectedSummary}
          audit={audit}
          onOpenChange={(open) => {
            if (!open) setSelectedManagerId(null);
          }}
          onAssign={() => selectedSummary && openAssignments(selectedSummary.id)}
          onCalendar={() => selectedSummary && navigate(`/chief/calendar?pm=${encodeURIComponent(selectedSummary.name)}`)}
          onMessage={() => selectedSummary && navigate(`/chief/messages?manager=${encodeURIComponent(selectedSummary.id)}`)}
        />

        {/* Toast notification — aria-live so screen readers announce messages */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl",
            "transition-all duration-300",
            toast ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none",
          )}
        >
          {toast}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Sub-components

function SavedViewsBar({
  views,
  activeViewId,
  viewName,
  onViewNameChange,
  onApply,
  onSave,
  onDelete,
}: {
  views: SavedManagerView[];
  activeViewId: string;
  viewName: string;
  onViewNameChange: (value: string) => void;
  onApply: (view: SavedManagerView) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border bg-card/40 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="min-w-[180px]">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("chief.managers.views.title")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("chief.managers.views.desc")}</p>
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          {views.map((view) => (
            <div
              key={view.id}
              className={cn(
                "flex h-9 items-center overflow-hidden rounded-md border bg-background/40",
                activeViewId === view.id && "border-primary bg-primary/10 text-primary",
              )}
            >
              <button
                type="button"
                className="h-full px-3 text-xs font-medium"
                onClick={() => onApply(view)}
              >
                {view.name}
              </button>
              {!view.isDefault && (
                <button
                  type="button"
                  className="flex h-full w-8 items-center justify-center border-l text-muted-foreground hover:text-red-400"
                  onClick={() => onDelete(view.id)}
                  aria-label={t("chief.managers.views.deleteView", { name: view.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Input
            value={viewName}
            onChange={(event) => onViewNameChange(event.target.value)}
            placeholder={t("chief.managers.views.namePlaceholder")}
            className="min-w-0 sm:w-44"
          />
          <Button type="button" onClick={onSave} className="shrink-0">
            <Save className="mr-2 h-4 w-4" /> {t("chief.common.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function PendingInvitationsPanel({
  invitations,
  busyAction,
  onCopy,
  onResend,
  onRevoke,
}: {
  invitations: ManagerInvitation[];
  busyAction: string | null;
  onCopy: (invitation: ManagerInvitation) => void;
  onResend: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  if (!invitations.length) return null;

  return (
    <section className="rounded-lg border border-dashed bg-card/30 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("chief.managers.invitations.title")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("chief.managers.invitations.desc")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {invitations.slice(0, 4).map((invitation) => (
            <div key={invitation.id} className="rounded-md border bg-background/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="max-w-[220px] truncate text-xs font-medium">{invitation.name || invitation.email}</p>
                    <Badge variant="outline" className="border-yellow-500/40 bg-yellow-500/5 text-yellow-500">
                      {invitation.status === "Pending"  ? t("chief.common.status.pending")  :
                       invitation.status === "Accepted" ? t("chief.common.status.accepted") :
                       invitation.status === "Expired"  ? t("chief.common.status.expired")  :
                       invitation.status}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-[260px] truncate text-[11px] text-muted-foreground">
                    {invitation.email} / {t("chief.managers.invitations.expires", { date: formatDate(invitation.expiresAt, i18n.language) })}
                  </p>
                  {invitation.emailStatus === "failed" && (
                    <p className="mt-1 max-w-[260px] text-[11px] text-amber-500">
                      Email not sent: {invitation.emailWarning || "email provider is not configured"}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(invitation)} aria-label={t("chief.managers.invitations.copyLink", { email: invitation.email })}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onResend(invitation.id)}
                    disabled={busyAction === `invite-resend-${invitation.id}`}
                    aria-label={t("chief.managers.invitations.resend", { email: invitation.email })}
                  >
                    {busyAction === `invite-resend-${invitation.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => onRevoke(invitation.id)}
                    disabled={busyAction === `invite-revoke-${invitation.id}`}
                    aria-label={t("chief.managers.invitations.revoke", { email: invitation.email })}
                  >
                    {busyAction === `invite-revoke-${invitation.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {invitations.length > 4 && (
            <Badge variant="secondary" className="self-center">
              {t("chief.managers.invitations.moreInvites", { count: invitations.length - 4 })}
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Briefcase;
  tone: "info" | "success" | "warning";
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          tone === "success" && "bg-green-500/10 text-green-400",
          tone === "warning" && "bg-yellow-500/10 text-yellow-400",
          tone === "info" && "bg-primary/10 text-primary",
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/** Highlights occurrences of `query` inside `text`. */
function HighlightText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-primary/20 px-0.5 text-primary not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ManagerCard({
  manager,
  searchTerm,
  onAssign,
  onCalendar,
  onDetails,
  onMessage,
  onRebalance,
  onReminder,
  reminderBusy,
  onToggleStatus,
  onRate,
  ratingBusy,
}: {
  manager: ManagerSummary;
  searchTerm: string;
  onAssign: () => void;
  onCalendar: () => void;
  onDetails: () => void;
  onMessage: () => void;
  onRebalance: () => void;
  onReminder: () => void;
  reminderBusy: boolean;
  onToggleStatus: () => void;
  onRate: (rating: number) => void;
  ratingBusy: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-colors">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <button type="button" onClick={onDetails} className="flex min-w-0 items-center gap-4 text-left">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={manager.avatarUrl ?? ""} alt={manager.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {initials(manager.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">
              <HighlightText text={manager.name} query={searchTerm} />
            </CardTitle>
            <p className="truncate text-xs text-muted-foreground">
              <HighlightText text={managerEmailLabel(manager)} query={searchTerm} />
            </p>
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-manager-${manager.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDetails}>{t("chief.managers.actions.openDetails")}</DropdownMenuItem>
            <DropdownMenuItem onClick={onAssign}>{t("chief.managers.actions.assignments")}</DropdownMenuItem>
            <DropdownMenuItem onClick={onCalendar}>{t("chief.managers.actions.viewCalendar")}</DropdownMenuItem>
            <DropdownMenuItem onClick={onRebalance}>{t("chief.managers.actions.rebalanceWorkload")}</DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStatus}>
              {manager.status === "Active" ? t("chief.managers.actions.markOnLeave") : t("chief.managers.actions.markActive")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-primary" onClick={onReminder} disabled={reminderBusy}>
              {reminderBusy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />} {t("chief.managers.actions.sendReminder")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("chief.managers.card.computedWorkload")}</span>
          <span className={cn("font-medium", manager.workload >= 80 ? "text-red-500" : manager.workload >= 60 ? "text-yellow-500" : "text-green-500")}>
            {manager.workload}%
          </span>
        </div>
        <Progress value={manager.workload} className="h-1.5" />
        <div className={cn(
          "rounded-md border px-3 py-2 text-xs",
          manager.activeProjects.length >= PM_ACTIVE_PROJECT_CAPACITY || manager.clients.length >= PM_CLIENT_CAPACITY
            ? "border-red-500/30 bg-red-500/5 text-red-500"
            : manager.workload >= 70
              ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-600"
              : "border-green-500/30 bg-green-500/5 text-green-600",
        )}>
          Capacity: {manager.activeProjects.length}/{PM_ACTIVE_PROJECT_CAPACITY} active projects · {manager.clients.length}/{PM_CLIENT_CAPACITY} clients
        </div>

        <div className="grid grid-cols-3 gap-3 py-2">
          <Metric label={t("chief.managers.table.projects")} value={String(manager.activeProjects.length)} icon={Briefcase} />
          <Metric label={t("chief.managers.table.clients")} value={String(manager.clients.length)} icon={Users} />
          {/* Interactive star rating */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" aria-hidden="true" />
              {t("chief.managers.detail.overview.rating")}
            </div>
            <div className="flex items-center gap-0.5" role="group" aria-label={t("chief.managers.detail.overview.rating")}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={ratingBusy || manager.status === "Pending"}
                  onClick={() => onRate(star)}
                  aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                  aria-pressed={Math.round(manager.rating) >= star}
                  title={`Rate ${star}/5`}
                  className={cn(
                    "rounded transition-colors disabled:cursor-wait hover:scale-110 active:scale-95",
                    Math.round(manager.rating) >= star
                      ? "text-yellow-500"
                      : "text-muted-foreground/30 hover:text-yellow-400",
                  )}
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                </button>
              ))}
              <span className="ml-1.5 text-xs font-bold">
                {ratingBusy
                  ? <Loader2 className="h-3 w-3 animate-spin inline" aria-label="Saving…" />
                  : manager.status === "Pending"
                  ? t("chief.managers.card.ratingNew")
                  : manager.rating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={manager.status} />
          {manager.delayedCount > 0 && <Badge variant="outline" className="border-red-500 text-red-400 bg-red-500/5">{manager.delayedCount} {t("chief.managers.card.delayed")}</Badge>}
          {manager.urgentCount > 0 && <Badge variant="outline" className="border-yellow-500 text-yellow-400 bg-yellow-500/5">{manager.urgentCount} {t("chief.managers.card.urgent")}</Badge>}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <button type="button" onClick={onCalendar} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <CalendarDays className="h-3 w-3" />
            {manager.nextDeadline ? formatDate(manager.nextDeadline, i18n.language) : t("chief.common.noDeadline")}
          </button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onMessage} data-testid={`button-message-manager-${manager.id}`}>
            <MessageSquare className="mr-2 h-3 w-3" /> {t("chief.managers.actions.message")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagerTable({
  managers,
  searchTerm,
  onAssign,
  onDetails,
  onMessage,
  onRebalance,
}: {
  managers: ManagerSummary[];
  searchTerm: string;
  onAssign: (id: string) => void;
  onDetails: (id: string) => void;
  onMessage: (id: string) => void;
  onRebalance: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="rounded-lg border bg-card/40">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("chief.managers.table.manager")}</TableHead>
            <TableHead>{t("chief.managers.table.status")}</TableHead>
            <TableHead>{t("chief.managers.table.workload")}</TableHead>
            <TableHead>{t("chief.managers.table.projects")}</TableHead>
            <TableHead>{t("chief.managers.table.clients")}</TableHead>
            <TableHead>{t("chief.managers.table.nextDeadline")}</TableHead>
            <TableHead className="text-right">{t("chief.managers.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managers.map((manager) => (
            <TableRow key={manager.id}>
              <TableCell>
                <button type="button" onClick={() => onDetails(manager.id)} className="text-left">
                  <div className="font-medium">
                    <HighlightText text={manager.name} query={searchTerm} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <HighlightText text={managerEmailLabel(manager)} query={searchTerm} />
                  </div>
                </button>
              </TableCell>
              <TableCell><StatusBadge status={manager.status} /></TableCell>
              <TableCell className="min-w-[150px]">
                <div className="flex items-center gap-2">
                  <Progress value={manager.workload} className="h-1.5" />
                  <span className="w-9 text-xs">{manager.workload}%</span>
                </div>
              </TableCell>
              <TableCell>{manager.activeProjects.length}</TableCell>
              <TableCell>{manager.clients.length}</TableCell>
              <TableCell>{manager.nextDeadline ? formatDate(manager.nextDeadline, i18n.language) : "-"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => onAssign(manager.id)}>{t("chief.managers.actions.assign")}</Button>
                  <Button variant="outline" size="sm" onClick={() => onRebalance(manager.id)}>{t("chief.managers.actions.rebalance")}</Button>
                  <Button variant="ghost" size="icon" onClick={() => onMessage(manager.id)} aria-label={`${t("chief.managers.actions.message")} ${manager.name}`}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AssignmentSheet({
  open,
  focusManagerId,
  managers,
  clients,
  projects,
  clientDraft,
  projectDraft,
  clientSearch,
  projectSearch,
  clientPagination,
  projectPagination,
  loading,
  error,
  cascadeClientProjects,
  onCascadeClientProjectsChange,
  onClientSearchChange,
  onProjectSearchChange,
  onClientPageChange,
  onProjectPageChange,
  onClientDraftChange,
  onProjectDraftChange,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  focusManagerId: string | null;
  managers: Manager[];
  clients: ManagedClient[];
  projects: ManagedProject[];
  clientDraft: Record<string, string>;
  projectDraft: Record<string, string>;
  clientSearch: string;
  projectSearch: string;
  clientPagination: PlatformPagination;
  projectPagination: PlatformPagination;
  loading: boolean;
  error: string;
  cascadeClientProjects: boolean;
  onCascadeClientProjectsChange: (value: boolean) => void;
  onClientSearchChange: (value: string) => void;
  onProjectSearchChange: (value: string) => void;
  onClientPageChange: (page: number) => void;
  onProjectPageChange: (page: number) => void;
  onClientDraftChange: (clientId: string, managerId: string) => void;
  onProjectDraftChange: (projectId: string, managerId: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const focusManager = managers.find((manager) => manager.id === focusManagerId);
  const managerOptions = [{ id: "unassigned", name: t("chief.common.status.unassigned") }, ...managers.map((manager) => ({ id: manager.id, name: manager.name }))];
  const [bulkTarget, setBulkTarget] = useState(focusManagerId ?? "unassigned");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const bulkManager = managers.find((manager) => manager.id === bulkTarget) ?? null;
  const bulkCurrentProjects = projects.filter((project) => project.managerId === bulkTarget).length;
  const bulkCurrentClients = clients.filter((client) => client.managerId === bulkTarget).length;
  const bulkWouldOverload = Boolean(
    bulkManager &&
    (
      bulkCurrentProjects + selectedProjectIds.length > PM_ACTIVE_PROJECT_CAPACITY ||
      bulkCurrentClients + selectedClientIds.length > PM_CLIENT_CAPACITY
    ),
  );

  // When a focus manager is set, only show their items; otherwise show all
  const visibleClients = focusManagerId
    ? clients.filter((c) => c.managerId === focusManagerId || !c.managerId)
    : clients;
  const visibleProjects = focusManagerId
    ? projects.filter((p) => p.managerId === focusManagerId || !p.managerId)
    : projects;
  const selectedCount = selectedClientIds.length + selectedProjectIds.length;
  const allVisibleClientsSelected = visibleClients.length > 0 && visibleClients.every((client) => selectedClientIds.includes(client.id));
  const allVisibleProjectsSelected = visibleProjects.length > 0 && visibleProjects.every((project) => selectedProjectIds.includes(project.id));

  useEffect(() => {
    if (!open) return;
    setBulkTarget(focusManagerId ?? "unassigned");
    setSelectedClientIds([]);
    setSelectedProjectIds([]);
  }, [focusManagerId, open]);

  function toggleClientSelection(id: string) {
    setSelectedClientIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function toggleProjectSelection(id: string) {
    setSelectedProjectIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function toggleVisibleClients() {
    const visibleIds = visibleClients.map((client) => client.id);
    setSelectedClientIds((current) => (
      visibleIds.every((id) => current.includes(id))
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    ));
  }

  function toggleVisibleProjects() {
    const visibleIds = visibleProjects.map((project) => project.id);
    setSelectedProjectIds((current) => (
      visibleIds.every((id) => current.includes(id))
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    ));
  }

  function applyBulkAssignment() {
    selectedClientIds.forEach((id) => onClientDraftChange(id, bulkTarget));
    selectedProjectIds.forEach((id) => onProjectDraftChange(id, bulkTarget));
    setSelectedClientIds([]);
    setSelectedProjectIds([]);
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <div className="flex min-h-full flex-col gap-6">
          <SheetHeader>
            <SheetTitle>
              {focusManager ? t("chief.managers.assignments.titleFocused", { name: focusManager.name }) : t("chief.managers.assignments.titleTeam")}
            </SheetTitle>
            <SheetDescription>
              {focusManager
                ? t("chief.managers.assignments.descFocused", { name: focusManager.name })
                : t("chief.managers.assignments.descTeam")}
            </SheetDescription>
          </SheetHeader>

          <div className="rounded-lg border bg-primary/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t("chief.managers.assignments.bulkTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("chief.managers.assignments.bulkDesc")}</p>
              </div>
              <Badge variant="secondary">{selectedCount} {t("chief.managers.assignments.selected")}</Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select value={bulkTarget} onValueChange={setBulkTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {managerOptions.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={applyBulkAssignment} disabled={!selectedCount}>
                {t("chief.managers.assignments.applySelected")}
              </Button>
            </div>
            {bulkManager && selectedCount > 0 && (
              <div className={cn(
                "mt-3 rounded-md border px-3 py-2 text-xs",
                bulkWouldOverload
                  ? "border-red-500/30 bg-red-500/5 text-red-500"
                  : "border-green-500/30 bg-green-500/5 text-green-600",
              )}>
                {bulkManager.name}: {bulkCurrentProjects + selectedProjectIds.length}/{PM_ACTIVE_PROJECT_CAPACITY} active projects · {bulkCurrentClients + selectedClientIds.length}/{PM_CLIENT_CAPACITY} clients after this change
              </div>
            )}
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-md border bg-background/40 p-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border accent-primary"
                checked={cascadeClientProjects}
                onChange={(event) => onCascadeClientProjectsChange(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">{t("chief.managers.assignments.cascadeLabel")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("chief.managers.assignments.cascadeDesc")}
                </span>
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          )}

          <AssignmentSection
            title={t("chief.managers.assignments.clients")}
            empty={t("chief.managers.assignments.noClients")}
            searchValue={clientSearch}
            searchPlaceholder={t("chief.managers.assignments.searchClients")}
            onSearchChange={onClientSearchChange}
            pagination={clientPagination}
            loading={loading}
            onPreviousPage={() => onClientPageChange(Math.max(0, Math.floor(clientPagination.offset / clientPagination.limit) - 1))}
            onNextPage={() => onClientPageChange(Math.floor(clientPagination.offset / clientPagination.limit) + 1)}
            rows={visibleClients.map((client) => ({
              id: client.id,
              title: client.name,
              meta: `${client.exhibition} / ${client.status}`,
              secondary: client.contactEmail || client.contactName,
              details: clientIntakeSummary(client),
              value: clientDraft[client.id] ?? client.managerId ?? "unassigned",
              actionLabel: "Create project",
              actionHref: createProjectHrefForClient(client),
            }))}
            managerOptions={managerOptions}
            onChange={onClientDraftChange}
            selectedIds={selectedClientIds}
            allRowsSelected={allVisibleClientsSelected}
            onToggleRow={toggleClientSelection}
            onToggleAll={toggleVisibleClients}
          />

          <AssignmentSection
            title={t("chief.managers.assignments.projects")}
            empty={t("chief.managers.assignments.noProjects")}
            searchValue={projectSearch}
            searchPlaceholder={t("chief.managers.assignments.searchProjects")}
            onSearchChange={onProjectSearchChange}
            pagination={projectPagination}
            loading={loading}
            onPreviousPage={() => onProjectPageChange(Math.max(0, Math.floor(projectPagination.offset / projectPagination.limit) - 1))}
            onNextPage={() => onProjectPageChange(Math.floor(projectPagination.offset / projectPagination.limit) + 1)}
            rows={visibleProjects.map((project) => ({
              id: project.id,
              title: project.name,
              meta: `${project.exhibition} / ${project.system} / ${project.progress}%`,
              value: projectDraft[project.id] ?? project.managerId ?? "unassigned",
            }))}
            managerOptions={managerOptions}
            onChange={onProjectDraftChange}
            selectedIds={selectedProjectIds}
            allRowsSelected={allVisibleProjectsSelected}
            onToggleRow={toggleProjectSelection}
            onToggleAll={toggleVisibleProjects}
          />

          <SheetFooter className="mt-auto gap-2 sm:gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t("chief.common.cancel")}</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("chief.managers.assignments.saveAssignments")}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AssignmentSection({
  title,
  empty,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  pagination,
  loading,
  onPreviousPage,
  onNextPage,
  rows,
  managerOptions,
  onChange,
  selectedIds = [],
  allRowsSelected = false,
  onToggleRow,
  onToggleAll,
}: {
  title: string;
  empty: string;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  pagination: PlatformPagination;
  loading: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  rows: Array<{ id: string; title: string; meta: string; value: string; secondary?: string; details?: string; actionLabel?: string; actionHref?: string }>;
  managerOptions: Array<{ id: string; name: string }>;
  onChange: (id: string, managerId: string) => void;
  selectedIds?: string[];
  allRowsSelected?: boolean;
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">
            {t("chief.managers.assignments.showing", {
              total: pagination.total,
              start: pagination.total ? pagination.offset + 1 : 0,
              end: Math.min(pagination.offset + rows.length, pagination.total),
            })}
          </p>
        </div>
        {onToggleAll && rows.length > 0 && (
          <SelectAllButton allRowsSelected={allRowsSelected ?? false} onToggleAll={onToggleAll} />
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-8 text-sm"
        />
      </div>
      {loading && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("chief.managers.assignments.loading")}
        </div>
      )}
      {!loading && rows.length ? rows.map((row) => (
        <div key={row.id} className="rounded-lg border bg-background/40 p-3">
          <div className="mb-3 flex items-start gap-3">
            {onToggleRow && (
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border accent-primary"
                checked={selectedIds.includes(row.id)}
                onChange={() => onToggleRow(row.id)}
                aria-label={t("chief.managers.assignments.selectRow", { name: row.title })}
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.title}</p>
              <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
              {row.secondary && <p className="truncate text-[11px] text-muted-foreground">{row.secondary}</p>}
              {row.details && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{row.details}</p>}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Select value={row.value} onValueChange={(value) => onChange(row.id, value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {managerOptions.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {row.actionHref && row.actionLabel && (
              <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => window.location.assign(row.actionHref!)}>
                <Briefcase className="mr-2 h-3.5 w-3.5" /> {row.actionLabel}
              </Button>
            )}
          </div>
        </div>
      )) : !loading ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{empty}</div>
      ) : null}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={loading || pagination.offset === 0}
          onClick={onPreviousPage}
        >
          {t("chief.managers.assignments.previous")}
        </Button>
        <span>{t("chief.managers.assignments.page", { page: Math.floor(pagination.offset / Math.max(1, pagination.limit)) + 1 })}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={loading || !pagination.hasMore}
          onClick={onNextPage}
        >
          {t("chief.managers.assignments.next")}
        </Button>
      </div>
    </div>
  );
}

function ManagerDetailsSheet({
  manager,
  audit,
  onOpenChange,
  onAssign,
  onCalendar,
  onMessage,
}: {
  manager: ManagerSummary | null;
  audit: AuditEntry[];
  onOpenChange: (open: boolean) => void;
  onAssign: () => void;
  onCalendar: () => void;
  onMessage: () => void;
}) {
  const { t, i18n } = useTranslation();
  const managerAudit = manager ? audit.filter((entry) => entry.managerId === manager.id).slice(0, 5) : [];

  return (
    <Sheet open={!!manager} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {manager && (
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle>{manager.name}</SheetTitle>
              <SheetDescription>{manager.role} / {managerEmailLabel(manager)}</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3">
              <DetailStat label={t("chief.managers.detail.workload")} value={`${manager.workload}%`} />
              <DetailStat label={t("chief.managers.detail.projects")} value={String(manager.activeProjects.length)} />
              <DetailStat label={t("chief.managers.detail.clients")} value={String(manager.clients.length)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onAssign}><ArrowRightLeft className="mr-2 h-4 w-4" /> {t("chief.common.assignments")}</Button>
              <Button size="sm" variant="outline" onClick={onCalendar}><CalendarDays className="mr-2 h-4 w-4" /> {t("chief.nav.calendar")}</Button>
              <Button size="sm" variant="outline" onClick={onMessage}><MessageSquare className="mr-2 h-4 w-4" /> {t("chief.managers.actions.message")}</Button>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid h-auto grid-cols-4 bg-muted/40 p-1">
                <TabsTrigger value="overview" className="text-xs">{t("chief.managers.detail.tabs.overview")}</TabsTrigger>
                <TabsTrigger value="projects" className="text-xs">{t("chief.managers.detail.tabs.projects")}</TabsTrigger>
                <TabsTrigger value="clients" className="text-xs">{t("chief.managers.detail.tabs.clients")}</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">{t("chief.managers.detail.tabs.activity")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3">
                <div className="rounded-lg border bg-card/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{t("chief.managers.detail.overview.title")}</p>
                      <p className="text-xs text-muted-foreground">{t("chief.managers.detail.overview.desc")}</p>
                    </div>
                    <span className={cn("text-sm font-bold", manager.workload >= 80 ? "text-red-500" : manager.workload >= 65 ? "text-yellow-500" : "text-green-500")}>
                      {manager.workload}%
                    </span>
                  </div>
                  <Progress value={manager.workload} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DetailStat label={t("chief.managers.detail.overview.delayed")} value={String(manager.delayedCount)} />
                  <DetailStat label={t("chief.managers.detail.overview.dueSoon")} value={String(manager.urgentCount)} />
                  <DetailStat label={t("chief.managers.detail.overview.nextDeadline")} value={manager.nextDeadline ? formatDate(manager.nextDeadline, i18n.language) : t("chief.managers.detail.overview.none")} />
                  <DetailStat label={t("chief.managers.detail.overview.rating")} value={manager.rating.toFixed(1)} />
                </div>
              </TabsContent>

              <TabsContent value="projects" className="space-y-3">
                {manager.allProjects.length ? manager.allProjects.map((project) => (
                  <div key={project.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.exhibition} / {project.system}</p>
                      </div>
                      <WorkStatusBadge status={project.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={project.progress} className="h-1.5" />
                      <span className="w-9 text-xs text-muted-foreground">{project.progress}%</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{t("chief.managers.table.nextDeadline")}: {formatDate(project.deadline, i18n.language)}</p>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("chief.managers.detail.noProjects")}</div>
                )}
              </TabsContent>

              <TabsContent value="clients" className="space-y-3">
                {manager.clients.length ? manager.clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.exhibition}</p>
                    </div>
                    <WorkStatusBadge status={client.status} />
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("chief.managers.detail.noClients")}</div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-3">
                <AuditList entries={managerAudit} managers={[manager]} compact />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Briefcase }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("h-3 w-3", Icon === Star && "text-yellow-500 fill-yellow-500")} />
        {label}
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function SelectAllButton({ allRowsSelected, onToggleAll }: { allRowsSelected: boolean; onToggleAll: () => void }) {
  const { t } = useTranslation();
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onToggleAll}>
      {allRowsSelected ? t("chief.common.clear") : t("chief.common.selectAll")}
    </Button>
  );
}

function AuditList({
  entries,
  managers,
  compact = false,
}: {
  entries: AuditEntry[];
  managers: Array<Pick<Manager, "id" | "name">>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (!entries.length) {
    return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("chief.managers.audit.noActivity")}</div>;
  }

  return (
    <div className={cn("grid gap-3", !compact && "md:grid-cols-2")}>
      {entries.map((entry) => {
        const manager = managers.find((item) => item.id === entry.managerId);
        return (
          <div key={entry.id} className="rounded-lg border bg-background/40 p-3">
            <div className="flex items-start gap-3">
              <span className={cn(
                "mt-1 h-2 w-2 flex-shrink-0 rounded-full",
                entry.tone === "success" && "bg-green-500",
                entry.tone === "warning" && "bg-yellow-500",
                entry.tone === "info" && "bg-primary",
              )} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{entry.action}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{manager?.name ?? t("chief.managers.audit.team")} / {entry.time}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: ManagerStatus }) {
  const { t } = useTranslation();
  const label =
    status === "Active"   ? t("chief.common.status.active") :
    status === "Pending"  ? t("chief.common.status.pending") :
                            t("chief.common.status.onLeave");
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "Active" && "border-green-500 text-green-500 bg-green-500/5",
        status === "Pending" && "border-yellow-500 text-yellow-500 bg-yellow-500/5",
        status === "On Leave" && "border-slate-500 text-slate-400 bg-slate-500/5",
      )}
    >
      {label}
    </Badge>
  );
}

function WorkStatusBadge({ status }: { status: WorkStatus }) {
  const { t } = useTranslation();
  const label =
    status === "Active"    ? t("chief.common.status.active") :
    status === "Pending"   ? t("chief.common.status.pending") :
    status === "Delayed"   ? t("chief.common.status.delayed") :
                             t("chief.common.status.completed");
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "Active" && "border-green-500 text-green-500 bg-green-500/5",
        status === "Pending" && "border-yellow-500 text-yellow-500 bg-yellow-500/5",
        status === "Delayed" && "border-red-500 text-red-500 bg-red-500/5",
        status === "Completed" && "border-blue-500 text-blue-500 bg-blue-500/5",
      )}
    >
      {label}
    </Badge>
  );
}

function ManagersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* 5 summary tiles */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-lg border bg-card/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>

      {/* Manager cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card/40 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Skeleton className="h-8 rounded" />
              <Skeleton className="h-8 rounded" />
              <Skeleton className="h-8 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pure helpers

function readSavedManagerViews(defaultViews: SavedManagerView[] = DEFAULT_MANAGER_VIEWS): SavedManagerView[] {
  if (typeof window === "undefined") return defaultViews;

  try {
    const raw = window.localStorage.getItem(SAVED_MANAGER_VIEWS_KEY);
    if (!raw) return defaultViews;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultViews;

    const customViews = parsed
      .map(toSavedManagerView)
      .filter((view): view is SavedManagerView => Boolean(view));

    return [...defaultViews, ...customViews];
  } catch {
    return defaultViews;
  }
}

function persistSavedManagerViews(views: SavedManagerView[]) {
  if (typeof window === "undefined") return;
  const customViews = views.filter((view) => !view.isDefault);
  window.localStorage.setItem(SAVED_MANAGER_VIEWS_KEY, JSON.stringify(customViews));
}

function toSavedManagerView(value: unknown): SavedManagerView | null {
  if (!value || typeof value !== "object") return null;
  const view = value as Partial<SavedManagerView>;
  if (!view.id || !view.name || !view.sortMode || !view.viewMode || !view.statusFilter) return null;
  if (!MANAGER_STATUS_OPTIONS.includes(view.statusFilter)) return null;
  if (!["workload-desc", "workload-asc", "projects-desc", "rating-desc"].includes(view.sortMode)) return null;
  if (!["cards", "table"].includes(view.viewMode)) return null;

  return {
    id: String(view.id),
    name: String(view.name),
    search: typeof view.search === "string" ? view.search : "",
    statusFilter: view.statusFilter,
    sortMode: view.sortMode,
    viewMode: view.viewMode,
  };
}

function assignmentValue(managerId: string | null | undefined) {
  return managerId ?? "unassigned";
}

function clientIntakeSummary(client: ManagedClient) {
  const details = [
    client.boothWidthM && client.boothDepthM ? `${client.boothWidthM} x ${client.boothDepthM} m` : "",
    client.preferredSystem ? client.preferredSystem : "",
    client.venueCity ? client.venueCity : "",
    client.targetDate ? `Target ${client.targetDate}` : "",
    client.intakeNotes ? client.intakeNotes : "",
  ].filter(Boolean);
  return details.join(" / ");
}

function createProjectHrefForClient(client: ManagedClient) {
  const params = new URLSearchParams({
    new: "1",
    client: client.name,
    exhibition: client.exhibition,
    clientId: client.id,
  });
  if (client.boothWidthM) params.set("width", String(client.boothWidthM));
  if (client.boothDepthM) params.set("depth", String(client.boothDepthM));
  if (client.preferredSystem) params.set("system", client.preferredSystem);
  if (client.targetDate) params.set("deadline", client.targetDate);
  return `/chief/projects?${params.toString()}`;
}

function mergeAssignmentOriginals<T extends { id: string; managerId: string | null }>(
  current: Record<string, string>,
  rows: T[],
) {
  const next = { ...current };
  rows.forEach((row) => {
    if (!(row.id in next)) next[row.id] = assignmentValue(row.managerId);
  });
  return next;
}

function mergeAssignmentDrafts<T extends { id: string; managerId: string | null }>(
  current: Record<string, string>,
  rows: T[],
) {
  const next = { ...current };
  rows.forEach((row) => {
    if (!(row.id in next)) next[row.id] = assignmentValue(row.managerId);
  });
  return next;
}

function hasDraftChanges(draft: Record<string, string>, original: Record<string, string>) {
  return Object.entries(draft).some(([id, managerId]) => original[id] !== undefined && original[id] !== managerId);
}

function changedAssignmentRows(draft: Record<string, string>, original: Record<string, string>) {
  return Object.entries(draft)
    .filter(([id, managerId]) => original[id] !== undefined && original[id] !== managerId)
    .map(([id, managerId]) => ({ id, managerId }));
}

function normalizeManagerStatus(status: string): ManagerStatus {
  const value = status.trim().toLowerCase();
  if (value === "active") return "Active";
  if (value === "pending" || value === "invited") return "Pending";
  return "On Leave";
}

function normalizeWorkStatus(status: string): WorkStatus {
  const value = status.trim().toLowerCase();
  if (value.includes("delay") || value.includes("blocked")) return "Delayed";
  if (value.includes("complete") || value.includes("approved") || value.includes("done")) return "Completed";
  if (value.includes("active") || value.includes("progress") || value.includes("review") || value.includes("revision")) return "Active";
  return "Pending";
}

function summarizeManager(manager: Manager, clients: ManagedClient[], projects: ManagedProject[]): ManagerSummary {
  const managerProjects = projects.filter((project) => project.managerId === manager.id);
  const activeProjects = managerProjects.filter((project) => project.status !== "Completed");
  const managerClients = clients.filter((client) => client.managerId === manager.id);
  const workload = computeWorkload(manager.status, activeProjects, managerClients.length);
  const delayedCount = activeProjects.filter((project) => project.status === "Delayed").length;
  const urgentCount = activeProjects.filter((project) => daysUntil(project.deadline) <= 14).length;
  const nextDeadline = activeProjects.map((project) => project.deadline).sort()[0] ?? null;

  return {
    ...manager,
    workload,
    activeProjects,
    allProjects: managerProjects,
    clients: managerClients,
    delayedCount,
    urgentCount,
    nextDeadline,
  };
}

function computeWorkload(status: ManagerStatus, projects: ManagedProject[], clientCount: number) {
  if (status === "Pending") return 0;

  const total = Math.max(1, projects.length);
  const delayedFraction = projects.filter(p => p.status === "Delayed").length / total;
  const urgentFraction = projects.filter(p => {
    const d = daysUntil(p.deadline);
    return d >= 0 && d <= 14;
  }).length / total;
  const overdueBonus = projects.filter(p => daysUntil(p.deadline) < 0).length / total;

  // Base load: how full is this PM relative to capacity?
  const projectLoad = Math.min(1, projects.length / PM_ACTIVE_PROJECT_CAPACITY);
  const clientLoad  = Math.min(1, clientCount / PM_CLIENT_CAPACITY);
  const baseLoad    = Math.max(projectLoad, clientLoad);

  // Urgency pressure on top of base load
  const urgencyBoost = delayedFraction * 0.25 + urgentFraction * 0.12 + overdueBonus * 0.18;

  const raw = (baseLoad * 75 + urgencyBoost * 25) * 100;
  const adjusted = status === "On Leave" ? Math.min(raw, 35) : raw;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

function compareProjectRisk(a: ManagedProject, b: ManagedProject) {
  const aRisk = (a.status === "Delayed" ? 100 : 0) - daysUntil(a.deadline);
  const bRisk = (b.status === "Delayed" ? 100 : 0) - daysUntil(b.deadline);
  return bRisk - aRisk;
}

function daysUntil(date: string) {
  const now = new Date();
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function formatDate(date: string, locale = "en-US") {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function managerEmailLabel(manager: { email?: string }) {
  return manager.email?.trim() || "Account not linked";
}
