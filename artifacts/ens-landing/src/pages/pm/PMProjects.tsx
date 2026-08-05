import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { preloadPortalRoute } from "@/lib/route-preload";
import { useDebounce } from "@/hooks/useDebounce";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  deletePlatformProject,
  getPlatformProjects,
  recordReportExport,
  updatePlatformProject,
  updatePlatformProjectStage,
  type PlatformPagination,
  type PlatformProject,
  type PlatformProjectSummary,
  type PlatformProjectUpdateInput,
} from "@/lib/platform-api";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowUpDown,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Ruler,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";

type FilterStatus =
  | "All" | "Planning" | "In Design" | "Client Review"
  | "Revision" | "Delayed" | "Approved" | "Completed";

const STATUS_OPTIONS: FilterStatus[] = [
  "All", "Planning", "In Design", "Client Review",
  "Revision", "Delayed", "Approved", "Completed",
];

function initialStatusFilter(): FilterStatus {
  const value = new URLSearchParams(window.location.search).get("status")?.toLowerCase();
  const match = STATUS_OPTIONS.find((status) => status.toLowerCase().replace(/\s+/g, "_") === value || status.toLowerCase() === value);
  return match ?? "All";
}

function initialSearchQuery() {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Planning:      { bg: "rgba(194,65,12,0.1)",  text: "#c2410c" },
  "In Design":   { bg: "rgba(47,125,58,0.1)",  text: "#2f7d3a" },
  "Client Review":{ bg: "rgba(29,78,216,0.1)", text: "#1d4ed8" },
  Revision:      { bg: "rgba(217,119,6,0.1)",  text: "#d97706" },
  Delayed:       { bg: "rgba(220,38,38,0.1)",  text: "#dc2626" },
  Approved:      { bg: "rgba(34,197,94,0.1)",  text: "#16a34a" },
  Completed:     { bg: "rgba(29,78,216,0.1)",  text: "#1d4ed8" },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "#dc2626", medium: "#d97706", low: "#6b7280",
};

const PAGE_SIZE = 12;
const EMPTY_PAGINATION: PlatformPagination = { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false };
const EMPTY_SUMMARY: PlatformProjectSummary = { total: 0, inDesign: 0, review: 0, delayed: 0 };
const STAGE_ACTIONS = ["intake", "design", "review", "production", "closed"] as const;

type SortField = "name" | "deadline" | "progress" | "status";
type SortDir   = "asc" | "desc";

const KANBAN_COLUMNS = [
  { id: "planning",  label: "planning",  statuses: new Set(["Planning"]) },
  { id: "progress",  label: "progress",  statuses: new Set(["In Design", "Client Review", "Revision"]) },
  { id: "delayed",   label: "delayed",   statuses: new Set(["Delayed"]) },
  { id: "completed", label: "completed", statuses: new Set(["Approved", "Completed"]) },
] as const;

const KANBAN_COLORS: Record<string, { dot: string; border: string; text: string }> = {
  planning:  { dot: "bg-gray-500",   border: "border-t-gray-500",   text: "text-gray-500" },
  progress:  { dot: "bg-blue-600",   border: "border-t-blue-600",   text: "text-blue-600" },
  delayed:   { dot: "bg-red-500",    border: "border-t-red-500",    text: "text-red-500" },
  completed: { dot: "bg-green-600",  border: "border-t-green-600",  text: "text-green-600" },
};

