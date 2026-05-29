import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "@/hooks/useDebounce";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  Clock, CheckCircle2, ArrowUpRight, X, MessageSquare,
  Send, ChevronDown, ChevronUp, AlertCircle, Search,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPmRequests,
  replyPmRequest,
  updatePmRequestStatus,
  type PlatformPagination,
  type PmRequestItem,
  type PmRequestPriority,
  type PmRequestSummary,
  type PmRequestStatus,
} from "@/lib/platform-api";

type Status = PmRequestStatus;
type Priority = PmRequestPriority;
type Request = PmRequestItem;

const STATUS_CFG: Record<Status, { bg: string; text: string }> = {
  Pending:        { bg: "rgba(217,119,6,0.1)",    text: "#d97706" },
  "In Progress":  { bg: "rgba(29,78,216,0.1)",    text: "#1d4ed8" },
  Resolved:       { bg: "rgba(47,125,58,0.1)",    text: "#2f7d3a" },
  Declined:       { bg: "rgba(220,38,38,0.1)",    text: "#dc2626" },
};
const STATUS_FILTER_OPTIONS = ["All", "Pending", "In Progress", "Resolved", "Declined"] as const;
const PRIORITY_COLOR: Record<Priority, string> = {
  High: "#dc2626", Medium: "#d97706", Low: "#6b7280",
};


const PAGE_SIZE = 10;
const EMPTY_PAGINATION: PlatformPagination = { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false };
const EMPTY_SUMMARY: PmRequestSummary = { total: 0, pending: 0, inProgress: 0, resolved: 0, declined: 0 };

