import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  getManagerWorkspace,
  invitePlatformManager,
  updateManagerAssignments,
  updateManagerStatus,
} from "@/lib/platform-api";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  ArrowRightLeft,
  Briefcase,
  CalendarDays,
  Clock,
  Grid2X2,
  ListFilter,
  MessageSquare,
  MoreVertical,
  Search,
  Send,
  Star,
  TableProperties,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ManagerStatus = "Active" | "Pending" | "On Leave";
type WorkStatus = "Active" | "Pending" | "Delayed" | "Completed";
type StatusFilter = "all" | ManagerStatus | "High Load";
type ViewMode = "cards" | "table";
type SortMode = "workload-desc" | "workload-asc" | "projects-desc" | "rating-desc";

interface Manager {
  id: string;
  name: string;
  email: string;
  role: string;
  rating: number;
  status: ManagerStatus;
  avatarUrl?: string;
  avatarTone?: string;
}

interface ManagedClient {
  id: string;
  name: string;
  exhibition: string;
  managerId: string | null;
  status: WorkStatus;
  lastActivity: string;
}

interface ManagedProject {
  id: string;
  name: string;
  clientId: string;
  exhibition: string;
  managerId: string | null;
  status: WorkStatus;
  progress: number;
  deadline: string;
  system: string;
}

interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  time: string;
  managerId?: string;
  tone: "info" | "success" | "warning";
}

interface ManagerSummary extends Manager {
  workload: number;
  activeProjects: ManagedProject[];
  allProjects: ManagedProject[];
  clients: ManagedClient[];
  delayedCount: number;
  urgentCount: number;
  nextDeadline: string | null;
}

const INITIAL_MANAGERS: Manager[] = [
  { id: "m1", name: "John Doe", email: "john.doe@ens.test", role: "Project Manager", rating: 4.8, status: "Active" },
  { id: "m2", name: "Jane Smith", email: "jane.smith@ens.test", role: "Project Manager", rating: 4.9, status: "Active" },
  { id: "m3", name: "Mike Ross", email: "mike.ross@ens.test", role: "Project Manager", rating: 4.5, status: "On Leave" },
  { id: "m4", name: "Sarah Chen", email: "sarah.chen@ens.test", role: "Project Manager", rating: 4.7, status: "Active" },
];

const INITIAL_CLIENTS: ManagedClient[] = [
  { id: "c1", name: "TechCorp Industries", exhibition: "TechCon 2026", managerId: "m1", status: "Active", lastActivity: "2 hours ago" },
  { id: "c2", name: "MediLife", exhibition: "HealthExpo 2026", managerId: "m4", status: "Active", lastActivity: "5 hours ago" },
  { id: "c3", name: "FastCars Co", exhibition: "AutoShow 2026", managerId: "m3", status: "Pending", lastActivity: "1 day ago" },
  { id: "c4", name: "OrbitSys Corp", exhibition: "SpaceTech Expo 2026", managerId: "m2", status: "Pending", lastActivity: "3 days ago" },
  { id: "c5", name: "EcoTech Solutions", exhibition: "GreenEnergy 2026", managerId: "m1", status: "Pending", lastActivity: "4 days ago" },
  { id: "c6", name: "GreenBite Ltd", exhibition: "FoodFair 2026", managerId: "m4", status: "Delayed", lastActivity: "Today" },
  { id: "c7", name: "BankPlus Group", exhibition: "FinTech Summit 2026", managerId: null, status: "Pending", lastActivity: "Not assigned" },
];

