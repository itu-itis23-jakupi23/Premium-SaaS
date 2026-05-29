import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { Skeleton } from "@/components/ui/skeleton";
import { getPmReport, recordReportExport, type PmReportPayload } from "@/lib/platform-api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Download, TrendingUp, Users, CheckCircle, Clock,
  ArrowUpRight, ArrowDownRight, type LucideIcon,
} from "lucide-react";

/* ─── Static chart data (keys are language-neutral) ────────────────────────── */
const PERIOD_KEYS = ["this_week", "last_week", "this_month", "last_month", "this_quarter"] as const;
type PeriodKey = typeof PERIOD_KEYS[number];

interface StatItem {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  icon: LucideIcon;
  color: string;
}

const TT_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 11,
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
const DAY_KEY_TO_INDEX: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
};
const MONTH_KEY_TO_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function localizeDay(key: string, locale: string): string {
  const idx = DAY_KEY_TO_INDEX[key];
  if (idx === undefined) return key;
  // 2024-01-01 is a Monday; 2024-01-07 is Sunday
  const date = new Date(2024, 0, idx === 0 ? 7 : idx);
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
}

function localizeMonth(key: string, locale: string): string {
  const idx = MONTH_KEY_TO_INDEX[key];
  if (idx === undefined) return key;
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2024, idx, 1));
}

