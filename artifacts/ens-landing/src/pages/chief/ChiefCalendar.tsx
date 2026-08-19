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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  MapPin,
  User,
  Building2,
  RotateCcw,
  Search,
  CalendarCheck,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getPlatformCalendar,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventInput,
} from "@/lib/platform-api";

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

type CalendarStatusFilter = "all" | Exhibition["status"];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Format "2026-03-18" → locale-aware "Mar 18, 2026" */
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
    pm:        event.pm || "Unassigned",
    status:    normalizeCalendarStatus(event.status),
    startDate: event.startDate,
    endDate:   event.endDate,
    location:  event.location  || "TBD",
    standType: event.standType || "Custom",
  };
}

function normalizeCalendarStatus(status: string): Exhibition["status"] {
  const v = status.toLowerCase();
  if (v.includes("completed") || v.includes("approved"))                       return "Completed";
  if (v.includes("delayed")   || v.includes("blocked") || v.includes("risk")) return "Delayed";
  if (v.includes("draft")     || v.includes("planning") || v.includes("pending")) return "Pending";
  return "Active";
}

function exhibitionToCalendarInput(exhibition: Omit<Exhibition, "id">): CalendarEventInput {
  return {
    name:      exhibition.name,
    client:    exhibition.client,
    pm:        exhibition.pm,
    status:    exhibition.status,
    startDate: exhibition.startDate,
    endDate:   exhibition.endDate,
    location:  exhibition.location,
    standType: exhibition.standType,
  };
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Jan 2, 2000 is Sunday (index 0) → Sun-Sat order matches JS getDay() */
function getWeekdayShorts(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2000, 0, 2 + i);
    return d.toLocaleDateString(locale, { weekday: "short" });
  });
}

function getMonthNames(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2000, i, 1);
    return d.toLocaleDateString(locale, { month: "long" });
  });
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

const EMPTY_FORM = {
  name: "", client: "", pm: "", status: "Pending" as Exhibition["status"],
  startDate: "", endDate: "", location: "", standType: "",
};

// ---------------------------------------------------------------------------
// ExhibitionForm — shared form fields
// ---------------------------------------------------------------------------

