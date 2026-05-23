import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { getPlatformOverview, type PlatformOverview, type PlatformProject } from "@/lib/platform-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { MessageSquare, ArrowRight, CheckCircle2, Clock, FileText, Layout, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ClientDashboard() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : "Could not load client dashboard data.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeProject = overview?.projects[0] ?? null;
  const clientName = overview?.clients[0]?.name ?? overview?.organization?.name ?? "Client";
  const steps = buildSteps(activeProject);

  const stats = useMemo(() => {
    return [
      { label: "Project Progress", value: `${activeProject?.progress ?? 0}%`, icon: TrendingUp },
      { label: "Pending Approvals", value: String(overview?.metrics.pendingApprovals ?? 0), icon: CheckCircle2 },
      { label: "Workspace Versions", value: String(overview?.metrics.activeWorkspaces ?? 0), icon: Layout },
      { label: "Documents", value: String(overview?.metrics.documents ?? 0), icon: FileText },
    ];
  }, [activeProject, overview]);

  return (
    <DashboardLayout role="client">
      <PageHeader
        title={`Welcome back, ${clientName}`}
        breadcrumbs={[{ label: "Dashboard", href: "/client" }]}
      />

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl font-bold">
                {activeProject?.name ?? (isLoading ? "Loading project..." : "No active project")}
              </CardTitle>
              <CardDescription>{activeProject?.exhibition ?? "Project data is loaded from PostgreSQL"}</CardDescription>
            </div>
            {activeProject && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {activeProject.status}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {activeProject ? (
              <div className="mt-4 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-background/50 border">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(activeProject.pm)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{activeProject.pm}</p>
                      <p className="text-xs text-muted-foreground">Project Manager</p>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-auto" asChild>
                      <Link href="/client/messages">Messages</Link>
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium">{activeProject.progress}%</span>
                    </div>
                    <Progress value={activeProject.progress} className="h-2" />

                    <div className="relative mt-8 pt-6">
                      <div className="absolute top-0 left-0 w-full h-1 bg-muted rounded-full" />
                      <div className="absolute top-0 left-0 h-1 bg-primary rounded-full transition-all duration-500" style={{ width: `${activeProject.progress}%` }} />
                      <div className="flex justify-between">
                        {steps.map((step) => (
                          <div key={step.label} className="flex flex-col items-center gap-2 -mt-1.5">
                            <div className={`w-3 h-3 rounded-full border-2 bg-background z-10 ${
                              step.status === "completed" ? "border-primary bg-primary" :
                              step.status === "active" ? "border-primary animate-pulse" :
                              "border-muted"
                            }`} />
                            <span className={`text-[10px] font-medium uppercase tracking-wider ${
                              step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                            }`}>
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-48">
                  <Link href="/client/workspace">
                    <div className="group relative aspect-square rounded-lg border-2 border-dashed border-primary/30 bg-background/50 flex flex-col items-center justify-center p-4 cursor-pointer hover:border-primary/60 transition-colors">
                      <div className="w-full h-full relative" style={{ perspective: "800px" }}>
                        <div className="absolute inset-4 border-2 border-primary/20 rounded rotate-x-12 rotate-y-12 transition-transform group-hover:scale-110" style={{ transformStyle: "preserve-3d", transform: "rotateX(30deg) rotateY(-20deg)" }}>
                          <div className="absolute inset-0 bg-primary/5 border border-primary/20" />
                          <div className="absolute -right-4 bottom-0 w-4 h-12 bg-primary/10 border border-primary/20" />
                        </div>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                        <p className="text-xs font-bold text-primary">VIEW WORKSPACE</p>
                        <ArrowRight className="h-4 w-4 text-primary mt-1" />
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground uppercase font-bold">Workspace Preview</p>
                    </div>
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyPanel text={isLoading ? "Loading active project..." : "No active project has been assigned yet."} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <EmptyPanel text="Loading activity..." />
              ) : overview?.activity.length ? (
                overview.activity.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px]">{initials(item.user)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold">{item.user}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.action} {item.project}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{item.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel text="No activity has been recorded yet." />
              )}
              <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                <Link href="/client/projects">View Project Timeline</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Approval Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ApprovalRow done={Boolean(activeProject && activeProject.progress >= 20)} label="Project Created" value={activeProject?.lastUpdate ?? ""} />
                <ApprovalRow done={Boolean(activeProject && activeProject.progress >= 45)} label="Design In Progress" value={activeProject?.system ?? ""} />
                <ApprovalRow done={Boolean(activeProject && activeProject.progress >= 65)} label="Client Review" value={overview?.metrics.pendingApprovals ? "Review required" : "No pending review"} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ApprovalRow({ done, label, value }: { done: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className={`flex items-center gap-2 ${done ? "text-green-500" : "text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        <span>{label}</span>
      </div>
      {value && <span className="text-muted-foreground">{value}</span>}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function buildSteps(project: PlatformProject | null) {
  const progress = project?.progress ?? 0;
  const labels = [
    { label: "Created", threshold: 1 },
    { label: "Designing", threshold: 35 },
    { label: "Review", threshold: 65 },
    { label: "Approved", threshold: 85 },
    { label: "Production", threshold: 95 },
  ];

  return labels.map((step) => ({
    label: step.label,
    status: progress >= step.threshold ? "completed" : progress >= step.threshold - 20 ? "active" : "pending",
  }));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "NA";
}