function signed(value: number, suffix: string): string {
  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${value >= 0 ? "+" : ""}${rounded}${suffix}`;
}

function hasNumericData(rows: Array<Record<string, unknown>>, keys: string[]) {
  return rows.some((row) => keys.some((key) => Number(row[key] ?? 0) > 0));
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────────────────── */
export default function PMReports() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<PeriodKey>("this_week");
  const [report, setReport] = useState<PmReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMsg,     setToastMsg]     = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    document.title = t("pm.reports.title");
  }, [t]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getPmReport(period)
      .then((payload) => {
        if (!mounted) return;
        setReport(payload);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setReport(null);
        setError(reason instanceof Error ? reason.message : t("pm.reports.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [period, t]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3000);
  }

  function exportReport() {
    const exportedAt = new Date().toLocaleString(i18n.language);
    const exportDate = new Date().toISOString().slice(0, 10);

    downloadExcelWorkbook(`ens-pm-report-${period}-${exportDate}.xls`, [
      {
        name: "Summary",
        rows: [
          ["Report", "Period", "Exported At", "Source", "Data Status", "Completion Rate", "Satisfaction", "Active Clients", "Avg Response Hours"],
          [
            "ENS PM Report",
            t(`pm.reports.period.${period}`),
            exportedAt,
            "PostgreSQL",
            hasReportData ? "Data available" : "No rows for this period",
            report?.stats.completionRate ?? 0,
            report?.stats.satisfaction ?? "",
            report?.stats.activeClients ?? 0,
            Number((report?.stats.avgResponseHours ?? 0).toFixed(1)),
          ],
        ],
      },
      {
        name: "Weekly Activity",
        rows: [
          ["Day", "Tasks", "Revisions", "Approvals"],
          ...weeklyData.map((item) => [formatDay(item.key), item.tasks, item.revisions, item.approvals]),
        ],
      },
      {
        name: "Project Efficiency",
        rows: [
          ["Project", "Efficiency", "On-Time"],
          ...projectEfficiency.map((item) => [item.name, item.efficiency, item.onTime]),
        ],
      },
      {
        name: "Revision Trend",
        rows: [
          ["Month", "Revisions", "Changes"],
          ...revisionTrend.map((item) => [formatMonth(item.month), item.revisions, item.changes]),
        ],
      },
      {
        name: "Status",
        rows: [
          ["Status", "Projects"],
          ...statusPie.map((item) => [item.name, item.value]),
        ],
      },
    ]);
    void recordReportExport({ report: "PM performance report", range: period, format: "xls" });
    showToast(t("pm.reports.toast.exported"));
  }

  /* Translated stats (rebuilt when language changes) */
  const stats = useMemo<StatItem[]>(() => [
    {
      label: t("pm.reports.stats.completionRate"),
      value: `${report?.stats.completionRate ?? 0}%`,
      delta: signed(report?.stats.completionRateDelta ?? 0, "%"),
      up: (report?.stats.completionRateDelta ?? 0) >= 0,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      label: t("pm.reports.stats.satisfaction"),
      value: report?.stats.satisfaction === null || report?.stats.satisfaction === undefined ? "N/A" : `${report.stats.satisfaction.toFixed(1)}/5`,
      delta: report?.stats.satisfactionDelta === null || report?.stats.satisfactionDelta === undefined ? "N/A" : signed(report.stats.satisfactionDelta, ""),
      up: (report?.stats.satisfactionDelta ?? 0) >= 0,
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      label: t("pm.reports.stats.activeClients"),
      value: String(report?.stats.activeClients ?? 0),
      delta: signed(report?.stats.activeClientsDelta ?? 0, ""),
      up: (report?.stats.activeClientsDelta ?? 0) >= 0,
      icon: Users,
      color: "text-purple-600",
    },
    {
      label: t("pm.reports.stats.avgResponse"),
      value: `${(report?.stats.avgResponseHours ?? 0).toFixed(1)}h`,
      delta: signed(report?.stats.avgResponseHoursDelta ?? 0, "h"),
      up: (report?.stats.avgResponseHoursDelta ?? 0) <= 0,
      icon: Clock,
      color: "text-orange-600",
    },
  ], [report, t]);

  /* STATUS_PIE with translated names */
  const statusPie = useMemo(() =>
    (report?.statusPie ?? []).map((s) => ({
      ...s,
      name: t(`pm.reports.pieStatus.${s.key}`),
    })),
  [report, t]);

  /* Localized day/month tick formatters */
  const formatDay   = (key: string) => localizeDay(key, i18n.language);
  const formatMonth = (key: string) => localizeMonth(key, i18n.language);

  const weeklyData = report?.weeklyData ?? [];
  const projectEfficiency = report?.projectEfficiency ?? [];
  const revisionTrend = report?.revisionTrend ?? [];
  const totalProjects = statusPie.reduce((sum, s) => sum + s.value, 0);
  const hasWeeklyData = hasNumericData(weeklyData, ["tasks", "revisions", "approvals"]);
  const hasEfficiencyData = projectEfficiency.length > 0;
  const hasRevisionData = hasNumericData(revisionTrend, ["revisions", "changes"]);
  const hasStatusData = totalProjects > 0;
  const hasReportData = hasWeeklyData || hasEfficiencyData || hasRevisionData || hasStatusData;
  const chartEmptyMessage = isLoading ? t("pm.reports.loading") : t("pm.reports.empty");

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader
          title={t("pm.reports.title")}
          breadcrumbs={[{ label: t("pm.nav.dashboard"), href: "/pm" }, { label: t("pm.nav.reports") }]}
        >
          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
              {PERIOD_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  aria-pressed={period === key}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded transition-all ${period === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t(`pm.reports.period.${key}`)}
                </button>
              ))}
            </div>
            {/* Export */}
            <button
              onClick={exportReport}
              disabled={isLoading}
              aria-label={t("pm.reports.export")}
              className="flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              {t("pm.reports.export")}
            </button>
          </div>
        </PageHeader>

        {error && (
          <Card role="alert" className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border rounded-lg bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                  <Skeleton className="h-7 w-20 mb-1" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              ))
            : stats.map((s) => (
                <div key={s.label} className="border rounded-lg bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</p>
                    <s.icon aria-hidden="true" className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold font-mono mb-1">{s.value}</p>
                  <div className={`flex items-center gap-1 text-[10px] font-mono ${s.up ? "text-green-600" : "text-red-500"}`}>
                    {s.up ? <ArrowUpRight aria-hidden="true" className="h-3 w-3" /> : <ArrowDownRight aria-hidden="true" className="h-3 w-3" />}
                    {s.delta} {t("pm.reports.vsLastPeriod")}
                  </div>
                </div>
              ))
          }
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly Productivity */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("pm.reports.cards.weeklyTitle")}</CardTitle>
              <CardDescription className="text-[10px] font-mono">
                {t("pm.reports.cards.weeklyDesc", { period: t(`pm.reports.period.${period}`) })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div role="img" aria-label={t("pm.reports.cards.weeklyTitle")}>
              {isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : hasWeeklyData ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={weeklyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="key" tickFormatter={formatDay} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <RTooltip contentStyle={TT_STYLE} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="tasks"     name={t("pm.reports.chart.tasks")}     fill="#1d4ed8" radius={[3, 3, 0, 0]} barSize={10} />
                    <Bar dataKey="revisions" name={t("pm.reports.chart.revisions")} fill="#c2410c" radius={[3, 3, 0, 0]} barSize={10} />
                    <Bar dataKey="approvals" name={t("pm.reports.chart.approvals")} fill="#2f7d3a" radius={[3, 3, 0, 0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message={chartEmptyMessage} />
              )}
              </div>
            </CardContent>
          </Card>

          {/* Project Efficiency */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("pm.reports.cards.efficiencyTitle")}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t("pm.reports.cards.efficiencyDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="img" aria-label={t("pm.reports.cards.efficiencyTitle")}>
              {isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : hasEfficiencyData ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={projectEfficiency} layout="vertical" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={76} />
                    <RTooltip contentStyle={TT_STYLE} formatter={(v: number) => `${v}%`} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="efficiency" name={t("pm.reports.chart.efficiency")} fill="#1d4ed8" radius={[0, 3, 3, 0]} barSize={8} />
                    <Bar dataKey="onTime"     name={t("pm.reports.chart.onTime")}     fill="#2f7d3a" radius={[0, 3, 3, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message={chartEmptyMessage} />
              )}
              </div>
            </CardContent>
          </Card>

          {/* Revision & Change Trend */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("pm.reports.cards.revisionTitle")}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t("pm.reports.cards.revisionDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="img" aria-label={t("pm.reports.cards.revisionTitle")}>
              {isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : hasRevisionData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revisionTrend}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1d4ed8" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="chgGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#c2410c" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#c2410c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={formatMonth} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <RTooltip contentStyle={TT_STYLE} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="revisions" name={t("pm.reports.chart.revisions")} stroke="#1d4ed8" strokeWidth={2} fill="url(#revGrad)" dot={{ r: 3, fill: "#1d4ed8" }} />
                    <Area type="monotone" dataKey="changes"   name={t("pm.reports.chart.changes")}   stroke="#c2410c" strokeWidth={2} fill="url(#chgGrad)" dot={{ r: 3, fill: "#c2410c" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message={chartEmptyMessage} />
              )}
              </div>
            </CardContent>
          </Card>

          {/* Project Status Breakdown */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("pm.reports.cards.statusTitle")}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t("pm.reports.cards.statusDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              {isLoading ? (
                <div className="flex w-full items-center gap-6">
                  <Skeleton className="h-[200px] w-[200px] rounded-full shrink-0" />
                  <div className="flex flex-col gap-3 flex-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-8 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasStatusData ? (
                <>
                  <div className="h-[200px] w-1/2 min-w-[200px]" role="img" aria-label={t("pm.reports.cards.statusTitle")}>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={statusPie}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <RTooltip contentStyle={TT_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {statusPie.map((s) => (
                      <div key={s.key} className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-xs font-medium">{s.name}</span>
                        <span className="text-xs font-mono text-muted-foreground ml-auto">{s.value}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t mt-1">
                      <span className="text-xs font-mono text-muted-foreground">
                        {t("pm.reports.total", { count: totalProjects })}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full">
                  <EmptyChart message={chartEmptyMessage} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Always-rendered ARIA live toast */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold shadow-xl z-50 transition-all duration-300 ${toastVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
      >
        {toastMsg}
      </div>
    </DashboardLayout>
  );
}
