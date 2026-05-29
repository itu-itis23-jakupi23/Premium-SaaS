import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useDebounce } from "@/hooks/useDebounce";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  getPlatformClients,
  updatePlatformClientStatus,
  type PlatformClient,
  type PlatformClientSummary,
  type PlatformPagination,
} from "@/lib/platform-api";
import {
  Search, Monitor, Mail, Building2, CheckCircle2,
  Clock, AlertCircle, Layers, Users, ArrowUpRight, X, MessageSquare, type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Active:   { bg: "rgba(47,125,58,0.1)",   text: "#2f7d3a" },
  Lead:     { bg: "rgba(29,78,216,0.1)",   text: "#1d4ed8" },
  Pending:  { bg: "rgba(194,65,12,0.1)",   text: "#c2410c" },
  Inactive: { bg: "rgba(107,114,128,0.12)", text: "#6b7280" },
};

const PAGE_SIZE = 12;
const EMPTY_PAGINATION: PlatformPagination = { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false };
const EMPTY_SUMMARY: PlatformClientSummary = { total: 0, active: 0, needsSetup: 0 };

export default function PMClients() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState<PlatformClient | null>(null);
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [pagination, setPagination] = useState<PlatformPagination>(EMPTY_PAGINATION);
  const [summary, setSummary] = useState<PlatformClientSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = t("pm.clients.title");
  }, [t]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    getPlatformClients({
      q: debouncedSearch,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((data) => {
        if (!mounted) return;
        setClients(data.clients);
        setPagination(data.pagination);
        setSummary(data.summary ?? EMPTY_SUMMARY);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setClients([]);
        setPagination({ ...EMPTY_PAGINATION, offset: page * PAGE_SIZE });
        setSummary(EMPTY_SUMMARY);
        setError(err instanceof Error ? err.message : t("pm.clients.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [debouncedSearch, page, t]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const pageStart = pagination.total ? pagination.offset + 1 : 0;
  const pageEnd = Math.min(pagination.offset + clients.length, pagination.total);

  function clientStatusLabel(status: string): string {
    const map: Record<string, string> = {
      Active:   t("pm.common.status.active"),
      Lead:     t("pm.common.status.lead"),
      Pending:  t("pm.common.status.pending"),
      Inactive: t("pm.common.status.inactive"),
    };
    return map[status] ?? status;
  }

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader
          title={t("pm.clients.title")}
          breadcrumbs={[{ label: t("pm.nav.dashboard"), href: "/pm" }, { label: t("pm.nav.myClients") }]}
        >
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("pm.clients.searchPlaceholder")}
              aria-label={t("pm.clients.searchPlaceholder")}
              className="pl-8 pr-3 h-8 text-xs border rounded-md bg-muted/30 outline-none focus:border-primary w-48"
            />
          </div>
        </PageHeader>

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
                <Skeleton className="h-8 w-14 mt-2" />
              </div>
            ))
          ) : (
            ([
              [t("pm.clients.stats.total"),      summary.total,      "text-foreground", Users],
              [t("pm.clients.stats.active"),     summary.active,     "text-green-600",  CheckCircle2],
              [t("pm.clients.stats.needsSetup"), summary.needsSetup, "text-orange-600", AlertCircle],
            ] satisfies Array<[string, number, string, LucideIcon]>).map(([label, value, color, Icon]) => (
              <div key={label as string} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label as string}</p>
                  <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className={`text-2xl font-bold font-mono mt-2 ${color as string}`}>{value as number}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-lg bg-card overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Skeleton className="h-6 w-28 rounded" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              </div>
            ))
          ) : clients.length > 0 ? (
            clients.map((client) => {
              const sc = STATUS_COLOR[client.status] ?? STATUS_COLOR.Pending;

              return (
                <div key={client.id} className="border rounded-lg bg-card overflow-hidden hover:border-primary/30 transition-all">
                  <div
                    role="button"
                    tabIndex={0}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer"
                    aria-label={t("pm.clients.actions.openDetails", { name: client.name })}
                    onClick={() => setSelectedClient(client)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedClient(client); } }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-bold text-primary">{initials(client.name)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{client.name}</span>
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            {clientStatusLabel(client.status)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {client.contactName} / {client.contactEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-mono bg-muted/50 border rounded px-2 py-0.5 max-w-[180px] truncate">
                        {client.exhibition}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/pm/messages?contactId=${encodeURIComponent(client.id)}`);
                        }}
                        title={t("pm.clients.actions.message")}
                        aria-label={t("pm.clients.actions.messageClient", { name: client.name })}
                        className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/30 transition-colors"
                      >
                        <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      {client.projectId ? (
                        <Link href={`/pm/workspace?projectId=${encodeURIComponent(client.projectId)}`}>
                          <button
                            onClick={(event) => event.stopPropagation()}
                            title={t("pm.clients.actions.openWorkspace")}
                            aria-label={t("pm.clients.actions.openWorkspaceFor", { name: client.name })}
                            className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/30 transition-colors"
                          >
                            <Monitor aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          onClick={(event) => event.stopPropagation()}
                          title={t("pm.clients.actions.noWorkspace")}
                          aria-label={t("pm.clients.actions.noWorkspace")}
                          className="p-2 rounded-md text-muted-foreground border border-border opacity-40"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setSelectedClient(client); }}
                        aria-label={t("pm.clients.actions.openDetails", { name: client.name })}
                        className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/30 transition-colors"
                      >
                        <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState text={t("pm.clients.noMatch")} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">
          <span>{t("pm.clients.paging.showing", { start: pageStart, end: pageEnd, total: pagination.total })}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={isLoading || pagination.offset === 0}
              className="rounded-md border px-3 py-1.5 font-semibold transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pm.common.previous")}
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={isLoading || !pagination.hasMore}
              className="rounded-md border px-3 py-1.5 font-semibold transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pm.common.next")}
            </button>
          </div>
        </div>
      </div>

      {selectedClient && (
        <ClientDetailDrawer
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onMessage={() => navigate(`/pm/messages?contactId=${encodeURIComponent(selectedClient.id)}`)}
          onStatusChange={(newStatus) => {
            setSelectedClient((prev) => prev ? { ...prev, status: newStatus } : null);
            setClients((prev) => prev.map((c) => c.id === selectedClient.id ? { ...c, status: newStatus } : c));
          }}
          t={t}
        />
      )}
    </DashboardLayout>
  );
}

function DetailRow({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <div className="w-7 h-7 rounded bg-muted/50 flex items-center justify-center flex-shrink-0">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

const CLIENT_STATUS_OPTIONS = ["Active", "Lead", "Pending", "Inactive"] as const;

function ClientDetailDrawer({ client, onClose, onMessage, onStatusChange, t }: { client: PlatformClient; onClose: () => void; onMessage: () => void; onStatusChange: (newStatus: string) => void; t: TFn }) {
  const [localStatus, setLocalStatus] = useState(client.status);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const statusCfg = STATUS_COLOR[localStatus] ?? STATUS_COLOR.Pending;
  const projectSearch = encodeURIComponent(client.exhibition || client.name);
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(drawerRef, true, onClose);

  const changeStatus = useCallback(async (newStatus: string) => {
    if (newStatus === localStatus || isSavingStatus) return;
    setIsSavingStatus(true);
    try {
      await updatePlatformClientStatus(client.id, newStatus);
      setLocalStatus(newStatus);
      onStatusChange(newStatus);
    } catch {
      // revert on error — silent fail; page will refresh on next load
    } finally {
      setIsSavingStatus(false);
    }
  }, [client.id, isSavingStatus, localStatus, onStatusChange]);

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <aside
        ref={drawerRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-detail-title"
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-lg flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{t("pm.clients.detail.clientDetails")}</p>
            <h2 id="client-detail-title" className="truncate text-xl font-bold">{client.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{client.contactName} / {client.contactEmail}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={t("pm.common.close")}>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {/* Status selector */}
            <div className="relative">
              <select
                value={localStatus}
                onChange={(e) => { void changeStatus(e.target.value); }}
                disabled={isSavingStatus}
                aria-label={t("pm.clients.detail.changeStatus")}
                className={cn(
                  "appearance-none cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold font-mono border-0 outline-none focus:ring-1 focus:ring-current disabled:opacity-60 pr-6",
                  isSavingStatus && "animate-pulse",
                )}
                style={{ background: statusCfg.bg, color: statusCfg.text }}
              >
                {CLIENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ background: "var(--background)", color: "var(--foreground)" }}>
                    {translateClientStatus(s, t)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px]" style={{ color: statusCfg.text }}>▾</span>
            </div>
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
              {t("pm.clients.detail.assignedPm", { name: client.pm })}
            </span>
          </div>

          <section className="mb-5 rounded-lg border bg-card/50 p-4">
            <h3 className="mb-3 text-sm font-bold">{t("pm.clients.detail.contact")}</h3>
            <div className="space-y-2.5">
              <DetailRow icon={Building2} value={client.company || client.name} />
              <DetailRow icon={Users} value={client.contactName} />
              <DetailRow icon={Mail} value={client.contactEmail} />
            </div>
          </section>

          <section className="mb-5 rounded-lg border bg-card/50 p-4">
            <h3 className="mb-3 text-sm font-bold">{t("pm.clients.detail.linkedProject")}</h3>
            <div className="rounded-md border bg-background/60 p-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Layers aria-hidden="true" className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{client.exhibition || t("pm.clients.detail.noLinkedProject")}</p>
                  <p className="mt-1 text-[11px] font-mono text-muted-foreground">{t("pm.clients.detail.dataSource")}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card/50 p-4">
            <h3 className="mb-3 text-sm font-bold">{t("pm.clients.detail.operationalStatus")}</h3>
            <div className="flex items-start gap-3 rounded-md border border-border/50 bg-card p-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                <Clock aria-hidden="true" className="h-3 w-3 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-medium leading-tight">
                  {t("pm.clients.detail.lastActivity", { time: client.lastActivity })}
                </p>
                <p className="mt-0.5 text-[9.5px] font-mono text-muted-foreground">
                  {client.projectId ? t("pm.clients.detail.workspaceReady") : t("pm.clients.detail.workspaceMissing")}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t p-4">
          <button
            type="button"
            onClick={onMessage}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
            {t("pm.clients.actions.message")}
          </button>
          <Link href={`/pm/projects?q=${projectSearch}`}>
            <button className="rounded-md border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
              {t("pm.clients.actions.viewProject")}
            </button>
          </Link>
          {client.projectId ? (
            <Link href={`/pm/workspace?projectId=${encodeURIComponent(client.projectId)}`}>
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {t("pm.clients.actions.openWorkspace")}
              </button>
            </Link>
          ) : (
            <button type="button" disabled className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground opacity-40">
              {t("pm.clients.actions.openWorkspace")}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function translateClientStatus(status: string, t: TFn): string {
  const map: Record<string, string> = {
    Active: t("pm.common.status.active"),
    Lead: t("pm.common.status.lead"),
    Pending: t("pm.common.status.pending"),
    Inactive: t("pm.common.status.inactive"),
  };
  return map[status] ?? status;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
