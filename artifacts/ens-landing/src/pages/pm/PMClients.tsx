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
import { Search, Monitor, Send, MessageSquare, MoreHorizontal } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

export default function PMClients() {
  return (
    <DashboardLayout role="pm">
      <PageHeader 
        title="My Clients" 
        breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "My Clients" }]} 
      />

      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search clients or projects..." className="pl-9 bg-card/50" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Filter</Button>
            <Button>Add Client</Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Exhibition Name</TableHead>
                <TableHead>Booth Dimensions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Interaction</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProjects.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-foreground">{project.client}</TableCell>
                  <TableCell>{project.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{project.dimensions}</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">{project.system}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      project.status === "Active" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                      project.status === "Delayed" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                      "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    )}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{project.lastUpdate}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href="/pm/workspace">
                        <Button variant="ghost" size="icon" title="Open Workspace">
                          <Monitor className="h-4 w-4" />
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2">
                            <Send className="h-4 w-4" /> Send Design
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <MessageSquare className="h-4 w-4" /> Message Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