export default function PMProjects() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState(() => initialSearchQuery());
  const debouncedSearch = useDebounce(search, 250);
  const [filter, setFilter] = useState<FilterStatus>(() => initialStatusFilter());
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"list" | "grid" | "kanban">("list");
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [projects, setProjects] = useState<PlatformProject[]>([]);
  const [pagination, setPagination] = useState<PlatformPagination>(EMPTY_PAGINATION);
  const [summary, setSummary] = useState<PlatformProjectSummary>(EMPTY_SUMMARY);
  const [selectedProject, setSelectedProject] = useState<PlatformProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stageBusy, setStageBusy] = useState("");
  const [loadError, setLoadError] = useState("");
  const { toast } = useToast();
  // Edit project
  const [editTarget, setEditTarget] = useState<PlatformProject | null>(null);
  const [editForm, setEditForm] = useState({ name: "", client: "", system: "octanorm", width: "6", depth: "3", deadline: "", description: "" });
  const [editError, setEditError] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);
  // Delete project
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<PlatformProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Focus trap ref — only for the inline delete confirmation dialog
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(deleteDialogRef, !!confirmDeleteProject, () => setConfirmDeleteProject(null));

  useEffect(() => {
    document.title = t("pm.projects.title");
  }, [t]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setLoadError("");

    getPlatformProjects({
      q: debouncedSearch,
      status: filter === "All" ? "" : filter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((data) => {
        if (!mounted) return;
        setProjects(data.projects);
        setPagination(data.pagination);
        setSummary(data.summary ?? EMPTY_SUMMARY);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setProjects([]);
        setPagination({ ...EMPTY_PAGINATION, offset: page * PAGE_SIZE });
        setSummary(EMPTY_SUMMARY);
        setLoadError(reason instanceof Error ? reason.message : t("pm.projects.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [debouncedSearch, filter, page, t]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trimmedSearch = debouncedSearch.trim();

    if (filter === "All") {
      params.delete("status");
    } else {
      params.set("status", filter.toLowerCase().replace(/\s+/g, "_"));
    }

    if (trimmedSearch) {
      params.set("q", trimmedSearch);
    } else {
      params.delete("q");
    }

    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [debouncedSearch, filter]);

  const pageStart = pagination.total ? pagination.offset + 1 : 0;
  const pageEnd = Math.min(pagination.offset + projects.length, pagination.total);

  async function refreshProjects() {
    const latest = await getPlatformProjects({
      q: debouncedSearch,
      status: filter === "All" ? "" : filter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setProjects(latest.projects);
    setPagination(latest.pagination);
    setSummary(latest.summary ?? EMPTY_SUMMARY);
    return latest.projects;
  }

  async function updateStage(project: PlatformProject, stage: string) {
    if (stageBusy) return;
    setStageBusy(`${project.id}:${stage}`);
    try {
      await updatePlatformProjectStage(project.id, stage);
      const latestProjects = await refreshProjects();
      const updated = latestProjects.find((item) => item.id === project.id);
      setSelectedProject(updated ?? null);
      showToast(t("pm.projects.toast.stageUpdated", { name: project.name, stage: stageLabel(stage, t) }));
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t("pm.projects.toast.stageError"));
    } finally {
      setStageBusy("");
    }
  }

  function openEdit(project: PlatformProject) {
    const [widthStr, depthStr] = project.dimensions.replace(/\s*m\s*$/i, "").split(/\s*[x×]\s*/);
    setEditForm({
      name: project.name,
      client: project.client,
      system: project.system,
      width: widthStr?.trim() ?? "6",
      depth: depthStr?.trim() ?? "3",
      deadline: project.deadline ?? "",
      description: project.description ?? "",
    });
    setEditError("");
    setEditTarget(project);
  }

  async function saveEdit() {
    if (!editTarget || isEditSaving) return;
    if (!editForm.name.trim() || !editForm.client.trim()) {
      setEditError(t("pm.projects.modal.nameClientRequired"));
      return;
    }
    const width = Number(editForm.width);
    const depth = Number(editForm.depth);
    if (!Number.isFinite(width) || width < 1 || !Number.isFinite(depth) || depth < 1) {
      setEditError(t("pm.projects.modal.dimensionsInvalid"));
      return;
    }
    setIsEditSaving(true);
    setEditError("");
    try {
      const input: PlatformProjectUpdateInput = {
        name: editForm.name.trim(),
        client: editForm.client.trim(),
        system: editForm.system,
        widthM: width,
        depthM: depth,
        deadline: editForm.deadline,
        exhibition: editForm.name.trim(),
        description: editForm.description.trim(),
      };
      const result = await updatePlatformProject(editTarget.id, input);
      const latestProjects = await refreshProjects();
      const updated = latestProjects.find((p) => p.id === editTarget.id) ?? result.project;
      setSelectedProject(updated ?? null);
      setEditTarget(null);
      showToast(t("pm.projects.toast.edited", { name: editForm.name.trim() }));
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : t("pm.projects.toast.editError"));
    } finally {
      setIsEditSaving(false);
    }
  }

  async function deleteProject(project: PlatformProject) {
    setIsDeleting(true);
    try {
      await deletePlatformProject(project.id);
      setConfirmDeleteProject(null);
      setSelectedProject(null);
      const latest = await refreshProjects();
      void latest;
      showToast(t("pm.projects.toast.deleted", { name: project.name }));
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t("pm.projects.toast.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  }

  function showToast(message: string) {
    toast({ title: message });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sortedProjects = useMemo(() => {
    const list = [...projects];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name")     cmp = a.name.localeCompare(b.name);
      if (sortBy === "status")   cmp = a.status.localeCompare(b.status);
      if (sortBy === "progress") cmp = a.progress - b.progress;
      if (sortBy === "deadline") {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        cmp = da - db;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [projects, sortBy, sortDir]);

  function exportProjects() {
    downloadExcelWorkbook(`pm-projects-${new Date().toISOString().slice(0, 10)}.xls`, [
      {
        name: "Projects",
        rows: [
          ["Project", "Client", "PM", "System", "Dimensions", "Status", "Health", "Progress %", "Deadline", "Exhibition"],
          ...sortedProjects.map((p) => [
            p.name, p.client, p.pm, p.system, p.dimensions,
            p.status, p.health, `${p.progress}%`, p.deadline ?? "—", p.exhibition,
          ]),
        ],
      },
      {
        name: "Summary",
        rows: [
          ["Metric", "Value"],
          ["Total", sortedProjects.length],
          ["Delayed", sortedProjects.filter((p) => p.status === "Delayed").length],
          ["Completed", sortedProjects.filter((p) => p.status === "Completed" || p.status === "Approved").length],
          ["Exported at", new Date().toLocaleString()],
        ],
      },
    ]);
    void recordReportExport({ report: "PM project portfolio", format: "xls", href: "/pm/reports" });
    showToast(t("pm.projects.toast.exported"));
  }

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      All: t("pm.projects.filter.all"),
      Planning: t("pm.common.status.planning"),
      "In Design": t("pm.common.status.inDesign"),
      "Client Review": t("pm.common.status.clientReview"),
      Revision: t("pm.common.status.revision"),
      Delayed: t("pm.common.status.delayed"),
      Approved: t("pm.common.status.approved"),
      Completed: t("pm.common.status.completed"),
    };
    return map[status] ?? status;
  }

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader
          title={t("pm.projects.title")}
          breadcrumbs={[{ label: t("pm.nav.dashboard"), href: "/pm" }, { label: t("pm.nav.projects") }]}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
              {([["list", List], ["grid", LayoutGrid], ["kanban", Layers]] as const).map(([key, Icon]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  data-testid={`button-view-${key}`}
                  aria-label={t(`pm.projects.view.${key}`)}
                  aria-pressed={view === key}
                  className={`rounded p-1.5 transition-colors ${
                    view === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            <button
              onClick={exportProjects}
              disabled={sortedProjects.length === 0}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              title={t("pm.projects.exportTooltip")}
            >
              <Download aria-hidden="true" className="h-3 w-3" />
              {t("pm.projects.export")}
            </button>
          </div>
        </PageHeader>

        {loadError && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Assigned client projects appear here after Chief approval. Use the project workspace to submit designs to the client.
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { labelKey: "pm.projects.stats.total",    value: summary.total,    Icon: Layers,       color: "text-foreground" },
            { labelKey: "pm.projects.stats.inDesign", value: summary.inDesign, Icon: CheckCircle2, color: "text-green-600" },
            { labelKey: "pm.projects.stats.review",   value: summary.review,   Icon: Clock,        color: "text-blue-600" },
            { labelKey: "pm.projects.stats.delayed",  value: summary.delayed,  Icon: AlertCircle,  color: "text-red-600" },
          ].map(({ labelKey, value, Icon, color }) => (
            <div key={labelKey} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{t(labelKey)}</span>
                <Icon aria-hidden="true" className={`h-4 w-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                aria-pressed={filter === status}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide transition-all ${
                  filter === status
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/50"
                }`}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("pm.projects.searchPlaceholder")}
                aria-label={t("pm.projects.searchPlaceholder")}
                className="h-8 w-52 rounded-md border bg-muted/30 pl-8 pr-3 text-xs outline-none focus:border-primary"
                data-testid="input-search-projects"
              />
            </div>
            <button
              onClick={() => setShowFilter((f) => !f)}
              aria-pressed={showFilter}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                showFilter ? "border-primary text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground",
              )}
              data-testid="button-filter"
            >
              <Filter aria-hidden="true" className="h-3 w-3" /> {t("pm.common.filter")}
            </button>
          </div>
        </div>

        {/* Sort panel (shown when Filter is active) */}
        {showFilter && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/50 px-4 py-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ArrowUpDown className="h-3 w-3" /> {t("pm.projects.sortBy")}
            </span>
            {(["name", "deadline", "progress", "status"] as SortField[]).map((field) => (
              <button
                key={field}
                onClick={() => {
                  if (sortBy === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
                  else { setSortBy(field); setSortDir("asc"); }
                }}
                aria-pressed={sortBy === field}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-semibold capitalize transition-all",
                  sortBy === field
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40",
                )}
              >
                {t(`pm.projects.sort.${field}`)}
                {sortBy === field && (
                  <span className="ml-1 opacity-70">{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {view === "list" ? (
          <ProjectTable
            projects={sortedProjects}
            isLoading={isLoading}
            locale={i18n.language}
            stageBusy={stageBusy}
            onDetails={setSelectedProject}
            onStageChange={updateStage}
            t={t}
          />
        ) : view === "grid" ? (
          <ProjectGrid
            projects={sortedProjects}
            isLoading={isLoading}
            locale={i18n.language}
            stageBusy={stageBusy}
            onDetails={setSelectedProject}
            onStageChange={updateStage}
            t={t}
          />
        ) : (
          <ProjectKanban
            projects={sortedProjects}
            isLoading={isLoading}
            locale={i18n.language}
            stageBusy={stageBusy}
            onDetails={setSelectedProject}
            onStageChange={updateStage}
            t={t}
          />
        )}

        <PaginationBar
          start={pageStart}
          end={pageEnd}
          total={pagination.total}
          canPrevious={pagination.offset > 0}
          canNext={pagination.hasMore}
          isLoading={isLoading}
          onPrevious={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => current + 1)}
          t={t}
        />
      </div>

      {selectedProject && (
        <ProjectDetailDrawer
          project={selectedProject}
          locale={i18n.language}
          stageBusy={stageBusy}
          onClose={() => setSelectedProject(null)}
          onStageChange={updateStage}
          onEdit={openEdit}
          onDelete={(p) => setConfirmDeleteProject(p)}
          t={t}
        />
      )}

      {/* Edit project modal */}
      {editTarget && (
        <EditProjectModal
          project={editTarget}
          value={editForm}
          error={editError}
          isSaving={isEditSaving}
          onChange={(v) => { setEditError(""); setEditForm(v); }}
          onCancel={() => { setEditTarget(null); setEditError(""); }}
          onSubmit={saveEdit}
          t={t}
        />
      )}

      {/* Delete project confirmation */}
      {confirmDeleteProject && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/50" onClick={() => !isDeleting && setConfirmDeleteProject(null)} />
          <div
            ref={deleteDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="fixed left-1/2 top-1/2 z-[61] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl"
          >
            <h2 id="delete-project-title" className="mb-1 text-base font-bold">{t("pm.projects.delete.title")}</h2>
            <p className="mb-1 truncate text-sm font-semibold text-foreground">{confirmDeleteProject.name}</p>
            <p className="mb-5 text-sm text-muted-foreground">
              {t("pm.projects.delete.warning")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteProject(null)}
                disabled={isDeleting}
                className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                {t("pm.common.cancel")}
              </button>
              <button
                onClick={() => deleteProject(confirmDeleteProject)}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("pm.projects.delete.confirm")}
              </button>
            </div>
          </div>
        </>
      )}

    </DashboardLayout>
  );
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function ProjectTable({ projects, isLoading, locale, stageBusy, onDetails, onStageChange, t }: {
  projects: PlatformProject[];
  isLoading: boolean;
  locale: string;
  stageBusy: string;
  onDetails: (project: PlatformProject) => void;
  onStageChange: (project: PlatformProject, stage: string) => void;
  t: TFn;
}) {
  const headers = [
    t("pm.projects.table.project"), t("pm.projects.table.client"),  t("pm.projects.table.size"),
    t("pm.projects.table.progress"), t("pm.projects.table.deadline"), t("pm.projects.table.status"),
    t("pm.projects.table.actions"),
  ];

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            {headers.map((heading) => (
              <th key={heading} className="px-4 py-2.5 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => {
            const status = STATUS_COLOR[project.status] ?? STATUS_COLOR.Planning;
            const priority = (["high", "medium", "low", "high", "medium"] as const)[index % 5];

            return (
              <tr key={project.id} className="group border-b transition-colors last:border-0 hover:bg-muted/10">
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold leading-tight">{project.name}</div>
                  <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">{project.exhibition}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">{project.client}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <User aria-hidden="true" className="h-2.5 w-2.5" />
                    {project.pm}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs font-mono">
                    <Ruler aria-hidden="true" className="h-2.5 w-2.5 text-muted-foreground" />
                    {project.dimensions}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-mono uppercase text-muted-foreground">{project.system}</span>
                </td>
                <td className="min-w-[120px] px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-mono">
                    <span style={{ color: PRIORITY_COLOR[priority] }}>{t(`pm.common.priority.${priority}`)}</span>
                    <span className="text-muted-foreground">{project.progress}%</span>
                  </div>
                  <ProgressBar value={project.progress} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <Calendar aria-hidden="true" className="h-3 w-3" />
                    {formatDeadline(project.deadline, locale)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold font-mono" style={{ background: status.bg, color: status.text }}>
                    {translateStatus(project.status, t)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Link
                      href={`/pm/workspace?projectId=${encodeURIComponent(project.id)}`}
                      onPointerEnter={() => { void preloadPortalRoute("/pm/workspace")?.catch(() => undefined); }}
                      onFocus={() => { void preloadPortalRoute("/pm/workspace")?.catch(() => undefined); }}
                    >
                      <button className="flex items-center gap-1 whitespace-nowrap rounded border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                        <Layers aria-hidden="true" className="h-2.5 w-2.5" /> {t("pm.projects.actions.open")}
                      </button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDetails(project)}
                      className="flex items-center gap-1 whitespace-nowrap rounded border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ArrowUpRight aria-hidden="true" className="h-2.5 w-2.5" /> {t("pm.projects.actions.details")}
                    </button>
                    {project.status !== "Completed" && (
                      <button
                        type="button"
                        onClick={() => onStageChange(project, nextStageForProject(project))}
                        disabled={!!stageBusy}
                        className="flex items-center gap-1 whitespace-nowrap rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        <CheckCircle2 aria-hidden="true" className="h-2.5 w-2.5" />
                        {t("pm.projects.actions.advance")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {isLoading && !projects.length && Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="px-4 py-3"><div className="space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24 font-mono" /></div></td>
              <td className="px-4 py-3"><div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div></td>
              <td className="px-4 py-3"><Skeleton className="h-3 w-20" /></td>
              <td className="px-4 py-3"><Skeleton className="h-1.5 w-full rounded-full" /></td>
              <td className="px-4 py-3"><Skeleton className="h-3 w-20" /></td>
              <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
              <td className="px-4 py-3"><div className="flex gap-1.5"><Skeleton className="h-6 w-14 rounded" /><Skeleton className="h-6 w-14 rounded" /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!projects.length && !isLoading && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t("pm.projects.noMatch")}
        </div>
      )}
    </div>
  );
}

function ProjectGrid({ projects, isLoading, locale, stageBusy, onDetails, onStageChange, t }: {
  projects: PlatformProject[];
  isLoading: boolean;
  locale: string;
  stageBusy: string;
  onDetails: (project: PlatformProject) => void;
  onStageChange: (project: PlatformProject, stage: string) => void;
  t: TFn;
}) {
  if (!projects.length && !isLoading) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
        {t("pm.projects.noMatch")}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {isLoading && !projects.length && Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="rounded bg-muted/30 p-1.5 space-y-1">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </div>
      ))}
      {projects.map((project) => {
        const status = STATUS_COLOR[project.status] ?? STATUS_COLOR.Planning;

        return (
          <div key={project.id} className="rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-md">
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold leading-tight">{project.name}</h3>
                  <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">{project.client}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold font-mono" style={{ background: status.bg, color: status.text }}>
                  {translateStatus(project.status, t)}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {([
                  [t("pm.projects.grid.system"),   project.system.toUpperCase()],
                  [t("pm.projects.grid.size"),     project.dimensions],
                  [t("pm.projects.grid.deadline"), formatDeadline(project.deadline, locale)],
                  [t("pm.projects.grid.pm"),       project.pm],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="rounded bg-muted/30 p-1.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-[11px] font-semibold font-mono">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{t("pm.projects.grid.progress")}</span>
                  <span>{project.progress}%</span>
                </div>
                <ProgressBar value={project.progress} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDetails(project)}
                  className="flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" /> {t("pm.projects.actions.details")}
                </button>
                <button
                  type="button"
                  onClick={() => onStageChange(project, nextStageForProject(project))}
                  disabled={!!stageBusy || project.status === "Completed"}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-primary/20 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
                >
                  <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> {t("pm.projects.actions.advance")}
                </button>
              </div>
              <Link
                href={`/pm/workspace?projectId=${encodeURIComponent(project.id)}`}
                onPointerEnter={() => { void preloadPortalRoute("/pm/workspace")?.catch(() => undefined); }}
                onFocus={() => { void preloadPortalRoute("/pm/workspace")?.catch(() => undefined); }}
              >
                <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/20 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                  <Layers aria-hidden="true" className="h-3 w-3" /> {t("pm.projects.actions.openWorkspace")}
                </button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjectKanban({ projects, isLoading, locale, stageBusy, onDetails, onStageChange, t }: {
  projects: PlatformProject[];
  isLoading: boolean;
  locale: string;
  stageBusy: string;
  onDetails: (project: PlatformProject) => void;
  onStageChange: (project: PlatformProject, stage: string) => void;
  t: TFn;
}) {
  if (!projects.length && !isLoading) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
        {t("pm.projects.noMatch")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3" style={{ minHeight: 400 }}>
      {KANBAN_COLUMNS.map((col) => {
        const cards = projects.filter((p) => col.statuses.has(p.status));
        const colors = KANBAN_COLORS[col.id];
        return (
          <div key={col.id} className="flex flex-col gap-2">
            {/* Column header */}
            <div className={cn("flex items-center gap-2 rounded-lg border border-t-[3px] bg-card p-3", colors.border)}>
              <span className={cn("h-2 w-2 rounded-full", colors.dot)} aria-hidden="true" />
              <span className={cn("flex-1 text-[10px] font-bold uppercase tracking-widest", colors.text)}>
                {t(`pm.projects.kanban.${col.label}`)}
              </span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{cards.length}</span>
            </div>

            {/* Cards */}
            {isLoading && cards.length === 0 && Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-2.5 w-8" />
                  </div>
                  <Skeleton className="h-1 w-full rounded-full" />
                </div>
                <Skeleton className="h-3 w-20" />
                <div className="flex items-center justify-between border-t border-border/40 pt-2">
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}

            {cards.map((project) => {
              const status = STATUS_COLOR[project.status] ?? STATUS_COLOR.Planning;
              return (
                <div
                  key={project.id}
                  className="group rounded-lg border border-l-[3px] bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm"
                  style={{ borderLeftColor: status.text }}
                >
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => onDetails(project)}
                      className="text-left text-[11.5px] font-bold leading-tight hover:text-primary transition-colors line-clamp-2"
                    >
                      {project.name}
                    </button>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{project.client}</p>
                  </div>

                  <div className="mb-2">
                    <div className="mb-1 flex justify-between text-[9px] text-muted-foreground">
                      <span>{project.system.toUpperCase()}</span>
                      <span>{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} />
                  </div>

                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-2">
                    <Calendar className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    {formatDeadline(project.deadline, locale)}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-2">
                    <div className="flex min-w-0 items-center gap-1 text-[9px] text-muted-foreground">
                      <User className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{project.pm}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onDetails(project)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("pm.projects.actions.details")}
                      >
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                      {project.status !== "Completed" && project.status !== "Approved" && (
                        <button
                          type="button"
                          onClick={() => onStageChange(project, nextStageForProject(project))}
                          disabled={!!stageBusy}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          aria-label={t("pm.projects.actions.advance")}
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!isLoading && !cards.length && (
              <div className="rounded-lg border-2 border-dashed border-border/30 py-8 text-center text-[10px] text-muted-foreground/60">
                {t("pm.projects.kanban.empty")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PaginationBar({
  start,
  end,
  total,
  canPrevious,
  canNext,
  isLoading,
  onPrevious,
  onNext,
  t,
}: {
  start: number;
  end: number;
  total: number;
  canPrevious: boolean;
  canNext: boolean;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  t: TFn;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">
      <span>{t("pm.projects.paging.showing", { start, end, total })}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isLoading || !canPrevious}
          className="rounded-md border px-3 py-1.5 font-semibold transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("pm.common.previous")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || !canNext}
          className="rounded-md border px-3 py-1.5 font-semibold transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("pm.common.next")}
        </button>
      </div>
    </div>
  );
}

type EditForm = { name: string; client: string; system: string; width: string; depth: string; deadline: string; description: string };

function EditProjectModal({
  project,
  value,
  error,
  isSaving,
  onChange,
  onCancel,
  onSubmit,
  t,
}: {
  project: PlatformProject;
  value: EditForm;
  error: string;
  isSaving: boolean;
  onChange: (v: EditForm) => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: TFn;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, () => !isSaving && onCancel());
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/40" onClick={() => !isSaving && onCancel()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-project-title"
        className="fixed left-1/2 top-1/2 z-[61] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="edit-project-title" className="text-base font-bold">
              {t("pm.projects.edit.title")}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{project.name}</p>
          </div>
          <button onClick={onCancel} disabled={isSaving} className="text-muted-foreground hover:text-foreground" aria-label={t("pm.common.cancel")}>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {([
            [t("pm.projects.modal.projectName"), "name"],
            [t("pm.projects.modal.client"), "client"],
          ] as const).map(([label, key]) => (
            <div key={key}>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</label>
              <input
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          ))}

          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{t("pm.projects.modal.deadline")}</label>
            <input
              type="date"
              value={value.deadline}
              onChange={(e) => onChange({ ...value, deadline: e.target.value })}
              className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{t("pm.projects.modal.system")}</label>
            <select
              value={value.system}
              onChange={(e) => onChange({ ...value, system: e.target.value })}
              className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            >
              <option value="octanorm">Octanorm</option>
              <option value="maxima">Maxima</option>
              <option value="custom">{t("pm.projects.modal.systemCustom")}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              [t("pm.projects.modal.width"), "width"],
              [t("pm.projects.modal.depth"), "depth"],
            ] as const).map(([label, key]) => (
              <div key={key}>
                <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</label>
                <input
                  type="number" min="1" max="100" step="0.5"
                  value={value[key]}
                  onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                  className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {t("pm.projects.detail.description")}
            </label>
            <textarea
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={isSaving} className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40">
            {t("pm.common.cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={!value.name.trim() || !value.client.trim() || isSaving}
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {isSaving && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
            {isSaving ? t("pm.common.saving") : t("pm.projects.edit.submit")}
          </button>
        </div>
      </div>
    </>
  );
}

function ProjectDetailDrawer({
  project,
  locale,
  stageBusy,
  onClose,
  onStageChange,
  onEdit,
  onDelete,
  t,
}: {
  project: PlatformProject;
  locale: string;
  stageBusy: string;
  onClose: () => void;
  onStageChange: (project: PlatformProject, stage: string) => void;
  onEdit: (project: PlatformProject) => void;
  onDelete: (project: PlatformProject) => void;
  t: TFn;
}) {
  const status = STATUS_COLOR[project.status] ?? STATUS_COLOR.Planning;
  const currentStage = project.pipelineStage ?? currentStageForProject(project);
  const lifecycleHistory = project.lifecycleHistory ?? [];
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(drawerRef, true, onClose);

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <aside
        ref={drawerRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-detail-title"
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-xl flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{project.client}</p>
            <h2 id="project-detail-title" className="truncate text-xl font-bold">{project.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{project.exhibition}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={t("pm.common.cancel")}>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold font-mono" style={{ background: status.bg, color: status.text }}>
              {translateStatus(project.status, t)}
            </span>
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
              {t("pm.projects.detail.stage", { stage: stageLabel(currentStage, t) })}
            </span>
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
              {project.health}
            </span>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <DetailMetric label={t("pm.projects.table.client")} value={project.client} />
            <DetailMetric label={t("pm.projects.grid.pm")} value={project.pm} />
            <DetailMetric label={t("pm.projects.grid.system")} value={project.system} />
            <DetailMetric label={t("pm.projects.grid.size")} value={project.dimensions} />
            <DetailMetric label={t("pm.projects.grid.deadline")} value={formatDeadline(project.deadline, locale)} />
            <DetailMetric label={t("pm.projects.grid.progress")} value={`${project.progress}%`} />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex justify-between text-[11px] font-mono text-muted-foreground">
              <span>{t("pm.projects.grid.progress")}</span>
              <span>{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} />
          </div>

          <section className="mb-6 rounded-lg border bg-card/50 p-4">
            <h3 className="mb-2 text-sm font-bold">{t("pm.projects.detail.description")}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.description || t("pm.projects.detail.noDescription")}
            </p>
          </section>

          <section className="rounded-lg border bg-card/50 p-4">
            <h3 className="mb-3 text-sm font-bold">{t("pm.projects.detail.lifecycle")}</h3>
            <div className="grid gap-2 sm:grid-cols-5">
              {STAGE_ACTIONS.map((stage) => {
                const selected = stage === currentStage;
                const busy = stageBusy === `${project.id}:${stage}`;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => onStageChange(project, stage)}
                    disabled={!!stageBusy || selected}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      selected ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {busy ? t("pm.common.saving") : stageLabel(stage, t)}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 border-t pt-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("pm.projects.detail.history")}
              </h4>
              {lifecycleHistory.length ? (
                <div className="space-y-3">
                  {lifecycleHistory.slice(0, 6).map((item) => (
                    <div key={item.id} className="grid grid-cols-[auto,1fr] gap-3 text-sm">
                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {item.fromStage
                            ? t("pm.projects.detail.historyMove", { from: stageLabel(item.fromStage, t),
                                to: stageLabel(item.toStage, t),
                              })
                            : stageLabel(item.toStage, t)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("pm.projects.detail.historyMeta", { actor: item.actorName,
                            time: formatHistoryTimestamp(item.createdAt, locale),
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("pm.projects.detail.noHistory")}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
            Project ownership, client assignment, and deletion are controlled by Chief Manager.
          </p>
          <div className="flex items-center gap-2">
            <Link href={`/pm/calendar?clientName=${encodeURIComponent(project.client)}`}>
              <button className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("pm.nav.calendar")}
              </button>
            </Link>
            <Link
              href={`/pm/workspace?projectId=${encodeURIComponent(project.id)}`}
              onPointerEnter={() => { void preloadPortalRoute("/pm/workspace")?.catch(() => undefined); }}
              onFocus={() => { void preloadPortalRoute("/pm/workspace")?.catch(() => undefined); }}
            >
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {t("pm.projects.actions.openWorkspace")}
              </button>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function translateStatus(status: string, t: TFn): string {
  const map: Record<string, string> = {
    Planning:        t("pm.common.status.planning"),
    "In Design":     t("pm.common.status.inDesign"),
    "Client Review": t("pm.common.status.clientReview"),
    Revision:        t("pm.common.status.revision"),
    Delayed:         t("pm.common.status.delayed"),
    Approved:        t("pm.common.status.approved"),
    Completed:       t("pm.common.status.completed"),
  };
  return map[status] ?? status;
}

function currentStageForProject(project: PlatformProject) {
  if (project.status === "Completed" || project.status === "Approved") return "closed";
  if (project.status === "In Production") return "production";
  if (project.status === "Client Review" || project.status === "Revision") return "review";
  if (project.status === "In Design") return "design";
  return "intake";
}

function nextStageForProject(project: PlatformProject) {
  const current = currentStageForProject(project);
  if (current === "intake") return "design";
  if (current === "design") return "review";
  if (current === "review") return "production";
  return "closed";
}

function stageLabel(stage: string, t: TFn) {
  const map: Record<string, string> = {
    intake: t("pm.projects.stage.intake"),
    design: t("pm.projects.stage.design"),
    review: t("pm.projects.stage.review"),
    production: t("pm.projects.stage.production"),
    closed: t("pm.projects.stage.closed"),
  };
  return map[stage] ?? stage;
}

function formatHistoryTimestamp(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? "#2f7d3a" : value >= 40 ? "#1d4ed8" : "#c2410c";
  return (
    <div style={{ height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2 }} />
    </div>
  );
}

function formatDeadline(value: string | null, locale = "en-GB"): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "2-digit" });
}
