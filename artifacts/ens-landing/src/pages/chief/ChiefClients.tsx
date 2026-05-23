import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getPlatformClients, type PlatformClient } from "@/lib/platform-api";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

export default function ChiefClients() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detailClient, setDetailClient] = useState<PlatformClient | null>(null);
  const [toast, setToast] = useState("");
  const [newClient, setNewClient] = useState({ name: "", company: "", email: "", exhibition: "" });

  useEffect(() => {
    let mounted = true;

    getPlatformClients()
      .then((data) => {
        if (!mounted) return;
        setClients(data.clients);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : "Unable to load clients");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredClients = clients.filter(client =>
    (statusFilter === "All" || client.status === statusFilter) &&
    (client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.exhibition.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function addClient() {
    const name = newClient.name.trim();
    if (!name) return;
    setClients((current) => [{
      id: `client-${Date.now()}`,
      name,
      company: newClient.company.trim() || name,
      contactName: name,
      contactEmail: newClient.email.trim() || "pending@email.local",
      pm: "Unassigned",
      exhibition: newClient.exhibition.trim() || "New Exhibition",
      status: "Pending",
      lastActivity: "Just now",
    }, ...current]);
    setNewClient({ name: "", company: "", email: "", exhibition: "" });
    setAddOpen(false);
    showToast(`${name} added to clients`);
  }

  function assignManager(clientId: string) {
    setClients((current) => current.map((client) => (
      client.id === clientId ? { ...client, pm: client.pm === "Unassigned" ? "John Doe" : "Jane Smith", lastActivity: "Just now" } : client
    )));
    showToast("Manager assignment updated");
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader 
          title="Clients Management" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Clients" }]}
        >
          <Button onClick={() => setAddOpen(true)} data-testid="button-add-client">
            <UserPlus className="mr-2 h-4 w-4" /> Add Client
          </Button>
        </PageHeader>

        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

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
                <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)} data-testid="button-filter-clients">
                  <Filter className="mr-2 h-4 w-4" /> {statusFilter === "All" ? "Filters" : statusFilter}
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
                    <TableCell>{client.company}</TableCell>
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
                          <DropdownMenuItem className="cursor-pointer" onClick={() => assignManager(client.id)}>
                            <UserCheck className="mr-2 h-4 w-4" /> Assign Manager
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => {
                            showToast(`Opening ${client.name} in Chief monitor`);
                            navigate("/chief/workspace-monitor");
                          }}>
                            <ExternalLink className="mr-2 h-4 w-4" /> Open Workspace
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => setDetailClient(client)}>
                            View Client Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredClients.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading clients from PostgreSQL..." : "No clients found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Client</DialogTitle>
              <DialogDescription>Create a client record in this chief view.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              {[
                ["name", "Client Name", "TechCorp Industries"],
                ["company", "Company", "TechCorp"],
                ["email", "Contact Email", "contact@company.com"],
                ["exhibition", "Exhibition", "TechCon 2026"],
              ].map(([key, label, placeholder]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`client-${key}`}>{label}</Label>
                  <Input
                    id={`client-${key}`}
                    value={newClient[key as keyof typeof newClient]}
                    placeholder={placeholder}
                    onChange={(event) => setNewClient((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={addClient} disabled={!newClient.name.trim()}>Add Client</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filter Clients</DialogTitle>
              <DialogDescription>Show clients by status.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {["All", "Active", "Pending", "Delayed", "Completed"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  onClick={() => { setStatusFilter(status); setFilterOpen(false); }}
                >
                  {status}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detailClient} onOpenChange={(open) => !open && setDetailClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{detailClient?.name}</DialogTitle>
              <DialogDescription>{detailClient?.company}</DialogDescription>
            </DialogHeader>
            {detailClient && (
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{detailClient.contactName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{detailClient.contactEmail}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">PM</span><span>{detailClient.pm}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Exhibition</span><span>{detailClient.exhibition}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{detailClient.status}</span></div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
