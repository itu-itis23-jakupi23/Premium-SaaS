import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  User,
  RotateCcw,
  Search,
  CalendarCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPlatformCalendar,
  type CalendarEvent,
} from "@/lib/platform-api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Exhibition {
  id: string;
  name: string;
  client: string;
  pm: string;
  status: "Active" | "Completed" | "Delayed" | "Pending";
  startDate: string;
  endDate: string;
  location: string;
  standType: string;
}

type StatusFilter = "all" | Exhibition["status"];

const STATUS_STYLES: Record<Exhibition["status"], string> = {
  Active:    "border-green-500/60 text-green-400 bg-green-500/10",
  Completed: "border-blue-500/60 text-blue-400 bg-blue-500/10",
  Delayed:   "border-red-500/60 text-red-400 bg-red-500/10",
  Pending:   "border-yellow-500/60 text-yellow-400 bg-yellow-500/10",
};

const STATUS_DOT: Record<Exhibition["status"], string> = {
  Active:    "bg-green-500",
  Completed: "bg-blue-500",
  Delayed:   "bg-red-500",
  Pending:   "bg-yellow-500",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatIso(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function exhibitionsForDay(exhibitions: Exhibition[], dateStr: string) {
  return exhibitions.filter((ex) => ex.startDate <= dateStr && ex.endDate >= dateStr);
}

function exhibitionsForMonth(exhibitions: Exhibition[], year: number, month: number) {
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0);
  return exhibitions.filter((ex) => ex.startDate <= isoDate(end) && ex.endDate >= isoDate(start));
}

function calendarEventToExhibition(event: CalendarEvent): Exhibition {
  return {
    id:        event.id,
    name:      event.name,
    client:    event.client,
    pm:        event.pm || "",
    status:    normalizeStatus(event.status),
    startDate: event.startDate,
    endDate:   event.endDate,
    location:  event.location  || "TBD",
    standType: event.standType || "Custom",
  };
}

function normalizeStatus(status: string): Exhibition["status"] {
  const v = status.toLowerCase();
  if (v.includes("completed") || v.includes("approved"))                        return "Completed";
  if (v.includes("delayed")   || v.includes("blocked") || v.includes("risk"))  return "Delayed";
  if (v.includes("draft")     || v.includes("planning") || v.includes("pending")) return "Pending";
  return "Active";
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getWeekdayShorts(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2000, 0, 2 + i);
    return d.toLocaleDateString(locale, { weekday: "short" });
  });
}

