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
  createPlatformProject,
  getManagerWorkspace,
  getPlatformProjects,
  recordReportExport,
  updatePlatformProject,
  updatePlatformProjectStage,
  type PlatformPagination,
  type ManagedClient,
  type PlatformManager,
  type PlatformProject,
} from "@/lib/platform-api";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  User,
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
  production: { dot: "bg-violet-600", text: "text-violet-600", bg: "bg-violet-600/10", border: "border-l-violet-600", borderTop: "border-t-violet-600", bar: "bg-violet-600" },
  closed:     { dot: "bg-green-700",  text: "text-green-700",  bg: "bg-green-700/10",  border: "border-l-green-700",  borderTop: "border-t-green-700",  bar: "bg-green-700" },
};

const PRIORITY_TEXT: Record<Priority, string> = {
  High:   "text-red-600",
  Medium: "text-amber-600",
  Low:    "text-gray-500",
};

const PAGE_SIZE = 25;

export default function ChiefProjects() {
  const { t, i18n } = useTranslation();
  const [location, navigate] = useLocation();
  const initialParams = new URLSearchParams(location.split("?")[1] ?? "");
  const initialManager = initialParams.get("pm") ?? "";

  const [projects, setProjects]             = useState<KanbanProject[]>([]);
  const [managers, setManagers]             = useState<PlatformManager[]>([]);
  const [managedClients, setManagedClients] = useState<ManagedClient[]>([]);
  const [pagination, setPagination]         = useState<PlatformPagination>({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false });
  const [page, setPage]                     = useState(0);
  const [view, setView]                     = useState<"kanban" | "list">("kanban");
  const [search, setSearch]                 = useState(initialManager);
  const debouncedSearch                     = useDebounce(search, 250);
  const [filterSt, setFilter]               = useState<"All" | "Active" | "Pending" | "Delayed" | "Completed">("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");
  const [toastMsg, setToastMsg]             = useState("");
  const [toastVisible, setToastVisible]     = useState(false);
  const [error, setError]                   = useState("");
  const [isLoading, setIsLoading]           = useState(true);
  const [movingProjectId, setMovingProjectId] = useState<string | null>(null);
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

  // Translated stage labels — reactive to language changes
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

  function openMonitor(projectName: string) {
    showToast(t("chief.projects.toast.openMonitor", { name: projectName }));
    window.setTimeout(() => navigate("/chief/workspace-monitor"), 500);
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
              {(["kanban", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
                  aria-label={mode === "kanban" ? t("chief.projects.viewKanban") : t("chief.projects.viewList")}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-bold capitalize transition-all",
                    view === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === "kanban" ? t("chief.projects.viewKanban") : t("chief.projects.viewList")}
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
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setCreateForm(EMPTY_CREATE_FORM); setCreateError(""); setCreateOpen(true); }}
              data-testid="button-create-project"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("chief.projects.newProject")}
            </Button>
          </div>
        </PageHeader>

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

        {/* KPI tiles */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label={t("chief.projects.metric.highRisk")} value={urgentCount}        tone={urgentCount        ? "warning" : "success"} />
          <MetricTile label={t("chief.projects.metric.waiting")}  value={waitingCount}       tone={waitingCount       ? "warning" : "success"} />
          <MetricTile label={t("chief.projects.metric.delayed")}  value={statusCounts.Delayed} tone={statusCounts.Delayed ? "warning" : "success"} />
          <MetricTile label={t("chief.projects.metric.matching")} value={pagination.total}   tone="info" />
        </div>

        {/* Stage count tiles */}
        <div className="grid grid-cols-5 gap-3">
          {stages.map((stage) => {
            const styles = STAGE_STYLES[stage.id];
            return (
              <div key={stage.id} className={cn("rounded-lg border border-t-[3px] bg-card p-3.5", styles.borderTop)}>
                <p className={cn("mb-1.5 text-[9px] uppercase tracking-widest", styles.text)}>{stage.label}</p>
                <p className={cn("text-xl font-bold", styles.text)}>{counts[stage.id] ?? 0}</p>
              </div>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {statusFilters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filterSt === key}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[11px] font-bold transition-all",
                filterSt === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/50",
              )}
            >
              {label}
            </button>
          ))}
          <div className="hidden h-4 w-px bg-border sm:block" />
          {priorityFilters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPriorityFilter(key)}
              aria-pressed={priorityFilter === key}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[11px] font-bold transition-all",
                priorityFilter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : cn("border-border hover:border-foreground/50", key === "All" ? "text-muted-foreground" : PRIORITY_TEXT[key as Priority]),
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Kanban board */}
        {view === "kanban" && (
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
                    <div className="rounded-lg border-2 border-dashed border-border/30 py-8 text-center text-[10px] text-muted-foreground/60">
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
                  <ProjectRow key={project.id} project={project} stages={stages} onOpen={openMonitor} onEdit={openEdit} />
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

        {/* Pagination bar */}
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

        {/* Stage legend footer */}
        <div className="flex items-center gap-6 border-t pt-2 text-[10px] text-muted-foreground">
          {stages.map((stage) => (
            <span key={stage.id} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", STAGE_STYLES[stage.id].dot)} />
              {stage.label}: {counts[stage.id] ?? 0}
            </span>
          ))}
          <span className="ml-auto">
            {t("chief.projects.footer.note", { count: filtered.length })}
          </span>
        </div>

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
              <DialogTitle>{t("chief.projects.create.title")}</DialogTitle>
              <DialogDescription>
                {t("chief.projects.create.description")}
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
                    ENS flow: create the exhibition shell first, then attach the client and PM when the registration arrives.
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

function ProjectCard({
  project,
  stage,
  isMoving,
  onMove,
  onOpen,
  onEdit,
  locale,
}: {
  project: KanbanProject;
  stage: Stage;
  isMoving: boolean;
  onMove: (id: string, dir: "prev" | "next") => void;
  onOpen: (name: string) => void;
  onEdit: (project: KanbanProject) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const stageIndex = STAGE_IDS.indexOf(stage);
  const styles     = STAGE_STYLES[stage];

  return (
    <div className={cn("group rounded-lg border border-l-[3px] bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm", styles.border)}>
      <div className="mb-2 flex items-start justify-between gap-1">
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-bold leading-tight transition-colors group-hover:text-primary">
          {project.name}
        </p>
        <span className={cn("mt-0.5 shrink-0 text-[9px] font-bold", PRIORITY_TEXT[project.priority])}>
          {project.priority[0]}
        </span>
      </div>

      <p className="mb-2 truncate text-[10px] text-muted-foreground">{project.client}</p>

      {project.waitDays > 0 && (
        <div className="mb-2 flex items-center gap-1 text-[9.5px] text-red-500">
          <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          {t("chief.projects.card.waiting", { days: project.waitDays })}
        </div>
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
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {stageIndex > 0 && (
            <button
              disabled={isMoving}
              onClick={() => onMove(project.id, "prev")}
              aria-label={t("chief.projects.card.movePrev")}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          )}
          {stageIndex < STAGE_IDS.length - 1 && (
            <button
              disabled={isMoving}
              onClick={() => onMove(project.id, "next")}
              aria-label={t("chief.projects.card.moveNext")}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => onOpen(project.name)}
            aria-label={t("chief.projects.card.openMonitor")}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Layers className="h-3 w-3" />
          </button>
          <button
            onClick={() => onEdit(project)}
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
}: {
  project: KanbanProject;
  stages: { id: Stage; label: string }[];
  onOpen: (name: string) => void;
  onEdit: (project: KanbanProject) => void;
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
      <TableCell className="text-sm">{project.client}</TableCell>
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
        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onEdit(project)}>
            <Pencil className="mr-2 h-3 w-3" aria-hidden="true" />
            {t("chief.projects.row.edit")}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpen(project.name)}>
            <List className="mr-2 h-3 w-3" aria-hidden="true" />
            {t("chief.projects.row.open")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone: "warning" | "success" | "info" }) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3",
      tone === "warning" && "border-red-500/40",
      tone === "success" && "border-green-500/40",
    )}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
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
