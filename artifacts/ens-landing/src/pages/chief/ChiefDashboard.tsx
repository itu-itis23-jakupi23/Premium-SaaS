import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from "recharts";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { mockStats, chartData, mockActivity } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  ArrowRight, 
  BrainCircuit, 
  Clock, 
  Download
} from "lucide-react";

const insights = [
  {
    title: "Manager Overloaded",
    description: "John Doe is currently handling 12 projects, 30% above average.",
    type: "warning",
    action: "Reassign",
    color: "border-yellow-500"
  },
  {
    title: "Project Stagnation",
    description: "HealthExpo Booth has had no activity for the last 48 hours.",
    type: "danger",
    action: "View Project",
    color: "border-red-500"
  },
  {
    title: "Pending Review",
    description: "Client (MediLife) has not reviewed the latest design version.",
    type: "info",
    action: "Send Reminder",
    color: "border-blue-500"
  },
  {
    title: "Optimization Opportunity",
    description: "Suggested reassignment for AutoShow project to Mike Ross.",
    type: "success",
    action: "Review",
    color: "border-green-500"
  }
];

const managerPerformance = [
  { name: "John Doe", completed: 45 },
  { name: "Jane Smith", completed: 52 },
  { name: "Mike Ross", completed: 38 },
  { name: "Sarah J.", completed: 41 },
];

export default function ChiefDashboard() {
  return (
    <DashboardLayout role="chief">
      <div className="space-y-8">
        <PageHeader 
          title="Chief Dashboard" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Dashboard" }]}
        >
          <Button data-testid="button-export-reports">
            <Download className="mr-2 h-4 w-4" /> Export Reports
          </Button>
        </PageHeader>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {mockStats.chief.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Activity Chart */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Project Activity</CardTitle>
              <CardDescription>Activity across all projects over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.activity}>
                  <defs>
                    <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="projects" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorProjects)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribution Chart */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Project Status</CardTitle>
              <CardDescription>Overall project health distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 ml-4">
                {chartData.distribution.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.name} ({item.value}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          {/* Manager Performance */}
          <Card className="lg:col-span-4 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Manager Performance</CardTitle>
              <CardDescription>Projects completed per manager</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={managerPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.1)'}}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {mockActivity.map((event) => (
                  <div key={event.id} className="flex gap-4">
                    <div className={cn(
                      "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                      event.type === 'update' ? 'bg-blue-500' : 
                      event.type === 'message' ? 'bg-green-500' : 'bg-red-500'
                    )} />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        {event.user} <span className="text-muted-foreground font-normal">{event.action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Project: {event.project}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{event.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="mt-6 w-full text-xs text-primary" data-testid="button-view-all-activity">
                View All Activity
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">AI Management Insights</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {insights.map((insight, i) => (
              <Card key={i} className={cn("bg-card/30 backdrop-blur-sm border-l-4", insight.color)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                  <Button variant="outline" size="sm" className="w-full text-[10px] h-8" data-testid={`button-insight-action-${i}`}>
                    {insight.action} <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
