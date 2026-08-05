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
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { getPlatformOverview, recordReportExport, type PlatformOverview } from "@/lib/platform-api";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { preloadPortalRoute } from "@/lib/route-preload";
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
    let mounted = true;
    setIsLoading(true);
    setError(null);
    getPlatformOverview()
      .then((data) => { if (mounted) { setOverview(data); setError(null); } })
      .catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : t("chief.dashboard.loadError")); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }

  useEffect(reloadData, []);

  const stats = useMemo(() => [
    { label: t("chief.dashboard.stats.totalClients"),    value: String(overview.metrics.clients),         icon: Users,       trend: t("chief.dashboard.stats.db"),       trendUp: true,                                         href: "/chief/clients" },
    { label: t("chief.dashboard.stats.activeProjects"),  value: String(overview.metrics.projects),        icon: Briefcase,   trend: t("chief.dashboard.stats.live"),     trendUp: true,                                         href: "/chief/projects" },
    { label: t("chief.dashboard.stats.managers"),        value: String(overview.metrics.projectManagers), icon: UserSquare2, trend: t("chief.dashboard.stats.assigned"), trendUp: true,                                         href: "/chief/managers" },
    { label: t("chief.dashboard.stats.delayedProjects"), value: String(overview.metrics.delayedProjects), icon: AlertCircle, trend: overview.metrics.delayedProjects ? t("chief.dashboard.stats.needsAction") : t("chief.dashboard.stats.clear"), trendUp: false, href: "/chief/projects" },
    { label: t("chief.dashboard.stats.pendingApprovals"),value: String(overview.metrics.pendingApprovals),icon: Clock,       trend: t("chief.dashboard.stats.open"),     trendUp: overview.metrics.pendingApprovals === 0,      href: "/chief/clients" },
    { label: t("chief.dashboard.stats.activeWorkspaces"),value: String(overview.metrics.activeWorkspaces),icon: Monitor,     trend: t("chief.dashboard.stats.saved"),    trendUp: true,                                         href: "/chief/workspace" },
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

  if (isLoading) {
    return (
      <DashboardLayout role="chief">
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-3.5">
        <PageHeader
          title={t("chief.dashboard.title")}
          breadcrumbs={[{ label: t("chief.nav.chief"), href: "/chief" }, { label: t("chief.nav.dashboard") }]}
        >
          <Button
            variant="outline"
            size="sm"
            onPointerEnter={() => { void preloadPortalRoute("/chief/reports")?.catch(() => undefined); }}
            onFocus={() => { void preloadPortalRoute("/chief/reports")?.catch(() => undefined); }}
            onClick={() => navigate("/chief/reports")}
          >
            {t("chief.nav.reports")}
          </Button>
          <Button size="sm" onClick={exportReport} data-testid="button-export-reports">
            <Download className="mr-1.5 h-3.5 w-3.5" /> {t("chief.dashboard.exportReports")}
          </Button>
        </PageHeader>

        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm text-red-500">
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={reloadData}
                className="shrink-0 border-red-500/30 text-red-500 hover:bg-red-500/10"
              >
                {t("chief.dashboard.retry")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-3.5 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-14" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              ))
            : stats.map((stat, i) => (
                <StatCard key={i} {...stat} />
              ))
          }
        </div>

        {isLoading ? (
          <Card className="border-border/60 bg-card/40">
            <CardHeader className="py-2.5 px-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
                <Skeleton className="h-8 w-28" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-3 space-y-2 bg-muted/20">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          overview.workflow && (
            <Card className="workflow-panel-enter border-primary/20 bg-card/70">
              <CardHeader className="py-2.5 px-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <span className="workflow-live-dot" aria-hidden="true" />
                      {t("chief.dashboard.workflow.title")}
                    </CardTitle>
                    <CardDescription className="text-xs">{t("chief.dashboard.workflow.desc")}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate("/chief/managers")}>
                    {t("chief.dashboard.workflow.openAssignments")} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                  <WorkflowQueueTile
                    label={t("chief.dashboard.workflow.pendingAccounts")}
                    value={overview.workflow.counts.pendingClientApprovals ?? 0}
                    detail={overview.workflow.counts.pendingClientApprovals ? t("chief.dashboard.workflow.pendingAccountsDetail") : t("chief.dashboard.workflow.pendingAccountsClear")}
                    tone={overview.workflow.counts.pendingClientApprovals ? "danger" : "clear"}
                    icon={UserSquare2}
                    onOpen={() => navigate("/chief/clients")}
                  />
                  <WorkflowQueueTile
                    label={t("chief.dashboard.workflow.newPMs")}
                    value={overview.workflow.counts.newProjectManagers}
                    detail={overview.workflow.newProjectManagers?.[0]?.name ?? t("chief.dashboard.workflow.newPMsClear")}
                    tone={overview.workflow.counts.newProjectManagers ? "info" : "clear"}
                    icon={UserPlus}
                    onOpen={() => navigate("/chief/managers")}
                  />
                  <WorkflowQueueTile
                    label={t("chief.dashboard.workflow.unassignedClients")}
                    value={overview.workflow.counts.unassignedClients}
                    detail={overview.workflow.unassignedClients?.[0]?.name ?? t("chief.dashboard.workflow.unassignedClientsClear")}
                    tone={overview.workflow.counts.unassignedClients ? "warning" : "clear"}
                    icon={Users}
                    onOpen={() => navigate("/chief/managers")}
                  />
                  <WorkflowQueueTile
                    label={t("chief.dashboard.workflow.unassignedProjects")}
                    value={overview.workflow.counts.unassignedProjects}
                    detail={overview.workflow.unassignedProjects?.[0]?.name ?? t("chief.dashboard.workflow.unassignedProjectsClear")}
                    tone={overview.workflow.counts.unassignedProjects ? "warning" : "clear"}
                    icon={Briefcase}
                    onOpen={() => navigate("/chief/managers")}
                  />
                  <WorkflowQueueTile
                    label={t("chief.dashboard.workflow.stalledApprovals")}
                    value={overview.workflow.counts.stalledApprovals}
                    detail={overview.workflow.approvalAging?.[0] ? `${overview.workflow.approvalAging[0].name} · ${overview.workflow.approvalAging[0].waitingDays}d` : t("chief.dashboard.workflow.stalledApprovalsClear")}
                    tone={overview.workflow.counts.stalledApprovals ? "danger" : "clear"}
                    icon={Clock}
                    onOpen={() => navigate("/chief/clients")}
                  />
                  <WorkflowQueueTile
                    label={t("chief.dashboard.workflow.overloadedPMs")}
                    value={overview.workflow.counts.overloadedManagers}
                    detail={overview.workflow.workloadAlerts?.[0] ? `${overview.workflow.workloadAlerts[0].name} · ${overview.workflow.workloadAlerts[0].workload}%` : t("chief.dashboard.workflow.overloadedPMsClear")}
                    tone={overview.workflow.counts.overloadedManagers ? "danger" : "clear"}
                    icon={AlertCircle}
                    onOpen={() => navigate("/chief/managers")}
                  />
                </div>
              </CardContent>
            </Card>
          )
        )}

        <div className="grid gap-3 lg:grid-cols-7">
          {/* Activity Chart */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="py-2.5 px-4">
              <CardTitle className="text-sm font-semibold">{t("chief.dashboard.charts.projectActivity")}</CardTitle>
              <CardDescription className="text-[11px]">{t("chief.dashboard.charts.projectActivityDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[195px] px-4 pb-2.5 pt-0">
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
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
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
            <CardHeader className="py-2.5 px-4">
              <CardTitle className="text-sm font-semibold">{t("chief.dashboard.charts.projectStatus")}</CardTitle>
              <CardDescription className="text-[11px]">
                {t("chief.dashboard.charts.projectStatusDesc", { count: overview.metrics.projects })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-[195px] items-center justify-center px-4 pb-2.5 pt-0">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <>
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.charts.distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
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
                        formatter={(value: number) => [`${value}%`, t("chief.dashboard.pieShare")]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 ml-1">
                    {overview.charts.distribution.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-[11px] font-medium whitespace-nowrap">{translateStatus(item.name, t)}</p>
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

        <div className="grid gap-3 lg:grid-cols-7">
          {/* Manager Performance */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="py-2.5 px-4">
              <CardTitle className="text-sm font-semibold">{t("chief.dashboard.charts.managerPerformance")}</CardTitle>
              <CardDescription className="text-[11px]">{t("chief.dashboard.charts.managerPerformanceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[185px] px-4 pb-2.5 pt-0">
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
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
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
                    <div className="mt-2 text-center text-xs text-muted-foreground">{t("chief.dashboard.noManagerAssignments")}</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="py-2.5 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{t("chief.dashboard.recentActivity")}</CardTitle>
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-2.5 pt-0">
              <div className="space-y-2.5">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="mt-1 h-2 w-2 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-2.5 w-1/2" />
                        </div>
                      </div>
                    ))
                  : visibleActivity.slice(0, 3).map((event) => (
                      <div key={event.id} className="flex gap-2.5">
                        <div className={cn(
                          "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                          event.type === 'update' ? 'bg-blue-500' :
                          event.type === 'message' ? 'bg-emerald-500' : 'bg-rose-500'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {event.user} <span className="text-muted-foreground font-normal">{event.action}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{t("chief.common.project")}: {event.project}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{event.time}</p>
                        </div>
                      </div>
                    ))
                }
                {!overview.activity.length && !isLoading && (
                  <p className="text-xs text-muted-foreground">{t("chief.dashboard.noActivity")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operational Alerts Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider">{t("chief.dashboard.commandCenter")}</h2>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="bg-card/30 backdrop-blur-sm border-l-4 border-l-muted">
                    <CardHeader className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-6 w-10" />
                        </div>
                        <Skeleton className="h-7 w-7 rounded-lg" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 space-y-2">
                      <Skeleton className="h-2.5 w-full" />
                      <Skeleton className="h-7 w-full rounded-md" />
                    </CardContent>
                  </Card>
                ))
              : insights.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <Card key={i} className={cn("bg-card/30 backdrop-blur-sm border-l-4 p-3", insight.color)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-xs font-semibold">{insight.title}</CardTitle>
                      <p className="mt-1 text-2xl font-bold">{insight.value}</p>
                    </div>
                    <div className="rounded-lg border bg-background/50 p-1.5 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground truncate">
                    {insight.description}
                  </p>
                  <Button variant="outline" size="sm" className="mt-2 h-7 w-full text-[10px]" onClick={() => runInsight(insight.href)} data-testid={`button-insight-action-${i}`}>
                    {insight.action} <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Button>
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
      className="workflow-tile-motion rounded-lg border bg-background/40 p-2.5 sm:p-3 text-left transition-colors hover:bg-muted/60"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
        </div>
        <span className={cn("rounded-md border p-1.5 shrink-0", toneClass)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{detail}</p>
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
