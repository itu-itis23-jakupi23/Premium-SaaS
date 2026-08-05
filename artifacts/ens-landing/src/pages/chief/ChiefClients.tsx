import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";
import {
  approvePlatformClient,
  ClientArchiveBlockedError,
  createPlatformClient,
  deletePlatformClient,
  getManagerWorkspace,
  getPlatformClients,
  rejectPlatformClient,
  updateManagerAssignments,
  updatePlatformClient,
  type PlatformClient,
  type PlatformManager,
  type ClientArchiveBlocker,
  type PlatformPagination,
} from "@/lib/platform-api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Archive, Pencil, Search, MoreVertical, UserPlus, ExternalLink, UserCheck, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Link2 } from "lucide-react";

const PAGE_SIZE = 25;
const CLIENT_APP_URL = (import.meta.env.VITE_CLIENT_APP_URL ?? "http://localhost:5175").replace(/\/+$/, "");

type ClientForm = {
  name:       string;
  company:    string;
  email:      string;
  exhibition: string;
};
const EMPTY_CLIENT_FORM: ClientForm = { name: "", company: "", email: "", exhibition: "" };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clientStatusBadge(status: string) {
  if (status === "Active")           return "bg-green-500/10 text-green-600";
  if (status === "Pending Approval") return "bg-yellow-500/10 text-yellow-600";
  if (status === "Lead")             return "bg-blue-500/10 text-blue-600";
  if (status === "Inactive")         return "bg-gray-500/10 text-gray-500";
  if (status === "Archived")         return "bg-red-500/10 text-red-600";
  return "bg-muted text-muted-foreground";
}

