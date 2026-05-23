import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { getPlatformOverview, type PlatformOverview, type PlatformProject } from "@/lib/platform-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PMDashboard() {
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
        setError(err instanceof Error ? err.message : "Could not load dashboard data.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const metrics = overview?.metrics;

    return [
      { label: "Assigned Clients", value: String(metrics?.clients ?? 0), icon: Users },
      { label: "Active Projects", value: String(metrics?.projects ?? 0), icon: Briefcase },
      { label: "Pending Reviews", value: String(metrics?.pendingApprovals ?? 0), icon: Clock },
      { label: "Completed", value: String(metrics?.completedProjects ?? 0), icon: CheckCircle2 },
      { label: "Workspace Files", value: String(metrics?.activeWorkspaces ?? 0), icon: Monitor },
    ];
  }, [overview]);

  const taskItems = useMemo(() => {
    return (overview?.projects ?? []).slice(0, 6).map((project) => ({
      id: project.id,
      title: project.name,
      priority: priorityForProject(project),
      deadline: deadlineLabel(project.deadline),
      project,
    }));
  }, [overview]);

  const actionItems = useMemo(() => {
    if (!overview) return [];

    const items: Array<{
      title: string;
      description: string;
      action: string;
      color: string;
    }> = [];

    if (overview.metrics.pendingApprovals > 0) {
      items.push({
        title: `${overview.metrics.pendingApprovals} pending approvals`,
        description: "Client review work is waiting for a decision or revision request.",
        action: "Open approvals",
        color: "border-yellow-500",
      });
    }

    if (overview.metrics.delayedProjects > 0) {
      items.push({
        title: `${overview.metrics.delayedProjects} delayed projects`,
        description: "Projects need PM attention before deadlines are missed.",
        action: "Review risk",
        color: "border-red-500",
      });
    }

    if (overview.metrics.activeWorkspaces > 0) {
      items.push({
        title: `${overview.metrics.activeWorkspaces} active workspaces`,
        description: "Booth designs are available for editing, review, or submission.",
        action: "Open workspace",
        color: "border-blue-500",
      });
    }

    return items;
  }, [overview]);

  return (
    <DashboardLayout role="pm">
      <PageHeader
        title="Project Manager Dashboard"
        breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "Overview" }]}
      />

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Active Project Work
            </CardTitle>
            <Button variant="outline" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <EmptyPanel text="Loading assigned project work..." />
            ) : taskItems.length > 0 ? (
              <div className="space-y-4">
                {taskItems.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                    <div className="flex items-center gap-3">
                      <Checkbox id={`task-${task.id}`} />
                      <div>
                        <label htmlFor={`task-${task.id}`} className="text-sm font-medium leading-none cursor-pointer">
                          {task.title}
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.deadline}
                          </span>
                          <Badge variant="outline" className={cn(
                            "text-[10px] px-1 py-0 h-4",
                            task.priority === "High" ? "border-red-500/50 text-red-500 bg-red-500/10" :
                            task.priority === "Medium" ? "border-yellow-500/50 text-yellow-500 bg-yellow-500/10" :
                            "border-blue-500/50 text-blue-500 bg-blue-500/10"
                          )}>
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href="/pm/projects" aria-label={`Open ${task.project.name}`}>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel text="No active projects are assigned in PostgreSQL yet." />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 px-1">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Action Items
          </h3>
          {isLoading ? (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Loading action items...</p>
              </CardContent>
            </Card>
          ) : actionItems.length > 0 ? (
            actionItems.map((card) => (
              <Card key={card.title} className={cn("bg-card/50 backdrop-blur-sm border-l-4", card.color)}>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-sm">{card.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {card.description}
                  </p>
                  <Button variant="link" className="h-auto p-0 mt-2 text-primary text-xs font-medium" asChild>
                    <a href="/pm/projects">
                      {card.action}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">No urgent PM actions for this organization.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-8 bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <EmptyPanel text="Loading activity..." />
          ) : overview?.activity.length ? (
            <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-muted before:via-muted before:to-transparent">
              {overview.activity.map((item) => {
                const Icon = activityIcon(item.type);

                return (
                  <div key={item.id} className="relative flex items-start gap-4 pl-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background border border-border z-10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{item.user}</span> {item.action}
                        <span className="font-medium text-primary ml-1">{item.project}</span>
                      </p>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyPanel text="No activity events have been recorded yet." />
          )}
        </CardContent>
      </Card>
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

function priorityForProject(project: PlatformProject) {
  const normalized = `${project.health} ${project.status}`.toLowerCase();
  if (normalized.includes("blocked") || normalized.includes("delayed") || normalized.includes("risk")) return "High";
  if (normalized.includes("review") || normalized.includes("revision")) return "Medium";
  return "Low";
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return "No deadline";

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
}

function activityIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("comment") || normalized.includes("message")) return MessageSquare;
  if (normalized.includes("approval")) return CheckCircle2;
  if (normalized.includes("delay") || normalized.includes("risk")) return AlertCircle;
  return Clock;
}

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}
