import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { mockStats, mockProjects, mockMessages } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { MessageSquare, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ClientDashboard() {
  const activeProject = mockProjects[0];
  const stats = mockStats.client;

  const steps = [
    { label: "Created", status: "completed" },
    { label: "Designing", status: "completed" },
    { label: "Review", status: "active" },
    { label: "Approved", status: "pending" },
    { label: "Production", status: "pending" },
  ];

  return (
    <DashboardLayout role="client">
      <PageHeader 
        title="Welcome back, TechCorp!" 
        breadcrumbs={[{ label: "Dashboard", href: "/client" }]} 
      />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-3">
        {/* Active Project Card */}
        <Card className="md:col-span-2 border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl font-bold">{activeProject.name}</CardTitle>
              <CardDescription>{activeProject.exhibition}</CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {activeProject.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="mt-4 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-background/50 border">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{activeProject.pm}</p>
                    <p className="text-xs text-muted-foreground">Project Manager</p>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-auto" asChild>
                    <Link href="/client/messages">Message</Link>
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium">{activeProject.progress}%</span>
                  </div>
                  <Progress value={activeProject.progress} className="h-2" />
                  
                  {/* Timeline */}
                  <div className="relative mt-8 pt-6">
                    <div className="absolute top-0 left-0 w-full h-1 bg-muted rounded-full" />
                    <div className="absolute top-0 left-0 h-1 bg-primary rounded-full transition-all duration-500" style={{ width: '50%' }} />
                    <div className="flex justify-between">
                      {steps.map((step, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 -mt-1.5">
                          <div className={`w-3 h-3 rounded-full border-2 bg-background z-10 ${
                            step.status === 'completed' ? 'border-primary bg-primary' : 
                            step.status === 'active' ? 'border-primary animate-pulse' : 
                            'border-muted'
                          }`} />
                          <span className={`text-[10px] font-medium uppercase tracking-wider ${
                            step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-48">
                 <Link href="/client/workspace">
                  <div className="group relative aspect-square rounded-lg border-2 border-dashed border-primary/30 bg-background/50 flex flex-col items-center justify-center p-4 cursor-pointer hover:border-primary/60 transition-colors">
                    <div className="w-full h-full relative" style={{ perspective: '800px' }}>
                      <div className="absolute inset-4 border-2 border-primary/20 rounded rotate-x-12 rotate-y-12 transition-transform group-hover:scale-110" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(30deg) rotateY(-20deg)' }}>
                        <div className="absolute inset-0 bg-primary/5 border border-primary/20" />
                        <div className="absolute -right-4 bottom-0 w-4 h-12 bg-primary/10 border border-primary/20" />
                      </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <p className="text-xs font-bold text-primary">VIEW WORKSPACE</p>
                      <ArrowRight className="h-4 w-4 text-primary mt-1" />
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground uppercase font-bold">Workspace Preview</p>
                  </div>
                 </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Recent Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockMessages.slice(0, 2).map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[10px]">{msg.sender === 'You' ? 'YC' : 'PM'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold">{msg.sender}</p>
                    <p className="text-xs text-muted-foreground truncate">{msg.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{msg.time}</p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                <Link href="/client/messages">View All Conversations</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Approval Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Layout Approved</span>
                  </div>
                  <span className="text-muted-foreground">May 12</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-yellow-500">
                    <Clock className="h-3 w-3" />
                    <span>Branding Pending</span>
                  </div>
                  <Button variant="link" className="h-auto p-0 text-[10px]" asChild>
                    <Link href="/client/approvals">Review</Link>
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Final Design</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