export default function ChiefClients() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [, navigate] = useLocation();

  const [searchTerm,     setSearchTerm]     = useState("");
  const [clients,        setClients]        = useState<PlatformClient[]>([]);
  const [managers,       setManagers]       = useState<PlatformManager[]>([]);
  const [pagination,     setPagination]     = useState<PlatformPagination>({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false });
  const [page,           setPage]           = useState(0);
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [statusFilter,   setStatusFilter]   = useState("");
  const [addOpen,        setAddOpen]        = useState(false);
  const [detailClient,   setDetailClient]   = useState<PlatformClient | null>(null);
  const [editClientId,   setEditClientId]   = useState<string | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [archiveBlockers,setArchiveBlockers]= useState<ClientArchiveBlocker[]>([]);
  const [assignClientId, setAssignClientId] = useState<string | null>(null);
  const [assignPm,       setAssignPm]       = useState("");
  const [isAssigning,    setIsAssigning]    = useState(false);
  const [rejectClientId, setRejectClientId] = useState<string | null>(null);
  const [rejectionReason,setRejectionReason]= useState("");
  const [isRejecting,    setIsRejecting]    = useState(false);
  const [isMutatingClient,setIsMutatingClient]=useState(false);
  const [toastMsg,       setToastMsg]       = useState("");
  const [toastVisible,   setToastVisible]   = useState(false);
  const [newClient,      setNewClient]      = useState<ClientForm>(EMPTY_CLIENT_FORM);
  const [editForm,       setEditForm]       = useState<ClientForm>(EMPTY_CLIENT_FORM);
  const [emailError,     setEmailError]     = useState("");
  const [editEmailError, setEditEmailError] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 250);

  useEffect(() => {
    document.title = t("chief.clients.title");
  }, [t]);

  /* Translated status filter pills (reactive to language) */
  const statusFilters = useMemo(() => [
    { label: t("chief.clients.filter.all"),            value: "" },
    { label: t("chief.clients.filter.lead"),           value: "lead" },
    { label: t("chief.clients.filter.pendingApproval"),value: "pending_approval" },
    { label: t("chief.clients.filter.active"),         value: "active" },
    { label: t("chief.clients.filter.inactive"),       value: "inactive" },
    { label: t("chief.clients.filter.archived"),       value: "archived" },
  ], [t]);

  useEffect(() => {
    let mounted = true;
    getManagerWorkspace()
      .then((workspace) => { if (mounted) setManagers(workspace.managers); })
      .catch(() => { if (mounted) setManagers([]); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getPlatformClients({ q: debouncedSearch, status: statusFilter, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => {
        if (!mounted) return;
        setClients(data.clients);
        setPagination(data.pagination);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setClients([]);
        setPagination({ total: 0, limit: PAGE_SIZE, offset: page * PAGE_SIZE, hasMore: false });
        setError(reason instanceof Error ? reason.message : t("chief.clients.loadError"));
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [debouncedSearch, page, statusFilter, t]);

  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter]);

  const managerOptions = managers
    .filter((m) => m.status === "Active")
    .map((m) => {
      const activeProj = m.activeProjects ?? 0;
      const workloadVal = m.workload ?? 0;
      return {
        id: m.id,
        name: `${m.name} (${activeProj} active project${activeProj === 1 ? "" : "s"}, ${workloadVal}% workload)`,
      };
    });

  const pageStart = pagination.total ? pagination.offset + 1 : 0;
  const pageEnd   = Math.min(pagination.offset + clients.length, pagination.total);
  const assignmentTarget = clients.find((client) => client.id === assignClientId) ?? null;
  const rejectionTarget = clients.find((client) => client.id === rejectClientId) ?? null;

  async function reloadClients() {
    const data = await getPlatformClients({ q: debouncedSearch, status: statusFilter, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    setClients(data.clients);
    setPagination(data.pagination);
    return data;
  }

  function showToast(message: string) {
    setToastMsg(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2400);
  }

  async function copyClientRegistrationLink() {
    const organizationSlug = auth.user?.organizationSlug;
    if (!organizationSlug) {
      showToast("Your organization code is unavailable. Sign out and sign in again.");
      return;
    }

    const link = `${CLIENT_APP_URL}/signup?organization=${encodeURIComponent(organizationSlug)}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Client registration link copied");
    } catch {
      window.prompt("Copy this client registration link", link);
    }
  }

  function clientStatusLabel(status: string): string {
    const map: Record<string, string> = {
      Active:            t("chief.clients.status.active"),
      "Pending Approval":t("chief.clients.status.pendingApproval"),
      Lead:              t("chief.clients.status.lead"),
      Inactive:          t("chief.clients.status.inactive"),
      Archived:          t("chief.clients.status.archived"),
    };
    return map[status] ?? status;
  }

  function openAssignment(client: PlatformClient) {
    setAssignClientId(client.id);
    const currentManager = managers.find((item) => item.name === client.pm);
    setAssignPm(currentManager?.id ?? "");
  }

  async function addClient() {
    const name  = newClient.name.trim();
    const email = newClient.email.trim();
    if (!name) return;
    if (email && !isValidEmail(email)) {
      setEmailError(t("chief.clients.emailError"));
      return;
    }
    setEmailError("");
    try {
      setIsMutatingClient(true);
      await createPlatformClient({
        name,
        company:    newClient.company.trim() || name,
        email,
        exhibition: newClient.exhibition.trim() || "New Exhibition",
      });
      await reloadClients();
      setNewClient(EMPTY_CLIENT_FORM);
      setEmailError("");
      setAddOpen(false);
      showToast(t("chief.clients.toast.added", { name }));
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t("chief.clients.toast.addError"));
    } finally {
      setIsMutatingClient(false);
    }
  }

  function openEditClient(client: PlatformClient) {
    setEditClientId(client.id);
    setEditForm({
      name:       client.contactName || client.name,
      company:    client.company || client.name,
      email:      client.contactEmail,
      exhibition: client.exhibition === "No active exhibition" ? "" : client.exhibition,
    });
    setEditEmailError("");
  }

  async function saveEditClient() {
    if (!editClientId) return;
    const name    = editForm.name.trim();
    const company = editForm.company.trim();
    const email   = editForm.email.trim();
    if (!name || !company) return;
    if (email && !isValidEmail(email)) {
      setEditEmailError(t("chief.clients.emailError"));
      return;
    }
    setEditEmailError("");
    try {
      setIsMutatingClient(true);
      await updatePlatformClient(editClientId, { name, company, email, exhibition: editForm.exhibition.trim() });
      const response = await reloadClients();
      const updatedClient = response.clients.find((c) => c.id === editClientId) ?? null;
      if (detailClient?.id === editClientId) setDetailClient(updatedClient);
      setEditClientId(null);
      setEditForm(EMPTY_CLIENT_FORM);
      showToast(t("chief.clients.toast.updated", { name: company }));
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t("chief.clients.toast.updateError"));
    } finally {
      setIsMutatingClient(false);
    }
  }

  async function confirmAssign() {
    if (!assignClientId || !assignPm) return;
    const target = clients.find((client) => client.id === assignClientId);
    const manager = managers.find((item) => item.id === assignPm);
    if (!managers.length) {
      showToast(t("chief.clients.toast.noManagers"));
      return;
    }
    const isPendingApproval = target?.status === "Pending Approval";
    const applyAssignment = async (confirmOverCapacity = false) => {
      if (isPendingApproval) {
        await approvePlatformClient(assignClientId, {
          managerId: assignPm,
          note: "Approved and assigned from the Chief client queue",
          confirmOverCapacity,
          overrideReason: confirmOverCapacity ? "Chief confirmed over-capacity approval from the client queue" : null,
        });
      } else {
        await updateManagerAssignments({
          clientAssignments: [{ clientId: assignClientId, managerId: assignPm }],
          projectAssignments: [],
          cascadeClientProjects: true,
          confirmOverCapacity,
          overrideReason: confirmOverCapacity ? "Chief confirmed over-capacity assignment from client list" : null,
        });
      }

      const [, workspace] = await Promise.all([reloadClients(), getManagerWorkspace()]);
      setManagers(workspace.managers);
      setAssignClientId(null);
      setAssignPm("");
      showToast(isPendingApproval
        ? t("chief.clients.toast.approved", { client: target?.name ?? t("chief.clients.toast.defaultClient"), manager: manager?.name ?? t("chief.clients.toast.unassigned") })
        : t("chief.clients.toast.assigned", { client: target?.name ?? t("chief.clients.toast.defaultClient"), manager: manager?.name ?? t("chief.clients.toast.unassigned") }));
    };

    try {
      setIsAssigning(true);
      await applyAssignment(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t("chief.clients.toast.assignError");
      if (/capacity|overload/i.test(message)) {
        try {
          await applyAssignment(true);
        } catch (retryReason) {
          showToast(retryReason instanceof Error ? retryReason.message : t("chief.clients.toast.assignError"));
        }
        return;
      }
      showToast(message);
    } finally {
      setIsAssigning(false);
    }
  }

  async function confirmReject() {
    if (!rejectClientId || !rejectionReason.trim()) return;
    try {
      setIsRejecting(true);
      await rejectPlatformClient(rejectClientId, rejectionReason.trim());
      await reloadClients();
      setRejectClientId(null);
      setRejectionReason("");
      showToast(t("chief.clients.toast.rejected", { client: rejectionTarget?.name ?? t("chief.clients.toast.defaultClient") }));
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t("chief.clients.toast.rejectError"));
    } finally {
      setIsRejecting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteClientId) return;
    const target = clients.find((c) => c.id === deleteClientId);
    try {
      setIsMutatingClient(true);
      await deletePlatformClient(deleteClientId);
      await reloadClients();
      setDeleteClientId(null);
      setArchiveBlockers([]);
      if (detailClient?.id === deleteClientId) setDetailClient(null);
      showToast(t("chief.clients.toast.archived", { name: target?.name ?? t("chief.clients.toast.defaultClient") }));
    } catch (reason) {
      if (reason instanceof ClientArchiveBlockedError) {
        setArchiveBlockers(reason.projects);
        showToast(reason.message);
        return;
      }
      showToast(reason instanceof Error ? reason.message : t("chief.clients.toast.archiveError"));
    } finally {
      setIsMutatingClient(false);
    }
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader
          title={t("chief.clients.title")}
          breadcrumbs={[{ label: t("chief.nav.dashboard"), href: "/chief" }, { label: t("chief.nav.clients") }]}
        >
          <Button variant="outline" onClick={copyClientRegistrationLink} data-testid="button-copy-client-invite">
            <Link2 aria-hidden="true" className="mr-2 h-4 w-4" />
            Invite client
            <Copy aria-hidden="true" className="ml-2 h-3.5 w-3.5 opacity-60" />
          </Button>
          <Button onClick={() => setAddOpen(true)} data-testid="button-add-client">
            <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            {t("chief.clients.addClient")}
          </Button>
        </PageHeader>

        {error && (
          <Card role="alert" className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="p-0">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("chief.clients.searchPlaceholder")}
                  aria-label={t("chief.clients.searchPlaceholder")}
                  className="pl-9 bg-muted/50 border-transparent focus:border-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-clients"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {statusFilters.map((sf) => (
                  <button
                    key={sf.value || "all"}
                    onClick={() => setStatusFilter(sf.value)}
                    aria-pressed={statusFilter === sf.value}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                      statusFilter === sf.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {sf.label}
                  </button>
                ))}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-muted">
                  <TableHead>{t("chief.clients.table.clientName")}</TableHead>
                  <TableHead>{t("chief.clients.table.company")}</TableHead>
                  <TableHead>{t("chief.clients.table.assignedPm")}</TableHead>
                  <TableHead>{t("chief.clients.table.exhibition")}</TableHead>
                  <TableHead>{t("chief.clients.table.status")}</TableHead>
                  <TableHead>{t("chief.clients.table.lastActivity")}</TableHead>
                  <TableHead className="text-right">{t("chief.clients.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="border-muted hover:bg-muted/30">
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.company}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">
                          {client.pm.split(" ").map((n) => n[0]).join("")}
                        </div>
                        {client.pm}
                      </div>
                    </TableCell>
                    <TableCell>{client.exhibition}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={clientStatusBadge(client.status)}>
                        {clientStatusLabel(client.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{client.lastActivity}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {client.status === "Pending Approval" && (
                          <Button
                            size="sm"
                            onClick={() => openAssignment(client)}
                            data-testid={`button-review-client-${client.id}`}
                          >
                            <UserCheck aria-hidden="true" className="mr-2 h-4 w-4" />
                            {t("chief.clients.menu.reviewAndAssign")}
                          </Button>
                        )}
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-client-${client.id}`} aria-label={t("chief.clients.table.actions")}>
                            <MoreVertical aria-hidden="true" className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => openAssignment(client)}>
                            <UserCheck aria-hidden="true" className="mr-2 h-4 w-4" />
                            {client.status === "Pending Approval"
                              ? t("chief.clients.menu.reviewAndAssign")
                              : t("chief.clients.menu.assignManager")}
                          </DropdownMenuItem>
                          {client.status === "Pending Approval" && (
                            <DropdownMenuItem className="cursor-pointer text-red-500 focus:text-red-500" onClick={() => {
                              setRejectClientId(client.id);
                              setRejectionReason("");
                            }}>
                              <UserX aria-hidden="true" className="mr-2 h-4 w-4" />
                              {t("chief.clients.menu.rejectRequest")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="cursor-pointer" onClick={() => {
                            showToast(t("chief.clients.toast.openingWorkspace", { name: client.name }));
                            navigate(client.projectId
                              ? `/chief/workspace?projectId=${encodeURIComponent(client.projectId)}`
                              : "/chief/workspace");
                          }}>
                            <ExternalLink aria-hidden="true" className="mr-2 h-4 w-4" />
                            {t("chief.clients.menu.openWorkspace")}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => openEditClient(client)}>
                            <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                            {t("chief.clients.menu.editClient")}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => setDetailClient(client)}>
                            {t("chief.clients.menu.viewDetails")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer text-red-500 focus:text-red-500" onClick={() => {
                            setDeleteClientId(client.id);
                            setArchiveBlockers([]);
                          }}>
                            <Archive aria-hidden="true" className="mr-2 h-4 w-4" />
                            {t("chief.clients.menu.archive")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {isLoading && !clients.length && Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-7 rounded" /></TableCell>
                  </TableRow>
                ))}
                {!clients.length && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {t("chief.clients.noClients")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>{t("chief.clients.showing", { start: pageStart, end: pageEnd, total: pagination.total })}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((c) => Math.max(0, c - 1))} disabled={isLoading || pagination.offset === 0}>
                  {t("chief.clients.previous")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((c) => c + 1)} disabled={isLoading || !pagination.hasMore}>
                  {t("chief.clients.next")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Add Client Dialog ── */}
        <Dialog open={addOpen} onOpenChange={(open) => { if (isMutatingClient) return; setAddOpen(open); if (!open) setEmailError(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.clients.addDialog.title")}</DialogTitle>
              <DialogDescription>{t("chief.clients.addDialog.desc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              {([
                ["name",       t("chief.clients.addDialog.name"),       "TechCorp Industries"],
                ["company",    t("chief.clients.addDialog.company"),    "TechCorp"],
                ["exhibition", t("chief.clients.addDialog.exhibition"), "TechCon 2026"],
              ] as Array<[keyof typeof newClient, string, string]>).map(([key, label, placeholder]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`client-${key}`}>{label}</Label>
                  <Input id={`client-${key}`} value={newClient[key]} placeholder={placeholder}
                    onChange={(e) => setNewClient((c) => ({ ...c, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="client-email">{t("chief.clients.addDialog.email")}</Label>
                <Input id="client-email" type="email" value={newClient.email} placeholder="contact@company.com"
                  onChange={(e) => { setNewClient((c) => ({ ...c, email: e.target.value })); setEmailError(""); }} />
                {emailError && <p className="text-xs text-red-500">{emailError}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddOpen(false); setEmailError(""); }} disabled={isMutatingClient}>
                {t("chief.clients.cancel")}
              </Button>
              <Button onClick={addClient} disabled={!newClient.name.trim() || isMutatingClient}>
                {isMutatingClient ? t("chief.clients.saving") : t("chief.clients.addDialog.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign or approve client */}
        <Dialog open={!!assignClientId} onOpenChange={(open) => { if (!open && !isAssigning) { setAssignClientId(null); setAssignPm(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {assignmentTarget?.status === "Pending Approval"
                  ? t("chief.clients.approveDialog.title")
                  : t("chief.clients.assignDialog.title")}
              </DialogTitle>
              <DialogDescription>
                {assignmentTarget?.status === "Pending Approval"
                  ? t("chief.clients.approveDialog.desc", { name: assignmentTarget.name })
                  : t("chief.clients.assignDialog.desc", { name: assignmentTarget?.name ?? "..." })}
              </DialogDescription>
            </DialogHeader>
            {assignmentTarget?.status === "Pending Approval" && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{assignmentTarget.company}</p>
                <p className="mt-1 text-muted-foreground">{assignmentTarget.exhibition}</p>
                <p className="mt-2 text-xs text-muted-foreground">{t("chief.clients.approveDialog.result")}</p>
              </div>
            )}
            <Select value={assignPm} onValueChange={setAssignPm}>
              <SelectTrigger><SelectValue placeholder={t("chief.clients.assignDialog.placeholder")} /></SelectTrigger>
              <SelectContent>
                {managerOptions.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignClientId(null)} disabled={isAssigning}>
                {t("chief.clients.cancel")}
              </Button>
              <Button onClick={confirmAssign} disabled={!assignPm || isAssigning}>
                {isAssigning
                  ? t("chief.clients.saving")
                  : assignmentTarget?.status === "Pending Approval"
                    ? t("chief.clients.approveDialog.submit")
                    : t("chief.clients.assignDialog.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!rejectClientId} onOpenChange={(open) => {
          if (!open && !isRejecting) {
            setRejectClientId(null);
            setRejectionReason("");
          }
        }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("chief.clients.rejectDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("chief.clients.rejectDialog.desc", { name: rejectionTarget?.name ?? t("chief.clients.toast.defaultClient") })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="client-rejection-reason">{t("chief.clients.rejectDialog.reason")}</Label>
              <Textarea
                id="client-rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder={t("chief.clients.rejectDialog.placeholder")}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectClientId(null); setRejectionReason(""); }} disabled={isRejecting}>
                {t("chief.clients.cancel")}
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={!rejectionReason.trim() || isRejecting}>
                {isRejecting ? t("chief.clients.saving") : t("chief.clients.rejectDialog.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit Client Dialog ── */}
        <Dialog open={!!editClientId} onOpenChange={(open) => { if (isMutatingClient) return; if (!open) { setEditClientId(null); setEditForm(EMPTY_CLIENT_FORM); setEditEmailError(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("chief.clients.editDialog.title")}</DialogTitle>
              <DialogDescription>{t("chief.clients.editDialog.desc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              {([
                ["name",       t("chief.clients.editDialog.contactName"), "Dana Client"],
                ["company",    t("chief.clients.addDialog.company"),      "TechCorp Industries"],
                ["exhibition", t("chief.clients.addDialog.exhibition"),   "TechCon 2026"],
              ] as Array<[keyof ClientForm, string, string]>).map(([key, label, placeholder]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`edit-client-${key}`}>{label}</Label>
                  <Input id={`edit-client-${key}`} value={editForm[key]} placeholder={placeholder}
                    onChange={(e) => setEditForm((c) => ({ ...c, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="edit-client-email">{t("chief.clients.addDialog.email")}</Label>
                <Input id="edit-client-email" type="email" value={editForm.email} placeholder="contact@company.com"
                  onChange={(e) => { setEditForm((c) => ({ ...c, email: e.target.value })); setEditEmailError(""); }} />
                {editEmailError && <p className="text-xs text-red-500">{editEmailError}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditClientId(null); setEditForm(EMPTY_CLIENT_FORM); setEditEmailError(""); }} disabled={isMutatingClient}>
                {t("chief.clients.cancel")}
              </Button>
              <Button onClick={saveEditClient} disabled={!editForm.name.trim() || !editForm.company.trim() || isMutatingClient}>
                {isMutatingClient ? t("chief.clients.saving") : t("chief.clients.editDialog.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Archive Dialog ── */}
        <Dialog open={!!deleteClientId} onOpenChange={(open) => { if (!open && !isMutatingClient) { setDeleteClientId(null); setArchiveBlockers([]); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("chief.clients.archiveDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("chief.clients.archiveDialog.desc", { name: clients.find((c) => c.id === deleteClientId)?.name ?? "…" })}
              </DialogDescription>
            </DialogHeader>
            {archiveBlockers.length > 0 && (
              <div className="space-y-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                <p className="text-xs font-semibold text-yellow-600">{t("chief.clients.archiveDialog.blockers")}</p>
                <div className="space-y-2">
                  {archiveBlockers.map((project) => (
                    <div key={project.id} className="flex items-center justify-between gap-3 rounded border bg-background px-2 py-1.5 text-xs">
                      <span className="font-medium">{project.name}</span>
                      <span className="text-muted-foreground">{project.status}{project.deadline ? ` / ${project.deadline}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteClientId(null); setArchiveBlockers([]); }} disabled={isMutatingClient}>
                {t("chief.clients.cancel")}
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isMutatingClient}>
                {isMutatingClient ? t("chief.clients.archiveDialog.archiving") : t("chief.clients.archiveDialog.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── View Details Dialog ── */}
        <Dialog open={!!detailClient} onOpenChange={(open) => !open && setDetailClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{detailClient?.name}</DialogTitle>
              <DialogDescription>{detailClient?.company}</DialogDescription>
            </DialogHeader>
            {detailClient && (
              <>
                <div className="grid gap-3 text-sm">
                  {([
                    [t("chief.clients.detailDialog.contact"),    detailClient.contactName],
                    [t("chief.clients.detailDialog.email"),      detailClient.contactEmail],
                    [t("chief.clients.detailDialog.pm"),         detailClient.pm],
                    [t("chief.clients.detailDialog.exhibition"), detailClient.exhibition],
                    [t("chief.clients.detailDialog.status"),     clientStatusLabel(detailClient.status)],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { openEditClient(detailClient); setDetailClient(null); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("chief.clients.menu.editClient")}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setAssignClientId(detailClient.id);
                    const currentManager = managers.find((item) => item.name === detailClient.pm);
                    setAssignPm(currentManager?.id ?? "");
                    setDetailClient(null);
                  }}>
                    <UserCheck className="mr-2 h-4 w-4" />
                    {t("chief.clients.menu.assignManager")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Always-rendered ARIA live toast */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl transition-all duration-300 ${toastVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
      >
        {toastMsg}
      </div>
    </DashboardLayout>
  );
}