function getMonthNames(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PMCalendar() {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] ?? "");
  const clientFilterName = urlParams.get("clientName") ?? "";

  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState("");

  // Calendar navigation
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch]             = useState("");

  useEffect(() => { document.title = t("pm.calendar.title"); }, [t]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getPlatformCalendar()
      .then(({ events }) => {
        if (!mounted) return;
        setExhibitions(events.map(calendarEventToExhibition));
        setError("");
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : t("pm.calendar.error.load"));
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [t]);

  const locale      = i18n.language;
  const weekdays    = useMemo(() => getWeekdayShorts(locale), [locale]);
  const monthNames  = useMemo(() => getMonthNames(locale), [locale]);
  const calendarGrid = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const thisMonthExhibitions = useMemo(
    () => exhibitionsForMonth(exhibitions, year, month),
    [exhibitions, year, month],
  );

  const filteredExhibitions = useMemo(() => {
    const q  = search.trim().toLowerCase();
    const cf = clientFilterName.toLowerCase();
    return thisMonthExhibitions.filter((ex) => {
      const matchesStatus = statusFilter === "all" || ex.status === statusFilter;
      const matchesSearch = !q || [ex.name, ex.client, ex.location, ex.standType]
        .some((v) => v.toLowerCase().includes(q));
      const matchesClient = !cf || ex.client.toLowerCase().includes(cf);
      return matchesStatus && matchesSearch && matchesClient;
    });
  }, [thisMonthExhibitions, statusFilter, search, clientFilterName]);

  const selectedDayExhibitions = useMemo(() => {
    if (!selectedDay) return [];
    return filteredExhibitions.filter((ex) => ex.startDate <= selectedDay && ex.endDate >= selectedDay);
  }, [filteredExhibitions, selectedDay]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(isoDate(today));
  }

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: "all",       label: t("pm.calendar.filter.all") },
    { key: "Active",    label: t("pm.calendar.filter.active") },
    { key: "Pending",   label: t("pm.calendar.filter.pending") },
    { key: "Delayed",   label: t("pm.calendar.filter.delayed") },
    { key: "Completed", label: t("pm.calendar.filter.completed") },
  ];

  const todayStr = isoDate(today);
  const assignedSummary = useMemo(() => {
    const upcoming = exhibitions
      .filter((ex) => ex.endDate >= todayStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return {
      total: exhibitions.length,
      active: exhibitions.filter((ex) => ex.status === "Active").length,
      pending: exhibitions.filter((ex) => ex.status === "Pending").length,
      next: upcoming[0] ?? null,
    };
  }, [exhibitions, todayStr]);

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader
          title={t("pm.calendar.title")}
          breadcrumbs={[
            { label: t("pm.nav.dashboard"), href: "/pm" },
            { label: t("pm.calendar.breadcrumb") },
          ]}
        >
          <Badge
            data-testid="pm-calendar-assigned-only"
            variant="outline"
            className="gap-1.5 border-primary/30 bg-primary/5 px-3 py-1.5 text-primary"
          >
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("pm.calendar.title")}
          </Badge>
        </PageHeader>

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {clientFilterName && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">
              Showing calendar for <strong>{clientFilterName}</strong>
            </span>
            <a
              href="/pm/calendar"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear client filter"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Clear filter
            </a>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <CalendarSummaryCard label="Assigned exhibitions" value={String(assignedSummary.total)} />
          <CalendarSummaryCard label="Active now" value={String(assignedSummary.active)} tone="green" />
          <CalendarSummaryCard label="Pending prep" value={String(assignedSummary.pending)} tone="yellow" />
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next exhibition</p>
              <p className="mt-1 truncate text-sm font-bold">
                {assignedSummary.next?.name ?? "No upcoming assignment"}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {assignedSummary.next
                  ? `${assignedSummary.next.client} · ${formatIso(assignedSummary.next.startDate, locale)}`
                  : "Chief-assigned client projects will appear here."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Month header + navigation */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={prevMonth} aria-label={t("pm.calendar.previousMonth")}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <h2 className="text-lg font-bold min-w-[180px] text-center">
                {monthNames[month]} {year}
              </h2>
              <Button variant="outline" size="sm" onClick={nextMonth} aria-label={t("pm.calendar.nextMonth")}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("pm.calendar.searchPlaceholder")}
                  className="h-8 w-48 pl-8 text-xs"
                />
              </div>
              {/* Today button */}
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
                <RotateCcw className="mr-1.5 h-3 w-3" aria-hidden="true" />
                {t("pm.calendar.today")}
              </Button>
            </div>
          </CardHeader>

          {/* Status filter chips */}
          <div className="flex flex-wrap gap-1.5 px-6 pb-4">
            {statusOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                aria-pressed={statusFilter === key}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                  statusFilter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40",
                )}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto flex items-center text-[11px] text-muted-foreground">
              {filteredExhibitions.length} {t("pm.calendar.eventsThisMonth")}
            </span>
          </div>

          <CardContent className="px-4 pb-6">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {weekdays.map((day) => (
                <div key={day} className="py-2 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarGrid.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const dateStr   = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = exhibitionsForDay(filteredExhibitions, dateStr);
                const isToday   = dateStr === todayStr;
                const isSelected = dateStr === selectedDay;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                    aria-label={formatIso(dateStr, locale)}
                    aria-pressed={isSelected}
                    className={cn(
                      "group min-h-[68px] w-full rounded-lg border p-1.5 text-left transition-all",
                      isToday   && "border-primary/60 bg-primary/5",
                      isSelected && "border-primary bg-primary/10 ring-1 ring-primary/30",
                      !isToday && !isSelected && "border-border/50 hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <span className={cn(
                      "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                    )}>
                      {day}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {dayEvents.slice(0, 3).map((ex) => (
                        <span
                          key={ex.id}
                          className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[ex.status])}
                          aria-hidden="true"
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                    {dayEvents.length > 0 && (
                      <p className="mt-0.5 truncate text-[9px] text-muted-foreground leading-tight">
                        {dayEvents[0].name}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day detail panel */}
        {selectedDay && (
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                {formatIso(selectedDay, locale)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDayExhibitions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("pm.calendar.noEventsDay")}
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDayExhibitions.map((ex) => (
                    <div key={ex.id} className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", STATUS_DOT[ex.status])} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight truncate">{ex.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-2.5 w-2.5" aria-hidden="true" /> {ex.client}
                            </span>
                            {ex.location && ex.location !== "TBD" && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" aria-hidden="true" /> {ex.location}
                              </span>
                            )}
                            <span className="text-[10px] font-mono">{ex.startDate} → {ex.endDate}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[ex.status])}>
                          {ex.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upcoming events list */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("pm.calendar.upcomingThisMonth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2 py-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
                      <div className="min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-52" />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-7 w-16 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredExhibitions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("pm.calendar.noEvents")}</p>
            ) : (
              <div className="space-y-2">
                {filteredExhibitions
                  .sort((a, b) => a.startDate.localeCompare(b.startDate))
                  .map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[ex.status])} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{ex.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {ex.client} · {formatIso(ex.startDate, locale)} – {formatIso(ex.endDate, locale)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[ex.status])}>
                          {ex.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventForm sub-component
// ─────────────────────────────────────────────────────────────────────────────

function CalendarSummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "yellow";
}) {
  const toneClass = tone === "green"
    ? "text-green-500"
    : tone === "yellow"
      ? "text-yellow-500"
      : "text-primary";

  return (
    <Card className="bg-card/60">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-3xl font-bold leading-none", toneClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}
