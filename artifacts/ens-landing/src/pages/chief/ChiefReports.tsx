import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadExcelWorkbook } from "@/lib/excel-export";
import { getChiefReport, recordReportExport, type ChiefReportPayload } from "@/lib/platform-api";
import { ArrowUpDown, BarChart3, Briefcase, ChevronUp, ChevronDown, Download, ExternalLink, Star, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Range = "3M" | "6M" | "12M";

const TT_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 11,
};

function averageSatisfaction(rows: Array<{ satisfaction: number }>) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + row.satisfaction, 0) / rows.length;
}

type LeaderboardSortField = "projects" | "onTime" | "satisfaction" | "revenue";
type SortDir = "asc" | "desc";

export default function ChiefReports() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [range, setRange] = useState<Range>("6M");
  const [leaderboardSort, setLeaderboardSort] = useState<{ field: LeaderboardSortField; dir: SortDir }>({ field: "satisfaction", dir: "desc" });
  const [report, setReport] = useState<ChiefReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = t("chief.reports.title");
  }, [t]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getChiefReport(range)
      .then((payload) => {
        if (!mounted) return;
        setReport(payload);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setReport(null);
        setError(reason instanceof Error ? reason.message : t("chief.reports.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [range, t]);

  const revenueData    = report?.revenueData    ?? [];
  const pmPerformance  = report?.pmPerformance  ?? [];
  const systemPie      = report?.systemSplit    ?? [];
  const bottleneckData = report?.bottlenecks    ?? [];
  const monthlyTrend   = report?.monthlyTrend   ?? [];
  const totalRevenue   = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const totalTarget    = revenueData.reduce((sum, item) => sum + item.target, 0);
  const totalProjects  = revenueData.reduce((sum, item) => sum + item.projects, 0);

  const sortedPmPerformance = useMemo(() => {
    const { field, dir } = leaderboardSort;
    return [...pmPerformance].sort((a, b) => {
      const diff = a[field] - b[field];
      return dir === "desc" ? -diff : diff;
    });
  }, [pmPerformance, leaderboardSort]);

  function toggleSort(field: LeaderboardSortField) {
    setLeaderboardSort((current) =>
      current.field === field
        ? { field, dir: current.dir === "desc" ? "asc" : "desc" }
        : { field, dir: "desc" },
    );
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function exportReport() {
    downloadExcelWorkbook(`ens-chief-report-${range}.xls`, [
      {
        name: "Summary",
        rows: [
          [t("chief.reports.export.colReport"), t("chief.reports.export.colRange"), t("chief.reports.export.colExportedAt"), t("chief.reports.export.colRevenue"), t("chief.reports.export.colTarget"), t("chief.reports.export.colProjects")],
          ["ENS Chief Report", range, new Date().toLocaleString(), totalRevenue, totalTarget, totalProjects],
        ],
      },
      {
        name: "Revenue vs Target",
        rows: [
          [t("chief.reports.table.month"), t("chief.reports.export.colRevenueDollar"), t("chief.reports.export.colTargetDollar"), t("chief.reports.table.projects")],
          ...revenueData.map((item) => [item.month, item.revenue, item.target, item.projects]),
          [t("chief.reports.export.rowTotals"), totalRevenue, totalTarget, totalProjects],
        ],
      },
      {
        name: "PM Performance",
        rows: [
          [t("chief.reports.table.pm"), t("chief.reports.table.projects"), t("chief.reports.export.colOnTimePct"), t("chief.reports.table.satisfaction"), t("chief.reports.export.colRevenueDollar")],
          ...[...pmPerformance]
            .sort((a, b) => b.satisfaction - a.satisfaction)
            .map((pm) => [pm.name, pm.projects, pm.onTime, pm.satisfaction, pm.revenue]),
        ],
      },
      {
        name: "System Split",
        rows: [[t("chief.reports.export.colSystem"), t("chief.reports.export.colShare")], ...systemPie.map((s) => [s.name, s.value])],
      },
      {
        name: "Bottlenecks",
        rows: [
          [t("chief.reports.export.colProject"), t("chief.reports.export.colWaitDays"), t("chief.reports.export.colStage")],
          ...bottleneckData.map((item) => [item.name, item.waitDays, item.stage]),
        ],
      },
    ]);
    void recordReportExport({ report: "Chief analytics report", range, format: "xls" });
    showToast(t("chief.reports.toast.exported"));
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader
          title={t("chief.reports.title")}
          breadcrumbs={[{ label: t("chief.nav.dashboard"), href: "/chief" }, { label: t("chief.nav.reports") }]}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
              {(["3M", "6M", "12M"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setRange(item)}
                  aria-pressed={range === item}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all ${range === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              onClick={exportReport}
              aria-label={t("chief.reports.exportExcel")}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
              data-testid="button-export-excel"
            >
              <Download className="h-3.5 w-3.5" />
              {t("chief.reports.exportExcel")}
            </button>
          </div>
        </PageHeader>

        {error && (
          <Card role="alert" className="border-yellow-500/40 bg-yellow-500/5">
            <CardContent className="p-4 text-sm text-yellow-500">
              {error}
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && totalRevenue === 0 && (
          <Card role="status" className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 text-sm text-blue-500">
              {t("chief.reports.revenueNotice")}
            </CardContent>
          </Card>
        )}

        {/* KPI tiles */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          ) : (
            <>
              <KpiTile label={t("chief.reports.kpi.revenue")} value={totalRevenue ? `$${(totalRevenue / 1000).toFixed(0)}K` : t("chief.reports.notConfigured")} detail={t("chief.reports.kpi.revenueDetail")} icon={TrendingUp} />
              <KpiTile label={t("chief.reports.kpi.projects")} value={String(totalProjects)} detail={t("chief.reports.kpi.projectsDetail", { range })} icon={Briefcase} />
              <KpiTile label={t("chief.reports.kpi.pms")} value={`${pmPerformance.length}`} detail={t("chief.reports.kpi.pmsDetail")} icon={Users} />
              <KpiTile label={t("chief.reports.kpi.satisfaction")} value={averageSatisfaction(pmPerformance) ? `${averageSatisfaction(pmPerformance).toFixed(1)}/5` : t("chief.reports.notConfigured")} detail={t("chief.reports.kpi.satisfactionDetail")} icon={Star} />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue vs Target */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("chief.reports.cards.revenueTitle")}</CardTitle>
              <CardDescription className="text-[10px]">
                {t("chief.reports.cards.revenueDesc", {
                  range,
                  total: (totalRevenue / 1000).toFixed(0),
                  projects: totalProjects,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[240px] w-full" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={revenueData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v) / 1000}k`} />
                    <RTooltip contentStyle={TT_STYLE} formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="revenue" name={t("chief.reports.chart.revenue")} fill="#1d4ed8" radius={[3, 3, 0, 0]} barSize={14} />
                    <Bar dataKey="target"  name={t("chief.reports.chart.target")}  fill="#d1d5db" radius={[3, 3, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* PM Performance */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("chief.reports.cards.pmPerfTitle")}</CardTitle>
              <CardDescription className="text-[10px]">{t("chief.reports.cards.pmPerfDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[240px] w-full" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pmPerformance} layout="vertical" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={70} />
                    <RTooltip contentStyle={TT_STYLE} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="onTime"       name={t("chief.reports.chart.onTimePct")}   fill="#1d4ed8" radius={[0, 3, 3, 0]} barSize={8} />
                    <Bar dataKey="satisfaction" name={t("chief.reports.chart.satisfaction")} fill="#2f7d3a" radius={[0, 3, 3, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 12-Month Revenue Trend */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("chief.reports.cards.trendTitle")}</CardTitle>
              <CardDescription className="text-[10px]">{t("chief.reports.cards.trendDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[210px] w-full" /> : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={monthlyTrend}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1d4ed8" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v) / 1000}k`} />
                    <RTooltip contentStyle={TT_STYLE} formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Area type="monotone" dataKey="revenue" name={t("chief.reports.chart.revenue")} stroke="#1d4ed8" strokeWidth={2} fill="url(#revFill)" dot={{ r: 3, fill: "#1d4ed8" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* System Split & Bottlenecks */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{t("chief.reports.cards.systemTitle")}</CardTitle>
              <CardDescription className="text-[10px]">{t("chief.reports.cards.systemDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 items-center">
              {isLoading ? (
                <>
                  <Skeleton className="h-[140px] w-full rounded-full" />
                  <div className="space-y-2.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div className="space-y-1"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-20" /></div>
                        <Skeleton className="h-5 w-8 rounded" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={systemPie} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={4} dataKey="value">
                          {systemPie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                        </Pie>
                        <RTooltip contentStyle={TT_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="mb-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                      {t("chief.reports.bottlenecks")}
                    </p>
                    {bottleneckData.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => navigate(`/chief/calendar?search=${encodeURIComponent(item.name)}`)}
                        className="flex w-full items-center justify-between border-b border-border/40 py-1.5 last:border-0 text-left hover:bg-muted/10 rounded transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10.5px] font-medium group-hover:text-primary transition-colors">{item.name}</p>
                          <p className="text-[9px] text-muted-foreground">{item.stage}</p>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${item.waitDays >= 5 ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"}`}>
                            {item.waitDays}d
                          </span>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* PM Leaderboard */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">{t("chief.reports.leaderboardTitle")}</CardTitle>
            <CardDescription className="text-[10px]">
              {t("chief.reports.leaderboardDesc", { range })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("chief.reports.table.rank")}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("chief.reports.table.pm")}
                  </th>
                  {(["projects", "onTime", "satisfaction", "revenue"] as LeaderboardSortField[]).map((field) => {
                    const isSorted = leaderboardSort.field === field;
                    return (
                      <th key={field} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => toggleSort(field)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          aria-label={`Sort by ${field}`}
                        >
                          {t(`chief.reports.table.${field}`)}
                          {isSorted
                            ? leaderboardSort.dir === "desc"
                              ? <ChevronDown className="h-3 w-3" />
                              : <ChevronUp className="h-3 w-3" />
                            : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-3 py-2.5"><Skeleton className="h-3 w-full max-w-[60px]" /></td>
                        ))}
                      </tr>
                    ))
                  : sortedPmPerformance.map((pm, index) => (
                  <tr key={pm.name} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2.5 font-bold text-muted-foreground">#{index + 1}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold">{pm.name}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{pm.projects}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{pm.onTime}%</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-green-600">{pm.satisfaction}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">${(pm.revenue / 1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Always-rendered ARIA live toast */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl transition-all duration-300 ${toast ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
      >
        {toast}
      </div>
    </DashboardLayout>
  );
}

function KpiTile({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}
