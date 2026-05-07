import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  Ruler, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  History
} from "lucide-react";

export default function ClientProjects() {
  const project = mockProjects[0];

  return (
    <DashboardLayout role="client">
      <PageHeader 
        title="Project Details" 
        breadcrumbs={[{ label: "Dashboard", href: "/client" }, { label: "Projects" }]} 
      />

      <div className="grid gap-6 mt-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl font-bold">{project.name}</CardTitle>
                  <CardDescription className="text-base">{project.exhibition}</CardDescription>
                </div>
                <Badge className="bg-primary text-primary-foreground">{project.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                {project.description}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-background/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Stand Type</p>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{project.standType}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Dimensions</p>
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{project.dimensions}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Deadline</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{new Date(project.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Last Update</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{project.lastUpdate}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Production Readiness</span>
                  <span className="text-sm font-bold">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Revision History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.revisions?.map((rev) => (
                  <div key={rev.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card/50">
                    <div className={`mt-1 h-2 w-2 rounded-full ${rev.status === 'Approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <p className="text-sm font-bold">{rev.note}</p>
                        <Badge variant="outline" className="text-[10px]">{rev.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{rev.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {project.approvals?.map((approval) => (
                  <div key={approval.id} className="relative pl-6 border-l-2 border-muted last:border-l-0 pb-6 last:pb-0">
                    <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 bg-background ${
                      approval.status === 'Approved' ? 'border-green-500' : 'border-yellow-500 animate-pulse'
                    }`} />
                    <div>
                      <p className="text-sm font-bold leading-none">{approval.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{approval.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                         <Badge className={approval.status === 'Approved' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'}>
                          {approval.status}
                        </Badge>
                        {approval.date !== '-' && <span className="text-[10px] text-muted-foreground">{approval.date}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-6" variant="outline">
                View Full Timeline
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                The Branding Placement design is waiting for your review. Please visit the workspace to provide feedback.
              </p>
              <Button className="w-full text-xs" size="sm">
                Open Workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
