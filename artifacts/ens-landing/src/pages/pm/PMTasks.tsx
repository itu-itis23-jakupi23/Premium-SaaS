import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Plus, Calendar, Clock, AlertCircle } from "lucide-react";

const columns = [
  {
    id: "todo",
    title: "To Do",
    tasks: [
      { id: "t1", title: "Finalize TechCon furniture", client: "TechCorp", priority: "High", deadline: "Aug 12" },
      { id: "t2", title: "Send contract for HealthExpo", client: "MediLife", priority: "Medium", deadline: "Aug 15" },
    ]
  },
  {
    id: "inprogress",
    title: "In Progress",
    tasks: [
      { id: "t3", title: "3D Modeling for AutoShow", client: "FastCars Co", priority: "High", deadline: "Today" },
      { id: "t4", title: "Revision A: MediLife", client: "MediLife", priority: "Medium", deadline: "Aug 11" },
    ]
  },
  {
    id: "done",
    title: "Done",
    tasks: [
      { id: "t5", title: "Initial Proposal: TechCon", client: "TechCorp", priority: "Low", deadline: "Aug 5" },
    ]
  }
];

export default function PMTasks() {
  return (
    <DashboardLayout role="pm">
      <PageHeader 
        title="Tasks Kanban" 
        breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "Tasks" }]} 
      >
        <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New Task</Button>
      </PageHeader>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                {col.title}
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{col.tasks.length}</Badge>
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </div>

            <div className="flex flex-col gap-3">
              {col.tasks.map((task) => (
                <Card key={task.id} className="bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-colors cursor-pointer group shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className={cn(
                        "text-[10px] h-5 px-1.5",
                        task.priority === "High" ? "border-red-500/50 text-red-500 bg-red-500/5" :
                        task.priority === "Medium" ? "border-yellow-500/50 text-yellow-500 bg-yellow-500/5" :
                        "border-blue-500/50 text-blue-500 bg-blue-500/5"
                      )}>
                        {task.priority}
                      </Badge>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">PM</AvatarFallback>
                      </Avatar>
                    </div>
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight mb-2">
                      {task.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">{task.client}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                        <Clock className="h-3 w-3" />
                        {task.deadline}
                      </div>
                      {task.priority === "High" && <AlertCircle className="h-3 w-3 text-red-500" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="ghost" className="w-full border border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary text-xs h-12 dashed gap-2">
                <Plus className="h-3 w-3" /> Add Task
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
