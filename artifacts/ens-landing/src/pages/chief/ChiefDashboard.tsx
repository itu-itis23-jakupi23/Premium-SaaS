import { useEffect, useMemo, useState } from "react";
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
import { getPlatformOverview, type PlatformOverview } from "@/lib/platform-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  ArrowRight, 
  BrainCircuit, 
  Briefcase,
  Clock, 
  Download,
  AlertCircle,
  Monitor,
  UserSquare2,
  Users
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
};

export default function ChiefDashboard() {
  const [, navigate] = useLocation();
  const [overview, setOverview] = useState<PlatformOverview>(EMPTY_OVERVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [toast, setToast] = useState("");

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
        setError(reason instanceof Error ? reason.message : "Unable to load dashboard data");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => [
    { label: "Total Clients", value: String(overview.metrics.clients), icon: Users, trend: "DB", trendUp: true },
    { label: "Active Projects", value: String(overview.metrics.projects), icon: Briefcase, trend: "Live", trendUp: true },
    { label: "Managers", value: String(overview.metrics.projectManagers), icon: UserSquare2, trend: "Assigned", trendUp: true },
    { label: "Delayed Projects", value: String(overview.metrics.delayedProjects), icon: AlertCircle, trend: overview.metrics.delayedProjects ? "Needs action" : "Clear", trendUp: false },
    { label: "Pending Approvals", value: String(overview.metrics.pendingApprovals), icon: Clock, trend: "Open", trendUp: overview.metrics.pendingApprovals === 0 },
    { label: "Active Workspaces", value: String(overview.metrics.activeWorkspaces), icon: Monitor, trend: "Saved", trendUp: true },
  ], [overview.metrics]);

  const managerPerformance = useMemo(() => {
    const byPm = new Map<string, number>();
    overview.projects.forEach((project) => {
      byPm.set(project.pm, (byPm.get(project.pm) ?? 0) + 1);
    });
    return Array.from(byPm, ([name, projects]) => ({ name, projects }));
  }, [overview.projects]);

  const insights = useMemo(() => [
    {
      title: `${overview.metrics.delayedProjects} delayed projects`,
      description: overview.metrics.delayedProjects
        ? "Review blocked or delayed projects before assigning new work."
        : "No delayed projects are currently recorded in PostgreSQL.",
      action: "Review",
      color: overview.metrics.delayedProjects ? "border-red-500" : "border-green-500",
    },
    {
      title: `${overview.metrics.pendingApprovals} pending approvals`,
      description: overview.metrics.pendingApprovals
        ? "Client approvals are waiting for action."
        : "No approval bottleneck is currently recorded.",
      action: "Open Queue",
      color: overview.metrics.pendingApprovals ? "border-yellow-500" : "border-green-500",
    },
    {
      title: `${overview.metrics.activeWorkspaces} active workspaces`,
      description: "Workspace count is pulled from saved booth designs in PostgreSQL.",
      action: "Monitor",
      color: "border-blue-500",
    },
    {
      title: overview.organization?.plan ? `${overview.organization.plan} plan` : "No organization",
      description: overview.organization
        ? `${overview.organization.name} is the active tenant for this database-backed view.`
        : "Create an organization to start tracking live SaaS data.",
      action: "Settings",
      color: "border-primary",
    },
  ], [overview]);

  const visibleActivity = showAllActivity ? overview.activity : overview.activity.slice(0, 3);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function exportReport() {
    const rows = [
      ["Metric", "Value"],
      ["Clients", overview.metrics.clients],
      ["Projects", overview.metrics.projects],
      ["Project Managers", overview.metrics.projectManagers],
      ["Delayed Projects", overview.metrics.delayedProjects],
      ["Pending Approvals", overview.metrics.pendingApprovals],
      ["Active Workspaces", overview.metrics.activeWorkspaces],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "chief-dashboard-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Report exported");
  }

  function runInsight(action: string) {
    if (action === "Review") navigate("/chief/projects");
    else if (action === "Open Queue") navigate("/chief/clients");
    else if (action === "Monitor") navigate("/chief/workspace-monitor");
    else if (action === "Settings") navigate("/chief/settings");
    else showToast(`${action} opened`);
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-8">
        <PageHeader 
          title="Chief Dashboard" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Dashboard" }]}
        >
          <Button onClick={exportReport} data-testid="button-export-reports">
            <Download className="mr-2 h-4 w-4" /> Export Reports
          </Button>
        </PageHeader>

        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-500">
              {error}
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Activity Chart */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Project Activity</CardTitle>
              <CardDescription>Activity across all projects over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
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
            </CardContent>
          </Card>

          {/* Distribution Chart */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Project Status</CardTitle>
              <CardDescription>Overall project health distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
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
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 ml-4">
                {overview.charts.distribution.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.name} ({item.value}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Manager Performance */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Manager Performance</CardTitle>
              <CardDescription>Projects assigned per manager from PostgreSQL</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
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
              {!managerPerformance.length && !isLoading && (
                <div className="mt-3 text-center text-xs text-muted-foreground">No manager assignments found.</div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {visibleActivity.map((event) => (
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
                      <p className="text-xs text-muted-foreground">Project: {event.project}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{event.time}</p>
                    </div>
                  </div>
                ))}
                {!overview.activity.length && !isLoading && (
                  <p className="text-sm text-muted-foreground">No activity has been recorded yet.</p>
                )}
              </div>
              <Button variant="ghost" className="mt-6 w-full text-xs text-primary" onClick={() => setShowAllActivity((value) => !value)} data-testid="button-view-all-activity">
                {showAllActivity ? "Show Recent Activity" : "View All Activity"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">AI Management Insights</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {insights.map((insight, i) => (
              <Card key={i} className={cn("bg-card/30 backdrop-blur-sm border-l-4", insight.color)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                  <Button variant="outline" size="sm" className="w-full text-[10px] h-8" onClick={() => runInsight(insight.action)} data-testid={`button-insight-action-${i}`}>
                    {insight.action} <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
