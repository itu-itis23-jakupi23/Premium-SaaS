import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Download, TrendingUp, TrendingDown, Users, Briefcase, Star, Calendar } from "lucide-react";

type Range = '3M' | '6M' | '12M';

const REVENUE_DATA: Record<Range, {month:string;revenue:number;target:number;projects:number}[]> = {
  '3M': [
    { month:'Jun', revenue:67000, target:60000, projects:20 },
    { month:'Jul', revenue:71000, target:65000, projects:22 },
    { month:'Aug', revenue:69000, target:68000, projects:21 },
  ],
  '6M': [
    { month:'Mar', revenue:48000, target:45000, projects:14 },
    { month:'Apr', revenue:61000, target:55000, projects:18 },
    { month:'May', revenue:55000, target:58000, projects:16 },
    { month:'Jun', revenue:67000, target:60000, projects:20 },
    { month:'Jul', revenue:71000, target:65000, projects:22 },
    { month:'Aug', revenue:69000, target:68000, projects:21 },
  ],
  '12M': [
    { month:'Sep', revenue:38000, target:40000, projects:11 },
    { month:'Oct', revenue:42000, target:42000, projects:12 },
    { month:'Nov', revenue:44000, target:43000, projects:13 },
    { month:'Dec', revenue:39000, target:38000, projects:10 },
    { month:'Jan', revenue:45000, target:44000, projects:12 },
    { month:'Feb', revenue:52000, target:48000, projects:15 },
    { month:'Mar', revenue:48000, target:45000, projects:14 },
    { month:'Apr', revenue:61000, target:55000, projects:18 },
    { month:'May', revenue:55000, target:58000, projects:16 },
    { month:'Jun', revenue:67000, target:60000, projects:20 },
    { month:'Jul', revenue:71000, target:65000, projects:22 },
    { month:'Aug', revenue:69000, target:68000, projects:21 },
  ],
};

const PM_PERFORMANCE = [
  { name:'Sarah M.',  projects:12, satisfaction:4.9, onTime:96, revenue:84000 },
  { name:'Alex K.',   projects:9,  satisfaction:4.7, onTime:88, revenue:62000 },
  { name:'Jordan L.', projects:8,  satisfaction:4.5, onTime:82, revenue:54000 },
  { name:'Maya R.',   projects:10, satisfaction:4.8, onTime:91, revenue:71000 },
  { name:'Chris P.',  projects:7,  satisfaction:4.3, onTime:78, revenue:48000 },
];
const SYSTEM_PIE = [
  { name:'Maxima',   value:62, color:'#1d4ed8' },
  { name:'Octanorm', value:38, color:'#c2410c' },
];
const BOTTLENECK_DATA = [
  { name:'TechCon 2024',   waitDays:3, stage:'Client Review' },
  { name:'HealthExpo',     waitDays:6, stage:'Approval' },
  { name:'RetailPeak',     waitDays:8, stage:'Change Req.' },
  { name:'EcoFair Stand',  waitDays:2, stage:'Design Rev.' },
];
const MONTHLY_TREND = REVENUE_DATA['12M'].map(d => ({
  month: d.month,
  revenue: d.revenue,
  projects: d.projects,
  satisfaction: (4.2 + Math.random()*0.8).toFixed(1),
}));

const TT_STYLE = { backgroundColor:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:6, fontSize:11 };

const KPI = [
  { label:'Total Revenue',    value:'$328K',  delta:'+12.5%', up:true,  icon:TrendingUp,   color:'text-green-600' },
  { label:'Active Projects',  value:'22',     delta:'+4',     up:true,  icon:Briefcase,    color:'text-blue-600' },
  { label:'Team Members',     value:'5 PMs',  delta:'Stable', up:true,  icon:Users,        color:'text-purple-600' },
  { label:'Avg Satisfaction', value:'4.8/5',  delta:'+0.3',   up:true,  icon:Star,         color:'text-orange-600' },
];

