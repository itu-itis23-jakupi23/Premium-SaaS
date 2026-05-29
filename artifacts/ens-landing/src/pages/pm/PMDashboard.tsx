import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
} from "recharts";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPlatformOverview,
  recordReportExport,
  type PlatformOverview,
  type PlatformProject,
} from "@/lib/platform-api";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  ClipboardCheck,
  ArrowRight,
  Users,
  Briefcase,
  Monitor,
  Download,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PMDashboard() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    document.title = t("pm.dashboard.title");
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    getPlatformOverview()
      .then((data) => {
        if (!isMounted) return;
        setOverview(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : t("pm.dashboard.loadError"));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [t]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2400);
  }

  function exportDashboard() {
    if (!overview) return;
    downloadExcelWorkbook(`pm-dashboard-${new Date().toISOString().slice(0, 10)}.xls`, [
      {
        name: "Projects",
        rows: [
          ["Project", "Client", "PM", "Status", "Health", "Deadline"],
          ...overview.projects.map((p) => [p.name, p.client, p.pm, p.status, p.health, p.deadline ?? ""]),
        ],
      },
      {
        name: "Activity",
        rows: [
          ["Type", "User", "Action", "Project", "Time"],
          ...overview.activity.map((e) => [e.type, e.user, e.action, e.project, e.time]),
        ],
      },
    ]);
    void recordReportExport({ report: "PM dashboard overview", format: "xls" });
    showToast(t("pm.dashboard.exported"));
  }

  const metrics = overview?.metrics;

  const stats = useMemo(() => [
    {
      label: t("pm.dashboard.stats.assignedClients"),
      value: String(metrics?.clients ?? 0),
      icon: Users,
      trend: t("pm.dashboard.stats.managedTrend"),
      trendUp: true,
      href: "/pm/clients",
    },
    {
      label: t("pm.dashboard.stats.activeProjects"),
      value: String(metrics?.projects ?? 0),
      icon: Briefcase,
      trend: t("pm.dashboard.stats.liveTrend"),
      trendUp: true,
      href: "/pm/projects",
    },
    {
      label: t("pm.dashboard.stats.pendingReviews"),
      value: String(metrics?.pendingApprovals ?? 0),
      icon: Clock,
      trend: metrics?.pendingApprovals
        ? t("pm.dashboard.stats.needsAttention")
        : t("pm.dashboard.stats.allClear"),
      trendUp: !metrics?.pendingApprovals,
      href: "/pm/requests?status=pending",
    },
    {
      label: t("pm.dashboard.stats.completed"),
      value: String(metrics?.completedProjects ?? 0),
      icon: CheckCircle2,
      trend: t("pm.dashboard.stats.deliveredTrend"),
      trendUp: true,
      href: "/pm/projects?status=completed",
    },
    {
      label: t("pm.dashboard.stats.workspaceFiles"),
      value: String(metrics?.activeWorkspaces ?? 0),
      icon: Monitor,
      trend: t("pm.dashboard.stats.workspacesOpenTrend"),
      trendUp: true,
      href: "/pm/workspace",
    },
  ], [metrics, t]);

  const taskItems = useMemo(() => {
    return (overview?.projects ?? []).slice(0, 6).map((project) => ({
      id: project.id,
      title: project.name,
      priority: priorityForProject(project),
      deadline: deadlineLabel(project.deadline, t),
      href: `/pm/projects?q=${encodeURIComponent(project.name)}`,
      project,
    }));
  }, [overview, t]);

  const actionItems = useMemo(() => {
    if (!overview) return [];
    const items: Array<{
      title: string;
      value: string;
      description: string;
      action: string;
      color: string;
      borderColor: string;
      iconColor: string;
      icon: typeof AlertCircle;
      href: string;
    }> = [];

    const delayed = overview.metrics.delayedProjects;
    const pending = overview.metrics.pendingApprovals;
    const workspaces = overview.metrics.activeWorkspaces;
    const completed = overview.metrics.completedProjects;

    items.push({
      title: t("pm.dashboard.actions.delayedProjects"),
      value: String(delayed),
      description: delayed
        ? t("pm.dashboard.actions.delayedProjectsDesc")
        : t("pm.dashboard.actions.noDelays"),
      action: t("pm.dashboard.actions.reviewRisk"),
      color: delayed ? "border-l-red-500 bg-red-500/5" : "border-l-green-500 bg-green-500/5",
      borderColor: delayed ? "border-red-500" : "border-green-500",
      iconColor: delayed ? "text-red-500" : "text-green-500",
      icon: AlertCircle,
      href: "/pm/projects?status=delayed",
    });

    items.push({
      title: t("pm.dashboard.actions.pendingApprovals"),
      value: String(pending),
      description: pending
        ? t("pm.dashboard.actions.pendingApprovalsDesc")
        : t("pm.dashboard.actions.noPending"),
      action: t("pm.dashboard.actions.openApprovals"),
      color: pending ? "border-l-yellow-500 bg-yellow-500/5" : "border-l-green-500 bg-green-500/5",
      borderColor: pending ? "border-yellow-500" : "border-green-500",
      iconColor: pending ? "text-yellow-500" : "text-green-500",
      icon: ClipboardCheck,
      href: "/pm/requests?status=pending",
    });

    items.push({
      title: t("pm.dashboard.actions.activeWorkspaces"),
      value: String(workspaces),
      description: t("pm.dashboard.actions.activeWorkspacesDesc"),
      action: t("pm.dashboard.actions.openWorkspace"),
      color: "border-l-blue-500 bg-blue-500/5",
      borderColor: "border-blue-500",
      iconColor: "text-blue-500",
      icon: Monitor,
      href: "/pm/workspace",
    });

    items.push({
      title: t("pm.dashboard.actions.completedProjects"),
      value: String(completed),
      description: t("pm.dashboard.actions.completedProjectsDesc"),
      action: t("pm.dashboard.actions.viewCompleted"),
      color: "border-l-primary bg-primary/5",
      borderColor: "border-primary",
      iconColor: "text-primary",
      icon: TrendingUp,
      href: "/pm/projects?status=completed",
    });

    return items;
  }, [overview, t]);

  return (
    <DashboardLayout role="pm">
      <div className="space-y-8">
        <PageHeader
          title={t("pm.dashboard.title")}
          breadcrumbs={[{ label: t("pm.nav.dashboard"), href: "/pm" }, { label: t("pm.dashboard.overview") }]}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={exportDashboard}
            disabled={!overview}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("pm.dashboard.export")}
          </Button>
        </PageHeader>

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))
            : stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))
          }
        </div>

        {/* Charts row */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Weekly activity AreaChart */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>{t("pm.dashboard.charts.activity")}</CardTitle>
              <CardDescription>
                {t("pm.dashboard.charts.activityDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[240px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.charts?.activity ?? []}>
                    <defs>
                      <linearGradient id="pmColorProjects" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="projects"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#pmColorProjects)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status distribution PieChart */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>{t("pm.dashboard.charts.status")}</CardTitle>
              <CardDescription>
                {t("pm.dashboard.charts.statusDesc", { count: metrics?.projects ?? 0 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-[240px] items-center justify-center">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <>
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview?.charts?.distribution ?? []}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(overview?.charts?.distribution ?? []).map((entry, index) => (
                          <Cell key={`pm-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`${value}%`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2.5 ml-2">
                    {(overview?.charts?.distribution ?? []).map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-xs font-medium whitespace-nowrap">{item.name}</p>
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

        {/* Active Projects + Command Center */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Projects list */}
          <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-primary" />
                {t("pm.dashboard.activeWork.title")}
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <a href="/pm/projects">{t("pm.dashboard.activeWork.viewAll")}</a>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                      <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  ))}
                </div>
              ) : taskItems.length > 0 ? (
                <div className="space-y-3">
                  {taskItems.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            task.priority === "high" ? "bg-red-500" :
                            task.priority === "medium" ? "bg-yellow-500" :
                            "bg-blue-500",
                          )}
                        />
                        <div>
                          <a href={task.href} className="text-sm font-medium leading-none hover:text-primary">
                            {task.title}
                          </a>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock aria-hidden="true" className="h-3 w-3" /> {task.deadline}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1 py-0 h-4",
                                task.priority === "high" ? "border-red-500/50 text-red-500 bg-red-500/10" :
                                task.priority === "medium" ? "border-yellow-500/50 text-yellow-500 bg-yellow-500/10" :
                                "border-blue-500/50 text-blue-500 bg-blue-500/10",
                              )}
                            >
                              {t(`pm.common.priority.${task.priority}`)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a
                          href={task.href}
                          aria-label={t("pm.dashboard.activeWork.openProject", { name: task.project.name })}
                        >
                          <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel text={t("pm.dashboard.activeWork.empty")} />
              )}
            </CardContent>
          </Card>

          {/* Command Center */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2 px-1">
              <ClipboardCheck aria-hidden="true" className="h-4 w-4 text-primary" />
              {t("pm.dashboard.actionItems.title")}
            </h3>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border bg-card/50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-7 w-8 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-7 w-full rounded-md" />
                </div>
              ))
            ) : (
              actionItems.map((card) => {
                const Icon = card.icon;
                return (
                  <Card
                    key={card.title}
                    className={cn("bg-card/50 backdrop-blur-sm border-l-4", card.color)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {card.title}
                          </p>
                          <p className="text-2xl font-bold mt-0.5">{card.value}</p>
                        </div>
                        <div className={cn("rounded-lg border bg-background/50 p-2", card.iconColor)}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {card.description}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[11px]"
                        asChild
                      >
                        <a href={card.href}>
                          {card.action}
                          <ArrowRight aria-hidden="true" className="ml-1.5 h-3 w-3" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Recent activity timeline */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {t("pm.dashboard.recentActivity.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="relative space-y-5 pl-10">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5 pt-1">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : overview?.activity.length ? (
              <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-muted before:via-muted before:to-transparent">
                {overview.activity.map((item) => {
                  const Icon = activityIcon(item.type);
                  return (
                    <div key={item.id} className="relative flex items-start gap-4 pl-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background border border-border z-10">
                        <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm">
                          <span className="font-semibold text-foreground">{item.user}</span>{" "}
                          {item.action}
                          <span className="font-medium text-primary ml-1">{item.project}</span>
                        </p>
                        <span className="text-xs text-muted-foreground">{item.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel text={t("pm.dashboard.recentActivity.empty")} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ARIA live toast */}
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
    </DashboardLayout>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function priorityForProject(project: PlatformProject): "high" | "medium" | "low" {
  const normalized = `${project.health} ${project.status}`.toLowerCase();
  if (normalized.includes("blocked") || normalized.includes("delayed") || normalized.includes("risk")) return "high";
  if (normalized.includes("review") || normalized.includes("revision")) return "medium";
  return "low";
}

function deadlineLabel(deadline: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!deadline) return t("pm.common.noDeadline");
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return t("pm.common.overdue", { count: Math.abs(days) });
  if (days === 0) return t("pm.common.today");
  if (days === 1) return t("pm.common.tomorrow");
  return t("pm.common.inDays", { count: days });
}

function activityIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("comment") || normalized.includes("message")) return MessageSquare;
  if (normalized.includes("approval")) return CheckCircle2;
  if (normalized.includes("delay") || normalized.includes("risk")) return AlertCircle;
  return Clock;
}

