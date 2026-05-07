import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Monitor, 
  Activity, 
  Maximize2,
  Users,
  Clock,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChiefWorkspaceMonitor() {
  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader 
          title="Workspace Monitor" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Monitor" }]}
        >
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-muted-foreground">12 Active Now</span>
            </div>
            <Button size="sm" variant="outline" data-testid="button-refresh-monitor">
              Refresh All
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mockProjects.map((project) => (
            <Card key={project.id} className="bg-card/50 backdrop-blur-sm border-border overflow-hidden hover:border-primary/50 transition-all group">
              <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1 animate-pulse" /> Live
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-maximize-workspace-${project.id}`}>
                    <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* CSS 3D Booth Wireframe Preview */}
                <div className="relative h-40 w-full bg-black/40 rounded-lg overflow-hidden border border-muted/50 flex items-center justify-center perspective-[1000px]">
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--primary)_0%,_transparent_70%)] opacity-5" />
                   {/* Minimal CSS 3D Box for Booth Preview */}
                   <div className="w-24 h-24 preserve-3d rotate-x-12 rotate-y-45 animate-booth-float">
                      <div className="absolute inset-0 border-2 border-primary/40 bg-primary/5 translate-z-12" />
                      <div className="absolute inset-0 border-2 border-primary/40 bg-primary/5 -translate-z-12" />
                      <div className="absolute inset-0 border-2 border-primary/40 bg-primary/5 rotate-y-90 translate-z-12" />
                      <div className="absolute inset-0 border-2 border-primary/40 bg-primary/5 rotate-y-90 -translate-z-12" />
                      <div className="absolute inset-0 border-2 border-primary/40 bg-primary/5 rotate-x-90 translate-z-12" />
                      <div className="absolute inset-0 border-2 border-primary/40 bg-primary/5 rotate-x-90 -translate-z-12" />
                   </div>
                   <div className="absolute bottom-2 right-2 flex gap-1">
                      <Layers className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">V4.2</span>
                   </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm truncate pr-2">{project.name}</h3>
                    <Badge className="text-[9px] h-4">{project.system}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="truncate">{project.client}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{project.lastUpdate}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-muted/50">
                  <div className="flex -space-x-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-bold">
                        U{i}
                      </div>
                    ))}
                  </div>
                  <Button size="sm" className="h-7 text-[10px]" data-testid={`button-open-workspace-${project.id}`}>
                    Join Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <style>{`
        .perspective-[1000px] { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .rotate-x-12 { transform: rotateX(12deg); }
        .rotate-y-45 { transform: rotateY(45deg); }
        .translate-z-12 { transform: translateZ(3rem); }
        .-translate-z-12 { transform: translateZ(-3rem); }
        .rotate-y-90 { transform: rotateY(90deg); }
        .rotate-x-90 { transform: rotateX(90deg); }
        @keyframes booth-float {
          0%, 100% { transform: rotateX(12deg) rotateY(45deg) translateY(0); }
          50% { transform: rotateX(15deg) rotateY(50deg) translateY(-5px); }
        }
        .animate-booth-float { animation: booth-float 6s ease-in-out infinite; }
      `}</style>
    </DashboardLayout>
  );
}
