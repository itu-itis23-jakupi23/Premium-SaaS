import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockClients } from "@/lib/mock-data";
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  MoreVertical, 
  UserPlus, 
  ExternalLink, 
  UserCheck, 
  Filter 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ChiefClients() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = mockClients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.exhibition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader 
          title="Clients Management" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Clients" }]}
        >
          <Button data-testid="button-add-client">
            <UserPlus className="mr-2 h-4 w-4" /> Add Client
          </Button>
        </PageHeader>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search clients or exhibitions..." 
                  className="pl-9 bg-muted/50 border-transparent focus:border-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-clients"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" data-testid="button-filter-clients">
                  <Filter className="mr-2 h-4 w-4" /> Filters
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-muted">
                  <TableHead>Client Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Assigned PM</TableHead>
                  <TableHead>Exhibition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} className="border-muted hover:bg-muted/30">
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.name}</TableCell> {/* Mock data doesn't have company separate, using name */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">
                          {client.pm.split(' ').map(n => n[0]).join('')}
                        </div>
                        {client.pm}
                      </div>
                    </TableCell>
                    <TableCell>{client.exhibition}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={cn(
                          "bg-opacity-10",
                          client.status === 'Active' ? 'bg-green-500 text-green-500' :
                          client.status === 'Pending' ? 'bg-yellow-500 text-yellow-500' :
                          client.status === 'Delayed' ? 'bg-red-500 text-red-500' : 'bg-blue-500 text-blue-500'
                        )}
                      >
                        {client.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{client.lastActivity}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-client-${client.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem className="cursor-pointer">
                            <UserCheck className="mr-2 h-4 w-4" /> Assign Manager
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">
                            <ExternalLink className="mr-2 h-4 w-4" /> Open Workspace
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">
                            View Client Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

import { cn } from "@/lib/utils";
