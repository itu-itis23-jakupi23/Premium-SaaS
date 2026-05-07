import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockManagers } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Star, 
  Briefcase, 
  MessageSquare, 
  MoreVertical, 
  UserPlus,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export default function ChiefManagers() {
  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader 
          title="Managers Management" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Managers" }]}
        >
          <Button data-testid="button-invite-manager">
            <UserPlus className="mr-2 h-4 w-4" /> Invite Manager
          </Button>
        </PageHeader>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockManagers.map((manager) => (
            <Card key={manager.id} className="bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarImage src="" alt={manager.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {manager.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{manager.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{manager.role}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-actions-manager-${manager.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Assign Clients</DropdownMenuItem>
                    <DropdownMenuItem>View Projects</DropdownMenuItem>
                    <DropdownMenuItem className="text-primary">
                      <Send className="mr-2 h-3 w-3" /> Send Reminder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Workload</span>
                  <span className={cn(
                    "font-medium",
                    manager.workload > 80 ? "text-red-500" : "text-green-500"
                  )}>{manager.workload}%</span>
                </div>
                <Progress value={manager.workload} className="h-1.5" />
                
                <div className="grid grid-cols-2 gap-4 py-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3" /> Active Projects
                    </div>
                    <p className="text-sm font-bold">{manager.projects}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> Performance
                    </div>
                    <p className="text-sm font-bold">{manager.rating}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <Badge 
                    variant="outline"
                    className={cn(
                      manager.status === 'Active' ? 'border-green-500 text-green-500 bg-green-500/5' : 'border-yellow-500 text-yellow-500 bg-yellow-500/5'
                    )}
                  >
                    {manager.status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" data-testid={`button-message-manager-${manager.id}`}>
                    <MessageSquare className="mr-2 h-3 w-3" /> Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