function ExhibitionForm({
  form,
  onChange,
  managerOptions = [],
}: {
  form: typeof EMPTY_FORM;
  onChange: (field: string, value: string) => void;
  managerOptions?: string[];
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="ev-name">{t("chief.calendar.form.nameLabel")}</Label>
          <Input
            id="ev-name"
            placeholder={t("chief.calendar.form.namePlaceholder")}
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-client">{t("chief.calendar.form.clientLabel")}</Label>
          <Input
            id="ev-client"
            placeholder={t("chief.calendar.form.clientPlaceholder")}
            value={form.client}
            onChange={(e) => onChange("client", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-pm">{t("chief.calendar.form.pmLabel")}</Label>
          {managerOptions.length > 0 ? (
            <Select value={form.pm} onValueChange={(v) => onChange("pm", v)}>
              <SelectTrigger id="ev-pm">
                <SelectValue placeholder={t("chief.calendar.form.pmPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {managerOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="ev-pm"
              placeholder={t("chief.calendar.form.pmPlaceholder")}
              value={form.pm}
              onChange={(e) => onChange("pm", e.target.value)}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-start">{t("chief.calendar.form.startLabel")}</Label>
          <Input
            id="ev-start"
            type="date"
            value={form.startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-end">{t("chief.calendar.form.endLabel")}</Label>
          <Input
            id="ev-end"
            type="date"
            value={form.endDate}
            onChange={(e) => onChange("endDate", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-location">{t("chief.calendar.form.locationLabel")}</Label>
          <Input
            id="ev-location"
            placeholder={t("chief.calendar.form.locationPlaceholder")}
            value={form.location}
            onChange={(e) => onChange("location", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-stand">{t("chief.calendar.form.standLabel")}</Label>
          <Input
            id="ev-stand"
            placeholder={t("chief.calendar.form.standPlaceholder")}
            value={form.standType}
            onChange={(e) => onChange("standType", e.target.value)}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{t("chief.calendar.form.statusLabel")}</Label>
          <Select value={form.status} onValueChange={(v) => onChange("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">{t("chief.calendar.status.pending")}</SelectItem>
              <SelectItem value="Active">{t("chief.calendar.status.active")}</SelectItem>
              <SelectItem value="Delayed">{t("chief.calendar.status.delayed")}</SelectItem>
              <SelectItem value="Completed">{t("chief.calendar.status.completed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarFilters
// ---------------------------------------------------------------------------

function CalendarFilters({
  pmFilter, clientFilter, statusFilter, search,
  managerOptions, clientOptions, resultCount,
  onPmChange, onClientChange, onStatusChange, onSearchChange, onReset,
}: {
  pmFilter: string; clientFilter: string; statusFilter: CalendarStatusFilter; search: string;
  managerOptions: string[]; clientOptions: string[]; resultCount: number;
  onPmChange: (value: string) => void; onClientChange: (value: string) => void;
  onStatusChange: (value: CalendarStatusFilter) => void;
  onSearchChange: (value: string) => void; onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border bg-card/40 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_150px_auto] lg:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("chief.calendar.filter.searchPlaceholder")}
            aria-label={t("chief.calendar.filter.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={pmFilter} onValueChange={onPmChange}>
          <SelectTrigger><SelectValue placeholder={t("chief.calendar.filter.pmPlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("chief.calendar.filter.allManagers")}</SelectItem>
            {managerOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={onClientChange}>
          <SelectTrigger><SelectValue placeholder={t("chief.calendar.filter.clientPlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("chief.calendar.filter.allClients")}</SelectItem>
            {clientOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as CalendarStatusFilter)}>
          <SelectTrigger><SelectValue placeholder={t("chief.calendar.filter.statusPlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("chief.calendar.filter.allStatuses")}</SelectItem>
            <SelectItem value="Active">{t("chief.calendar.status.active")}</SelectItem>
            <SelectItem value="Pending">{t("chief.calendar.status.pending")}</SelectItem>
            <SelectItem value="Delayed">{t("chief.calendar.status.delayed")}</SelectItem>
            <SelectItem value="Completed">{t("chief.calendar.status.completed")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="h-9 px-3">
            {t("chief.calendar.filter.shown", { count: resultCount })}
          </Badge>
          <Button variant="outline" size="icon" onClick={onReset} aria-label={t("chief.calendar.filter.resetFilters")}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// YearView
// ---------------------------------------------------------------------------

function YearView({
  year, exhibitions, onYearChange, onMonthClick, onAddEvent,
}: {
  year: number; exhibitions: Exhibition[];
  onYearChange: (y: number) => void;
  onMonthClick: (m: number) => void;
  onAddEvent: () => void;
}) {
  const { t, i18n } = useTranslation();

  const monthNames = useMemo(
    () => getMonthNames(i18n.language),
    [i18n.language],
  );

  const yearCount = exhibitions.filter(
    (ex) => new Date(ex.startDate).getFullYear() === year,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => onYearChange(year - 1)} aria-label={String(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-2xl font-bold w-20 text-center">{year}</span>
          <Button variant="outline" size="icon" onClick={() => onYearChange(year + 1)} aria-label={String(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {(Object.keys(STATUS_DOT) as Exhibition["status"][]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                {t(`chief.calendar.status.${s.toLowerCase()}`)}
              </span>
            ))}
          </div>
          <span className="text-sm text-muted-foreground hidden sm:block">
            <CalendarDays className="inline h-4 w-4 mr-1" aria-hidden="true" />
            {t("chief.calendar.yearExhibitions", { count: yearCount })}
          </span>
          <Button size="sm" onClick={onAddEvent}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("chief.calendar.addEvent")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {monthNames.map((monthName, idx) => {
          const exs    = exhibitionsForMonth(exhibitions, year, idx);
          const isPast = new Date(year, idx + 1, 0) < new Date();
          return (
            <Card
              key={idx}
              onClick={() => onMonthClick(idx)}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:border-primary/60 hover:shadow-md",
                "bg-card/50 backdrop-blur-sm",
                isPast && exs.length === 0 && "opacity-40",
              )}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{monthName}</CardTitle>
                  {exs.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs font-bold">
                      {exs.length}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5 min-h-[64px]">
                {exs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("chief.calendar.noExhibitions")}</p>
                ) : (
                  exs.map((ex) => (
                    <div key={ex.id} className="flex items-center gap-1.5 text-xs">
                      <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", STATUS_DOT[ex.status])} />
                      <span className="truncate text-foreground">{ex.name}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MonthView
// ---------------------------------------------------------------------------

function MonthView({
  year, month, exhibitions, onBack, onMonthChange, onAddEvent, onDayClick, onGoToToday,
}: {
  year: number; month: number; exhibitions: Exhibition[];
  onBack: () => void;
  onMonthChange: (delta: number) => void;
  onAddEvent: (prefillDate?: string) => void;
  onDayClick: (ex: Exhibition) => void;
  onGoToToday: () => void;
}) {
  const { t, i18n } = useTranslation();

  const weekdays = useMemo(
    () => getWeekdayShorts(i18n.language),
    [i18n.language],
  );

  const monthNames = useMemo(
    () => getMonthNames(i18n.language),
    [i18n.language],
  );

  const cells        = buildCalendarGrid(year, month);
  const today        = isoDate(new Date());
  const isCurrentMonth = `${new Date().getFullYear()}-${new Date().getMonth()}` === `${year}-${month}`;
  const monthExs     = exhibitionsForMonth(exhibitions, year, month);

  return (
    <div className="space-y-4">
      {/* Month header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            {t("chief.calendar.allMonths")}
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(-1)}
            aria-label={t("chief.calendar.prevMonth")}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-lg font-bold min-w-[180px] text-center">
            {monthNames[month]} {year}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(1)}
            aria-label={t("chief.calendar.nextMonth")}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={onGoToToday} className="h-8 gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("chief.calendar.today")}
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => onAddEvent()}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("chief.calendar.addEvent")}
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {weekdays.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-background">
          {cells.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[110px] border-b border-r border-border/40 bg-muted/10"
                />
              );
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayExs  = exhibitionsForDay(exhibitions, dateStr);
            const isToday = dateStr === today;

            return (
              <div
                key={dateStr}
                className={cn(
                  "min-h-[110px] border-b border-r border-border/40 p-1.5 flex flex-col gap-1 transition-colors",
                  "hover:bg-muted/20",
                  isToday && "bg-primary/5",
                  (i + 1) % 7 === 0 && "border-r-0",
                )}
              >
                <button
                  onClick={() => onAddEvent(dateStr)}
                  className="group self-start"
                  aria-label={t("chief.calendar.addEventTitle")}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground group-hover:bg-muted group-hover:text-foreground",
                    )}
                  >
                    {day}
                  </span>
                </button>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayExs.slice(0, 3).map((ex) => (
                    <button
                      key={ex.id}
                      onClick={(e) => { e.stopPropagation(); onDayClick(ex); }}
                      className={cn(
                        "w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded truncate leading-tight",
                        "border-l-2 transition-opacity hover:opacity-80",
                        ex.status === "Active"    && "bg-green-500/15 text-green-300 border-l-green-500",
                        ex.status === "Completed" && "bg-blue-500/15 text-blue-300 border-l-blue-500",
                        ex.status === "Delayed"   && "bg-red-500/15 text-red-300 border-l-red-500",
                        ex.status === "Pending"   && "bg-yellow-500/15 text-yellow-300 border-l-yellow-500",
                      )}
                      title={ex.name}
                      aria-label={ex.name}
                    >
                      {ex.name}
                    </button>
                  ))}
                  {dayExs.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      {t("chief.calendar.moreEvents", { count: dayExs.length - 3 })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month exhibitions list */}
      {monthExs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("chief.calendar.exhibitionsThisMonth", { count: monthExs.length })}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {monthExs.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onDayClick(ex)}
                className="text-left rounded-lg border border-border/60 bg-card/50 p-4 space-y-2 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">{ex.name}</p>
                  <Badge variant="outline" className={cn("text-xs shrink-0", STATUS_STYLES[ex.status])}>
                    {t(`chief.calendar.status.${ex.status.toLowerCase()}`)}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Building2 className="h-3 w-3" aria-hidden="true" />{ex.client}</p>
                  <p className="flex items-center gap-1.5"><User className="h-3 w-3" aria-hidden="true" />{ex.pm}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" aria-hidden="true" />{ex.location}</p>
                  <p className="text-foreground">
                    {formatIso(ex.startDate, i18n.language)} – {formatIso(ex.endDate, i18n.language)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventDetailDialog
// ---------------------------------------------------------------------------

function EventDetailDialog({
  exhibition,
  onClose,
  onDelete,
  onEdit,
  deleting,
}: {
  exhibition: Exhibition;
  onClose: () => void;
  onDelete: (id: string) => void | Promise<void>;
  onEdit: (ex: Exhibition) => void;
  deleting?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{exhibition.name}</DialogTitle>
          <DialogDescription>{t("chief.calendar.detail.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Badge variant="outline" className={cn("text-sm", STATUS_STYLES[exhibition.status])}>
            {t(`chief.calendar.status.${exhibition.status.toLowerCase()}`)}
          </Badge>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("chief.calendar.detail.client")}</p>
              <p className="font-medium">{exhibition.client}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("chief.calendar.detail.pm")}</p>
              <p className="font-medium">{exhibition.pm}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("chief.calendar.detail.location")}</p>
              <p className="font-medium">{exhibition.location}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("chief.calendar.detail.standType")}</p>
              <p className="font-medium">{exhibition.standType}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("chief.calendar.detail.startDate")}</p>
              <p className="font-medium">{formatIso(exhibition.startDate, i18n.language)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("chief.calendar.detail.endDate")}</p>
              <p className="font-medium">{formatIso(exhibition.endDate, i18n.language)}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("chief.calendar.detail.confirmDelete")}</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { void onDelete(exhibition.id); }}
                disabled={deleting}
              >
                {deleting ? t("chief.calendar.detail.deleting") : t("chief.calendar.detail.confirm")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                {t("chief.calendar.detail.cancel")}
              </Button>
            </div>
          ) : (
            <>
              <Button variant="destructive" size="sm" onClick={() => setConfirmingDelete(true)}>
                {t("chief.calendar.detail.delete")}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { onEdit(exhibition); onClose(); }}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t("chief.calendar.detail.edit")}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  {t("chief.calendar.detail.close")}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AddEventDialog
// ---------------------------------------------------------------------------

function AddEventDialog({
  prefillDate,
  onClose,
  onSave,
  saving,
  managerOptions = [],
}: {
  prefillDate?: string;
  onClose: () => void;
  onSave: (ex: Omit<Exhibition, "id">) => void | Promise<void>;
  saving?: boolean;
  managerOptions?: string[];
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    startDate: prefillDate ?? "",
    endDate:   prefillDate ?? "",
  });

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    await onSave({
      name:      form.name.trim(),
      client:    form.client.trim()    || "-",
      pm:        form.pm.trim()        || "-",
      status:    form.status,
      startDate: form.startDate,
      endDate:   form.endDate,
      location:  form.location.trim()  || "-",
      standType: form.standType.trim() || "-",
    });
  }

  const valid = !!form.name.trim() && !!form.startDate && !!form.endDate && form.startDate <= form.endDate;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("chief.calendar.add.title")}</DialogTitle>
          <DialogDescription>{t("chief.calendar.add.description")}</DialogDescription>
        </DialogHeader>
        <ExhibitionForm form={form} onChange={handleChange} managerOptions={managerOptions} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("chief.calendar.add.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving ? t("chief.calendar.add.saving") : t("chief.calendar.add.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// EditEventDialog
// ---------------------------------------------------------------------------

function EditEventDialog({
  exhibition,
  onClose,
  onSave,
  saving,
  managerOptions = [],
}: {
  exhibition: Exhibition;
  onClose: () => void;
  onSave: (ex: Exhibition) => void | Promise<void>;
  saving?: boolean;
  managerOptions?: string[];
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<typeof EMPTY_FORM>({
    name:      exhibition.name,
    client:    exhibition.client,
    pm:        exhibition.pm,
    status:    exhibition.status,
    startDate: exhibition.startDate,
    endDate:   exhibition.endDate,
    location:  exhibition.location,
    standType: exhibition.standType,
  });

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    await onSave({
      ...exhibition,
      name:      form.name.trim(),
      client:    form.client.trim()    || "-",
      pm:        form.pm.trim()        || "-",
      status:    form.status,
      startDate: form.startDate,
      endDate:   form.endDate,
      location:  form.location.trim()  || "-",
      standType: form.standType.trim() || "-",
    });
  }

  const valid = !!form.name.trim() && !!form.startDate && !!form.endDate && form.startDate <= form.endDate;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("chief.calendar.edit.title")}</DialogTitle>
          <DialogDescription>{t("chief.calendar.edit.description")}</DialogDescription>
        </DialogHeader>
        <ExhibitionForm form={form} onChange={handleChange} managerOptions={managerOptions} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("chief.calendar.edit.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving ? t("chief.calendar.edit.saving") : t("chief.calendar.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ChiefCalendar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const requestedPm     = params.get("pm")     ?? "all";
  const requestedSearch = params.get("search") ?? "";
  const now = new Date();

  const [year, setYear]               = useState(now.getFullYear());
  const [month, setMonth]             = useState<number | null>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [addOpen, setAddOpen]         = useState(false);
  const [addPrefill, setAddPrefill]   = useState<string | undefined>();
  const [detailEx, setDetailEx]       = useState<Exhibition | null>(null);
  const [editEx, setEditEx]           = useState<Exhibition | null>(null);
  const [pmFilter, setPmFilter]       = useState(requestedPm);

  useEffect(() => {
    setPmFilter(requestedPm);
  }, [requestedPm]);

  useEffect(() => {
    if (requestedSearch) setSearch(requestedSearch);
  }, [requestedSearch]);
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>("all");
  const [search, setSearch]           = useState(requestedSearch);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    document.title = t("chief.calendar.title");
  }, [t]);

  useEffect(() => {
    let mounted = true;

    getPlatformCalendar()
      .then(({ events }) => {
        if (!mounted) return;
        setExhibitions(events.map(calendarEventToExhibition));
        setError("");
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setExhibitions([]);
        setError(reason instanceof Error ? reason.message : t("chief.calendar.error.load"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [t]);

  const managerOptions = useMemo(
    () => uniqueSorted(exhibitions.map((ex) => ex.pm)),
    [exhibitions],
  );
  const clientOptions = useMemo(
    () => uniqueSorted(exhibitions.map((ex) => ex.client)),
    [exhibitions],
  );
  const filteredExhibitions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exhibitions.filter((ex) => {
      const matchesPm     = pmFilter === "all" || ex.pm === pmFilter;
      const matchesClient = clientFilter === "all" || ex.client === clientFilter;
      const matchesStatus = statusFilter === "all" || ex.status === statusFilter;
      const matchesSearch = !term || [ex.name, ex.client, ex.pm, ex.location, ex.standType, ex.status]
        .some((v) => v.toLowerCase().includes(term));
      return matchesPm && matchesClient && matchesStatus && matchesSearch;
    });
  }, [clientFilter, exhibitions, pmFilter, search, statusFilter]);

  function changeMonth(delta: number) {
    if (month === null) return;
    let newMonth = month + delta;
    let newYear  = year;
    if (newMonth < 0)  { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0;  newYear++; }
    setMonth(newMonth);
    setYear(newYear);
  }

  function goToToday() {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  function openAddEvent(prefillDate?: string) {
    setAddPrefill(prefillDate);
    setAddOpen(true);
  }

  async function handleSave(ex: Omit<Exhibition, "id">) {
    try {
      setIsSaving(true);
      const response = await createCalendarEvent(exhibitionToCalendarInput(ex));
      setExhibitions(response.events.map(calendarEventToExhibition));
      setAddOpen(false);
      setAddPrefill(undefined);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chief.calendar.error.save"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(updated: Exhibition) {
    try {
      setIsSaving(true);
      const response = await updateCalendarEvent(updated.id, exhibitionToCalendarInput(updated));
      setExhibitions(response.events.map(calendarEventToExhibition));
      setEditEx(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chief.calendar.error.update"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      setIsSaving(true);
      const response = await deleteCalendarEvent(id);
      setExhibitions(response.events.map(calendarEventToExhibition));
      setDetailEx(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chief.calendar.error.delete"));
    } finally {
      setIsSaving(false);
    }
  }

  function resetFilters() {
    setPmFilter("all");
    setClientFilter("all");
    setStatusFilter("all");
    setSearch("");
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader
          title={t("chief.calendar.title")}
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: t("chief.calendar.breadcrumb") }]}
        >
          {month === null && (
            <Button size="sm" onClick={() => openAddEvent()}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("chief.calendar.addEvent")}
            </Button>
          )}
        </PageHeader>

        <CalendarFilters
          pmFilter={pmFilter}
          clientFilter={clientFilter}
          statusFilter={statusFilter}
          search={search}
          managerOptions={managerOptions}
          clientOptions={clientOptions}
          resultCount={filteredExhibitions.length}
          onPmChange={setPmFilter}
          onClientChange={setClientFilter}
          onStatusChange={setStatusFilter}
          onSearchChange={setSearch}
          onReset={resetFilters}
        />

        {isLoading && (
          <div className="space-y-4">
            {/* Skeleton month header */}
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
            {/* Skeleton calendar grid */}
            <div className="rounded-lg border bg-card overflow-hidden">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="py-2 px-1 text-center">
                    <Skeleton className="h-3 w-6 mx-auto" />
                  </div>
                ))}
              </div>
              {/* 5 weeks of cells */}
              {Array.from({ length: 5 }).map((_, week) => (
                <div key={week} className="grid grid-cols-7 border-b last:border-0">
                  {Array.from({ length: 7 }).map((__, day) => (
                    <div key={day} className="min-h-[90px] border-r last:border-0 p-2 space-y-1">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      {week === 0 && day < 3 && <Skeleton className="h-4 w-full rounded" />}
                      {week === 1 && day === 2 && <Skeleton className="h-4 w-full rounded" />}
                      {week === 1 && day === 4 && <Skeleton className="h-4 w-4/5 rounded" />}
                      {week === 2 && day === 1 && <Skeleton className="h-4 w-full rounded" />}
                      {week === 2 && day === 5 && <Skeleton className="h-4 w-3/4 rounded" />}
                      {week === 3 && day === 3 && <Skeleton className="h-4 w-full rounded" />}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <Card role="alert" className="border-red-500/40 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-400">{error}</CardContent>
          </Card>
        )}

        {!isLoading && month === null ? (
          <YearView
            year={year}
            exhibitions={filteredExhibitions}
            onYearChange={(y) => setYear(y)}
            onMonthClick={(m) => setMonth(m)}
            onAddEvent={() => openAddEvent()}
          />
        ) : !isLoading ? (
          <MonthView
            year={year}
            month={month!}
            exhibitions={filteredExhibitions}
            onBack={() => setMonth(null)}
            onMonthChange={changeMonth}
            onAddEvent={openAddEvent}
            onDayClick={(ex) => setDetailEx(ex)}
            onGoToToday={goToToday}
          />
        ) : null}
      </div>

      {addOpen && (
        <AddEventDialog
          prefillDate={addPrefill}
          onClose={() => setAddOpen(false)}
          onSave={handleSave}
          saving={isSaving}
          managerOptions={managerOptions}
        />
      )}

      {detailEx && (
        <EventDetailDialog
          exhibition={detailEx}
          onClose={() => setDetailEx(null)}
          onDelete={handleDelete}
          onEdit={(ex) => { setDetailEx(null); setEditEx(ex); }}
          deleting={isSaving}
        />
      )}

      {editEx && (
        <EditEventDialog
          exhibition={editEx}
          onClose={() => setEditEx(null)}
          onSave={handleUpdate}
          saving={isSaving}
          managerOptions={managerOptions}
        />
      )}
    </DashboardLayout>
  );
}