const INITIAL_PROJECTS: ManagedProject[] = [
  { id: "p1", name: "TechCon Global Exhibit", clientId: "c1", exhibition: "TechCon 2026", managerId: "m1", status: "Active", progress: 76, deadline: "2026-06-04", system: "Maxima" },
  { id: "p2", name: "HealthExpo Modular Booth", clientId: "c2", exhibition: "HealthExpo 2026", managerId: "m4", status: "Active", progress: 68, deadline: "2026-06-12", system: "Octanorm" },
  { id: "p3", name: "AutoShow Premium Stand", clientId: "c3", exhibition: "AutoShow 2026", managerId: "m3", status: "Delayed", progress: 42, deadline: "2026-05-27", system: "Maxima" },
  { id: "p4", name: "SpaceTech Launch Pavilion", clientId: "c4", exhibition: "SpaceTech Expo 2026", managerId: "m2", status: "Pending", progress: 18, deadline: "2026-06-10", system: "Modular" },
  { id: "p5", name: "GreenEnergy Corner Stand", clientId: "c5", exhibition: "GreenEnergy 2026", managerId: "m1", status: "Pending", progress: 8, deadline: "2026-09-08", system: "Modular" },
  { id: "p6", name: "FoodFair Island Booth", clientId: "c6", exhibition: "FoodFair 2026", managerId: "m4", status: "Delayed", progress: 31, deadline: "2026-06-02", system: "Modular" },
  { id: "p7", name: "FinTech Summit Stand", clientId: "c7", exhibition: "FinTech Summit 2026", managerId: null, status: "Pending", progress: 0, deadline: "2026-11-09", system: "Maxima" },
];

const INITIAL_AUDIT: AuditEntry[] = [
  { id: "a1", action: "Workload review", detail: "FoodFair marked as delayed for Sarah Chen.", time: "Today, 09:40", managerId: "m4", tone: "warning" },
  { id: "a2", action: "Assignment", detail: "SpaceTech Expo assigned to Jane Smith.", time: "Yesterday, 16:10", managerId: "m2", tone: "success" },
  { id: "a3", action: "Access", detail: "Mike Ross marked on leave.", time: "May 21, 2026", managerId: "m3", tone: "info" },
];

const MANAGER_STATUS_OPTIONS: StatusFilter[] = ["all", "Active", "Pending", "On Leave", "High Load"];

