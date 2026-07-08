import { useEffect, useMemo, useState, type ElementType } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from "recharts";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { getPlatformOverview, recordReportExport, type PlatformOverview } from "@/lib/platform-api";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Briefcase,
  Clock,
  Download,
  AlertCircle,
  Monitor,
  UserSquare2,
  Users,
  UserPlus,
} from "lucide-react";

const EMPTY_OVERVIEW: PlatformOverview = {
  organization: null,
  metrics: {
    clients: 0,
    projects: 0,
    projectManagers: 0,
    delayedProjects: 0,
    pendingApprovals: 0,
    activeWorkspaces: 0,
    documents: 0,
    comments: 0,
    completedProjects: 0,
  },
  projects: [],
  clients: [],
  activity: [],
  charts: {
    activity: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, projects: 0 })),
    distribution: [
      { name: "Active", value: 0, color: "#3b82f6" },
      { name: "Pending", value: 0, color: "#eab308" },
      { name: "Delayed", value: 0, color: "#ef4444" },
      { name: "Completed", value: 0, color: "#22c55e" },
    ],
    activityCount: 0,
  },
  workflow: null,
};

export default function ChiefDashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [overview, setOverview] = useState<PlatformOverview>(EMPTY_OVERVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    document.title = t("chief.dashboard.pageTitle");
  }, [t]);

  function reloadData() {
    setIsLoading(true);
    setError(null);
    getPlatformOverview()
      .then((data) => {
        setOverview(data);
        setError(null);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t("chief.dashboard.loadError"));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  useEffect(() => {
    let mounted = true;

    getPlatformOverview()
      .then((data) => {
        if (!mounted) return;
        setOverview(data);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : t("chief.dashboard.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => [
    { label: t("chief.dashboard.stats.totalClients"),    value: String(overview.metrics.clients),         icon: Users,       trend: t("chief.dashboard.stats.db"),       trendUp: true,                                         href: "/chief/clients" },
    { label: t("chief.dashboard.stats.activeProjects"),  value: String(overview.metrics.projects),        icon: Briefcase,   trend: t("chief.dashboard.stats.live"),     trendUp: true,                                         href: "/chief/projects" },
    { label: t("chief.dashboard.stats.managers"),        value: String(overview.metrics.projectManagers), icon: UserSquare2, trend: t("chief.dashboard.stats.assigned"), trendUp: true,                                         href: "/chief/managers" },
    { label: t("chief.dashboard.stats.delayedProjects"), value: String(overview.metrics.delayedProjects), icon: AlertCircle, trend: overview.metrics.delayedProjects ? t("chief.dashboard.stats.needsAction") : t("chief.dashboard.stats.clear"), trendUp: false, href: "/chief/projects" },
    { label: t("chief.dashboard.stats.pendingApprovals"),value: String(overview.metrics.pendingApprovals),icon: Clock,       trend: t("chief.dashboard.stats.open"),     trendUp: overview.metrics.pendingApprovals === 0,      href: "/chief/clients" },
    { label: t("chief.dashboard.stats.activeWorkspaces"),value: String(overview.metrics.activeWorkspaces),icon: Monitor,     trend: t("chief.dashboard.stats.saved"),    trendUp: true,                                         href: "/chief/workspace-monitor" },
  ], [overview.metrics, t]);

  const managerPerformance = useMemo(() => {
    const byPm = new Map<string, number>();
    overview.projects.forEach((project) => {
      byPm.set(project.pm, (byPm.get(project.pm) ?? 0) + 1);
    });
    return Array.from(byPm, ([name, projects]) => ({ name, projects }));
  }, [overview.projects]);

  const insights = useMemo(() => {
    const delayed = overview.projects.filter((project) => isDelayedDashboardProject(project.status, project.health));
    const dueSoon = overview.projects.filter((project) => {
      const days = dashboardDaysUntil(project.deadline);
      return days !== null && days >= 0 && days <= 14;
    });
    const unassigned = overview.projects.filter((project) => !project.pm || project.pm.toLowerCase() === "unassigned");

    return [
      {
        title: t("chief.dashboard.insights.delayedTitle"),
        value: String(delayed.length),
        description: delayed.length
          ? t("chief.dashboard.insights.firstInQueue", { name: delayed[0].name })
          : t("chief.dashboard.insights.noDelayed"),
        action: t("chief.dashboard.insights.reviewProjects"),
        href: "/chief/projects",
        color: delayed.length ? "border-red-500" : "border-green-500",
        icon: AlertCircle,
      },
      {
        title: t("chief.dashboard.insights.dueSoonTitle"),
        value: String(dueSoon.length),
        description: dueSoon.length
          ? t("chief.dashboard.insights.nearestDeadline", { name: dueSoon[0].name })
          : t("chief.dashboard.insights.noDueSoon"),
        action: t("chief.dashboard.insights.openCalendar"),
        href: "/chief/calendar",
        color: dueSoon.length ? "border-yellow-500" : "border-green-500",
        icon: Clock,
      },
      {
        title: t("chief.dashboard.insights.unassignedTitle"),
        value: String(unassigned.length),
        description: unassigned.length
          ? t("chief.dashboard.insights.unassignedNeeds", { name: unassigned[0].name })
          : t("chief.dashboard.insights.noUnassigned"),
        action: t("chief.dashboard.insights.assignManagers"),
        href: "/chief/managers",
        color: unassigned.length ? "border-orange-500" : "border-green-500",
        icon: UserSquare2,
      },
      {
        title: t("chief.dashboard.insights.approvalsTitle"),
        value: String(overview.metrics.pendingApprovals),
        description: overview.metrics.pendingApprovals
          ? t("chief.dashboard.insights.approvalsWaiting")
          : t("chief.dashboard.insights.noApprovals"),
        action: t("chief.dashboard.insights.openQueue"),
        href: "/chief/clients",
        color: overview.metrics.pendingApprovals ? "border-yellow-500" : "border-green-500",
        icon: Monitor,
      },
    ];
  }, [overview.metrics.pendingApprovals, overview.projects, t]);

  const visibleActivity = showAllActivity ? overview.activity : overview.activity.slice(0, 3);

  function showToast(message: string) {
    setToastMsg(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2400);
  }

  function exportReport() {
    downloadExcelWorkbook("chief-dashboard-report.xls", [
      {
        name: "Metrics",
        rows: [
          ["Metric", "Value"],
          ["Clients", overview.metrics.clients],
          ["Projects", overview.metrics.projects],
          ["Project Managers", overview.metrics.projectManagers],
          ["Delayed Projects", overview.metrics.delayedProjects],
          ["Pending Approvals", overview.metrics.pendingApprovals],
          ["Active Workspaces", overview.metrics.activeWorkspaces],
        ],
      },
      {
        name: "Projects",
        rows: [
          ["Project", "Client", "PM", "Status", "Health", "Deadline", "System", "Exhibition"],
          ...overview.projects.map((project) => [
            project.name,
            project.client,
            project.pm,
            project.status,
            project.health,
            project.deadline ?? "",
            project.system,
            project.exhibition,
          ]),
        ],
      },
      {
        name: "Activity",
        rows: [
          ["Type", "User", "Action", "Project", "Time"],
          ...overview.activity.map((event) => [event.type, event.user, event.action, event.project, event.time]),
        ],
      },
    ]);
    void recordReportExport({ report: "Chief dashboard report", format: "xls" });
    showToast(t("chief.dashboard.excelExported"));
  }

  function runInsight(href: string) {
    navigate(href);
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-8">
        <PageHeader
          title={t("chief.dashboard.title")}
          breadcrumbs={[{ label: t("chief.nav.chief"), href: "/chief" }, { label: t("chief.nav.dashboard") }]}
        >
          <Button onClick={exportReport} data-testid="button-export-reports">
            <Download className="mr-2 h-4 w-4" /> {t("chief.dashboard.exportReports")}
          </Button>
        </PageHeader>

        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-red-500">
              {error}
              <button
                type="button"
                onClick={reloadData}
                className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-semibold hover:bg-red-500/10 transition-colors"
              >
                Retry
              </button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))
            : stats.map((stat, i) => (
                <StatCard key={i} {...stat} />
              ))
          }
        </div>

        {!isLoading && overview.workflow && (
          <Card className="workflow-panel-enter border-primary/20 bg-card/70">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="workflow-live-dot" aria-hidden="true" />
                    Assignment control
                  </CardTitle>
                  <CardDescription>New accounts and unassigned work that need Chief action.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/chief/managers")}>
                  Open assignments <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <WorkflowQueueTile
                  label="Pending accounts"
                  value={overview.workflow.counts.pendingClientApprovals ?? 0}
                  detail={overview.workflow.counts.pendingClientApprovals ? "Client accounts awaiting review" : "No accounts pending"}
                  tone={overview.workflow.counts.pendingClientApprovals ? "danger" : "clear"}
                  icon={UserSquare2}
                  onOpen={() => navigate("/chief/clients")}
                />
                <WorkflowQueueTile
                  label="New PMs"
                  value={overview.workflow.counts.newProjectManagers}
                  detail={overview.workflow.newProjectManagers[0]?.name ?? "No PM accounts waiting"}
                  tone={overview.workflow.counts.newProjectManagers ? "info" : "clear"}
                  icon={UserPlus}
                  onOpen={() => navigate("/chief/managers")}
                />
                <WorkflowQueueTile
                  label="Unassigned clients"
                  value={overview.workflow.counts.unassignedClients}
                  detail={overview.workflow.unassignedClients[0]?.name ?? "All clients assigned"}
                  tone={overview.workflow.counts.unassignedClients ? "warning" : "clear"}
                  icon={Users}
                  onOpen={() => navigate("/chief/managers")}
                />
                <WorkflowQueueTile
                  label="Unassigned projects"
                  value={overview.workflow.counts.unassignedProjects}
                  detail={overview.workflow.unassignedProjects[0]?.name ?? "All projects assigned"}
                  tone={overview.workflow.counts.unassignedProjects ? "warning" : "clear"}
                  icon={Briefcase}
                  onOpen={() => navigate("/chief/managers")}
                />
                <WorkflowQueueTile
                  label="Stalled approvals"
                  value={overview.workflow.counts.stalledApprovals}
                  detail={overview.workflow.approvalAging[0] ? `${overview.workflow.approvalAging[0].name} · ${overview.workflow.approvalAging[0].waitingDays}d` : "No stale approvals"}
                  tone={overview.workflow.counts.stalledApprovals ? "danger" : "clear"}
                  icon={Clock}
                  onOpen={() => navigate("/chief/clients")}
                />
                <WorkflowQueueTile
                  label="Overloaded PMs"
                  value={overview.workflow.counts.overloadedManagers}
                  detail={overview.workflow.workloadAlerts[0] ? `${overview.workflow.workloadAlerts[0].name} · ${overview.workflow.workloadAlerts[0].workload}%` : "Capacity looks stable"}
                  tone={overview.workflow.counts.overloadedManagers ? "danger" : "clear"}
                  icon={AlertCircle}
                  onOpen={() => navigate("/chief/managers")}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Activity Chart */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>{t("chief.dashboard.charts.projectActivity")}</CardTitle>
              <CardDescription>{t("chief.dashboard.charts.projectActivityDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview.charts.activity}>
                  <defs>
                    <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="projects" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorProjects)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Distribution Chart */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>{t("chief.dashboard.charts.projectStatus")}</CardTitle>
              <CardDescription>
                {t("chief.dashboard.charts.projectStatusDesc", { count: overview.metrics.projects })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-[300px] items-center justify-center">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <>
                  <ResponsiveContainer width="60%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.charts.distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {overview.charts.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`${value}%`, "Share"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-3 ml-2">
                    {overview.charts.distribution.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-xs font-medium whitespace-nowrap">{translateStatus(item.name, t)}</p>
                          <p className="text-[10px] text-muted-foreground">{item.value}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Manager Performance */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>{t("chief.dashboard.charts.managerPerformance")}</CardTitle>
              <CardDescription>{t("chief.dashboard.charts.managerPerformanceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={managerPerformance}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{fill: 'hsl(var(--muted)/0.1)'}}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="projects" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {!managerPerformance.length && (
                    <div className="mt-3 text-center text-xs text-muted-foreground">{t("chief.dashboard.noManagerAssignments")}</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("chief.dashboard.recentActivity")}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-2.5 w-1/3" />
                        </div>
                      </div>
                    ))
                  : visibleActivity.map((event) => (
                      <div key={event.id} className="flex gap-4">
                        <div className={cn(
                          "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                          event.type === 'update' ? 'bg-blue-500' :
                          event.type === 'message' ? 'bg-green-500' : 'bg-red-500'
                        )} />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">
                            {event.user} <span className="text-muted-foreground font-normal">{event.action}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{t("chief.common.project")}: {event.project}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{event.time}</p>
                        </div>
                      </div>
                    ))
                }
                {!overview.activity.length && !isLoading && (
                  <p className="text-sm text-muted-foreground">{t("chief.dashboard.noActivity")}</p>
                )}
              </div>
              <Button variant="ghost" className="mt-6 w-full text-xs text-primary" onClick={() => setShowAllActivity((value) => !value)} data-testid="button-view-all-activity">
                {showAllActivity ? t("chief.dashboard.showRecentActivity") : t("chief.dashboard.viewAllActivity")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Operational Alerts Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">{t("chief.dashboard.commandCenter")}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="bg-card/30 backdrop-blur-sm border-l-4 border-l-muted">
                    <CardHeader className="pb-2 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-8 w-12" />
                        </div>
                        <Skeleton className="h-9 w-9 rounded-lg" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                      <Skeleton className="h-8 w-full rounded-md" />
                    </CardContent>
                  </Card>
                ))
              : insights.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <Card key={i} className={cn("bg-card/30 backdrop-blur-sm border-l-4", insight.color)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm font-semibold">{insight.title}</CardTitle>
                        <p className="mt-1 text-3xl font-bold">{insight.value}</p>
                      </div>
                      <div className="rounded-lg border bg-background/50 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
                      {insight.description}
                    </p>
                    <Button variant="outline" size="sm" className="h-8 w-full text-[10px]" onClick={() => runInsight(insight.href)} data-testid={`button-insight-action-${i}`}>
                      {insight.action} <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl transition-all duration-300 ${
            toastVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          {toastMsg}
        </div>
      </div>
    </DashboardLayout>
  );
}

function WorkflowQueueTile({
  label,
  value,
  detail,
  tone,
  icon: Icon,
  onOpen,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "clear" | "info" | "warning" | "danger";
  icon: ElementType;
  onOpen: () => void;
}) {
  const toneClass = {
    clear: "border-green-500/25 bg-green-500/5 text-green-500",
    info: "border-blue-500/25 bg-blue-500/5 text-blue-500",
    warning: "border-yellow-500/25 bg-yellow-500/5 text-yellow-500",
    danger: "border-red-500/25 bg-red-500/5 text-red-500",
  }[tone];
  return (
    <button
      type="button"
      className="workflow-tile-motion rounded-lg border bg-background/40 p-4 text-left transition-colors hover:bg-muted/60"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <span className={cn("rounded-md border p-2", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p>
    </button>
  );
}

function translateStatus(name: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    Active: t("chief.common.status.active"),
    Pending: t("chief.common.status.pending"),
    Delayed: t("chief.common.status.delayed"),
    Completed: t("chief.common.status.completed"),
  };
  return map[name] ?? name;
}

function dashboardDaysUntil(date: string | null | undefined) {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function isDelayedDashboardProject(status: string, health: string) {
  const statusValue = status.toLowerCase();
  const healthValue = health.toLowerCase();
  return statusValue.includes("delay") || statusValue.includes("blocked") || healthValue.includes("risk");
}
