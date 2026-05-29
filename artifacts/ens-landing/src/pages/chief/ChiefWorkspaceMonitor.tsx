import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getWorkspaceMonitor,
  updateManagerAssignments,
  type PlatformManager,
  type WorkspaceMonitorProject,
} from "@/lib/platform-api";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Maximize2,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type WStatus = "live" | "pending" | "review" | "blocked";

interface StatusConfig {
  badgeClass: string;
  dotClass: string;
  svgColor: string;
}

const STATUS_CFG: Record<WStatus, StatusConfig> = {
  live:    { badgeClass: "border-green-500 text-green-500 bg-green-500/5",    dotClass: "bg-green-500",  svgColor: "#22c55e" },
  review:  { badgeClass: "border-blue-500 text-blue-500 bg-blue-500/5",       dotClass: "bg-blue-500",   svgColor: "#3b82f6" },
  pending: { badgeClass: "border-orange-500 text-orange-500 bg-orange-500/5", dotClass: "bg-orange-500", svgColor: "#f97316" },
  blocked: { badgeClass: "border-red-500 text-red-500 bg-red-500/5",          dotClass: "bg-red-500",    svgColor: "#ef4444" },
};

interface WProject {
  id: string;
  name: string;
  client: string;
  system: string;
  status: WStatus;
  version: string;
  dims: string;
  pm: string;
  managerId: string | null;
  lastActionMins: number;
  currentAction: string;
  waitingDays: number;
  progress: number;
}

function buildProjects(projects: WorkspaceMonitorProject[]): WProject[] {
  return projects.map((p) => ({
    id:             p.id,
    name:           p.name,
    client:         p.client || "Unassigned Client",
    system:         p.system ?? "octanorm",
    status:         p.status,
    version:        p.version,
    dims:           p.dims,
    pm:             p.pm || "Unassigned",
    managerId:      p.managerId,
    lastActionMins: p.lastActionMins,
    currentAction:  p.currentAction,
    waitingDays:    p.waitingDays,
    progress:       p.progress,
  }));
}

/** Mini isometric booth preview SVG */
function MiniBooth({ status }: { status: WStatus }) {
  const color = STATUS_CFG[status].svgColor;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMid meet"
      className="block"
      aria-hidden="true"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg,transparent,transparent 9px,hsl(var(--border)/0.4) 9px,hsl(var(--border)/0.4) 10px),repeating-linear-gradient(90deg,transparent,transparent 9px,hsl(var(--border)/0.4) 9px,hsl(var(--border)/0.4) 10px)",
      }}
    >
      <polygon points="40,65 80,80 120,65 80,50" fill={`${color}18`} stroke={color} strokeWidth="0.8" />
      <polygon points="40,65 40,35 80,20 80,50" fill={`${color}10`} stroke={color} strokeWidth="0.8" />
      <polygon points="80,50 80,20 120,35 120,65" fill={`${color}06`} stroke={color} strokeWidth="0.8" />
      <polygon points="40,35 40,30 80,15 80,20" fill={color} opacity="0.6" />
      <polygon points="80,20 80,15 120,30 120,35" fill={color} opacity="0.4" />
      <line x1="40" y1="65" x2="80" y2="80" stroke="#f97316" strokeWidth="1" strokeDasharray="3 2" />
      {([[40, 65], [40, 35], [80, 80], [80, 20], [120, 65], [120, 35]] as [number, number][]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.8} fill={color} />
      ))}
    </svg>
  );
}

function formatAge(
  mins: number,
  editingNow: string,
  minutesAgoTpl: (m: number) => string,
  hoursAgoTpl: (h: number) => string,
): string {
  if (mins === 0) return editingNow;
  if (mins < 60)  return minutesAgoTpl(mins);
  return hoursAgoTpl(Math.floor(mins / 60));
}

