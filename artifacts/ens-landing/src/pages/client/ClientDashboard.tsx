import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import {
  getPlatformOverview,
  type PlatformOverview,
  type PlatformProject,
} from "@/lib/platform-api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Layout,
  Lock,
  Send,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ClientDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = t("client.dashboard.pageTitle");
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
        setError(
          err instanceof Error ? err.message : t("client.dashboard.errorLoad"),
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const activeProject = overview?.projects[0] ?? null;
  const projectStatus = activeProject?.status.toLowerCase() ?? "";
  const hasReviewReady =
    projectStatus.includes("client review") ||
    projectStatus.includes("revision") ||
    projectStatus.includes("review");
  const clientName =
    user?.name ??
    overview?.clients[0]?.contactName ??
    overview?.clients[0]?.name ??
    overview?.organization?.name ??
    t("client.dashboard.defaultClientName");

  const stats = useMemo(
    () => [
      {
        label: t("client.dashboard.stat.progress"),
        value: `${activeProject?.progress ?? 0}%`,
        icon: TrendingUp,
      },
      {
        label: t("client.dashboard.stat.pendingApprovals"),
        value: String(overview?.metrics.pendingApprovals ?? 0),
        icon: CheckCircle2,
      },
      {
        label: t("client.dashboard.stat.workspaceVersions"),
        value: String(overview?.metrics.activeWorkspaces ?? 0),
        icon: Layout,
      },
      {
        label: t("client.dashboard.stat.documents"),
        value: String(overview?.metrics.documents ?? 0),
        icon: FileText,
      },
    ],
    [t, activeProject, overview],
  );

  const steps = useMemo(() => {
    const progress = activeProject?.progress ?? 0;
    const stepDefs = [
      { key: "created", threshold: 1 },
      { key: "designing", threshold: 35 },
      { key: "review", threshold: 65 },
      { key: "approved", threshold: 85 },
      { key: "production", threshold: 95 },
    ] as const;
    return stepDefs.map((step) => ({
      label: t(`client.dashboard.step.${step.key}`),
      status:
        progress >= step.threshold
          ? "completed"
          : progress >= step.threshold - 20
            ? "active"
            : "pending",
    }));
  }, [activeProject, t]);

  if (isLoading) {
    return (
      <DashboardLayout role="client">
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="client">
      <PageHeader
        title={t("client.dashboard.welcome", { name: clientName })}
        breadcrumbs={[
          { label: t("client.dashboard.breadcrumb"), href: "/client" },
        ]}
      />

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {!isLoading && !activeProject && (
        <Card className="mt-6 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="grid gap-4 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/30 bg-background text-yellow-500">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{t("client.dashboard.waitingTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("client.dashboard.waitingDesc")}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/client/messages">{t("client.dashboard.messageTeamBtn")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && activeProject && hasReviewReady && (
        <Card className="mt-6 overflow-hidden border-primary/40 bg-primary/10">
          <CardContent className="grid gap-4 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-background text-primary shadow-sm">
              <Send className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{t("client.dashboard.reviewTitle")}</h2>
                <Badge variant="outline" className="border-primary/30 bg-background/80 text-primary">
                  {activeProject.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("client.dashboard.reviewDesc", { name: activeProject.name })}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
              <Button asChild>
                <Link href="/client/workspace">{t("client.dashboard.openWorkspaceBtn")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/client/approvals">{t("client.dashboard.reviewApprovalBtn")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 mt-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl font-bold">
                {activeProject?.name ??
                  (isLoading
                    ? t("client.dashboard.loadingProject")
                    : t("client.dashboard.noActiveProject"))}
              </CardTitle>
              <CardDescription>
                {activeProject?.exhibition ??
                  t("client.dashboard.projectSubtitle")}
              </CardDescription>
            </div>
            {activeProject && (
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20"
              >
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
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {initials(activeProject.pm)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{activeProject.pm}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("client.dashboard.pmLabel")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      asChild
                    >
                      <Link href="/client/messages">
                        {t("client.dashboard.messagesBtn")}
                      </Link>
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("client.dashboard.overallProgress")}
                      </span>
                      <span className="font-medium">
                        {activeProject.progress}%
                      </span>
                    </div>
                    <Progress
                      value={activeProject.progress}
                      className="h-2"
                      aria-label={t("client.dashboard.overallProgress")}
                    />

                    <div className="relative mt-8 pt-6">
                      <div className="absolute top-0 left-0 w-full h-1 bg-muted rounded-full" />
                      <div
                        className="absolute top-0 left-0 h-1 bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${activeProject.progress}%` }}
                      />
                      <div className="flex justify-between">
                        {steps.map((step) => (
                          <div
                            key={step.label}
                            className="flex flex-col items-center gap-2 -mt-1.5"
                          >
                            <div
                              className={`w-3 h-3 rounded-full border-2 bg-background z-10 ${
                                step.status === "completed"
                                  ? "border-primary bg-primary"
                                  : step.status === "active"
                                    ? "border-primary animate-pulse"
                                    : "border-muted"
                              }`}
                            />
                            <span
                              className={`text-[10px] font-medium uppercase tracking-wider ${
                                step.status === "pending"
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
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
                    <div
                      className="group relative aspect-square rounded-lg border-2 border-dashed border-primary/30 bg-background/50 flex flex-col items-center justify-center p-4 cursor-pointer hover:border-primary/60 transition-colors"
                      aria-label={t("client.dashboard.viewWorkspace")}
                    >
                      <div
                        className="w-full h-full relative"
                        style={{ perspective: "800px" }}
                      >
                        <div
                          className="absolute inset-4 border-2 border-primary/20 rounded transition-transform group-hover:scale-110"
                          style={{
                            transformStyle: "preserve-3d",
                            transform: "rotateX(30deg) rotateY(-20deg)",
                          }}
                          aria-hidden="true"
                        >
                          <div className="absolute inset-0 bg-primary/5 border border-primary/20" />
                          <div className="absolute -right-4 bottom-0 w-4 h-12 bg-primary/10 border border-primary/20" />
                        </div>
                      </div>
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                        aria-hidden="true"
                      >
                        <p className="text-xs font-bold text-primary">
                          {t("client.dashboard.viewWorkspace")}
                        </p>
                        <ArrowRight
                          className="h-4 w-4 text-primary mt-1"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground uppercase font-bold">
                        {t("client.dashboard.workspacePreview")}
                      </p>
                    </div>
                  </Link>
                </div>
              </div>
            ) : (
              isLoading ? (
                <EmptyPanel text={t("client.dashboard.loadingActiveProject")} />
              ) : (
                <div className="rounded-lg border border-dashed border-yellow-500/30 bg-background/50 px-4 py-8 text-center">
                  <Lock className="mx-auto h-6 w-6 text-yellow-500" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">{t("client.dashboard.workspaceLocked")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("client.dashboard.workspaceLockedDesc")}</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageSquare
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                {t("client.dashboard.recentActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <EmptyPanel text={t("client.dashboard.loadingActivity")} />
              ) : overview?.activity.length ? (
                overview.activity.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px]">
                        {initials(item.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold">{item.user}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.action} {item.project}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {item.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel text={t("client.dashboard.noActivity")} />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                asChild
              >
                <Link href="/client/projects">
                  {t("client.dashboard.viewTimeline")}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                {t("client.dashboard.approvalProgress")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ApprovalRow
                  done={Boolean(
                    activeProject && activeProject.progress >= 20,
                  )}
                  label={t("client.dashboard.approval.created")}
                  value={activeProject?.lastUpdate ?? ""}
                />
                <ApprovalRow
                  done={Boolean(
                    activeProject && activeProject.progress >= 45,
                  )}
                  label={t("client.dashboard.approval.designing")}
                  value={activeProject?.system ?? ""}
                />
                <ApprovalRow
                  done={Boolean(
                    activeProject && activeProject.progress >= 65,
                  )}
                  label={t("client.dashboard.approval.review")}
                  value={
                    overview?.metrics.pendingApprovals
                      ? t("client.dashboard.approval.reviewRequired")
                      : t("client.dashboard.approval.noReview")
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ApprovalRow({
  done,
  label,
  value,
}: {
  done: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div
        className={`flex items-center gap-2 ${done ? "text-green-500" : "text-muted-foreground"}`}
      >
        {done ? (
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Clock className="h-3 w-3" aria-hidden="true" />
        )}
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

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NA"
  );
}
