import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Download, TrendingUp, Users, CheckCircle, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

const WEEKLY: Record<string, {name:string;tasks:number;revisions:number;approvals:number}[]> = {
  'This Week': [
    { name:'Mon', tasks:14, revisions:3, approvals:2 },
    { name:'Tue', tasks:19, revisions:5, approvals:4 },
    { name:'Wed', tasks:16, revisions:2, approvals:3 },
    { name:'Thu', tasks:24, revisions:6, approvals:5 },
    { name:'Fri', tasks:30, revisions:8, approvals:7 },
    { name:'Sat', tasks:8,  revisions:1, approvals:1 },
    { name:'Sun', tasks:5,  revisions:0, approvals:0 },
  ],
  'Last Week': [
    { name:'Mon', tasks:10, revisions:2, approvals:1 },
    { name:'Tue', tasks:15, revisions:4, approvals:2 },
    { name:'Wed', tasks:12, revisions:3, approvals:2 },
    { name:'Thu', tasks:18, revisions:4, approvals:3 },
    { name:'Fri', tasks:22, revisions:5, approvals:4 },
    { name:'Sat', tasks:6,  revisions:1, approvals:0 },
    { name:'Sun', tasks:3,  revisions:0, approvals:0 },
  ],
};
const PROJECT_EFFICIENCY = [
  { name:'TechCon 2024',   efficiency:92, onTime:95, satisfaction:4.9 },
  { name:'HealthExpo',     efficiency:74, onTime:68, satisfaction:4.2 },
  { name:'AutoShow',       efficiency:88, onTime:84, satisfaction:4.7 },
  { name:'EcoFair',        efficiency:80, onTime:79, satisfaction:4.5 },
  { name:'RetailPeak',     efficiency:67, onTime:60, satisfaction:3.9 },
];
const STATUS_PIE = [
  { name:'Active',    value:4, color:'#2f7d3a' },
  { name:'Pending',   value:2, color:'#d97706' },
  { name:'Review',    value:1, color:'#1d4ed8' },
  { name:'Delayed',   value:1, color:'#dc2626' },
];
const REVISION_TREND = [
  { month:'Mar', revisions:18, changes:12 },
  { month:'Apr', revisions:22, changes:14 },
  { month:'May', revisions:15, changes:8  },
  { month:'Jun', revisions:28, changes:18 },
  { month:'Jul', revisions:20, changes:11 },
  { month:'Aug', revisions:32, changes:20 },
];

const PERIOD_OPTIONS = ['This Week','Last Week'] as const;
type Period = typeof PERIOD_OPTIONS[number];

const STATS = [
  { label:'Completion Rate', value:'94.2%', delta:'+2.1%', up:true,  icon:CheckCircle, color:'text-green-600' },
  { label:'Client Satisfaction', value:'4.8/5', delta:'+0.2', up:true,  icon:TrendingUp, color:'text-blue-600' },
  { label:'Active Clients',  value:'8',     delta:'+1',    up:true,  icon:Users,       color:'text-purple-600' },
  { label:'Avg Response',    value:'2.1h',  delta:'-0.3h', up:true,  icon:Clock,       color:'text-orange-600' },
];

const TT_STYLE = { backgroundColor:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:6, fontSize:11 };

export default function PMReports() {
  const [period, setPeriod] = useState<Period>('This Week');

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader title="Performance Reports" breadcrumbs={[{label:'Dashboard',href:'/pm'},{label:'Reports'}]}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
              {PERIOD_OPTIONS.map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded transition-all ${period===p?'bg-background shadow-sm text-foreground':'text-muted-foreground hover:text-foreground'}`}>
                  {p}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
              <Download className="h-3.5 w-3.5"/> Export
            </button>
          </div>
        </PageHeader>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STATS.map(s => (
            <div key={s.label} className="border rounded-lg bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.color}`}/>
              </div>
              <p className="text-2xl font-bold font-mono mb-1">{s.value}</p>
              <div className={`flex items-center gap-1 text-[10px] font-mono ${s.up?'text-green-600':'text-red-500'}`}>
                {s.up ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
                {s.delta} vs last period
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly Productivity */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Weekly Productivity</CardTitle>
              <CardDescription className="text-[10px] font-mono">Tasks, revisions and approvals · {period}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={WEEKLY[period]} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}/>
                  <RTooltip contentStyle={TT_STYLE}/>
                  <Legend iconType="circle" wrapperStyle={{fontSize:10}}/>
                  <Bar dataKey="tasks"     name="Tasks"     fill="#1d4ed8" radius={[3,3,0,0]} barSize={10}/>
                  <Bar dataKey="revisions" name="Revisions" fill="#c2410c" radius={[3,3,0,0]} barSize={10}/>
                  <Bar dataKey="approvals" name="Approvals" fill="#2f7d3a" radius={[3,3,0,0]} barSize={10}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project efficiency */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Project Efficiency</CardTitle>
              <CardDescription className="text-[10px] font-mono">Design efficiency vs on-time delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={PROJECT_EFFICIENCY} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false}/>
                  <XAxis type="number" domain={[0,100]} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/>
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={76}/>
                  <RTooltip contentStyle={TT_STYLE} formatter={(v:number)=>`${v}%`}/>
                  <Legend iconType="circle" wrapperStyle={{fontSize:10}}/>
                  <Bar dataKey="efficiency" name="Efficiency" fill="#1d4ed8" radius={[0,3,3,0]} barSize={8}/>
                  <Bar dataKey="onTime"     name="On-Time"   fill="#2f7d3a" radius={[0,3,3,0]} barSize={8}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revision trend */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Revision & Change Trend</CardTitle>
              <CardDescription className="text-[10px] font-mono">Monthly revision requests vs change orders</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={REVISION_TREND}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="chgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c2410c" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#c2410c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}/>
                  <RTooltip contentStyle={TT_STYLE}/>
                  <Legend iconType="circle" wrapperStyle={{fontSize:10}}/>
                  <Area type="monotone" dataKey="revisions" name="Revisions" stroke="#1d4ed8" strokeWidth={2} fill="url(#revGrad)" dot={{r:3,fill:'#1d4ed8'}}/>
                  <Area type="monotone" dataKey="changes"   name="Changes"   stroke="#c2410c" strokeWidth={2} fill="url(#chgGrad)" dot={{r:3,fill:'#c2410c'}}/>
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project Status pie */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Project Status Breakdown</CardTitle>
              <CardDescription className="text-[10px] font-mono">Current distribution across all projects</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={STATUS_PIE} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {STATUS_PIE.map((e, i) => <Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <RTooltip contentStyle={TT_STYLE}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2.5">
                {STATUS_PIE.map(s => (
                  <div key={s.name} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:s.color}}/>
                    <span className="text-xs font-medium">{s.name}</span>
                    <span className="text-xs font-mono text-muted-foreground ml-auto">{s.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t mt-1">
                  <span className="text-xs font-mono text-muted-foreground">Total: {STATUS_PIE.reduce((s,p)=>s+p.value,0)} projects</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
