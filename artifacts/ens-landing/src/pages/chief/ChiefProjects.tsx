import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/useDebounce";
import {
  createPlatformExhibition,
  createPlatformProject,
  getPlatformExhibitions,
  getManagerWorkspace,
  getWorkspaceMonitor,
  getPlatformProjects,
  recordReportExport,
  updatePlatformProject,
  updatePlatformProjectStage,
  type PlatformPagination,
  type PlatformExhibition,
  type ExhibitionStatus,
  type ManagedClient,
  type PlatformManager,
  type PlatformProject,
  type WorkspaceMonitorProject,
} from "@/lib/platform-api";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { cn } from "@/lib/utils";
import { preloadPortalRoute } from "@/lib/route-preload";
import {
  Activity,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  User,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Stage = "intake" | "design" | "review" | "production" | "closed";
type Priority = "High" | "Medium" | "Low";

interface KanbanProject {
  id: string;
  name: string;
  client: string;
  pm: string;
  system: string;
  progress: number;
  deadline: string;
  status: string;
  health: string;
  stage: Stage;
  dimensions: string;
  priority: Priority;
  waitDays: number;
  exhibition: string;
  description: string;
}

interface ProjectEditForm {
  name: string;
  client: string;
  managerId: string;
  deadline: string;
  system: string;
  width: string;
  depth: string;
  exhibition: string;
  description: string;
}

const EMPTY_PROJECT_FORM: ProjectEditForm = {
  name: "",
  client: "",
  managerId: "keep",
  deadline: "",
  system: "octanorm",
  width: "6",
  depth: "3",
  exhibition: "",
  description: "",
};

interface CreateProjectForm {
  name: string;
  client: string;
  clientId: string;
  managerId: string;
  deadline: string;
  system: string;
  width: string;
  depth: string;
  exhibition: string;
}

const EMPTY_CREATE_FORM: CreateProjectForm = {
  name: "",
  client: "",
  clientId: "",
  managerId: "unassigned",
  deadline: "",
  system: "octanorm",
  width: "6",
  depth: "3",
  exhibition: "",
};

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Stage IDs are stable data keys — labels are translated inside the component
const STAGE_IDS: Stage[] = ["intake", "design", "review", "production", "closed"];

const STAGE_STYLES: Record<Stage, { dot: string; text: string; bg: string; border: string; borderTop: string; bar: string }> = {
  intake:     { dot: "bg-gray-500",   text: "text-gray-500",   bg: "bg-gray-500/10",   border: "border-l-gray-500",   borderTop: "border-t-gray-500",   bar: "bg-gray-500" },
  design:     { dot: "bg-blue-700",   text: "text-blue-700",   bg: "bg-blue-700/10",   border: "border-l-blue-700",   borderTop: "border-t-blue-700",   bar: "bg-blue-700" },
  review:     { dot: "bg-amber-600",  text: "text-amber-600",  bg: "bg-amber-600/10",  border: "border-l-amber-600",  borderTop: "border-t-amber-600",  bar: "bg-amber-600" },
  production: { dot: "bg-blue-600", text: "text-blue-600", bg: "bg-blue-600/10", border: "border-l-blue-600", borderTop: "border-t-blue-600", bar: "bg-blue-600" },
  closed:     { dot: "bg-green-700",  text: "text-green-700",  bg: "bg-green-700/10",  border: "border-l-green-700",  borderTop: "border-t-green-700",  bar: "bg-green-700" },
};

const PRIORITY_TEXT: Record<Priority, string> = {
  High:   "text-red-600",
  Medium: "text-amber-600",
  Low:    "text-gray-500",
};

const PAGE_SIZE = 25;

// A show counts as active from the moment it is confirmed until it is over.
const ACTIVE_EXHIBITION_STATUSES: ExhibitionStatus[] = ["confirmed", "in_production", "on_site", "live"];
const isActiveExhibition = (status: ExhibitionStatus) => ACTIVE_EXHIBITION_STATUSES.includes(status);

export default function ChiefProjects() {
  const { t, i18n } = useTranslation();
  const [location, navigate] = useLocation();
  const initialParams = new URLSearchParams(location.split("?")[1] ?? "");
  const initialManager = initialParams.get("pm") ?? "";

  const [projects, setProjects]             = useState<KanbanProject[]>([]);
  const [exhibitions, setExhibitions]       = useState<PlatformExhibition[]>([]);
  const [managers, setManagers]             = useState<PlatformManager[]>([]);
  const [managedClients, setManagedClients] = useState<ManagedClient[]>([]);
  const [pagination, setPagination]         = useState<PlatformPagination>({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false });
  const [page, setPage]                     = useState(0);
  const [view, setView]                     = useState<"kanban" | "list" | "live">("kanban");
  const [search, setSearch]                 = useState(initialManager);
  const debouncedSearch                     = useDebounce(search, 250);
  const [filterSt, setFilter]               = useState<"All" | "Active" | "Pending" | "Delayed" | "Completed">("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");
  const [toastMsg, setToastMsg]             = useState("");
  const [toastVisible, setToastVisible]     = useState(false);
  const [error, setError]                   = useState("");
  const [isLoading, setIsLoading]           = useState(true);
  const [movingProjectId, setMovingProjectId] = useState<string | null>(null);
  const [wsMap, setWsMap]                   = useState<Map<string, WorkspaceMonitorProject>>(new Map());
  const [editProject, setEditProject]       = useState<KanbanProject | null>(null);
  const [editForm, setEditForm]             = useState<ProjectEditForm>(EMPTY_PROJECT_FORM);
  const [editError, setEditError]           = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [closeTarget, setCloseTarget]       = useState<KanbanProject | null>(null);
  // Create project
  const [createOpen, setCreateOpen]         = useState(false);
  const [createForm, setCreateForm]         = useState<CreateProjectForm>(EMPTY_CREATE_FORM);
  const [createError, setCreateError]       = useState("");
  const [isCreating, setIsCreating]         = useState(false);
  // Tabs + exhibitions
  const [activeTab, setActiveTab]           = useState<"projects" | "exhibitions">("projects");
  const [exhibitionCreateOpen, setExhibitionCreateOpen] = useState(false);
  const [exhibitionForm, setExhibitionForm] = useState({ name: "", venue: "", city: "", startDate: "", endDate: "" });
  const [exhibitionCreateError, setExhibitionCreateError] = useState("");
  const [isCreatingExhibition, setIsCreatingExhibition]   = useState(false);
  // Exhibition detail
  const [exhibitionDetail,     setExhibitionDetail]       = useState<PlatformExhibition | null>(null);
  const [detailClientSearch,   setDetailClientSearch]     = useState("");

  useEffect(() => {
    document.title = t("chief.projects.title");
  }, [t]);

  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    if (params.get("new") !== "1") return;

    setCreateForm((current) => ({
      ...current,
      client: params.get("client") ?? current.client,
      clientId: params.get("clientId") ?? current.clientId,
      exhibition: params.get("exhibition") ?? current.exhibition,
      width: params.get("width") ?? current.width,
      depth: params.get("depth") ?? current.depth,
      system: params.get("system") ?? current.system,
      deadline: params.get("deadline") ?? current.deadline,
    }));
    setCreateOpen(true);
    params.delete("new");
    params.delete("client");
    params.delete("exhibition");
    params.delete("clientId");
    params.delete("width");
    params.delete("depth");
    params.delete("system");
    params.delete("deadline");
    navigate(`${location.split("?")[0]}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
  }, [location, navigate]);

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setError("");
    getPlatformProjects({
      q: debouncedSearch,
      status: projectStatusParam(filterSt),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((response) => {
        if (!mounted) return;
        setProjects(response.projects.map(toKanbanProject));
        setPagination(response.pagination);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setProjects([]);
        setPagination({ total: 0, limit: PAGE_SIZE, offset: page * PAGE_SIZE, hasMore: false });
        setError(reason instanceof Error ? reason.message : t("chief.projects.error.load"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [debouncedSearch, filterSt, page, t]);

  useEffect(() => { setPage(0); }, [debouncedSearch, filterSt]);

  useEffect(() => {
    let mounted = true;
    getManagerWorkspace()
      .then((workspace) => {
        if (!mounted) return;
        setManagers(workspace.managers);
        setManagedClients(workspace.clients);
      })
      .catch(() => {
        if (!mounted) return;
        setManagers([]);
        setManagedClients([]);
      });
    return () => { mounted = false; };
  }, []);

  // Load workspace monitor data silently — used to show live workspace status on project cards
  useEffect(() => {
    let mounted = true;
    getWorkspaceMonitor()
      .then((workspace) => {
        if (!mounted) return;
        const map = new Map<string, WorkspaceMonitorProject>();
        for (const p of workspace.projects) map.set(p.id, p);
        setWsMap(map);
      })
      .catch(() => { /* non-critical — cards degrade gracefully */ });
    return () => { mounted = false; };
  }, []);

  // Translated stage labels — reactive to language changes
  useEffect(() => {
    let mounted = true;
    getPlatformExhibitions()
      .then((response) => {
        if (mounted) setExhibitions(response.exhibitions);
      })
      .catch(() => {
        if (mounted) setExhibitions([]);
      });
    return () => { mounted = false; };
  }, []);

  const stages = useMemo(
    () => STAGE_IDS.map((id) => ({ id, label: t(`chief.projects.stage.${id}`) })),
    [t],
  );

  // Translated filter sets — reactive to language changes
  const statusFilters = useMemo(
    () => (["All", "Active", "Pending", "Delayed", "Completed"] as const).map((key) => ({
      key,
      label: t(`chief.projects.filter.${key.toLowerCase()}`),
    })),
    [t],
  );

  const priorityFilters = useMemo(
    () => (["All", "High", "Medium", "Low"] as const).map((key) => ({
      key,
      label: t(`chief.projects.priority.${key.toLowerCase()}`),
    })),
    [t],
  );

  const managerOptions = managers
    .filter((m) => m.status === "Active")
    .map((m) => ({ id: m.id, name: m.name }));

  const createSelectedClient = managedClients.find((client) => client.id === createForm.clientId) ?? null;
  const clientOptions = managedClients
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((client) => ({
      id: client.id,
      name: client.name,
      email: client.contactEmail,
      exhibition: cleanClientExhibition(client.exhibition),
      booth: formatClientBoothSummary(client),
    }));

  const filtered = useMemo(
    () => projects.filter((p) => priorityFilter === "All" || p.priority === priorityFilter),
    [priorityFilter, projects],
  );

  const counts      = Object.fromEntries(STAGE_IDS.map((id) => [id, filtered.filter((p) => p.stage === id).length]));
  const statusCounts = {
    Active:    filtered.filter((p) => p.status === "Active").length,
    Pending:   filtered.filter((p) => p.status === "Pending").length,
    Delayed:   filtered.filter((p) => p.status === "Delayed").length,
    Completed: filtered.filter((p) => p.status === "Completed").length,
  };
  const urgentCount  = filtered.filter((p) => p.priority === "High").length;
  const waitingCount = filtered.filter((p) => p.waitDays > 0).length;
  const pageStart    = pagination.total === 0 ? 0 : pagination.offset + 1;
  const pageEnd      = Math.min(pagination.offset + projects.length, pagination.total);

  async function reloadProjects() {
    const response = await getPlatformProjects({
      q: debouncedSearch,
      status: projectStatusParam(filterSt),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setProjects(response.projects.map(toKanbanProject));
    setPagination(response.pagination);
  }

  function showToast(message: string) {
    setToastMsg(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2400);
  }

  function openEdit(project: KanbanProject) {
    const dims    = parseProjectDimensions(project.dimensions);
    const manager = managerOptions.find((o) => o.name === project.pm);
    setEditProject(project);
    setEditForm({
      name:        project.name,
      client:      project.client,
      managerId:   manager?.id ?? "keep",
      deadline:    project.deadline,
      system:      normalizeSystem(project.system),
      width:       dims.width,
      depth:       dims.depth,
      exhibition:  project.exhibition,
      description: project.description,
    });
    setEditError("");
  }

  function selectCreateClient(clientId: string) {
    if (clientId === "none") {
      setCreateForm((f) => ({ ...f, clientId: "", client: "" }));
      return;
    }

    const client = managedClients.find((item) => item.id === clientId);
    if (!client) return;

    const exhibition = cleanClientExhibition(client.exhibition);
    const clientName = client.name || client.contactName || client.contactEmail;

    setCreateForm((f) => ({
      ...f,
      clientId: client.id,
      client: clientName,
      exhibition: exhibition || f.exhibition,
      width: client.boothWidthM ? String(client.boothWidthM) : f.width,
      depth: client.boothDepthM ? String(client.boothDepthM) : f.depth,
      system: client.preferredSystem ? normalizeSystem(client.preferredSystem) : f.system,
      deadline: client.targetDate || f.deadline,
      managerId: client.managerId || f.managerId,
      name: f.name.trim() ? f.name : exhibition ? `${exhibition} - ${clientName}` : `${clientName} project`,
    }));
  }

  async function saveEdit() {
    if (!editProject || isSavingProject) return;

    const name   = editForm.name.trim();
    const client = editForm.client.trim();
    const widthM = Number(editForm.width);
    const depthM = Number(editForm.depth);

    if (!name || !client) {
      setEditError(t("chief.projects.validate.required"));
      return;
    }
    if (!Number.isFinite(widthM) || widthM < 1 || widthM > 100 || !Number.isFinite(depthM) || depthM < 1 || depthM > 100) {
      setEditError(t("chief.projects.validate.dimensions"));
      return;
    }

    setEditError("");
    setIsSavingProject(true);
    try {
      await updatePlatformProject(editProject.id, {
        name,
        client,
        managerId:   editForm.managerId === "keep" ? undefined : editForm.managerId === "unassigned" ? null : editForm.managerId,
        deadline:    editForm.deadline,
        system:      editForm.system,
        widthM,
        depthM,
        exhibition:  editForm.exhibition.trim() || name,
        description: editForm.description.trim(),
      });
      await reloadProjects();
      setEditProject(null);
      setEditForm(EMPTY_PROJECT_FORM);
      showToast(t("chief.projects.toast.updated", { name }));
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : t("chief.projects.error.save"));
    } finally {
      setIsSavingProject(false);
    }
  }

  async function move(id: string, dir: "prev" | "next") {
    const target = projects.find((p) => p.id === id);
    if (!target || movingProjectId) return;

    const index     = STAGE_IDS.indexOf(target.stage);
    const nextIndex = dir === "next" ? Math.min(index + 1, STAGE_IDS.length - 1) : Math.max(index - 1, 0);
    const nextStage = STAGE_IDS[nextIndex];
    if (nextStage === target.stage) return;

    if (nextStage === "closed") { setCloseTarget(target); return; }
    await saveStageChange(target, nextStage);
  }

  async function saveStageChange(target: KanbanProject, nextStage: Stage) {
    const previousProjects = projects;
    setMovingProjectId(target.id);
    setProjects((current) => current.map((p) => p.id === target.id ? { ...p, stage: nextStage } : p));

    try {
      await updatePlatformProjectStage(target.id, nextStage);
      await reloadProjects();
      showToast(t("chief.projects.toast.moved", { name: target.name, stage: t(`chief.projects.stage.${nextStage}`) }));
    } catch (reason) {
      setProjects(previousProjects);
      showToast(reason instanceof Error ? reason.message : t("chief.projects.error.stage"));
    } finally {
      setMovingProjectId(null);
    }
  }

  function openMonitor(projectId: string, projectName: string) {
    showToast(t("chief.projects.toast.openMonitor", { name: projectName }));
    navigate(`/chief/workspace?projectId=${encodeURIComponent(projectId)}`);
  }

  async function createProject() {
    const name  = createForm.name.trim();
    const client = createForm.client.trim();
    const exhibition = createForm.exhibition.trim() || name;
    const widthN = Number(createForm.width);
    const depthN = Number(createForm.depth);

    if (!name) {
      setCreateError(t("chief.projects.validate.required"));
      return;
    }
    if (!Number.isFinite(widthN) || widthN < 1 || widthN > 100 || !Number.isFinite(depthN) || depthN < 1 || depthN > 100) {
      setCreateError(t("chief.projects.validate.dimensions"));
      return;
    }

    setCreateError("");
    setIsCreating(true);
    try {
      if (!createForm.clientId && !client) {
        await createPlatformExhibition({
          name: exhibition,
          opensAt: createForm.deadline || null,
        });
        const response = await getPlatformExhibitions();
        setExhibitions(response.exhibitions);
        await reloadProjects();
        setCreateOpen(false);
        setCreateForm(EMPTY_CREATE_FORM);
        showToast(`Exhibition created: ${exhibition}. Projects will appear when clients register.`);
        return;
      }
      await createPlatformProject({
        name,
        client,
        clientId: createForm.clientId,
        exhibition,
        system:   createForm.system,
        width:    createForm.width,
        depth:    createForm.depth,
        deadline: createForm.deadline,
        managerId: createForm.managerId,
      });
      // If a manager was chosen, we'd reassign here — for now update after creation
      await reloadProjects();
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      showToast(t("chief.projects.toast.created", { name }));
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : t("chief.projects.error.save"));
    } finally {
      setIsCreating(false);
    }
  }

  async function createExhibition() {
    const name = exhibitionForm.name.trim();
    if (!name) { setExhibitionCreateError("Exhibition name is required."); return; }
    setExhibitionCreateError("");
    setIsCreatingExhibition(true);
    try {
      await createPlatformExhibition({
        name,
        venue: exhibitionForm.venue.trim() || undefined,
        city:  exhibitionForm.city.trim()  || undefined,
        opensAt:  exhibitionForm.startDate || null,
        closesAt: exhibitionForm.endDate   || null,
      });
      const response = await getPlatformExhibitions();
      setExhibitions(response.exhibitions);
      setExhibitionCreateOpen(false);
      setExhibitionForm({ name: "", venue: "", city: "", startDate: "", endDate: "" });
      showToast(`Exhibition "${name}" created.`);
    } catch (reason) {
      setExhibitionCreateError(reason instanceof Error ? reason.message : "Failed to create exhibition.");
    } finally {
      setIsCreatingExhibition(false);
    }
  }

  function exportProjects() {
    downloadExcelWorkbook(`chief-projects-${new Date().toISOString().slice(0, 10)}.xls`, [
      {
        name: "Projects",
        rows: [
          ["Project", "Client", "PM", "System", "Stage", "Status", "Health", "Progress %", "Deadline", "Dimensions"],
          ...filtered.map((p) => [
            p.name, p.client, p.pm, p.system,
            p.stage, p.status, p.health,
            `${p.progress}%`, p.deadline || "—", p.dimensions,
          ]),
        ],
      },
      {
        name: "Summary",
        rows: [
          ["Metric", "Value"],
          ["Total (filtered)", filtered.length],
          ["High Risk", urgentCount],
          ["Delayed", statusCounts.Delayed],
          ["Completed", statusCounts.Completed],
          ["Waiting", waitingCount],
          ["Exported at", new Date().toLocaleString()],
        ],
      },
    ]);
    void recordReportExport({ report: "Chief project portfolio", format: "xls" });
    showToast(t("chief.projects.toast.exported"));
  }

  const locale = i18n.language;

  return (
    <DashboardLayout role="chief">
      <div className="space-y-5">
        <PageHeader
          title={t("chief.projects.title")}
          breadcrumbs={[{ label: t("chief.nav.dashboard"), href: "/chief" }, { label: t("chief.projects.breadcrumb") }]}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
              {([
                { id: "kanban", label: t("chief.projects.viewKanban") },
                { id: "list",   label: t("chief.projects.viewList") },
                { id: "live",   label: "Live" },
              ] as const).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setView(mode.id)}
                  aria-pressed={view === mode.id}
                  className={cn(
                    "flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-bold transition-all",
                    view === mode.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode.id === "live" && (
                    <span className={cn("h-1.5 w-1.5 rounded-full", view === "live" ? "bg-green-500" : "bg-muted-foreground")} />
                  )}
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("chief.projects.searchPlaceholder")}
                aria-label={t("chief.projects.searchPlaceholder")}
                className="h-8 w-52 rounded-md border bg-muted/30 pl-8 pr-3 text-xs outline-none focus:border-primary"
              />
            </div>
            {activeTab === "projects" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={exportProjects}
                disabled={filtered.length === 0}
                title={t("chief.projects.exportTooltip")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t("chief.projects.export")}
              </Button>
            )}
            {activeTab === "exhibitions" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setExhibitionForm({ name: "", venue: "", city: "", startDate: "", endDate: "" }); setExhibitionCreateError(""); setExhibitionCreateOpen(true); }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Add Exhibition
              </Button>
            )}
          </div>
        </PageHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          {(["projects", "exhibitions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "projects" ? "Projects" : "Exhibitions"}
            </button>
          ))}
        </div>

        {activeTab === "projects" && (<>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
            <button
              type="button"
              onClick={() => { setIsLoading(true); void reloadProjects().finally(() => setIsLoading(false)); }}
              className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-semibold hover:bg-red-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Compact stats + filter bar */}
        <div className="rounded-lg border bg-card/40 px-4 py-3 space-y-3">
          {/* Stage pipeline inline */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {stages.map((stage, i) => {
              const styles = STAGE_STYLES[stage.id];
              return (
                <div key={stage.id} className="flex items-center gap-2">
                  {i > 0 && <span className="hidden h-3 w-px bg-border sm:block" />}
                  <span className={cn("h-2 w-2 rounded-full shrink-0", styles.dot)} />
                  <span className="text-[11px] text-muted-foreground">{stage.label}</span>
                  <span className={cn("text-sm font-bold tabular-nums", styles.text)}>{counts[stage.id] ?? 0}</span>
                </div>
              );
            })}
            <div className="ml-auto flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <AlertCircle className={cn("h-3.5 w-3.5 shrink-0", urgentCount ? "text-red-500" : "text-muted-foreground")} aria-hidden="true" />
                <span className={cn("text-[11px] font-semibold tabular-nums", urgentCount ? "text-red-500" : "text-muted-foreground")}>{urgentCount}</span>
                <span className="text-[11px] text-muted-foreground">{t("chief.projects.metric.highRisk")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[11px] font-semibold tabular-nums", waitingCount ? "text-amber-500" : "text-muted-foreground")}>{waitingCount}</span>
                <span className="text-[11px] text-muted-foreground">{t("chief.projects.metric.waiting")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[11px] font-semibold tabular-nums", statusCounts.Delayed ? "text-orange-500" : "text-muted-foreground")}>{statusCounts.Delayed}</span>
                <span className="text-[11px] text-muted-foreground">{t("chief.projects.metric.delayed")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tabular-nums text-foreground">{pagination.total}</span>
                <span className="text-[11px] text-muted-foreground">{t("chief.projects.metric.matching")}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filterSt === key}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                  filterSt === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
            <div className="hidden h-4 w-px bg-border/50 sm:block" />
            {priorityFilters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPriorityFilter(key)}
                aria-pressed={priorityFilter === key}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                  priorityFilter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : cn("border-border/60 hover:border-foreground/40", key === "All" ? "text-muted-foreground" : PRIORITY_TEXT[key as Priority]),
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Kanban board */}
        {view === "kanban" && !isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/40 px-6 py-16 text-center" style={{ minHeight: 420 }}>
            <p className="text-sm font-semibold text-foreground">{t("chief.projects.kanban.emptyBoardTitle")}</p>
            <p className="max-w-md text-xs text-muted-foreground">{t("chief.projects.kanban.emptyBoardBody")}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" onClick={() => navigate("/chief/clients")}>
                {t("chief.projects.kanban.emptyBoardClientsCta")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("exhibitions")}>
                {t("chief.projects.kanban.emptyBoardExhibitionCta")}
              </Button>
            </div>
          </div>
        )}
        {view === "kanban" && (isLoading || projects.length > 0) && (
          <div className="grid grid-cols-5 gap-3" style={{ minHeight: 420 }}>
            {stages.map((stage) => {
              const styles = STAGE_STYLES[stage.id];
              const cards  = filtered.filter((p) => p.stage === stage.id);
              return (
                <div key={stage.id} className="flex flex-col gap-2">
                  <div className="mb-1 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", styles.dot)} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stage.label}</span>
                      <span className="rounded-full bg-muted px-1.5 text-[9px] text-muted-foreground">{cards.length}</span>
                    </div>
                  </div>

                  {cards.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      stage={stage.id}
                      isMoving={movingProjectId === project.id}
                      onMove={move}
                      onOpen={openMonitor}
                      onEdit={openEdit}
                      locale={locale}
                      ws={wsMap.get(project.id)}
                    />
                  ))}

                  {isLoading && !cards.length && Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-3.5 w-3.5 rounded" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-1.5 w-full rounded-full" />
                      <div className="flex items-center justify-between pt-1 border-t border-border/30">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  ))}
                  {!cards.length && !isLoading && (
                    <div className="rounded-lg border-2 border-dashed border-border/30 py-8 text-center text-[10px] text-muted-foreground">
                      {t("chief.projects.kanban.empty")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  {[
                    t("chief.projects.list.col.project"),
                    t("chief.projects.list.col.client"),
                    t("chief.projects.list.col.pm"),
                    t("chief.projects.list.col.system"),
                    t("chief.projects.list.col.stage"),
                    t("chief.projects.list.col.progress"),
                    t("chief.projects.list.col.health"),
                    "Workspace",
                    "",
                  ].map((header, i) => (
                    <TableHead key={i} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((project) => (
                  <ProjectRow key={project.id} project={project} stages={stages} onOpen={openMonitor} onEdit={openEdit} ws={wsMap.get(project.id)} />
                ))}
                {isLoading && !filtered.length && Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-1.5 w-full rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-7 rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!filtered.length && !isLoading && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t("chief.projects.list.noMatch")}
              </div>
            )}
          </div>
        )}

        {/* Live view — workspace monitor embedded */}
        {view === "live" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card/50 p-4 space-y-3">
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
            {!isLoading && filtered.map((project) => {
              const ws = wsMap.get(project.id);
              const dotCls  = ws ? (WS_DOT[ws.status]  ?? "bg-muted-foreground") : "bg-muted-foreground/30";
              const textCls = ws ? (WS_TEXT[ws.status] ?? "text-muted-foreground") : "text-muted-foreground";
              return (
                <div
                  key={project.id}
                  className="group overflow-hidden rounded-lg border bg-card/50 transition-colors hover:border-primary/40"
                >
                  {/* Booth mini preview */}
                  <div className="relative h-24 overflow-hidden bg-muted/20">
                    <LiveBoothSVG status={ws?.status ?? null} />
                    <span className="absolute left-2 top-2 rounded border bg-card/90 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {project.system.toUpperCase()}
                    </span>
                    {ws && (
                      <span className={cn(
                        "absolute bottom-2 right-2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold bg-card/90",
                        textCls,
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", dotCls)} />
                        {ws.lastActionMins === 0 ? "Editing now" : wsAge(ws.lastActionMins)}
                      </span>
                    )}
                  </div>

                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="min-w-0 flex-1 truncate text-[12px] font-bold leading-tight group-hover:text-primary">
                        {project.name}
                      </p>
                      {ws && (
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase bg-card/90", textCls)}>
                          {ws.status}
                        </span>
                      )}
                    </div>

                    <p className="truncate text-[11px] text-muted-foreground">{project.client || "Unassigned client"}</p>

                    {ws?.currentAction && (
                      <div className="flex items-center gap-1.5 text-[10px] text-primary">
                        <Activity className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{ws.currentAction}</span>
                      </div>
                    )}

                    <div className="pt-1">
                      <div className="mb-1 flex justify-between text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-2.5 w-2.5" aria-hidden="true" />
                          {project.pm}
                        </span>
                        <span>{project.progress}%</span>
                      </div>
                      <ProgressBar value={project.progress} stageId={project.stage} />
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                      <button
                        onClick={() => openEdit(project)}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Reassign PM"
                      >
                        Reassign
                      </button>
                      <button
                        onClick={() => navigate(`/chief/workspace?projectId=${encodeURIComponent(project.id)}`)}
                        onPointerEnter={() => { void preloadPortalRoute("/chief/workspace")?.catch(() => undefined); }}
                        onFocus={() => { void preloadPortalRoute("/chief/workspace")?.catch(() => undefined); }}
                        className="flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                        aria-label={`Open workspace for ${project.name}`}
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                No projects match the current filters.
              </div>
            )}
          </div>
        )}

        {/* Pagination + footer — hidden in live view */}
        {view !== "live" && (<>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">
            <span>
              {t("chief.projects.paging.showing", { start: pageStart, end: pageEnd, total: pagination.total })}
              {priorityFilter !== "All" ? ` ${t("chief.projects.paging.filtered", { count: filtered.length })}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={isLoading || page === 0}
                onClick={() => setPage((c) => Math.max(0, c - 1))}
              >
                {t("chief.projects.paging.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={isLoading || !pagination.hasMore}
                onClick={() => setPage((c) => c + 1)}
              >
                {t("chief.projects.paging.next")}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-right">
            {t("chief.projects.footer.note", { count: filtered.length })}
          </p>
        </>)}

        </>)}

        {/* Exhibitions tab */}
        {activeTab === "exhibitions" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-card/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total exhibitions</p>
                <p className="mt-2 text-2xl font-bold">{exhibitions.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Each exhibition groups client booth projects.</p>
              </div>
              <div className="rounded-lg border bg-card/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
                <p className="mt-2 text-2xl font-bold">{exhibitions.filter((e) => isActiveExhibition(e.status)).length}</p>
              </div>
              <div className="rounded-lg border bg-card/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Draft / Closed</p>
                <p className="mt-2 text-2xl font-bold">{exhibitions.filter((e) => !isActiveExhibition(e.status)).length}</p>
              </div>
            </div>

            {exhibitions.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-border/50 py-16 text-center">
                <p className="text-sm font-semibold text-muted-foreground">No exhibitions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create your first exhibition to organize client booth projects under a single event.
                </p>
                <button
                  onClick={() => { setExhibitionForm({ name: "", venue: "", city: "", startDate: "", endDate: "" }); setExhibitionCreateOpen(true); }}
                  className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="inline-block h-3 w-3 mr-1.5" aria-hidden="true" />
                  Add first exhibition
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {exhibitions.map((ex) => {
                  const statusColor =
                    isActiveExhibition(ex.status) ? "text-green-600 bg-green-500/10 border-green-500/30" :
                    ex.status === "planned" ? "text-gray-500 bg-gray-500/10 border-gray-400/30" :
                    "text-muted-foreground bg-muted/30 border-border";
                  return (
                    <button
                      type="button"
                      key={ex.id}
                      onClick={() => { setDetailClientSearch(""); setExhibitionDetail(ex); }}
                      className="rounded-lg border bg-card p-4 space-y-2 w-full text-left hover:border-primary/40 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold leading-tight">{ex.name}</p>
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", statusColor)}>
                          {ex.status}
                        </span>
                      </div>
                      {(ex.venue || ex.city) && (
                        <p className="text-xs text-muted-foreground">{[ex.venue, ex.city].filter(Boolean).join(" · ")}</p>
                      )}
                      {(ex.opensAt || ex.closesAt) && (
                        <p className="text-[10px] text-muted-foreground">
                          {ex.opensAt ? new Date(ex.opensAt).toLocaleDateString() : "—"}
                          {ex.closesAt ? ` → ${new Date(ex.closesAt).toLocaleDateString()}` : ""}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {projects.filter((p) => p.exhibition === ex.name).length} project(s) linked
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to view PMs &amp; clients →
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add Exhibition dialog */}
        <Dialog
          open={exhibitionCreateOpen}
          onOpenChange={(open) => {
            if (isCreatingExhibition) return;
            if (!open) { setExhibitionCreateOpen(false); setExhibitionForm({ name: "", venue: "", city: "", startDate: "", endDate: "" }); setExhibitionCreateError(""); }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Exhibition</DialogTitle>
              <DialogDescription>
                Add an exhibition to group client booth projects under a single event. Projects appear automatically when clients register.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ex-name">Exhibition name <span className="text-red-500">*</span></Label>
                <Input
                  id="ex-name"
                  value={exhibitionForm.name}
                  onChange={(e) => setExhibitionForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. CES Las Vegas 2027"
                  autoFocus
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ex-venue">Venue</Label>
                  <Input
                    id="ex-venue"
                    value={exhibitionForm.venue}
                    onChange={(e) => setExhibitionForm((f) => ({ ...f, venue: e.target.value }))}
                    placeholder="Convention Center"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ex-city">City</Label>
                  <Input
                    id="ex-city"
                    value={exhibitionForm.city}
                    onChange={(e) => setExhibitionForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Las Vegas, NV"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ex-start">Start date</Label>
                  <Input
                    id="ex-start"
                    type="date"
                    value={exhibitionForm.startDate}
                    onChange={(e) => setExhibitionForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ex-end">End date</Label>
                  <Input
                    id="ex-end"
                    type="date"
                    value={exhibitionForm.endDate}
                    onChange={(e) => setExhibitionForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              {exhibitionCreateError && (
                <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {exhibitionCreateError}
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setExhibitionCreateOpen(false)}
                disabled={isCreatingExhibition}
              >
                Cancel
              </Button>
              <Button
                onClick={createExhibition}
                disabled={isCreatingExhibition || !exhibitionForm.name.trim()}
              >
                {isCreatingExhibition ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />Creating…</>
                ) : (
                  <><Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />Create Exhibition</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit project sheet */}
        <Sheet
          open={!!editProject}
          onOpenChange={(open) => {
            if (isSavingProject) return;
            if (!open) { setEditProject(null); setEditForm(EMPTY_PROJECT_FORM); setEditError(""); }
          }}
        >
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{t("chief.projects.edit.title")}</SheetTitle>
              <SheetDescription>{t("chief.projects.edit.sheetDescription")}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="project-name">{t("chief.projects.edit.name")}</Label>
                <Input
                  id="project-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("chief.projects.edit.namePlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="project-client">{t("chief.projects.edit.client")}</Label>
                <Input
                  id="project-client"
                  value={editForm.client}
                  onChange={(e) => setEditForm((f) => ({ ...f, client: e.target.value }))}
                  placeholder={t("chief.projects.edit.clientPlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="project-exhibition">{t("chief.projects.edit.exhibition")}</Label>
                <Input
                  id="project-exhibition"
                  value={editForm.exhibition}
                  onChange={(e) => setEditForm((f) => ({ ...f, exhibition: e.target.value }))}
                  placeholder={t("chief.projects.edit.exhibitionPlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("chief.projects.edit.manager")}</Label>
                <Select
                  value={editForm.managerId}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, managerId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("chief.projects.edit.managerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">{t("chief.projects.edit.keepManager")}</SelectItem>
                    <SelectItem value="unassigned">{t("chief.projects.edit.unassigned")}</SelectItem>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="project-deadline">{t("chief.projects.edit.deadline")}</Label>
                  <Input
                    id="project-deadline"
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("chief.projects.edit.system")}</Label>
                  <Select
                    value={editForm.system}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, system: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("chief.projects.edit.systemPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="octanorm">{t("chief.projects.edit.octanorm")}</SelectItem>
                      <SelectItem value="maxima">{t("chief.projects.edit.maxima")}</SelectItem>
                      <SelectItem value="custom">{t("chief.projects.edit.custom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="project-width">{t("chief.projects.edit.width")}</Label>
                  <Input
                    id="project-width"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={editForm.width}
                    onChange={(e) => setEditForm((f) => ({ ...f, width: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-depth">{t("chief.projects.edit.depth")}</Label>
                  <Input
                    id="project-depth"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={editForm.depth}
                    onChange={(e) => setEditForm((f) => ({ ...f, depth: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="project-description">{t("chief.projects.edit.descriptionLabel")}</Label>
                <textarea
                  id="project-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="min-h-24 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder={t("chief.projects.edit.descriptionPlaceholder")}
                />
              </div>

              {editError && (
                <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {editError}
                </div>
              )}
            </div>

            <SheetFooter className="mt-6">
              <Button
                variant="outline"
                onClick={() => { setEditProject(null); setEditForm(EMPTY_PROJECT_FORM); setEditError(""); }}
                disabled={isSavingProject}
              >
                {t("chief.projects.edit.cancel")}
              </Button>
              <Button onClick={saveEdit} disabled={isSavingProject || !editForm.name.trim() || !editForm.client.trim()}>
                {isSavingProject ? t("chief.projects.edit.saving") : t("chief.projects.edit.save")}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Close project confirm dialog */}
        <Dialog
          open={!!closeTarget}
          onOpenChange={(open) => { if (!open && !movingProjectId) setCloseTarget(null); }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("chief.projects.close.title")}</DialogTitle>
              <DialogDescription>
                {t("chief.projects.close.description", { name: closeTarget?.name ?? "" })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCloseTarget(null)} disabled={!!movingProjectId}>
                {t("chief.projects.close.cancel")}
              </Button>
              <Button
                onClick={() => {
                  if (!closeTarget) return;
                  const target = closeTarget;
                  setCloseTarget(null);
                  void saveStageChange(target, "closed");
                }}
                disabled={!!movingProjectId}
              >
                {movingProjectId ? t("chief.projects.close.closing") : t("chief.projects.close.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create project dialog */}
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (isCreating) return;
            if (!open) { setCreateOpen(false); setCreateForm(EMPTY_CREATE_FORM); setCreateError(""); }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Exhibition / Project</DialogTitle>
              <DialogDescription>
                Create an exhibition shell first, or attach a registered client to create the company project.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 grid gap-4">
              <div className="grid gap-2">
                <Label>Registered client</Label>
                <Select
                  value={createForm.clientId || "none"}
                  onValueChange={selectCreateClient}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select registered client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client yet - create exhibition shell</SelectItem>
                    {clientOptions.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}{client.exhibition ? ` - ${client.exhibition}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createSelectedClient ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-foreground">{createSelectedClient.name}</span>
                      <span>{createSelectedClient.contactEmail}</span>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      <span>Exhibition: {cleanClientExhibition(createSelectedClient.exhibition) || "Not registered yet"}</span>
                      <span>Booth: {formatClientBoothSummary(createSelectedClient)}</span>
                      <span>System: {createSelectedClient.preferredSystem || "Octanorm"}</span>
                      <span>Assigned PM: {createSelectedClient.managerName || "Unassigned"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    ENS flow: this will create only the exhibition. A company project appears when a client registers or is attached.
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="create-name">
                    {t("chief.projects.edit.name")}
                    <span className="ml-0.5 text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t("chief.projects.edit.namePlaceholder")}
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-client">
                    Client / company
                  </Label>
                  <Input
                    id="create-client"
                    value={createForm.client}
                    onChange={(e) => setCreateForm((f) => ({ ...f, client: e.target.value }))}
                    placeholder="Optional until assigned"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="create-exhibition">{t("chief.projects.edit.exhibition")}</Label>
                <Input
                  id="create-exhibition"
                  value={createForm.exhibition}
                  onChange={(e) => setCreateForm((f) => ({ ...f, exhibition: e.target.value }))}
                  placeholder={t("chief.projects.edit.exhibitionPlaceholder")}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("chief.projects.edit.manager")}</Label>
                  <Select
                    value={createForm.managerId}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, managerId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("chief.projects.edit.managerPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{t("chief.projects.edit.unassigned")}</SelectItem>
                      {managerOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-deadline">{t("chief.projects.edit.deadline")}</Label>
                  <Input
                    id="create-deadline"
                    type="date"
                    min={todayInputValue()}
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm((f) => ({ ...f, deadline: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>{t("chief.projects.edit.system")}</Label>
                  <Select
                    value={createForm.system}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, system: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="octanorm">{t("chief.projects.edit.octanorm")}</SelectItem>
                      <SelectItem value="maxima">{t("chief.projects.edit.maxima")}</SelectItem>
                      <SelectItem value="custom">{t("chief.projects.edit.custom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-width">{t("chief.projects.edit.width")}</Label>
                  <Input
                    id="create-width"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={createForm.width}
                    onChange={(e) => setCreateForm((f) => ({ ...f, width: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-depth">{t("chief.projects.edit.depth")}</Label>
                  <Input
                    id="create-depth"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={createForm.depth}
                    onChange={(e) => setCreateForm((f) => ({ ...f, depth: e.target.value }))}
                  />
                </div>
              </div>

              {createError && (
                <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {createError}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE_FORM); setCreateError(""); }}
                disabled={isCreating}
              >
                {t("chief.projects.edit.cancel")}
              </Button>
              <Button
                onClick={createProject}
                disabled={isCreating || !createForm.name.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t("chief.projects.create.creating")}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {t("chief.projects.create.confirm")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exhibition detail sheet — PM + Client split view */}
        <Sheet
          open={!!exhibitionDetail}
          onOpenChange={(open) => { if (!open) { setExhibitionDetail(null); setDetailClientSearch(""); } }}
        >
          <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-[min(92vw,1100px)]">
            {exhibitionDetail && (() => {
              const ex = exhibitionDetail;
              const normalizeEx = (v: string) => v.trim().toLowerCase();
              const exClients = managedClients.filter((c) =>
                normalizeEx(cleanClientExhibition(c.exhibition) || c.name) === normalizeEx(ex.name)
              );
              const exManagerIds = [...new Set(exClients.map((c) => c.managerId).filter(Boolean))];
              const exManagers = managers.filter((m) => exManagerIds.includes(m.id));
              const q = detailClientSearch.trim().toLowerCase();
              const searchedClients = q
                ? exClients.filter((c) =>
                    [c.name, c.contactName, c.contactEmail, c.exhibition, c.managerName, c.preferredSystem,
                     String(c.boothWidthM ?? ""), String(c.boothDepthM ?? "")]
                      .some((v) => (v ?? "").toLowerCase().includes(q))
                  )
                : exClients;

              const statusColor =
                isActiveExhibition(ex.status) ? "text-green-500 border-green-500/40 bg-green-500/10" :
                ex.status === "planned" ? "text-gray-400 border-gray-400/40 bg-gray-400/10"  :
                "text-muted-foreground border-border bg-muted/20";

              return (
                <>
                  <div className="border-b bg-card/60 px-6 py-4">
                    <SheetHeader className="space-y-1 pr-8">
                      <div className="flex flex-wrap items-center gap-2">
                        <SheetTitle className="text-xl">{ex.name}</SheetTitle>
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", statusColor)}>
                          {ex.status}
                        </span>
                      </div>
                      <SheetDescription>
                        {[ex.venue, ex.city].filter(Boolean).join(" · ")}
                        {ex.opensAt && ` · ${new Date(ex.opensAt).toLocaleDateString()} – ${ex.closesAt ? new Date(ex.closesAt).toLocaleDateString() : "?"}`}
                      </SheetDescription>
                    </SheetHeader>
                  </div>

                  <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[300px_minmax(0,1fr)]">
                    {/* Left — Project Managers */}
                    <aside className="flex min-h-0 flex-col border-r bg-background/40">
                      <div className="border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                          <p className="text-sm font-semibold">Project Managers</p>
                          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{exManagers.length}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">Assigned to this exhibition</p>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {exManagers.length === 0 ? (
                          <div className="m-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                            <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                            No managers assigned yet
                          </div>
                        ) : (
                          exManagers.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                                {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{m.name}</p>
                                <p className="truncate text-[10px] text-muted-foreground">{m.email}</p>
                              </div>
                              <span className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
                                m.status === "Active" ? "border-green-500/40 bg-green-500/10 text-green-500" : "border-border text-muted-foreground"
                              )}>
                                {m.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </aside>

                    {/* Right — Clients */}
                    <section className="flex min-h-0 flex-col">
                      <div className="border-b px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                            <p className="text-sm font-semibold">Clients</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{exClients.length}</span>
                          </div>
                          <div className="relative ml-auto w-full max-w-xs">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                              value={detailClientSearch}
                              onChange={(e) => setDetailClientSearch(e.target.value)}
                              placeholder="Search by any detail…"
                              className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-auto">
                        {exClients.length === 0 ? (
                          <div className="m-8 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                            No clients registered for this exhibition yet.
                          </div>
                        ) : searchedClients.length === 0 ? (
                          <div className="m-8 py-8 text-center text-sm text-muted-foreground">
                            No clients match your search.
                          </div>
                        ) : (
                          <table className="w-full min-w-[560px]">
                            <thead className="sticky top-0 z-10 border-b bg-muted/30">
                              <tr>
                                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Client</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Booth</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PM</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {searchedClients.map((c) => (
                                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-4 py-2.5">
                                    <p className="text-[12px] font-semibold leading-tight">{c.name}</p>
                                    {c.contactName && c.contactName !== c.name && (
                                      <p className="text-[10px] text-muted-foreground">{c.contactName}</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                                      <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                                      <span className="truncate max-w-[160px]">{c.contactEmail}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <p className="text-[10px] font-mono text-muted-foreground">
                                      {c.boothWidthM && c.boothDepthM ? `${c.boothWidthM} × ${c.boothDepthM} m` : "—"}
                                    </p>
                                    {c.preferredSystem && (
                                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{c.preferredSystem}</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <p className="text-[11px] text-muted-foreground">{c.managerName || "—"}</p>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </section>
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {/* Always-rendered ARIA live toast — no mount/unmount flicker */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl transition-all duration-300",
            toastVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
          )}
        >
          {toastMsg}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LiveBoothSVG({ status }: { status: string | null }) {
  const color = status === "live" ? "#22c55e" : status === "review" ? "#3b82f6" : status === "pending" ? "#f97316" : status === "blocked" ? "#ef4444" : "#6b7280";
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" className="block" aria-hidden="true"
      style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 9px,hsl(var(--border)/0.3) 9px,hsl(var(--border)/0.3) 10px),repeating-linear-gradient(90deg,transparent,transparent 9px,hsl(var(--border)/0.3) 9px,hsl(var(--border)/0.3) 10px)" }}
    >
      <polygon points="40,65 80,80 120,65 80,50" fill={`${color}18`} stroke={color} strokeWidth="0.8" />
      <polygon points="40,65 40,35 80,20 80,50" fill={`${color}10`} stroke={color} strokeWidth="0.8" />
      <polygon points="80,50 80,20 120,35 120,65" fill={`${color}06`} stroke={color} strokeWidth="0.8" />
      <polygon points="40,35 40,30 80,15 80,20" fill={color} opacity="0.6" />
      <polygon points="80,20 80,15 120,30 120,35" fill={color} opacity="0.4" />
    </svg>
  );
}

const WS_DOT: Record<string, string> = {
  live:    "bg-green-500",
  review:  "bg-blue-500",
  pending: "bg-orange-500",
  blocked: "bg-red-500",
};
const WS_TEXT: Record<string, string> = {
  live:    "text-green-500",
  review:  "text-blue-500",
  pending: "text-orange-500",
  blocked: "text-red-500",
};

function wsAge(mins: number): string {
  if (mins === 0)    return "editing now";
  if (mins < 60)     return `${mins}m ago`;
  if (mins < 1440)   return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function ProjectCard({
  project,
  stage,
  isMoving,
  onMove,
  onOpen,
  onEdit,
  locale,
  ws,
}: {
  project: KanbanProject;
  stage: Stage;
  isMoving: boolean;
  onMove: (id: string, dir: "prev" | "next") => void;
  onOpen: (id: string, name: string) => void;
  onEdit: (project: KanbanProject) => void;
  locale: string;
  ws?: WorkspaceMonitorProject;
}) {
  const { t } = useTranslation();
  const stageIndex = STAGE_IDS.indexOf(stage);
  const styles     = STAGE_STYLES[stage];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project.id, project.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(project.id, project.name);
        }
      }}
      aria-label={t("chief.projects.card.openMonitor")}
      className={cn("group cursor-pointer rounded-lg border border-l-[3px] bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50", styles.border)}
    >
      <div className="mb-2 flex items-start justify-between gap-1">
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-bold leading-tight transition-colors group-hover:text-primary">
          {project.name}
        </p>
        <span className={cn("mt-0.5 shrink-0 text-[9px] font-bold", PRIORITY_TEXT[project.priority])}>
          {project.priority[0]}
        </span>
      </div>

      <p className="mb-1.5 truncate text-[10px] font-semibold text-foreground">{project.client || "—"}</p>

      {/* Live workspace status — shown when PM has an active workspace */}
      {ws ? (
        <div className="mb-2 flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", WS_DOT[ws.status] ?? "bg-muted-foreground")} />
          <span className={cn("text-[9.5px] font-semibold", WS_TEXT[ws.status] ?? "text-muted-foreground")}>
            {ws.status}
          </span>
          <span className="text-[9px] text-muted-foreground">· {wsAge(ws.lastActionMins)}</span>
        </div>
      ) : project.waitDays > 0 ? (
        <div className="mb-2 flex items-center gap-1 text-[9.5px] text-red-500">
          <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          {t("chief.projects.card.waiting", { days: project.waitDays })}
        </div>
      ) : (
        <div className="mb-2 h-[1.125rem]" />
      )}

      <div className="mb-2">
        <div className="mb-1 flex justify-between text-[9px] text-muted-foreground">
          <span>{project.system.toUpperCase()}</span>
          <span>{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} stageId={stage} />
      </div>

      <div className="mb-2 flex items-center gap-1 text-[9px] text-muted-foreground">
        <Calendar className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        {formatShortDate(project.deadline, locale, t("chief.projects.card.noDate"))}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-2">
        <div className="flex min-w-0 items-center gap-1 text-[9px] text-muted-foreground">
          <User className="h-2.5 w-2.5" aria-hidden="true" />
          <span className="truncate">{project.pm}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {stageIndex > 0 && (
            <button
              disabled={isMoving}
              onClick={(e) => { e.stopPropagation(); onMove(project.id, "prev"); }}
              aria-label={t("chief.projects.card.movePrev")}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          )}
          {stageIndex < STAGE_IDS.length - 1 && (
            <button
              disabled={isMoving}
              onClick={(e) => { e.stopPropagation(); onMove(project.id, "next"); }}
              aria-label={t("chief.projects.card.moveNext")}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(project.id, project.name); }}
            aria-label={t("chief.projects.card.openMonitor")}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Layers className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(project); }}
            aria-label={t("chief.projects.card.editProject")}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  stages,
  onOpen,
  onEdit,
  ws,
}: {
  project: KanbanProject;
  stages: { id: Stage; label: string }[];
  onOpen: (id: string, name: string) => void;
  onEdit: (project: KanbanProject) => void;
  ws?: WorkspaceMonitorProject;
}) {
  const { t }     = useTranslation();
  const styles     = STAGE_STYLES[project.stage];
  const stageLabel = stages.find((s) => s.id === project.stage)?.label ?? project.stage;

  return (
    <TableRow className="group border-muted hover:bg-muted/10">
      <TableCell>
        <div className="text-sm font-semibold leading-tight">{project.name}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{project.dimensions} / {project.exhibition}</div>
      </TableCell>
      <TableCell className="text-sm font-medium">{project.client || "—"}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{project.pm}</TableCell>
      <TableCell>
        <span className="rounded bg-muted/50 px-2 py-0.5 text-[10px]">{project.system.toUpperCase()}</span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={cn("text-[10px] font-bold", styles.bg, styles.text)}>
          {stageLabel}
        </Badge>
      </TableCell>
      <TableCell className="min-w-[100px]">
        <div className="flex items-center gap-2">
          <ProgressBar value={project.progress} stageId={project.stage} />
          <span className="shrink-0 text-[10px]">{project.progress}%</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={healthBadge(project.health)}>{project.health}</Badge>
      </TableCell>
      <TableCell>
        {ws ? (
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", WS_DOT[ws.status] ?? "bg-muted-foreground")} />
            <span className={cn("text-[10px] font-semibold", WS_TEXT[ws.status] ?? "text-muted-foreground")}>{ws.status}</span>
            <span className="text-[10px] text-muted-foreground">· {wsAge(ws.lastActionMins)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onEdit(project)}>
            <Pencil className="mr-2 h-3 w-3" aria-hidden="true" />
            {t("chief.projects.row.edit")}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpen(project.id, project.name)}>
            <Layers className="mr-2 h-3 w-3" aria-hidden="true" />
            {t("chief.projects.row.open")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ProgressBar({ value, stageId }: { value: number; stageId: Stage }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", STAGE_STYLES[stageId].bar)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure data helpers (no i18n context)
// ---------------------------------------------------------------------------

function toKanbanProject(project: PlatformProject, index: number): KanbanProject {
  const waitDays = computeWaitDays(project);
  const status   = normalizeStatus(project.status);
  const priority = computePriority(project, waitDays);
  return {
    id:          project.id,
    name:        project.name,
    client:      project.client,
    pm:          project.pm || "Unassigned",
    system:      project.system || "custom",
    progress:    project.progress,
    deadline:    project.deadline ?? "",
    status,
    health:      computeHealth(project, waitDays),
    stage:       stageForProject(project, index),
    dimensions:  project.dimensions || "TBD",
    priority,
    waitDays,
    exhibition:  project.exhibition || project.name,
    description: project.description || "",
  };
}

function stageForProject(project: PlatformProject, index: number): Stage {
  const savedStage = normalizeStage(project.pipelineStage);
  if (savedStage) return savedStage;
  const status = normalizeStatus(project.status);
  if (status === "Completed")        return "closed";
  if (project.progress >= 80)        return "production";
  if (project.progress >= 50)        return "review";
  if (project.progress >= 20)        return "design";
  if (status === "Delayed")          return "review";
  return STAGE_IDS[index % 2];
}

function normalizeStage(stage: string | null | undefined): Stage | null {
  if (!stage) return null;
  if (stage === "intake" || stage === "design" || stage === "review" || stage === "production" || stage === "closed") {
    return stage;
  }
  return null;
}

function normalizeStatus(status: string) {
  const v = status.toLowerCase();
  if (v.includes("delay"))                                       return "Delayed";
  if (v.includes("complete") || v.includes("approved"))         return "Completed";
  if (v.includes("active") || v.includes("progress") || v.includes("review")) return "Active";
  return "Pending";
}

function projectStatusParam(filter: "All" | "Active" | "Pending" | "Delayed" | "Completed") {
  return filter === "All" ? undefined : filter.toLowerCase();
}

function computeHealth(project: PlatformProject, waitDays: number) {
  const status = normalizeStatus(project.status);
  if (status === "Delayed" || waitDays >= 7 || project.health.toLowerCase().includes("risk")) return "At Risk";
  if (status === "Pending"  || waitDays >= 3)                                                 return "Needs Review";
  if (status === "Completed")                                                                 return "Complete";
  return "On Track";
}

function computePriority(project: PlatformProject, waitDays: number): Priority {
  const days = daysUntil(project.deadline);
  if (normalizeStatus(project.status) === "Delayed" || waitDays >= 7 || days <= 7)    return "High";
  if (waitDays >= 3 || days <= 14 || project.progress < 35)                           return "Medium";
  return "Low";
}

function computeWaitDays(project: PlatformProject) {
  if (normalizeStatus(project.status) === "Delayed") return Math.max(3, Math.abs(daysUntil(project.deadline)));
  if (normalizeStatus(project.status) === "Pending") return 3;
  return 0;
}

function daysUntil(date: string | null) {
  if (!date) return 999;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 999;
  return Math.ceil((parsed.getTime() - Date.now()) / 86400000);
}

function formatShortDate(date: string, locale: string, noDateText: string): string {
  if (!date) return noDateText;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function parseProjectDimensions(dimensions: string) {
  const match = dimensions.match(/([\d.]+)\s*x\s*([\d.]+)/i);
  return { width: match?.[1] ?? "6", depth: match?.[2] ?? "3" };
}

function cleanClientExhibition(value: string | undefined) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "pending onboarding") return "";
  return text;
}

function formatClientBoothSummary(client: ManagedClient) {
  const width = client.boothWidthM;
  const depth = client.boothDepthM;
  if (!width || !depth) return "Size not set";
  return `${width} x ${depth} m`;
}

function normalizeSystem(system: string) {
  const v = system.toLowerCase();
  if (v.includes("maxima")) return "maxima";
  if (v.includes("custom")) return "custom";
  return "octanorm";
}

function healthBadge(health: string) {
  if (health === "At Risk")     return "border-red-500/60 bg-red-500/10 text-red-500";
  if (health === "Needs Review") return "border-yellow-500/60 bg-yellow-500/10 text-yellow-500";
  if (health === "Complete")    return "border-blue-500/60 bg-blue-500/10 text-blue-500";
  return "border-green-500/60 bg-green-500/10 text-green-500";
}