export default function ChiefWorkspaceMonitor() {
  const { t } = useTranslation();

  const [projects, setProjects]             = useState<WProject[]>([]);
  const [managers, setManagers]             = useState<PlatformManager[]>([]);
  const [filter, setFilter]                 = useState<"all" | WStatus>("all");
  const [reassignDlg, setReassignDlg]       = useState<WProject | null>(null);
  const [newPM, setNewPM]                   = useState("");
  const [toastMsg, setToastMsg]             = useState("");
  const [toastVisible, setToastVisible]     = useState(false);
  const [tick, setTick]                     = useState(0);
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState("");
  const [search, setSearch]                 = useState("");
  const [managerFilter, setManagerFilter]   = useState("all");
  const [lastRefreshed, setLastRefreshed]   = useState<Date | null>(null);
  const [secondsSince, setSecondsSince]     = useState(0);

  useEffect(() => {
    document.title = t("chief.monitor.title");
  }, [t]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  async function loadWorkspaces(options: { silent?: boolean } = {}) {
    try {
      if (!options.silent) setIsLoading(true);
      const workspace = await getWorkspaceMonitor();
      setProjects(buildProjects(workspace.projects));
      setManagers(workspace.managers);
      setError("");
      setLastRefreshed(new Date());
      setSecondsSince(0);
    } catch (reason) {
      setProjects([]);
      setManagers([]);
      setError(reason instanceof Error ? reason.message : t("chief.monitor.error.load"));
    } finally {
      if (!options.silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaces();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live pulse tick + silent 30s refresh + "X seconds ago" counter
  useEffect(() => {
    const tickInterval    = setInterval(() => setTick((n) => n + 1), 8000);
    const refreshInterval = setInterval(() => { void loadWorkspaces({ silent: true }); }, 30000);
    const secondsInterval = setInterval(() => setSecondsSince((n) => n + 1), 1000);
    return () => {
      clearInterval(tickInterval);
      clearInterval(refreshInterval);
      clearInterval(secondsInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reassign() {
    if (!reassignDlg || !newPM) return;
    const manager = managerOptions.find((item) => item.id === newPM);
    if (!managers.length) {
      showToast(t("chief.monitor.error.noManagers"));
      return;
    }
    try {
      await updateManagerAssignments({
        clientAssignments:       [],
        projectAssignments:      [{ projectId: reassignDlg.id, managerId: manager?.id ?? null }],
        cascadeClientProjects:   false,
      });
      await loadWorkspaces();
      showToast(t("chief.monitor.toast.reassigned", { name: reassignDlg.name, pm: manager?.name ?? t("chief.monitor.reassign.unassigned") }));
      setReassignDlg(null);
      setNewPM("");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t("chief.monitor.error.reassign"));
    }
  }

  const counts = {
    live:    projects.filter((p) => p.status === "live").length,
    review:  projects.filter((p) => p.status === "review").length,
    pending: projects.filter((p) => p.status === "pending").length,
    blocked: projects.filter((p) => p.status === "blocked").length,
  };

  const bottlenecks    = projects.filter((p) => p.waitingDays >= 3);
  const managerOptions = managers.filter((m) => m.status === "Active").map((m) => ({ id: m.id, name: m.name }));

  const filtered = projects.filter((project) => {
    const q              = search.trim().toLowerCase();
    const matchesStatus  = filter === "all" || project.status === filter;
    const matchesManager = managerFilter === "all" || project.managerId === managerFilter || project.pm === managerFilter;
    const matchesSearch  = !q || [project.name, project.client, project.pm, project.system, project.currentAction]
      .some((v) => v.toLowerCase().includes(q));
    return matchesStatus && matchesManager && matchesSearch;
  });

  const filterOptions = useMemo(() => [
    { key: "all" as "all" | WStatus,     label: t("chief.monitor.status.all"),     count: projects.length },
    { key: "live" as WStatus,    label: t("chief.monitor.status.live"),    count: counts.live },
    { key: "review" as WStatus,  label: t("chief.monitor.status.review"),  count: counts.review },
    { key: "pending" as WStatus, label: t("chief.monitor.status.pending"), count: counts.pending },
    { key: "blocked" as WStatus, label: t("chief.monitor.status.blocked"), count: counts.blocked },
  ], [t, projects.length, counts.live, counts.review, counts.pending, counts.blocked]);

  const statDescriptions = useMemo<Record<WStatus, string>>(() => ({
    live:    t("chief.monitor.stat.liveDesc"),
    review:  t("chief.monitor.stat.reviewDesc"),
    pending: t("chief.monitor.stat.pendingDesc"),
    blocked: t("chief.monitor.stat.blockedDesc"),
  }), [t]);

  const editingNow    = t("chief.monitor.card.editingNow");
  const minutesAgoTpl = (mins: number) => t("chief.monitor.card.minutesAgo", { mins });
  const hoursAgoTpl   = (hours: number) => t("chief.monitor.card.hoursAgo", { hours });

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader
          title={t("chief.monitor.title")}
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: t("chief.monitor.breadcrumb") }]}
        >
          <div className="flex items-center gap-3">
            {/* Live pulse indicator */}
            <span className="flex items-center gap-2 text-sm text-green-500 font-medium" aria-live="polite">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-block h-2 w-2 rounded-full bg-green-500 transition-shadow",
                  tick % 2 === 0 ? "shadow-[0_0_0_4px_rgba(34,197,94,0.2)]" : "shadow-[0_0_0_6px_rgba(34,197,94,0.15)]",
                )}
              />
              {t("chief.monitor.activeNow", { count: counts.live })}
            </span>
            {/* Last-refreshed timestamp */}
            {lastRefreshed && (
              <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex" aria-live="polite">
                <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
                {secondsSince < 5
                  ? t("chief.monitor.refreshedJustNow")
                  : secondsSince < 60
                  ? t("chief.monitor.refreshedSecondsAgo", { s: secondsSince })
                  : t("chief.monitor.refreshedMinutesAgo", { m: Math.floor(secondsSince / 60) })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void loadWorkspaces(); showToast(t("chief.monitor.toast.refreshed")); }}
              data-testid="button-refresh-monitor"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {t("chief.monitor.refresh")}
            </Button>
          </div>
        </PageHeader>

        {error && (
          <Card role="alert" className="border-yellow-500/40 bg-yellow-500/5">
            <CardContent className="p-4 text-sm text-yellow-500">
              {error}{t("chief.monitor.errorSuffix")}
            </CardContent>
          </Card>
        )}

        {/* Status stat tiles */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border">
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-8 w-12 mt-1" />
                  <Skeleton className="h-2.5 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(["live", "review", "pending", "blocked"] as WStatus[]).map((s) => (
              <Card key={s} className="bg-card/50 border-border">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t(`chief.monitor.status.${s}`)}
                  </p>
                  <p className={cn(
                    "mt-1 text-2xl font-bold",
                    s === "live"    && "text-green-500",
                    s === "review"  && "text-blue-500",
                    s === "pending" && "text-orange-500",
                    s === "blocked" && "text-red-500",
                  )}>
                    {counts[s]}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{statDescriptions[s]}</p>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("chief.monitor.stat.total")}
                </p>
                <p className="mt-1 text-2xl font-bold">{projects.length}</p>
                <p className="text-[10px] text-muted-foreground">{t("chief.monitor.stat.totalDesc")}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bottleneck alerts */}
        {bottlenecks.length > 0 && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-500">
                {t("chief.monitor.bottleneck.title", { count: bottlenecks.length })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {bottlenecks.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-card px-3 py-1.5">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="text-xs font-semibold">{p.name}</span>
                  <span className="text-xs text-red-400">
                    · {t("chief.monitor.bottleneck.waiting", { days: p.waitingDays })}
                  </span>
                  <span className="text-xs text-muted-foreground">PM: {p.pm}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          {filterOptions.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                filter === key
                  ? "bg-card text-foreground shadow-sm border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label} · {count}
            </button>
          ))}
        </div>

        {/* Search + manager filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("chief.monitor.searchPlaceholder")}
              aria-label={t("chief.monitor.searchPlaceholder")}
              className="h-9 pl-9"
            />
          </div>
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue placeholder={t("chief.monitor.pmPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("chief.monitor.allManagers")}</SelectItem>
              {managerOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Project card grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading && !filtered.length && Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="bg-card/50 border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-24" />
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-28" />
                    <Skeleton className="h-2.5 w-8" />
                  </div>
                  <Skeleton className="h-1 w-full rounded-full" />
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-7 w-16 rounded" />
                    <Skeleton className="h-7 w-16 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.map((project) => {
            const sc     = STATUS_CFG[project.status];
            const isLive = project.status === "live";
            const justNow = project.lastActionMins === 0;
            const ageText = formatAge(project.lastActionMins, editingNow, minutesAgoTpl, hoursAgoTpl);

            return (
              <Card
                key={project.id}
                className="overflow-hidden border-border bg-card/50 transition-colors hover:border-primary/40"
              >
                {/* Booth preview */}
                <div className="relative h-24 overflow-hidden bg-muted/20">
                  <MiniBooth status={project.status} />

                  {/* Version tag */}
                  <span className="absolute left-2 top-2 rounded border bg-card/90 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {project.version}
                  </span>

                  {/* Expand button */}
                  <button
                    type="button"
                    aria-label={t("chief.monitor.card.openPreview", { name: project.name })}
                    onClick={() => showToast(t("chief.monitor.toast.openedPreview", { name: project.name }))}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded border bg-card/90 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Maximize2 className="h-3 w-3" aria-hidden="true" />
                  </button>

                  {/* Live pulse badge */}
                  {isLive && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full bg-green-500",
                          justNow && (tick % 2 === 0 ? "shadow-[0_0_0_3px_rgba(34,197,94,0.25)]" : "shadow-[0_0_0_5px_rgba(34,197,94,0.15)]"),
                        )}
                      />
                      <span className="text-[10px] font-semibold text-green-500">{ageText}</span>
                    </div>
                  )}

                  {/* Waiting badge */}
                  {project.waitingDays >= 3 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5">
                      <AlertCircle className="h-2.5 w-2.5 text-red-500" aria-hidden="true" />
                      <span className="text-[10px] font-semibold text-red-500">
                        {t("chief.monitor.card.waitingDays", { days: project.waitingDays })}
                      </span>
                    </div>
                  )}
                </div>

                <CardContent className="space-y-3 p-3">
                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{project.name}</p>
                    <Badge variant="outline" className={cn("flex-shrink-0 text-[10px]", sc.badgeClass)}>
                      {project.status === "live" ? (
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                      ) : project.status === "review" ? (
                        <CheckCircle2 className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
                      ) : (
                        <Circle className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
                      )}
                      {t(`chief.monitor.status.${project.status}`)}
                    </Badge>
                  </div>

                  {/* Live action */}
                  {isLive && (
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-500">
                      <Activity className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{project.currentAction}</span>
                    </div>
                  )}

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{project.system.toUpperCase()} · {project.dims} m</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-1" />
                  </div>

                  {/* PM row + actions */}
                  <div className="flex items-center justify-between border-t pt-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary"
                        aria-hidden="true"
                      >
                        {project.pm.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="text-xs text-muted-foreground">{project.pm}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => { setReassignDlg(project); setNewPM(project.managerId ?? project.pm); }}
                      >
                        <UserCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                        {t("chief.monitor.card.reassign")}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => showToast(t("chief.monitor.toast.joinedSession", { name: project.name }))}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                        {t("chief.monitor.card.join")}
                      </Button>
                    </div>
                  </div>

                  {/* Client + last action */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 min-w-0">
                      <Users className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{project.client}</span>
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                      {ageText}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Status legend */}
        <div className="flex flex-wrap items-center gap-4 border-t pt-4">
          {(Object.keys(STATUS_CFG) as WStatus[]).map((key) => (
            <span key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("inline-block h-2 w-2 rounded-full", STATUS_CFG[key].dotClass)} aria-hidden="true" />
              {t(`chief.monitor.status.${key}`)}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            {t("chief.monitor.legend")}
          </span>
        </div>
      </div>

      {/* Reassign Dialog */}
      <Dialog
        open={!!reassignDlg}
        onOpenChange={(open) => { if (!open) { setReassignDlg(null); setNewPM(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chief.monitor.reassign.title")}</DialogTitle>
            <DialogDescription>
              {t("chief.monitor.reassign.description", { name: reassignDlg?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>

          {reassignDlg && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("chief.monitor.reassign.client")}
                </p>
                <p className="text-sm font-medium">{reassignDlg.client}</p>
              </div>

              <div className="space-y-2">
                {managerOptions.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setNewPM(pm.id)}
                    aria-pressed={newPM === pm.id}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      newPM === pm.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className={cn(
                      "h-2 w-2 flex-shrink-0 rounded-full border-2 transition-colors",
                      newPM === pm.id ? "border-primary bg-primary" : "border-muted-foreground",
                    )} aria-hidden="true" />
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary"
                      aria-hidden="true"
                    >
                      {pm.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span className={cn("text-sm", newPM === pm.id ? "font-semibold" : "text-muted-foreground")}>
                      {pm.name}
                    </span>
                    {pm.id === (reassignDlg.managerId ?? reassignDlg.pm) && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {t("chief.monitor.reassign.current")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReassignDlg(null); setNewPM(""); }}>
              {t("chief.monitor.reassign.cancel")}
            </Button>
            <Button onClick={reassign} disabled={!newPM || newPM === (reassignDlg?.managerId ?? reassignDlg?.pm)}>
              {t("chief.monitor.reassign.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Always-rendered ARIA live toast */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-4 py-2.5 text-sm shadow-xl transition-all duration-300",
          toastVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
        )}
      >
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" aria-hidden="true" />
        {toastMsg}
      </div>
    </DashboardLayout>
  );
}
