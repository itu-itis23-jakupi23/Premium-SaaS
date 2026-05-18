import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { mockStats, mockActivity } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  MessageSquare,
  ClipboardCheck,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const tasks = [
  { id: 1, title: "Update TechCon furniture layout", priority: "High", deadline: "Today" },
  { id: 2, title: "Review MediLife branding", priority: "Medium", deadline: "Tomorrow" },
  { id: 3, title: "Send quote for AutoShow", priority: "Low", deadline: "Aug 12" },
  { id: 4, title: "Finalize Octanorm structure for GlobalExhibit", priority: "High", deadline: "Today" },
];

const actionItems = [
  { title: "3 pending revisions", description: "TechCorp Industries requested changes to the lighting.", action: "View Revisions", color: "border-yellow-500" },
  { title: "Client waiting", description: "MediLife has been waiting for an update for 2 days.", action: "Send Update", color: "border-red-500" },
  { title: "Ready for approval", description: "AutoShow Premium Stand is ready for final review.", action: "Send for Approval", color: "border-blue-500" },
];

export default function PMDashboard() {
  return (
    <DashboardLayout role="pm">
      <PageHeader 
        title="Project Manager Dashboard" 
        breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "Overview" }]} 
      />
      
      <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {mockStats.pm.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Task List */}
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Active Tasks
            </CardTitle>
            <Button variant="outline" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                  <div className="flex items-center gap-3">
                    <Checkbox id={`task-${task.id}`} />
                    <div>
                      <label htmlFor={`task-${task.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                        {task.title}
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {task.deadline}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-1 py-0 h-4",
                          task.priority === "High" ? "border-red-500/50 text-red-500 bg-red-500/10" :
                          task.priority === "Medium" ? "border-yellow-500/50 text-yellow-500 bg-yellow-500/10" :
                          "border-blue-500/50 text-blue-500 bg-blue-500/10"
                        )}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Items */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 px-1">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Action Items
          </h3>
          {actionItems.map((card, i) => (
            <Card key={i} className={cn("bg-card/50 backdrop-blur-sm border-l-4", card.color)}>
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm">{card.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {card.description}
                </p>
                <Button variant="link" className="h-auto p-0 mt-2 text-primary text-xs font-medium">
                  {card.action} →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <Card className="mt-8 bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-muted before:via-muted before:to-transparent">
            {mockActivity.map((item) => (
              <div key={item.id} className="relative flex items-start gap-4 pl-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background border border-border z-10">
                  {item.type === 'update' ? <Clock className="h-5 w-5 text-blue-500" /> : 
                   item.type === 'message' ? <MessageSquare className="h-5 w-5 text-green-500" /> : 
                   <AlertCircle className="h-5 w-5 text-yellow-500" />}
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">{item.user}</span> {item.action} 
                    <span className="font-medium text-primary ml-1">{item.project}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
