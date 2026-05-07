import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  Download, 
  Calendar, 
  FileText, 
  TrendingUp, 
  PieChart as PieIcon 
} from "lucide-react";

const revenueData = [
  { month: "Jan", revenue: 45000, projects: 12 },
  { month: "Feb", revenue: 52000, projects: 15 },
  { month: "Mar", revenue: 48000, projects: 14 },
  { month: "Apr", revenue: 61000, projects: 18 },
  { month: "May", revenue: 55000, projects: 16 },
  { month: "Jun", revenue: 67000, projects: 20 },
];

export default function ChiefReports() {
  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader 
          title="Reports & Analytics" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Reports" }]}
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" data-testid="button-date-range">
              <Calendar className="mr-2 h-4 w-4" /> Last 6 Months
            </Button>
            <Button size="sm" data-testid="button-export-pdf">
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-2xl">$328,000</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-green-500">
                <TrendingUp className="h-3 w-3" /> +12.5% from last period
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription>Avg. Project Value</CardDescription>
              <CardTitle className="text-2xl">$18,450</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-green-500">
                <TrendingUp className="h-3 w-3" /> +4.2% from last period
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription>Project Efficiency</CardDescription>
              <CardTitle className="text-2xl">94.2%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" /> 48 projects tracked
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription>Client Retention</CardDescription>
              <CardTitle className="text-2xl">88%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-primary">
                <PieIcon className="h-3 w-3" /> 12 new clients
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Revenue vs Projects</CardTitle>
              <CardDescription>Comparison of revenue growth and project count</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{fill: 'hsl(var(--primary))'}} />
                  <Line yAxisId="right" type="monotone" dataKey="projects" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{fill: 'hsl(var(--secondary))'}} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>System Popularity</CardTitle>
              <CardDescription>Usage of Maxima vs Octanorm systems</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Maxima', value: 65 },
                  { name: 'Octanorm', value: 35 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.1)'}}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
