import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ChevronLeft, ChevronRight, CalendarDays, Plus, MapPin, User, Building2, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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

const INITIAL_EXHIBITIONS: Exhibition[] = [
  { id: "e1",  name: "TechCon 2024",         client: "TechCorp Industries", pm: "John Doe",   status: "Completed", startDate: "2024-08-10", endDate: "2024-08-15", location: "Berlin",     standType: "Maxima" },
  { id: "e2",  name: "HealthExpo 2024",       client: "MediLife",           pm: "Jane Smith", status: "Completed", startDate: "2024-07-18", endDate: "2024-07-22", location: "Amsterdam",  standType: "Octanorm" },
  { id: "e3",  name: "AutoShow 2024",         client: "FastCars Co",        pm: "Mike Ross",  status: "Completed", startDate: "2024-09-01", endDate: "2024-09-05", location: "Frankfurt",  standType: "Maxima" },
  { id: "e4",  name: "FoodFair 2024",         client: "GreenBite Ltd",      pm: "Sarah Chen", status: "Completed", startDate: "2024-10-12", endDate: "2024-10-16", location: "Paris",      standType: "Modular" },
  { id: "e5",  name: "BuildExpo 2024",        client: "ConstructPro",       pm: "John Doe",   status: "Completed", startDate: "2024-11-05", endDate: "2024-11-09", location: "Milan",      standType: "Octanorm" },
  { id: "e6",  name: "RetailWorld 2024",      client: "ShopNow Inc",        pm: "Jane Smith", status: "Completed", startDate: "2024-12-03", endDate: "2024-12-07", location: "Dubai",      standType: "Maxima" },
  { id: "e7",  name: "TechCon 2025",         client: "TechCorp Industries", pm: "John Doe",   status: "Completed", startDate: "2025-03-10", endDate: "2025-03-14", location: "Berlin",     standType: "Maxima" },
  { id: "e8",  name: "MedDevice Expo 2025",  client: "MediLife",           pm: "Sarah Chen", status: "Completed", startDate: "2025-04-22", endDate: "2025-04-26", location: "Vienna",     standType: "Octanorm" },
  { id: "e9",  name: "AutoShow 2025",         client: "FastCars Co",        pm: "Mike Ross",  status: "Completed", startDate: "2025-05-08", endDate: "2025-05-12", location: "Geneva",     standType: "Maxima" },
  { id: "e10", name: "GreenEnergy 2025",      client: "EcoTech Solutions",  pm: "Jane Smith", status: "Completed", startDate: "2025-06-18", endDate: "2025-06-22", location: "Copenhagen", standType: "Modular" },
  { id: "e11", name: "FoodFair 2025",         client: "GreenBite Ltd",      pm: "Sarah Chen", status: "Completed", startDate: "2025-09-15", endDate: "2025-09-19", location: "Paris",      standType: "Modular" },
  { id: "e12", name: "FinTech Summit 2025",   client: "BankPlus Group",     pm: "John Doe",   status: "Completed", startDate: "2025-10-07", endDate: "2025-10-10", location: "London",     standType: "Maxima" },
  { id: "e13", name: "RetailWorld 2025",      client: "ShopNow Inc",        pm: "Mike Ross",  status: "Completed", startDate: "2025-11-20", endDate: "2025-11-24", location: "Dubai",      standType: "Maxima" },
  { id: "e14", name: "BuildExpo 2025",        client: "ConstructPro",       pm: "Jane Smith", status: "Completed", startDate: "2025-12-02", endDate: "2025-12-06", location: "Milan",      standType: "Octanorm" },
  { id: "e15", name: "TechCon 2026",         client: "TechCorp Industries", pm: "John Doe",   status: "Active",    startDate: "2026-03-18", endDate: "2026-03-22", location: "Berlin",     standType: "Maxima" },
  { id: "e16", name: "HealthExpo 2026",       client: "MediLife",           pm: "Sarah Chen", status: "Active",    startDate: "2026-04-14", endDate: "2026-04-18", location: "Amsterdam",  standType: "Octanorm" },
  { id: "e17", name: "AutoShow 2026",         client: "FastCars Co",        pm: "Mike Ross",  status: "Pending",   startDate: "2026-05-20", endDate: "2026-05-24", location: "Geneva",     standType: "Maxima" },
  { id: "e18", name: "SpaceTech Expo 2026",   client: "OrbitSys Corp",      pm: "Jane Smith", status: "Pending",   startDate: "2026-06-10", endDate: "2026-06-14", location: "Houston",    standType: "Modular" },
  { id: "e19", name: "GreenEnergy 2026",      client: "EcoTech Solutions",  pm: "John Doe",   status: "Pending",   startDate: "2026-09-08", endDate: "2026-09-12", location: "Copenhagen", standType: "Modular" },
  { id: "e20", name: "FoodFair 2026",         client: "GreenBite Ltd",      pm: "Sarah Chen", status: "Delayed",   startDate: "2026-10-20", endDate: "2026-10-24", location: "Paris",      standType: "Modular" },
  { id: "e21", name: "FinTech Summit 2026",   client: "BankPlus Group",     pm: "Mike Ross",  status: "Pending",   startDate: "2026-11-09", endDate: "2026-11-12", location: "London",     standType: "Maxima" },
  { id: "e22", name: "RetailWorld 2026",      client: "ShopNow Inc",        pm: "Jane Smith", status: "Pending",   startDate: "2026-12-01", endDate: "2026-12-05", location: "Dubai",      standType: "Maxima" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<Exhibition["status"], string> = {
  Active:    "border-green-500/60 text-green-400 bg-green-500/10",
  Completed: "border-blue-500/60 text-blue-400 bg-blue-500/10",
  Delayed:   "border-red-500/60 text-red-400 bg-red-500/10",
  Pending:   "border-yellow-500/60 text-yellow-400 bg-yellow-500/10",
};

const STATUS_BAR: Record<Exhibition["status"], string> = {
  Active:    "bg-green-500",
  Completed: "bg-blue-500",
  Delayed:   "bg-red-500",
  Pending:   "bg-yellow-500",
};

const STATUS_DOT: Record<Exhibition["status"], string> = {
  Active:    "bg-green-500",
  Completed: "bg-blue-500",
  Delayed:   "bg-red-500",
  Pending:   "bg-yellow-500",
};

type CalendarStatusFilter = "all" | Exhibition["status"];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function exhibitionsForDay(exhibitions: Exhibition[], dateStr: string) {
  return exhibitions.filter((ex) => ex.startDate <= dateStr && ex.endDate >= dateStr);
}

function exhibitionsForMonth(exhibitions: Exhibition[], year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return exhibitions.filter((ex) => ex.startDate <= isoDate(end) && ex.endDate >= isoDate(start));
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const EMPTY_FORM = {
  name: "", client: "", pm: "", status: "Pending" as Exhibition["status"],
  startDate: "", endDate: "", location: "", standType: "",
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function CalendarFilters({
  pmFilter,
  clientFilter,
  statusFilter,
  search,
  managerOptions,
  clientOptions,
  resultCount,
  onPmChange,
  onClientChange,
  onStatusChange,
  onSearchChange,
  onReset,
}: {
  pmFilter: string;
  clientFilter: string;
  statusFilter: CalendarStatusFilter;
  search: string;
  managerOptions: string[];
  clientOptions: string[];
  resultCount: number;
  onPmChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onStatusChange: (value: CalendarStatusFilter) => void;
  onSearchChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card/40 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_150px_auto] lg:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search exhibition, client, city"
            className="pl-9"
          />
        </div>
        <Select value={pmFilter} onValueChange={onPmChange}>
          <SelectTrigger>
            <SelectValue placeholder="Project manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All managers</SelectItem>
            {managerOptions.map((manager) => (
              <SelectItem key={manager} value={manager}>{manager}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={onClientChange}>
          <SelectTrigger>
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clientOptions.map((client) => (
              <SelectItem key={client} value={client}>{client}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => onStatusChange(value as CalendarStatusFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Delayed">Delayed</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="h-9 px-3">{resultCount} shown</Badge>
          <Button variant="outline" size="icon" onClick={onReset} aria-label="Reset filters">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

// Year overview

function YearView({
  year, exhibitions,
  onYearChange, onMonthClick, onAddEvent,
}: {
  year: number;
  exhibitions: Exhibition[];
  onYearChange: (y: number) => void;
  onMonthClick: (m: number) => void;
  onAddEvent: () => void;
}) {
  const yearCount = exhibitions.filter(
    (ex) => new Date(ex.startDate).getFullYear() === year
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => onYearChange(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-2xl font-bold w-20 text-center">{year}</span>
          <Button variant="outline" size="icon" onClick={() => onYearChange(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {(Object.keys(STATUS_DOT) as Exhibition["status"][]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                {s}
              </span>
            ))}
          </div>
          <span className="text-sm text-muted-foreground hidden sm:block">
            <CalendarDays className="inline h-4 w-4 mr-1" />
            {yearCount} exhibition{yearCount !== 1 ? "s" : ""}
          </span>
          <Button size="sm" onClick={onAddEvent}>
            <Plus className="mr-2 h-4 w-4" /> Add Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MONTHS.map((monthName, idx) => {
          const exs = exhibitionsForMonth(exhibitions, year, idx);
          const isPast = new Date(year, idx + 1, 0) < new Date();
          return (
            <Card
              key={monthName}
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
                  <p className="text-xs text-muted-foreground">No exhibitions</p>
                ) : (
                  exs.map((ex) => (
                    <div key={ex.id} className="flex items-center gap-1.5 text-xs">
                      <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", STATUS_DOT[ex.status])} />
                      <span className="truncate text-foreground/80">{ex.name}</span>
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

// Month calendar grid

function MonthView({
  year, month, exhibitions,
  onBack, onMonthChange, onAddEvent, onDayClick,
}: {
  year: number;
  month: number;
  exhibitions: Exhibition[];
  onBack: () => void;
  onMonthChange: (delta: number) => void;
  onAddEvent: (prefillDate?: string) => void;
  onDayClick: (ex: Exhibition) => void;
}) {
  const cells = buildCalendarGrid(year, month);
  const today = isoDate(new Date());

  return (
    <div className="space-y-4">
      {/* Month header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4 mr-1" /> All months
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-lg font-bold min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button size="sm" onClick={() => onAddEvent()}>
          <Plus className="mr-2 h-4 w-4" /> Add Event
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 bg-background">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="min-h-[110px] border-b border-r border-border/40 bg-muted/10" />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayExs = exhibitionsForDay(exhibitions, dateStr);
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
                  title="Add event on this day"
                >
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 group-hover:bg-muted group-hover:text-foreground",
                  )}>
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
                        STATUS_BAR[ex.status].replace("bg-", "border-l-"),
                        ex.status === "Active"    && "bg-green-500/15 text-green-300 border-l-green-500",
                        ex.status === "Completed" && "bg-blue-500/15 text-blue-300 border-l-blue-500",
                        ex.status === "Delayed"   && "bg-red-500/15 text-red-300 border-l-red-500",
                        ex.status === "Pending"   && "bg-yellow-500/15 text-yellow-300 border-l-yellow-500",
                      )}
                      title={ex.name}
                    >
                      {ex.name}
                    </button>
                  ))}
                  {dayExs.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{dayExs.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month exhibitions list */}
      {(() => {
        const monthExs = exhibitionsForMonth(exhibitions, year, month);
        if (monthExs.length === 0) return null;
        return (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {monthExs.length} Exhibition{monthExs.length !== 1 ? "s" : ""} this month
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
                      {ex.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{ex.client}</p>
                    <p className="flex items-center gap-1.5"><User className="h-3 w-3" />{ex.pm}</p>
                    <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{ex.location}</p>
                    <p className="text-foreground/50">{ex.startDate} - {ex.endDate}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Event detail dialog

function EventDetailDialog({
  exhibition,
  onClose,
  onDelete,
}: {
  exhibition: Exhibition;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{exhibition.name}</DialogTitle>
          <DialogDescription>Exhibition details</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Badge variant="outline" className={cn("text-sm", STATUS_STYLES[exhibition.status])}>
            {exhibition.status}
          </Badge>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground mb-0.5">Client</p><p className="font-medium">{exhibition.client}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">Project Manager</p><p className="font-medium">{exhibition.pm}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">Location</p><p className="font-medium">{exhibition.location}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">Stand Type</p><p className="font-medium">{exhibition.standType}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">Start Date</p><p className="font-medium">{exhibition.startDate}</p></div>
            <div><p className="text-xs text-muted-foreground mb-0.5">End Date</p><p className="font-medium">{exhibition.endDate}</p></div>
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={() => { onDelete(exhibition.id); onClose(); }}>
            Delete Event
          </Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add event dialog

function AddEventDialog({
  prefillDate,
  onClose,
  onSave,
}: {
  prefillDate?: string;
  onClose: () => void;
  onSave: (ex: Exhibition) => void;
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    startDate: prefillDate ?? "",
    endDate: prefillDate ?? "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSave() {
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    onSave({
      id: `e-${Date.now()}`,
      name: form.name.trim(),
      client: form.client.trim() || "-",
      pm: form.pm.trim() || "-",
      status: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
      location: form.location.trim() || "-",
      standType: form.standType.trim() || "-",
    });
    onClose();
  }

  const valid = form.name.trim() && form.startDate && form.endDate && form.startDate <= form.endDate;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Exhibition Event</DialogTitle>
          <DialogDescription>Schedule a new exhibition on the calendar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ev-name">Exhibition Name *</Label>
              <Input id="ev-name" placeholder="e.g. TechCon 2027" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-client">Client</Label>
              <Input id="ev-client" placeholder="Client company" value={form.client} onChange={(e) => set("client", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-pm">Project Manager</Label>
              <Input id="ev-pm" placeholder="PM name" value={form.pm} onChange={(e) => set("pm", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-start">Start Date *</Label>
              <Input id="ev-start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">End Date *</Label>
              <Input id="ev-end" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-location">Location</Label>
              <Input id="ev-location" placeholder="City / Venue" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-stand">Stand Type</Label>
              <Input id="ev-stand" placeholder="e.g. Maxima" value={form.standType} onChange={(e) => set("standType", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Delayed">Delayed</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!valid}>Save Event</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main page

export default function ChiefCalendar() {
  const [location] = useLocation();
  const requestedPm = new URLSearchParams(location.split("?")[1] ?? "").get("pm") ?? "all";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>(INITIAL_EXHIBITIONS);
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<string | undefined>();
  const [detailEx, setDetailEx] = useState<Exhibition | null>(null);
  const [pmFilter, setPmFilter] = useState(requestedPm);
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>("all");
  const [search, setSearch] = useState("");

  const managerOptions = useMemo(() => uniqueSorted(exhibitions.map((exhibition) => exhibition.pm)), [exhibitions]);
  const clientOptions = useMemo(() => uniqueSorted(exhibitions.map((exhibition) => exhibition.client)), [exhibitions]);
  const filteredExhibitions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exhibitions.filter((exhibition) => {
      const matchesPm = pmFilter === "all" || exhibition.pm === pmFilter;
      const matchesClient = clientFilter === "all" || exhibition.client === clientFilter;
      const matchesStatus = statusFilter === "all" || exhibition.status === statusFilter;
      const matchesSearch = !term || [
        exhibition.name,
        exhibition.client,
        exhibition.pm,
        exhibition.location,
        exhibition.standType,
        exhibition.status,
      ].some((value) => value.toLowerCase().includes(term));
      return matchesPm && matchesClient && matchesStatus && matchesSearch;
    });
  }, [clientFilter, exhibitions, pmFilter, search, statusFilter]);

  function changeMonth(delta: number) {
    if (month === null) return;
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0)  { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0;  newYear++; }
    setMonth(newMonth);
    setYear(newYear);
  }

  function openAddEvent(prefillDate?: string) {
    setAddPrefill(prefillDate);
    setAddOpen(true);
  }

  function handleSave(ex: Exhibition) {
    setExhibitions((prev) => [...prev, ex]);
  }

  function handleDelete(id: string) {
    setExhibitions((prev) => prev.filter((e) => e.id !== id));
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
          title="Exhibition Calendar"
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Calendar" }]}
        >
          {month === null && (
            <Button size="sm" onClick={() => openAddEvent()}>
              <Plus className="mr-2 h-4 w-4" /> Add Event
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

        {month === null ? (
          <YearView
            year={year}
            exhibitions={filteredExhibitions}
            onYearChange={(y) => setYear(y)}
            onMonthClick={(m) => setMonth(m)}
            onAddEvent={() => openAddEvent()}
          />
        ) : (
          <MonthView
            year={year}
            month={month}
            exhibitions={filteredExhibitions}
            onBack={() => setMonth(null)}
            onMonthChange={changeMonth}
            onAddEvent={openAddEvent}
            onDayClick={(ex) => setDetailEx(ex)}
          />
        )}
      </div>

      {addOpen && (
        <AddEventDialog
          prefillDate={addPrefill}
          onClose={() => setAddOpen(false)}
          onSave={handleSave}
        />
      )}

      {detailEx && (
        <EventDetailDialog
          exhibition={detailEx}
          onClose={() => setDetailEx(null)}
          onDelete={handleDelete}
        />
      )}
    </DashboardLayout>
  );
}
