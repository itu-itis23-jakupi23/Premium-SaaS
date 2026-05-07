import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Filter, 
  Briefcase,
  LayoutGrid,
  List
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ChiefProjects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const filteredProjects = mockProjects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.pm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader 
          title="Projects Overview" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Projects" }]}
        >
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            <Button 
              variant={view === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setView('list')}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={view === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setView('grid')}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button data-testid="button-create-project">
            <Briefcase className="mr-2 h-4 w-4" /> New Project
          </Button>
        </PageHeader>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search projects, clients or PMs..." 
                  className="pl-9 bg-muted/50 border-transparent focus:border-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-projects"
                />
              </div>
              <Button variant="outline" size="sm" data-testid="button-filter-projects">
                <Filter className="mr-2 h-4 w-4" /> Filters
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-muted">
                  <TableHead>Project Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id} className="border-muted hover:bg-muted/30">
                    <TableCell className="font-medium max-w-[200px] truncate">{project.name}</TableCell>
                    <TableCell>{project.client}</TableCell>
                    <TableCell>{project.pm}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {project.system}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{project.deadline}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={cn(
                          "bg-opacity-10",
                          project.status === 'Active' ? 'bg-green-500 text-green-500' :
                          project.status === 'Pending' ? 'bg-yellow-500 text-yellow-500' :
                          project.status === 'Delayed' ? 'bg-red-500 text-red-500' : 'bg-blue-500 text-blue-500'
                        )}
                      >
                        {project.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