function initialRequestSearch() {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function initialRequestStatusFilter(): Status | "All" {
  const value = new URLSearchParams(window.location.search).get("status");
  if (!value) return "All";

  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  const match = STATUS_FILTER_OPTIONS.find((status) => (
    status.toLowerCase().replace(/\s+/g, "_") === normalized
  ));
  return match ?? "All";
}

export default function PMRequests() {
  const { t } = useTranslation();
  const [search, setSearch] = useState(() => initialRequestSearch());
  const debouncedSearch = useDebounce(search, 250);
  const [requests,  setRequests]  = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [filterSt,  setFilterSt]  = useState<Status | "All">(() => initialRequestStatusFilter());
  const [page, setPage] = useState(0);
  const [pagination, setPagination] = useState<PlatformPagination>(EMPTY_PAGINATION);
  const [summary, setSummary] = useState<PmRequestSummary>(EMPTY_SUMMARY);
  const [toastMsg,     setToastMsg]     = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [error,     setError]     = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [confirmDeclineId, setConfirmDeclineId] = useState<string | null>(null);

  // Focus trap refs
  const requestDrawerRef = useRef<HTMLElement>(null);
  const declineDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(requestDrawerRef, !!selectedRequest, () => setSelectedRequest(null));
  useFocusTrap(declineDialogRef, !!confirmDeclineId, () => setConfirmDeclineId(null));

  useEffect(() => {
    document.title = t("pm.requests.title");
  }, [t]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    getPmRequests(requestListParams(page, debouncedSearch, filterSt))
      .then((payload) => {
        if (!mounted) return;
        setRequests(payload.requests);
        setPagination(payload.pagination ?? EMPTY_PAGINATION);
        setSummary(payload.summary ?? EMPTY_SUMMARY);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setRequests([]);
        setPagination({ ...EMPTY_PAGINATION, offset: page * PAGE_SIZE });
        setSummary(EMPTY_SUMMARY);
        setError(reason instanceof Error ? reason.message : t("pm.requests.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [debouncedSearch, filterSt, page, t]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterSt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trimmedSearch = debouncedSearch.trim();

    if (filterSt === "All") {
      params.delete("status");
    } else {
      params.set("status", filterSt.toLowerCase().replace(/\s+/g, "_"));
    }

    if (trimmedSearch) {
      params.set("q", trimmedSearch);
    } else {
      params.delete("q");
    }

    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [debouncedSearch, filterSt]);

  function applyRequestPayload(payload: { requests: Request[]; pagination?: PlatformPagination; summary?: PmRequestSummary }) {
    setRequests(payload.requests);
    setPagination(payload.pagination ?? EMPTY_PAGINATION);
    setSummary(payload.summary ?? EMPTY_SUMMARY);
    setSelectedRequest((current) => current ? payload.requests.find((item) => item.id === current.id) ?? null : null);
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3000);
  }

  async function changeStatus(id: string, status: Status) {
    const actionKey = `${id}:${status}`;
    setBusyAction(actionKey);
    setError("");

    const toastMap: Record<Status, string> = {
      Pending:        t("pm.requests.toast.pending"),
      "In Progress":  t("pm.requests.toast.started"),
      Resolved:       t("pm.requests.toast.resolved"),
      Declined:       t("pm.requests.toast.declined"),
    };

    try {
      const payload = await updatePmRequestStatus(id, status, requestListParams(page, debouncedSearch, filterSt));
      applyRequestPayload(payload);
      showToast(toastMap[status] ?? status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.requests.statusError"));
    } finally {
      setBusyAction("");
    }
  }

  async function sendReply(id: string) {
    const text = replyText[id]?.trim();
    if (!text) return;

    setBusyAction(`${id}:reply`);
    setError("");
    try {
      const payload = await replyPmRequest(id, text, requestListParams(page, debouncedSearch, filterSt));
      applyRequestPayload(payload);
      setReplyText((p) => ({ ...p, [id]: "" }));
      showToast(t("pm.requests.toast.replySent"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.requests.replyError"));
    } finally {
      setBusyAction("");
    }
  }

  function statusLabel(s: Status): string {
    const map: Record<Status, string> = {
      Pending:        t("pm.requests.status.pending"),
      "In Progress":  t("pm.requests.status.inProgress"),
      Resolved:       t("pm.requests.status.resolved"),
      Declined:       t("pm.requests.status.declined"),
    };
    return map[s] ?? s;
  }

  function priorityLabel(p: Priority): string {
    const map: Record<Priority, string> = {
      High:   t("pm.requests.priority.high"),
      Medium: t("pm.requests.priority.medium"),
      Low:    t("pm.requests.priority.low"),
    };
    return map[p] ?? p;
  }

  function filterLabel(option: Status | "All"): string {
    return option === "All" ? t("pm.requests.filter.all") : statusLabel(option);
  }

  const counts: Record<Status | "All", number> = {
    All: summary.total,
    Pending: summary.pending,
    "In Progress": summary.inProgress,
    Resolved: summary.resolved,
    Declined: summary.declined,
  };
  const pageStart = pagination.total ? pagination.offset + 1 : 0;
  const pageEnd = Math.min(pagination.offset + requests.length, pagination.total);
  const pendingCount = summary.pending;

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader
          title={t("pm.requests.title")}
          breadcrumbs={[{ label: t("pm.nav.dashboard"), href: "/pm" }, { label: t("pm.nav.requests") }]}
        >
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-3 py-1.5">
              <AlertCircle aria-hidden="true" className="h-4 w-4" />
              {t("pm.requests.pendingBadge", { count: pendingCount })}
            </span>
          )}
        </PageHeader>

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTER_OPTIONS.map((s) => {
              const cfg = s !== "All" ? STATUS_CFG[s] : null;
              const cnt = counts[s] ?? 0;
              return (
                <button
                  key={s}
                  onClick={() => setFilterSt(s)}
                  aria-pressed={filterSt === s}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold border transition-all ${filterSt === s ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-border hover:border-foreground/50"}`}
                  style={filterSt === s && cfg ? { background: cfg.bg, color: cfg.text, borderColor: `${cfg.text}40` } : {}}
                >
                  {filterLabel(s)} ({cnt})
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("pm.requests.searchPlaceholder")}
              aria-label={t("pm.requests.searchPlaceholder")}
              className="h-8 w-60 rounded-md border bg-muted/30 pl-8 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Request cards */}
        <div className="space-y-3">
          {isLoading && requests.length === 0 && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border rounded-lg bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="h-6 w-6 rounded shrink-0" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-16 rounded" />
                  <Skeleton className="h-7 w-20 rounded" />
                  <Skeleton className="h-7 w-16 rounded" />
                </div>
              </div>
            </div>
          ))}
          {requests.map((req) => {
            const sc = STATUS_CFG[req.status];
            const isExpanded = expanded === req.id;
            const isBusy = busyAction.startsWith(`${req.id}:`);
            return (
              <div key={req.id} className="border rounded-lg bg-card overflow-hidden transition-all hover:border-primary/30">
                {/* Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-sm">{req.client}</span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          {req.project}
                        </span>
                        <span
                          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {statusLabel(req.status)}
                        </span>
                        <span
                          className="text-[10px] font-mono font-bold"
                          style={{ color: PRIORITY_COLOR[req.priority] }}
                        >
                          {priorityLabel(req.priority)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed italic">"{req.request}"</p>
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : req.id)}
                      aria-label={isExpanded ? t("pm.requests.actions.collapse") : t("pm.requests.actions.expand")}
                      aria-expanded={isExpanded}
                      className="text-muted-foreground hover:text-foreground p-1 rounded shrink-0"
                    >
                      {isExpanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      {req.timestamp}
                      {req.comments.length > 0 && (
                        <span className="ml-2 flex items-center gap-1">
                          <MessageSquare aria-hidden="true" className="h-3 w-3" />
                          {t("pm.requests.replyCount", { count: req.comments.length })}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        aria-label={t("pm.requests.actions.details")}
                        className="text-[11px] font-semibold text-muted-foreground border border-border rounded px-3 py-1.5 hover:text-foreground hover:border-foreground/50"
                      >
                        {t("pm.requests.actions.details")}
                      </button>
                      {req.status === "Pending" && (
                        <>
                          <button
                            onClick={() => changeStatus(req.id, "In Progress")}
                            disabled={isBusy}
                            aria-label={t("pm.requests.actions.start")}
                            className="text-[11px] font-semibold border border-primary/30 text-primary bg-primary/5 rounded px-3 py-1.5 hover:bg-primary hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                            {t("pm.requests.actions.start")}
                          </button>
                          <button
                            onClick={() => setConfirmDeclineId(req.id)}
                            disabled={isBusy}
                            aria-label={t("pm.requests.actions.decline")}
                            className="text-[11px] font-semibold border border-red-200 text-red-600 rounded px-3 py-1.5 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <X aria-hidden="true" className="h-3 w-3" />
                            {t("pm.requests.actions.decline")}
                          </button>
                        </>
                      )}
                      {req.status === "In Progress" && (
                        <button
                          onClick={() => changeStatus(req.id, "Resolved")}
                          disabled={isBusy}
                          aria-label={t("pm.requests.actions.resolve")}
                          className="text-[11px] font-semibold border border-green-200 text-green-700 bg-green-50 rounded px-3 py-1.5 hover:bg-green-600 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                          {t("pm.requests.actions.resolve")}
                        </button>
                      )}
                      {(req.status === "Resolved" || req.status === "Declined") && (
                        <span className="text-[11px] font-mono text-muted-foreground px-3 py-1.5 border rounded border-dashed">
                          {statusLabel(req.status)}
                        </span>
                      )}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : req.id)}
                        aria-label={t("pm.requests.actions.reply")}
                        className="text-[11px] font-semibold text-muted-foreground border border-border rounded px-3 py-1.5 hover:text-foreground hover:border-foreground/50 flex items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {t("pm.requests.actions.reply")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: comments + reply */}
                {isExpanded && (
                  <div className="border-t bg-muted/20 p-4 space-y-3">
                    {(req.history ?? []).length > 0 && (
                      <div className="rounded-md border bg-background/70 p-3">
                        <p className="mb-2 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                          {t("pm.requests.history.title")}
                        </p>
                        <div className="space-y-2">
                          {(req.history ?? []).slice(0, 5).map((event) => (
                            <div key={event.id} className="flex items-start gap-2 text-xs">
                              <Clock aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{event.message}</p>
                                <p className="text-muted-foreground">
                                  {t("pm.requests.history.meta", { actor: event.actor,
                                    time: event.time,
                                  })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {req.comments.length > 0 && (
                      <div className="space-y-2">
                        {req.comments.map((c) => (
                          <div key={c.id} className={`flex gap-2.5 ${c.isMe ? "flex-row-reverse" : ""}`}>
                            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-mono font-bold text-primary">
                                {c.isMe ? t("pm.requests.pmInitials") : c.author.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${c.isMe ? "bg-primary text-white" : "bg-background border"}`}>
                              <p>{c.text}</p>
                              <p className={`text-[10px] mt-1 font-mono ${c.isMe ? "text-white/60" : "text-muted-foreground"}`}>
                                {c.time}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={replyText[req.id] ?? ""}
                        onChange={(e) => setReplyText((p) => ({ ...p, [req.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter" && !isBusy) void sendReply(req.id); }}
                        placeholder={t("pm.requests.replyPlaceholder")}
                        aria-label={t("pm.requests.replyPlaceholder")}
                        disabled={isBusy}
                        className="flex-1 h-9 border rounded-md px-3 text-sm bg-background outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => sendReply(req.id)}
                        disabled={isBusy || !replyText[req.id]?.trim()}
                        aria-label={t("pm.requests.actions.sendReply")}
                        className="h-9 w-9 bg-primary text-white rounded-md flex items-center justify-center hover:bg-primary/90 shrink-0 disabled:opacity-50"
                      >
                        <Send aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {requests.length === 0 && !isLoading && (
            <div className="text-center py-16 text-muted-foreground text-sm font-mono border-2 border-dashed rounded-lg">
              {t("pm.requests.noMatch")}
            </div>
          )}
        </div>

        <PaginationBar
          start={pageStart}
          end={pageEnd}
          total={pagination.total}
          canPrevious={pagination.offset > 0}
          canNext={pagination.hasMore}
          isLoading={isLoading}
          onPrevious={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => current + 1)}
          t={t}
        />
      </div>

      {selectedRequest && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelectedRequest(null)} />
          <aside
            ref={requestDrawerRef as React.RefObject<HTMLElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-detail-title"
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-xl flex-col border-l bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{selectedRequest.client}</p>
                <h2 id="request-detail-title" className="truncate text-xl font-bold">{selectedRequest.project}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedRequest.timestamp}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label={t("pm.common.cancel")}
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold font-mono" style={{ background: STATUS_CFG[selectedRequest.status].bg, color: STATUS_CFG[selectedRequest.status].text }}>
                  {statusLabel(selectedRequest.status)}
                </span>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-mono" style={{ color: PRIORITY_COLOR[selectedRequest.priority] }}>
                  {priorityLabel(selectedRequest.priority)}
                </span>
              </div>

              <section className="rounded-lg border bg-card/50 p-4">
                <h3 className="mb-2 text-sm font-bold">{t("pm.requests.detail.request")}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{selectedRequest.request}</p>
              </section>

              <section className="rounded-lg border bg-card/50 p-4">
                <h3 className="mb-3 text-sm font-bold">{t("pm.requests.history.title")}</h3>
                <div className="space-y-3">
                  {(selectedRequest.history ?? []).map((event) => (
                    <div key={event.id} className="grid grid-cols-[auto,1fr] gap-3 text-sm">
                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{event.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("pm.requests.history.meta", { actor: event.actor, time: event.time })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!(selectedRequest.history ?? []).length && (
                    <p className="text-sm text-muted-foreground">{t("pm.requests.history.empty")}</p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border bg-card/50 p-4">
                <h3 className="mb-3 text-sm font-bold">{t("pm.requests.detail.replies")}</h3>
                <div className="space-y-3">
                  {selectedRequest.comments.map((comment) => (
                    <div key={comment.id} className={`flex gap-2.5 ${comment.isMe ? "flex-row-reverse" : ""}`}>
                      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-mono font-bold text-primary">
                          {comment.isMe ? t("pm.requests.pmInitials") : comment.author.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${comment.isMe ? "bg-primary text-white" : "bg-background border"}`}>
                        <p>{comment.text}</p>
                        <p className={`text-[10px] mt-1 font-mono ${comment.isMe ? "text-white/60" : "text-muted-foreground"}`}>
                          {comment.time}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!selectedRequest.comments.length && (
                    <p className="text-sm text-muted-foreground">{t("pm.requests.detail.noReplies")}</p>
                  )}
                </div>
              </section>
            </div>
            <div className="space-y-3 border-t p-4">
              <div className="flex gap-2">
                <input
                  value={replyText[selectedRequest.id] ?? ""}
                  onChange={(e) => setReplyText((p) => ({ ...p, [selectedRequest.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !busyAction.startsWith(`${selectedRequest.id}:`)) void sendReply(selectedRequest.id); }}
                  placeholder={t("pm.requests.replyPlaceholder")}
                  aria-label={t("pm.requests.replyPlaceholder")}
                  disabled={busyAction.startsWith(`${selectedRequest.id}:`)}
                  className="flex-1 h-9 border rounded-md px-3 text-sm bg-background outline-none focus:border-primary"
                />
                <button
                  onClick={() => sendReply(selectedRequest.id)}
                  disabled={busyAction.startsWith(`${selectedRequest.id}:`) || !replyText[selectedRequest.id]?.trim()}
                  aria-label={t("pm.requests.actions.sendReply")}
                  className="h-9 w-9 bg-primary text-white rounded-md flex items-center justify-center hover:bg-primary/90 shrink-0 disabled:opacity-50"
                >
                  <Send aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {selectedRequest.status === "Pending" && (
                  <>
                    <button
                      onClick={() => changeStatus(selectedRequest.id, "In Progress")}
                      disabled={busyAction.startsWith(`${selectedRequest.id}:`)}
                      className="rounded-md border border-primary/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                    >
                      {t("pm.requests.actions.start")}
                    </button>
                    <button
                      onClick={() => setConfirmDeclineId(selectedRequest.id)}
                      disabled={busyAction.startsWith(`${selectedRequest.id}:`)}
                      className="rounded-md border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t("pm.requests.actions.decline")}
                    </button>
                  </>
                )}
                {selectedRequest.status === "In Progress" && (
                  <button
                    onClick={() => changeStatus(selectedRequest.id, "Resolved")}
                    disabled={busyAction.startsWith(`${selectedRequest.id}:`)}
                    className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {t("pm.requests.actions.resolve")}
                  </button>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Decline confirmation dialog */}
      {confirmDeclineId && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setConfirmDeclineId(null)}
          />
          <div
            ref={declineDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="decline-confirm-title"
            className="fixed left-1/2 top-1/2 z-[61] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl"
          >
            <h2 id="decline-confirm-title" className="mb-2 text-base font-bold">
              {t("pm.requests.confirmDecline.title")}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              {t("pm.requests.confirmDecline.body")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeclineId(null)}
                className="rounded-md border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {t("pm.common.cancel")}
              </button>
              <button
                onClick={async () => {
                  const id = confirmDeclineId;
                  setConfirmDeclineId(null);
                  await changeStatus(id, "Declined");
                }}
                disabled={Boolean(busyAction)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("pm.requests.actions.decline")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Always-rendered ARIA live toast */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xl z-50 transition-all duration-300 ${toastVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
      >
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-green-400" />
        {toastMsg}
      </div>
    </DashboardLayout>
  );
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function requestListParams(page: number, q: string, status: Status | "All") {
  return {
    q,
    status: status === "All" ? "" : status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };
}

function PaginationBar({
  start,
  end,
  total,
  canPrevious,
  canNext,
  isLoading,
  onPrevious,
  onNext,
  t,
}: {
  start: number;
  end: number;
  total: number;
  canPrevious: boolean;
  canNext: boolean;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  t: TFn;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">
      <span>{t("pm.requests.paging.showing", { start, end, total })}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isLoading || !canPrevious}
          className="rounded-md border px-3 py-1.5 font-semibold transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("pm.common.previous")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || !canNext}
          className="rounded-md border px-3 py-1.5 font-semibold transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("pm.common.next")}
        </button>
      </div>
    </div>
  );
}