export default function ChiefManagers() {
  const [, navigate] = useLocation();
  const [managers, setManagers] = useState<Manager[]>(INITIAL_MANAGERS);
  const [clients, setClients] = useState<ManagedClient[]>(INITIAL_CLIENTS);
  const [projects, setProjects] = useState<ManagedProject[]>(INITIAL_PROJECTS);
  const [audit, setAudit] = useState<AuditEntry[]>(INITIAL_AUDIT);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentFocusId, setAssignmentFocusId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState<Record<string, string>>({});
  const [projectDraft, setProjectDraft] = useState<Record<string, string>>({});
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [invite, setInvite] = useState({ name: "", email: "", role: "Project Manager" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("workload-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showAudit, setShowAudit] = useState(true);

  useEffect(() => {
    let mounted = true;

    getManagerWorkspace()
      .then((workspace) => {
        if (!mounted) return;
        setManagers(workspace.managers.map((manager) => ({
          id: manager.id,
          name: manager.name,
          email: manager.email,
          role: manager.role,
          rating: manager.rating,
          status: normalizeManagerStatus(manager.status),
          avatarUrl: manager.avatarUrl,
          avatarTone: manager.avatarTone,
        })));
        setClients(workspace.clients.map((client) => ({
          id: client.id,
          name: client.name,
          exhibition: client.exhibition,
          managerId: client.managerId,
          status: normalizeWorkStatus(client.status),
          lastActivity: client.lastActivity,
        })));
        setProjects(workspace.projects.map((project) => ({
          id: project.id,
          name: project.name,
          clientId: project.clientId,
          exhibition: project.exhibition,
          managerId: project.managerId,
          status: normalizeWorkStatus(project.status),
          progress: project.progress,
          deadline: project.deadline ?? "",
          system: project.system,
        })));
        setAudit(workspace.audit.map((entry) => ({
          id: entry.id,
          action: entry.type,
          detail: `${entry.user} ${entry.action} (${entry.project})`,
          time: entry.time,
          tone: entry.type.includes("delay") ? "warning" : "info",
        })));
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Manager workspace could not be loaded");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const summaries = useMemo(
    () => managers.map((manager) => summarizeManager(manager, clients, projects)),
    [clients, managers, projects],
  );

  const selectedSummary = summaries.find((manager) => manager.id === selectedManagerId) ?? null;

  const filteredManagers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = summaries.filter((manager) => {
      const matchesSearch = !term || [
        manager.name,
        manager.email,
        manager.role,
        ...manager.clients.map((client) => client.name),
        ...manager.allProjects.map((project) => project.name),
      ].some((value) => value.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "High Load" ? manager.workload >= 80 : manager.status === statusFilter);

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "workload-asc") return a.workload - b.workload;
      if (sortMode === "projects-desc") return b.activeProjects.length - a.activeProjects.length;
      if (sortMode === "rating-desc") return b.rating - a.rating;
      return b.workload - a.workload;
    });
  }, [search, sortMode, statusFilter, summaries]);

  const teamLoad = summaries.length
    ? Math.round(summaries.reduce((sum, manager) => sum + manager.workload, 0) / summaries.length)
    : 0;
  const delayedProjects = projects.filter((project) => project.status === "Delayed").length;
  const unassignedItems = clients.filter((client) => !client.managerId).length + projects.filter((project) => !project.managerId).length;

  function addAudit(entry: Omit<AuditEntry, "id" | "time">) {
    setAudit((current) => [
      {
        ...entry,
        id: `a-${Date.now()}`,
        time: "Just now",
      },
      ...current,
    ]);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function submitInvite() {
    const name = invite.name.trim() || invite.email.split("@")[0] || "New Manager";
    try {
      const { invitation } = await invitePlatformManager({ name, email: invite.email.trim() });
      const next: Manager = {
        id: invitation.id,
        name,
        email: invitation.email,
        role: invite.role,
        rating: 0,
        status: "Pending",
      };
      setManagers((current) => [next, ...current]);
      setInvite({ name: "", email: "", role: "Project Manager" });
      setInviteOpen(false);
      addAudit({
        action: "Invitation",
        detail: `Invitation queued for ${name}.`,
        managerId: next.id,
        tone: "success",
      });
      showToast(invitation.inviteUrl ? `Invite created: ${invitation.inviteUrl}` : `Invitation queued for ${name}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Manager invitation could not be created");
    }
  }

  async function toggleStatus(id: string) {
    const manager = managers.find((item) => item.id === id);
    if (!manager) return;

    const nextStatus: ManagerStatus = manager.status === "Active" ? "On Leave" : "Active";
    try {
      await updateManagerStatus(id, nextStatus === "Active" ? "active" : "suspended");
      setManagers((current) => current.map((item) => (
        item.id === id ? { ...item, status: nextStatus } : item
      )));
      addAudit({
        action: "Access",
        detail: `${manager.name} marked ${nextStatus.toLowerCase()}.`,
        managerId: id,
        tone: nextStatus === "Active" ? "success" : "warning",
      });
      showToast("Manager status updated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Manager status could not be updated");
    }
  }

  function openAssignments(managerId?: string) {
    setAssignmentFocusId(managerId ?? null);
    setClientDraft(Object.fromEntries(clients.map((client) => [client.id, client.managerId ?? "unassigned"])));
    setProjectDraft(Object.fromEntries(projects.map((project) => [project.id, project.managerId ?? "unassigned"])));
    setAssignmentOpen(true);
  }

  async function saveAssignments() {
    const managerLabel = (id: string) => managers.find((manager) => manager.id === id)?.name ?? "Unassigned";
    const changedClients = clients.filter((client) => (client.managerId ?? "unassigned") !== clientDraft[client.id]);
    const changedProjects = projects.filter((project) => (project.managerId ?? "unassigned") !== projectDraft[project.id]);

    try {
      await updateManagerAssignments({
        clientAssignments: changedClients.map((client) => ({
          clientId: client.id,
          managerId: clientDraft[client.id] === "unassigned" ? null : clientDraft[client.id],
        })),
        projectAssignments: changedProjects.map((project) => ({
          projectId: project.id,
          managerId: projectDraft[project.id] === "unassigned" ? null : projectDraft[project.id],
        })),
        cascadeClientProjects: false,
      });
      setClients((current) => current.map((client) => ({
        ...client,
        managerId: clientDraft[client.id] === "unassigned" ? null : clientDraft[client.id],
      })));
      setProjects((current) => current.map((project) => ({
        ...project,
        managerId: projectDraft[project.id] === "unassigned" ? null : projectDraft[project.id],
      })));
      setAssignmentOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Assignments could not be saved");
      return;
    }

    if (changedClients.length || changedProjects.length) {
      const focusManager = assignmentFocusId ?? changedProjects[0]?.managerId ?? changedClients[0]?.managerId;
      addAudit({
        action: "Assignment",
        detail: changedProjects.length
          ? `${changedClients.length} client and ${changedProjects.length} project assignment${changedProjects.length === 1 ? "" : "s"} updated.`
          : `${changedClients.length} client assignment${changedClients.length === 1 ? "" : "s"} updated.`,
        managerId: focusManager ?? undefined,
        tone: "success",
      });
      showToast(changedProjects.length ? "Assignments updated" : "Client assignments updated");
      return;
    }

    showToast(`No assignment changes for ${assignmentFocusId ? managerLabel(assignmentFocusId) : "team"}`);
  }

  async function rebalance(id: string) {
    const source = summaries.find((manager) => manager.id === id);
    const targets = summaries.filter((manager) => manager.id !== id && manager.status === "Active");
    if (!source || !targets.length) return;

    const projectToMove = [...source.activeProjects].sort(compareProjectRisk)[0];
    const target = [...targets].sort((a, b) => a.workload - b.workload)[0];

    if (!projectToMove || !target || source.workload < 70) {
      showToast("No urgent rebalance needed");
      return;
    }

    try {
      await updateManagerAssignments({
        clientAssignments: [],
        projectAssignments: [{ projectId: projectToMove.id, managerId: target.id }],
        cascadeClientProjects: false,
      });
      setProjects((current) => current.map((project) => (
        project.id === projectToMove.id ? { ...project, managerId: target.id } : project
      )));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Workload could not be rebalanced");
      return;
    }

    addAudit({
      action: "Rebalance",
      detail: `${projectToMove.name} moved from ${source.name} to ${target.name}.`,
      managerId: target.id,
      tone: "success",
    });
    showToast("Workload rebalanced");
  }

  function sendReminder(manager: ManagerSummary) {
    addAudit({
      action: "Reminder",
      detail: `Reminder sent to ${manager.name} for ${manager.delayedCount || manager.urgentCount || manager.activeProjects.length} priority item(s).`,
      managerId: manager.id,
      tone: manager.delayedCount ? "warning" : "info",
    });
    showToast(`Reminder sent to ${manager.name}`);
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader
          title="Managers Management"
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Managers" }]}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openAssignments()}>
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Assign Clients
            </Button>
            <Button onClick={() => setInviteOpen(true)} data-testid="button-invite-manager">
              <UserPlus className="mr-2 h-4 w-4" /> Invite Manager
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryTile label="Team Load" value={`${teamLoad}%`} icon={Briefcase} tone={teamLoad >= 80 ? "warning" : "info"} />
          <SummaryTile label="Active Managers" value={String(summaries.filter((manager) => manager.status === "Active").length)} icon={Users} tone="success" />
          <SummaryTile label="Delayed Projects" value={String(delayedProjects)} icon={AlertCircle} tone={delayedProjects ? "warning" : "success"} />
          <SummaryTile label="Unassigned Items" value={String(unassignedItems)} icon={Clock} tone={unassignedItems ? "warning" : "info"} />
        </div>

        <section className="rounded-lg border bg-card/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_180px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search managers, clients, projects"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger>
                  <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGER_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option === "all" ? "All statuses" : option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workload-desc">Highest workload</SelectItem>
                  <SelectItem value="workload-asc">Lowest workload</SelectItem>
                  <SelectItem value="projects-desc">Most active projects</SelectItem>
                  <SelectItem value="rating-desc">Best rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("cards")}
                aria-label="Card view"
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("table")}
                aria-label="Table view"
              >
                <TableProperties className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {viewMode === "cards" ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredManagers.map((manager) => (
              <ManagerCard
                key={manager.id}
                manager={manager}
                onAssign={() => openAssignments(manager.id)}
                onCalendar={() => navigate(`/chief/calendar?pm=${encodeURIComponent(manager.name)}`)}
                onDetails={() => setSelectedManagerId(manager.id)}
                onMessage={() => navigate(`/chief/messages?manager=${encodeURIComponent(manager.id)}`)}
                onRebalance={() => rebalance(manager.id)}
                onReminder={() => sendReminder(manager)}
                onToggleStatus={() => toggleStatus(manager.id)}
              />
            ))}
          </div>
        ) : (
          <ManagerTable
            managers={filteredManagers}
            onAssign={openAssignments}
            onDetails={setSelectedManagerId}
            onMessage={(id) => navigate(`/chief/messages?manager=${encodeURIComponent(id)}`)}
            onRebalance={rebalance}
          />
        )}

        {!filteredManagers.length && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No managers match the current filters.
          </div>
        )}

        <section className="rounded-lg border bg-card/40">
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left"
            onClick={() => setShowAudit((value) => !value)}
          >
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity Audit</h2>
              <p className="text-sm text-foreground">Assignment, access, rebalance, and reminder history</p>
            </div>
            <Badge variant="secondary">{audit.length}</Badge>
          </button>
          {showAudit && (
            <div className="border-t p-4">
              <AuditList entries={audit.slice(0, 6)} managers={managers} />
            </div>
          )}
        </section>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Manager</DialogTitle>
              <DialogDescription>Add a project manager to the chief workspace.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="manager-name">Name</Label>
                <Input
                  id="manager-name"
                  value={invite.name}
                  onChange={(event) => setInvite((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Sarah Mitchell"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager-email">Email</Label>
                <Input
                  id="manager-email"
                  value={invite.email}
                  onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))}
                  placeholder="manager@company.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={submitInvite} disabled={!invite.email.trim()}>Send Invite</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ClientAssignmentSheet
          open={assignmentOpen}
          focusManagerId={assignmentFocusId}
          managers={managers}
          clients={clients}
          clientDraft={clientDraft}
          onClientDraftChange={(clientId, managerId) => setClientDraft((current) => ({ ...current, [clientId]: managerId }))}
          onClose={() => setAssignmentOpen(false)}
          onSave={saveAssignments}
        />

        <ManagerDetailsSheet
          manager={selectedSummary}
          audit={audit}
          onOpenChange={(open) => {
            if (!open) setSelectedManagerId(null);
          }}
          onAssign={() => selectedSummary && openAssignments(selectedSummary.id)}
          onCalendar={() => selectedSummary && navigate(`/chief/calendar?pm=${encodeURIComponent(selectedSummary.name)}`)}
          onMessage={() => selectedSummary && navigate(`/chief/messages?manager=${encodeURIComponent(selectedSummary.id)}`)}
        />

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Briefcase;
  tone: "info" | "success" | "warning";
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          tone === "success" && "bg-green-500/10 text-green-400",
          tone === "warning" && "bg-yellow-500/10 text-yellow-400",
          tone === "info" && "bg-primary/10 text-primary",
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ManagerCard({
  manager,
  onAssign,
  onCalendar,
  onDetails,
  onMessage,
  onRebalance,
  onReminder,
  onToggleStatus,
}: {
  manager: ManagerSummary;
  onAssign: () => void;
  onCalendar: () => void;
  onDetails: () => void;
  onMessage: () => void;
  onRebalance: () => void;
  onReminder: () => void;
  onToggleStatus: () => void;
}) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-colors">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <button type="button" onClick={onDetails} className="flex min-w-0 items-center gap-4 text-left">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={manager.avatarUrl ?? ""} alt={manager.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {initials(manager.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{manager.name}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">{manager.email}</p>
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-manager-${manager.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDetails}>Open Details</DropdownMenuItem>
            <DropdownMenuItem onClick={onAssign}>Assign Clients</DropdownMenuItem>
            <DropdownMenuItem onClick={onCalendar}>View Calendar</DropdownMenuItem>
            <DropdownMenuItem onClick={onRebalance}>Rebalance Workload</DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStatus}>
              {manager.status === "Active" ? "Mark On Leave" : "Mark Active"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-primary" onClick={onReminder}>
              <Send className="mr-2 h-3 w-3" /> Send Reminder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Computed workload</span>
          <span className={cn("font-medium", manager.workload >= 80 ? "text-red-500" : manager.workload >= 60 ? "text-yellow-500" : "text-green-500")}>
            {manager.workload}%
          </span>
        </div>
        <Progress value={manager.workload} className="h-1.5" />

        <div className="grid grid-cols-3 gap-3 py-2">
          <Metric label="Projects" value={String(manager.activeProjects.length)} icon={Briefcase} />
          <Metric label="Clients" value={String(manager.clients.length)} icon={Users} />
          <Metric label="Rating" value={manager.rating ? manager.rating.toFixed(1) : "-"} icon={Star} />
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={manager.status} />
          {manager.delayedCount > 0 && <Badge variant="outline" className="border-red-500 text-red-400 bg-red-500/5">{manager.delayedCount} delayed</Badge>}
          {manager.urgentCount > 0 && <Badge variant="outline" className="border-yellow-500 text-yellow-400 bg-yellow-500/5">{manager.urgentCount} urgent</Badge>}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <button type="button" onClick={onCalendar} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <CalendarDays className="h-3 w-3" />
            {manager.nextDeadline ? formatDate(manager.nextDeadline) : "No deadline"}
          </button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onMessage} data-testid={`button-message-manager-${manager.id}`}>
            <MessageSquare className="mr-2 h-3 w-3" /> Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagerTable({
  managers,
  onAssign,
  onDetails,
  onMessage,
  onRebalance,
}: {
  managers: ManagerSummary[];
  onAssign: (id: string) => void;
  onDetails: (id: string) => void;
  onMessage: (id: string) => void;
  onRebalance: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card/40">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Manager</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Workload</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead>Clients</TableHead>
            <TableHead>Next Deadline</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managers.map((manager) => (
            <TableRow key={manager.id}>
              <TableCell>
                <button type="button" onClick={() => onDetails(manager.id)} className="text-left">
                  <div className="font-medium">{manager.name}</div>
                  <div className="text-xs text-muted-foreground">{manager.email}</div>
                </button>
              </TableCell>
              <TableCell><StatusBadge status={manager.status} /></TableCell>
              <TableCell className="min-w-[150px]">
                <div className="flex items-center gap-2">
                  <Progress value={manager.workload} className="h-1.5" />
                  <span className="w-9 text-xs">{manager.workload}%</span>
                </div>
              </TableCell>
              <TableCell>{manager.activeProjects.length}</TableCell>
              <TableCell>{manager.clients.length}</TableCell>
              <TableCell>{manager.nextDeadline ? formatDate(manager.nextDeadline) : "-"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => onAssign(manager.id)}>Assign Clients</Button>
                  <Button variant="outline" size="sm" onClick={() => onRebalance(manager.id)}>Rebalance</Button>
                  <Button variant="ghost" size="icon" onClick={() => onMessage(manager.id)} aria-label={`Message ${manager.name}`}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientAssignmentSheet({
  open,
  focusManagerId,
  managers,
  clients,
  clientDraft,
  onClientDraftChange,
  onClose,
  onSave,
}: {
  open: boolean;
  focusManagerId: string | null;
  managers: Manager[];
  clients: ManagedClient[];
  clientDraft: Record<string, string>;
  onClientDraftChange: (clientId: string, managerId: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const focusManager = managers.find((manager) => manager.id === focusManagerId);
  const managerOptions = [{ id: "unassigned", name: "Unassigned" }, ...managers.map((manager) => ({ id: manager.id, name: manager.name }))];

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <div className="flex min-h-full flex-col gap-6">
          <SheetHeader>
            <SheetTitle>{focusManager ? `Assign clients to ${focusManager.name}` : "Assign Clients"}</SheetTitle>
            <SheetDescription>Save client ownership changes for the selected manager.</SheetDescription>
          </SheetHeader>

          <AssignmentSection
            title="Clients"
            empty="No clients available."
            rows={clients.map((client) => ({
              id: client.id,
              title: client.name,
              meta: `${client.exhibition} / ${client.status}`,
              value: clientDraft[client.id] ?? client.managerId ?? "unassigned",
            }))}
            managerOptions={managerOptions}
            onChange={onClientDraftChange}
          />

          <SheetFooter className="mt-auto gap-2 sm:gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={onSave}>Save Client Assignments</Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AssignmentSection({
  title,
  empty,
  rows,
  managerOptions,
  onChange,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; title: string; meta: string; value: string }>;
  managerOptions: Array<{ id: string; name: string }>;
  onChange: (id: string, managerId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {rows.length ? rows.map((row) => (
        <div key={row.id} className="rounded-lg border bg-background/40 p-3">
          <div className="mb-3">
            <p className="text-sm font-medium">{row.title}</p>
            <p className="text-xs text-muted-foreground">{row.meta}</p>
          </div>
          <Select value={row.value} onValueChange={(value) => onChange(row.id, value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {managerOptions.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );
}

function ManagerDetailsSheet({
  manager,
  audit,
  onOpenChange,
  onAssign,
  onCalendar,
  onMessage,
}: {
  manager: ManagerSummary | null;
  audit: AuditEntry[];
  onOpenChange: (open: boolean) => void;
  onAssign: () => void;
  onCalendar: () => void;
  onMessage: () => void;
}) {
  const managerAudit = manager ? audit.filter((entry) => entry.managerId === manager.id).slice(0, 5) : [];

  return (
    <Sheet open={!!manager} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {manager && (
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle>{manager.name}</SheetTitle>
              <SheetDescription>{manager.role} / {manager.email}</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3">
              <DetailStat label="Workload" value={`${manager.workload}%`} />
              <DetailStat label="Projects" value={String(manager.activeProjects.length)} />
              <DetailStat label="Clients" value={String(manager.clients.length)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onAssign}><ArrowRightLeft className="mr-2 h-4 w-4" /> Assign Clients</Button>
              <Button size="sm" variant="outline" onClick={onCalendar}><CalendarDays className="mr-2 h-4 w-4" /> Calendar</Button>
              <Button size="sm" variant="outline" onClick={onMessage}><MessageSquare className="mr-2 h-4 w-4" /> Message</Button>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Project Load</h3>
              {manager.allProjects.length ? manager.allProjects.map((project) => (
                <div key={project.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.exhibition} / {project.system}</p>
                    </div>
                    <WorkStatusBadge status={project.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={project.progress} className="h-1.5" />
                    <span className="w-9 text-xs text-muted-foreground">{project.progress}%</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Deadline: {formatDate(project.deadline)}</p>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No assigned projects.</div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Clients</h3>
              {manager.clients.length ? manager.clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.exhibition}</p>
                  </div>
                  <WorkStatusBadge status={client.status} />
                </div>
              )) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No assigned clients.</div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Activity</h3>
              <AuditList entries={managerAudit} managers={[manager]} compact />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Briefcase }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("h-3 w-3", label === "Rating" && "text-yellow-500 fill-yellow-500")} />
        {label}
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function AuditList({
  entries,
  managers,
  compact = false,
}: {
  entries: AuditEntry[];
  managers: Array<Pick<Manager, "id" | "name">>;
  compact?: boolean;
}) {
  if (!entries.length) {
    return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No activity recorded yet.</div>;
  }

  return (
    <div className={cn("grid gap-3", !compact && "md:grid-cols-2")}>
      {entries.map((entry) => {
        const manager = managers.find((item) => item.id === entry.managerId);
        return (
          <div key={entry.id} className="rounded-lg border bg-background/40 p-3">
            <div className="flex items-start gap-3">
              <span className={cn(
                "mt-1 h-2 w-2 rounded-full",
                entry.tone === "success" && "bg-green-500",
                entry.tone === "warning" && "bg-yellow-500",
                entry.tone === "info" && "bg-primary",
              )} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{entry.action}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{manager?.name ?? "Team"} / {entry.time}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: ManagerStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "Active" && "border-green-500 text-green-500 bg-green-500/5",
        status === "Pending" && "border-yellow-500 text-yellow-500 bg-yellow-500/5",
        status === "On Leave" && "border-slate-500 text-slate-400 bg-slate-500/5",
      )}
    >
      {status}
    </Badge>
  );
}

function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "Active" && "border-green-500 text-green-500 bg-green-500/5",
        status === "Pending" && "border-yellow-500 text-yellow-500 bg-yellow-500/5",
        status === "Delayed" && "border-red-500 text-red-500 bg-red-500/5",
        status === "Completed" && "border-blue-500 text-blue-500 bg-blue-500/5",
      )}
    >
      {status}
    </Badge>
  );
}

function normalizeManagerStatus(status: string): ManagerStatus {
  const value = status.trim().toLowerCase();
  if (value === "active") return "Active";
  if (value === "pending" || value === "invited") return "Pending";
  return "On Leave";
}

function normalizeWorkStatus(status: string): WorkStatus {
  const value = status.trim().toLowerCase();
  if (value.includes("delay") || value.includes("blocked")) return "Delayed";
  if (value.includes("complete") || value.includes("approved") || value.includes("done")) return "Completed";
  if (value.includes("active") || value.includes("progress") || value.includes("review") || value.includes("revision")) return "Active";
  return "Pending";
}

function summarizeManager(manager: Manager, clients: ManagedClient[], projects: ManagedProject[]): ManagerSummary {
  const managerProjects = projects.filter((project) => project.managerId === manager.id);
  const activeProjects = managerProjects.filter((project) => project.status !== "Completed");
  const managerClients = clients.filter((client) => client.managerId === manager.id);
  const workload = computeWorkload(manager.status, activeProjects, managerClients.length);
  const delayedCount = activeProjects.filter((project) => project.status === "Delayed").length;
  const urgentCount = activeProjects.filter((project) => daysUntil(project.deadline) <= 14).length;
  const nextDeadline = activeProjects.map((project) => project.deadline).sort()[0] ?? null;

  return {
    ...manager,
    workload,
    activeProjects,
    allProjects: managerProjects,
    clients: managerClients,
    delayedCount,
    urgentCount,
    nextDeadline,
  };
}

function computeWorkload(status: ManagerStatus, projects: ManagedProject[], clientCount: number) {
  if (status === "Pending") return 0;

  const projectScore = projects.reduce((sum, project) => {
    const days = daysUntil(project.deadline);
    const statusWeight = project.status === "Delayed" ? 28 : project.status === "Active" ? 22 : 14;
    const urgency = days < 0 ? 18 : days <= 7 ? 14 : days <= 14 ? 9 : 0;
    return sum + statusWeight + urgency;
  }, 0);

  const raw = projectScore + clientCount * 5;
  const adjusted = status === "On Leave" ? Math.min(raw, 35) : raw;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

function compareProjectRisk(a: ManagedProject, b: ManagedProject) {
  const aRisk = (a.status === "Delayed" ? 100 : 0) - daysUntil(a.deadline);
  const bRisk = (b.status === "Delayed" ? 100 : 0) - daysUntil(b.deadline);
  return bRisk - aRisk;
}

function daysUntil(date: string) {
  const now = new Date();
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
