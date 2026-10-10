import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { HelpHint } from "@/components/HelpHint";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { getPlatformProjects, type PlatformProject } from "@/lib/platform-api";
import { projectStatusLabel, projectStatusStyle } from "@/lib/project-status";
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  MessageSquare,
  FileText,
  History,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function ProgressBar({ value }: { value: number }) {
  const c =
    value >= 80 ? "#2f7d3a" : value >= 40 ? "#1d4ed8" : "#c2410c";
  return (
    <div
      style={{
        height: 5,
        borderRadius: 3,
        background: "#e5e7eb",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${value}%`,
          background: c,
          borderRadius: 3,
        }}
      />
    </div>
  );
}

function getTimeline(
  p: PlatformProject,
  fallbackLabel: string,
  fallbackDate: string,
  fallbackBadge: string,
  formatMove: (fromStage: string | null | undefined, toStage: string) => string,
  formatDate: (iso: string) => string,
  formatBadge: (toStatus: string | null | undefined, toStage: string) => string,
) {
  const events: { icon: React.ElementType; color: string; label: string; date: string; badge: string }[] = [];
  if (p.lifecycleHistory?.length) {
    events.push(...p.lifecycleHistory.slice(-5).reverse().map((item) => ({
      icon: History,
      color: "#7c3aed",
      label: formatMove(item.fromStage, item.toStage),
      // `item.time` is a relative string the *server* built in English ("2 days
      // ago"), so it stayed English in all eleven locales. The ISO timestamp
      // next to it formats in the reader's language instead.
      date: formatDate(item.createdAt || item.time),
      badge: formatBadge(item.toStatus, item.toStage),
    })));
  }
  if (events.length === 0) {
    events.push({ icon: Layers, color: "#1d4ed8", label: fallbackLabel, date: fallbackDate, badge: fallbackBadge });
  }
  return events.slice(0, 5);
}

function formatProjectDate(date: string | null, locale: string, noDate: string) {
  if (!date) return noDate;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "2-digit" });
}

export default function ClientProjects() {
  const { t, i18n } = useTranslation();
  const [projects, setProjects] = useState<PlatformProject[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = t("client.projects.pageTitle");
  }, [t]);

  /** `withSpinner` is false for the background poll - see ClientQuotes. */
  const load = useCallback(async (withSpinner = true) => {
    if (withSpinner) setIsLoading(true);
    setError("");
    try {
      const response = await getPlatformProjects({ limit: 50 });
      setProjects(response.projects);
      setExpanded((current) => current ?? response.projects[0]?.id ?? null);
    } catch {
      // Only a visible load clears the list. A background poll that fails on a
      // transient blip must not empty a page the client is reading - it shows
      // the banner and leaves the last good data in place.
      if (withSpinner) {
        setProjects([]);
        setExpanded(null);
      }
      // Deliberately not `reason.message`: that puts raw API or network text
      // in front of a client who can do nothing with it, and occasionally
      // leaks internals. The retry button is the useful part.
      setError(t("client.projects.loadError"));
    } finally {
      if (withSpinner) setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // A PM can move a project on while the client has this page open; the status
  // badges and progress bars here are exactly what goes stale.
  useLiveRefresh(() => load(false), { intervalMs: 60_000 });

  const stats = useMemo(
    () => [
      {
        l: t("client.projects.stat.total"),
        v: projects.length,
        c: "text-foreground",
      },
      {
        l: t("client.projects.stat.active"),
        v: projects.filter((p) => p.status === "Active").length,
        c: "text-green-600",
      },
      {
        l: t("client.projects.stat.pendingReview"),
        v: projects.filter((p) => p.status === "Pending").length,
        c: "text-orange-600",
      },
      {
        l: t("client.projects.stat.avgProgress"),
        v: projects.length ? `${Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)}%` : "0%",
        c: "text-blue-600",
      },
    ],
    [projects, t],
  );

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        <PageHeader
          title={t("client.projects.title")}
          breadcrumbs={[
            {
              label: t("client.projects.breadcrumbDashboard"),
              href: "/client",
            },
            { label: t("client.projects.breadcrumbProjects") },
          ]}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="border rounded-lg p-4 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                {s.l}
              </p>
              <p className={`text-2xl font-bold font-mono ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Project cards */}
        <div className="space-y-3">
          {error && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
              <Button
                variant="outline"
                className="ms-2 min-h-11"
                disabled={isLoading}
                onClick={() => void load()}
              >
                {t("experience.retry")}
              </Button>
            </div>
          )}

          {isLoading && Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((__, i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            </div>
          ))}

          {!isLoading && !error && projects.length === 0 && (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center">
              <p className="text-sm font-semibold">{t("client.projects.emptyTitle")}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t("client.projects.emptyDesc")}</p>
            </div>
          )}

          {projects.map((project) => {
            const sc = projectStatusStyle(project.status);
            const isExp = expanded === project.id;
            const hasAction = project.status === "Pending" || project.status === "Client Review";
            const stageLabel = (stage: string) => t(`client.projects.stage.${stage}`, { defaultValue: stage });
            const timeline = getTimeline(
              project,
              t("client.projects.timeline.defaultLabel"),
              t("client.projects.timeline.defaultDate"),
              t("client.projects.status.Active"),
              (from, to) => from
                ? t("client.projects.timeline.movedFromTo", { from: stageLabel(from), to: stageLabel(to) })
                : t("client.projects.timeline.movedTo", { to: stageLabel(to) }),
              (iso) => formatProjectDate(
                iso ? iso.slice(0, 10) : null,
                i18n.language,
                t("client.projects.meta.noDate"),
              ),
              (toStatus, toStage) => toStatus
                ? t(`client.projects.status.${projectStatusLabel(toStatus)}`, { defaultValue: projectStatusLabel(toStatus) })
                : stageLabel(toStage),
            );

            const metaItems = [
              {
                label: t("client.projects.meta.system"),
                value: project.system?.toUpperCase() ?? "OCTANORM",
              },
              {
                label: t("client.projects.meta.size"),
                value: project.dimensions ?? "—",
              },
              { label: t("client.projects.meta.pm"), value: project.pm },
              {
                label: t("client.projects.meta.deadline"),
                value: formatProjectDate(project.deadline, i18n.language, t("client.projects.meta.noDate")),
              },
            ];

            return (
              <div
                key={project.id}
                className="border rounded-lg bg-card overflow-hidden hover:border-primary/30 transition-all"
                style={hasAction ? { borderColor: "rgba(217,119,6,0.4)" } : {}}
              >
                {/* Row header */}
                <div
                  className="p-4 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExp}
                  aria-controls={`project-detail-${project.id}`}
                  onClick={() => setExpanded(isExp ? null : project.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    // Space on a role="button" scrolls the page unless stopped,
                    // so keyboard users jumped down the list on every toggle.
                    e.preventDefault();
                    setExpanded(isExp ? null : project.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-sm leading-tight">
                          {project.name}
                        </h3>
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                          style={{
                            background: sc.bg,
                            color: sc.text,
                            border: `1px solid ${sc.border}`,
                          }}
                        >
                          {/* No `|| project.status` fallback: i18next returns the
                              key itself on a miss, which is truthy, so it could
                              never run. Every status the API can produce is a
                              real key - locale-coverage.test.ts proves it from
                              the project_status enum. */}
                          {t(`client.projects.status.${project.status}`)}
                        </span>
                        {hasAction && (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 animate-pulse">
                            <AlertCircle
                              className="h-2.5 w-2.5"
                              aria-hidden="true"
                            />
                            {t("client.projects.actionRequired")}
                          </span>
                        )}
                        {hasAction && (
                          <HelpHint
                            title="help.projects.actionRequired.title"
                            body="help.projects.actionRequired.body"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {project.exhibition ??
                          t("client.projects.exhibitionTbd")}
                      </p>
                    </div>
                    <span
                      className="text-muted-foreground p-1 transition-transform flex-shrink-0 pointer-events-none"
                      style={{ transform: isExp ? "rotate(180deg)" : "none" }}
                      aria-hidden="true"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {metaItems.map((m) => (
                      <div key={m.label} className="bg-muted/30 rounded p-2">
                        <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                          {m.label}
                        </p>
                        <p className="text-[11px] font-semibold font-mono mt-0.5 truncate">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                      <span className="flex items-center gap-1.5">
                        {t("client.projects.productionProgress")}
                        <HelpHint
                          title="help.projects.progress.title"
                          body="help.projects.progress.body"
                          note="help.projects.progress.note"
                        />
                      </span>
                      <span>{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} />
                  </div>
                </div>

                {/* Expanded: timeline + actions */}
                {isExp && (
                  <div
                    id={`project-detail-${project.id}`}
                    className="border-t bg-muted/10 p-5 grid grid-cols-1 gap-6 md:grid-cols-3"
                  >
                    {/* Timeline */}
                    <div className="md:col-span-2">
                      <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t("client.projects.timeline.heading")}
                        <HelpHint
                          title="help.projects.timeline.title"
                          body="help.projects.timeline.body"
                        />
                      </p>
                      <div className="space-y-2.5">
                        {timeline.map((ev, i) => {
                          const Icon = ev.icon;
                          return (
                            <div key={i} className="flex items-start gap-3">
                              <div
                                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ background: `${ev.color}14` }}
                                aria-hidden="true"
                              >
                                <Icon
                                  className="h-3.5 w-3.5"
                                  style={{ color: ev.color }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[11.5px] font-medium">
                                    {ev.label}
                                  </p>
                                  <span
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                                    style={{
                                      color: ev.color,
                                      borderColor: `${ev.color}30`,
                                      background: `${ev.color}08`,
                                    }}
                                  >
                                    {ev.badge}
                                  </span>
                                </div>
                                <p className="text-[9.5px] font-mono text-muted-foreground mt-0.5">
                                  {ev.date}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t("client.projects.quickActions")}
                        <HelpHint
                          title="help.projects.actions.title"
                          body="help.projects.actions.body"
                          note="help.projects.actions.note"
                        />
                      </p>
                      <div className="space-y-2">
                        <Link href={`/client/workspace?project=${encodeURIComponent(project.id)}`} className="w-full flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-md px-3 py-2.5 text-xs font-semibold hover:bg-primary hover:text-white transition-colors">
                            <Layers
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {t("client.projects.action.viewDesign")}
                          </Link>
                        <Link href={`/client/approvals?project=${encodeURIComponent(project.id)}`} className={`w-full flex items-center gap-2 border rounded-md px-3 py-2.5 text-xs font-semibold transition-colors ${
                              hasAction
                                ? "border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-600 hover:text-white"
                                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                            }`}>
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {hasAction
                              ? t("client.projects.action.reviewPending")
                              : t("client.projects.action.approvals")}
                          </Link>
                        <Link href="/client/documents" className="w-full flex items-center gap-2 border rounded-md px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                            <FileText
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {t("client.projects.action.documents")}
                          </Link>
                        <Link href={`/client/messages?project=${encodeURIComponent(project.id)}`} className="w-full flex items-center gap-2 border rounded-md px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                            <MessageSquare
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {t("client.projects.action.messagePm")}
                          </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