export default function ChiefReports() {
  const [range, setRange] = useState<Range>('6M');

  const revenueData = REVENUE_DATA[range];
  const totalRevenue = revenueData.reduce((s,d) => s+d.revenue, 0);
  const totalProjects = revenueData.reduce((s,d) => s+d.projects, 0);

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader title="Reports & Analytics" breadcrumbs={[{label:'Chief',href:'/chief'},{label:'Reports'}]}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
              {(['3M','6M','12M'] as const).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded transition-all ${range===r?'bg-background shadow-sm text-foreground':'text-muted-foreground hover:text-foreground'}`}>
                  {r}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
              data-testid="button-export-pdf">
              <Download className="h-3.5 w-3.5"/> Export PDF
            </button>
          </div>
        </PageHeader>

        {/* KPI row */}
        <div className="grid gap-4 grid-cols-4">
          {KPI.map(k => (
            <div key={k.label} className="border rounded-lg bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{k.label}</p>
                <k.icon className={`h-4 w-4 ${k.color}`}/>
              </div>
              <p className="text-2xl font-bold font-mono">{k.label==='Total Revenue'?`$${(totalRevenue/1000).toFixed(0)}K`:k.value}</p>
              <p className={`text-[10px] font-mono mt-1 ${k.up?'text-green-600':'text-red-500'}`}>{k.delta} vs prev period</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue vs Target */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Revenue vs Target</CardTitle>
              <CardDescription className="text-[10px] font-mono">
                {range} · Total: ${(totalRevenue/1000).toFixed(0)}K · {totalProjects} projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenueData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`$${v/1000}k`}/>
                  <RTooltip contentStyle={TT_STYLE} formatter={(v:number)=>`$${v.toLocaleString()}`}/>
                  <Legend iconType="circle" wrapperStyle={{fontSize:10}}/>
                  <Bar dataKey="revenue" name="Revenue" fill="#1d4ed8" radius={[3,3,0,0]} barSize={14}/>
                  <Bar dataKey="target"  name="Target"  fill="#d1d5db" radius={[3,3,0,0]} barSize={14}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* PM Performance */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">PM Performance</CardTitle>
              <CardDescription className="text-[10px] font-mono">Projects completed vs on-time delivery rate</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={PM_PERFORMANCE} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false}/>
                  <XAxis type="number" domain={[0,100]} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/>
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={60}/>
                  <RTooltip contentStyle={TT_STYLE}/>
                  <Legend iconType="circle" wrapperStyle={{fontSize:10}}/>
                  <Bar dataKey="onTime"       name="On-Time %"    fill="#1d4ed8" radius={[0,3,3,0]} barSize={8}/>
                  <Bar dataKey="satisfaction" name="Satisfaction" fill="#2f7d3a" radius={[0,3,3,0]} barSize={8} tickFormatter={(v:number)=>v.toFixed(1)}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trend + system split */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">12-Month Revenue Trend</CardTitle>
              <CardDescription className="text-[10px] font-mono">Revenue trajectory over the past year</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={MONTHLY_TREND}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`$${v/1000}k`}/>
                  <RTooltip contentStyle={TT_STYLE} formatter={(v:number)=>`$${v.toLocaleString()}`}/>
                  <Area type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={2} fill="url(#revFill)" dot={{r:3,fill:'#1d4ed8'}}/>
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* System split + bottlenecks */}
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">System Split & Bottlenecks</CardTitle>
              <CardDescription className="text-[10px] font-mono">System usage and client wait times</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 items-center">
              {/* Pie */}
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={SYSTEM_PIE} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={4} dataKey="value">
                      {SYSTEM_PIE.map((e,i) => <Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <RTooltip contentStyle={TT_STYLE}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {SYSTEM_PIE.map(s => (
                    <div key={s.name} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{background:s.color}}/>
                      <span className="font-mono">{s.name} {s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottleneck list */}
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Bottlenecks</p>
                {BOTTLENECK_DATA.map(b => (
                  <div key={b.name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-medium truncate">{b.name}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{b.stage}</p>
                    </div>
                    <span className={`text-[9.5px] font-mono font-bold ml-2 px-1.5 py-0.5 rounded shrink-0 ${b.waitDays>=5?'bg-red-50 text-red-600':'bg-orange-50 text-orange-600'}`}>
                      {b.waitDays}d
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PM ranking table */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">PM Leaderboard</CardTitle>
            <CardDescription className="text-[10px] font-mono">Ranked by client satisfaction · {range}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Rank','PM','Projects','On-Time','Satisfaction','Revenue'].map(h=>(
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...PM_PERFORMANCE].sort((a,b) => b.satisfaction-a.satisfaction).map((pm, i) => (
                  <tr key={pm.name} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2.5">
                      <span className={`font-mono font-bold text-xs ${i===0?'text-yellow-500':i===1?'text-gray-400':i===2?'text-orange-600':'text-muted-foreground'}`}>
                        #{i+1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-primary">{pm.name.split(' ').map(n=>n[0]).join('')}</span>
                        </div>
                        <span className="font-semibold text-xs">{pm.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{pm.projects}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div style={{height:4,width:60,borderRadius:2,background:'#e5e7eb',overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pm.onTime}%`,background:'#1d4ed8',borderRadius:2}}/>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{pm.onTime}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono font-bold text-xs ${pm.satisfaction >= 4.8 ? 'text-green-600' : pm.satisfaction >= 4.5 ? 'text-blue-600' : 'text-orange-600'}`}>
                        ★ {pm.satisfaction}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">${(pm.revenue/1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
