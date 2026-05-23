import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertCircle,
  Briefcase,
  CalendarDays,
  ChevronRight,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Users,
  Video,
} from "lucide-react";
import {
  getConversationMessages,
  getManagerWorkspace,
  getMessageContacts,
  sendConversationMessage,
  type DirectMessage,
  type ManagedProject,
  type MessageContact,
} from "@/lib/platform-api";
import { cn } from "@/lib/utils";

interface ExhibitionScope {
  id: string;
  name: string;
  clients: string[];
  systems: string[];
  status: string;
  deadline: string | null;
  projects: ManagedProject[];
  managers: MessageContact[];
  unread: number;
  lastMessage: string;
  lastMessageAt: string | null;
}

export default function ChiefMessages() {
  const [location] = useLocation();
  const requestedManager = new URLSearchParams(location.split("?")[1] ?? "").get("manager");
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(requestedManager);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  const scopes = useMemo(() => buildExhibitionScopes(projects, contacts), [contacts, projects]);
  const filteredScopes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopes;
    return scopes.filter((scope) => [
      scope.name,
      ...scope.clients,
      ...scope.systems,
      ...scope.managers.map((manager) => manager.name),
    ].some((value) => value.toLowerCase().includes(q)));
  }, [scopes, search]);

  const selectedScope = scopes.find((scope) => scope.id === selectedExhibitionId) ?? null;
  const scopedManagers = selectedScope?.managers ?? [];
  const selectedContact = scopedManagers.find((contact) => contact.id === selectedId) ?? scopedManagers[0] ?? null;
  const conversationContext = selectedScope ? {
    exhibitionId: selectedScope.id,
    exhibitionName: selectedScope.name,
    projectId: selectedScope.projects[0]?.id,
  } : undefined;
  const totalUnread = scopes.reduce((sum, scope) => sum + scope.unread, 0);

  useEffect(() => {
    let mounted = true;
    loadInbox()
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "Could not load exhibition messages.");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    async function loadInbox() {
      const [contactResponse, workspace] = await Promise.all([getMessageContacts(), getManagerWorkspace()]);
      if (!mounted) return;
      setContacts(contactResponse.contacts.filter((contact) => contact.role === "pm" || contact.role === "Project Manager"));
      setProjects(workspace.projects);
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!scopes.length) {
      setSelectedExhibitionId(null);
      setSelectedId(null);
      return;
    }

    const currentScope = selectedExhibitionId ? scopes.find((scope) => scope.id === selectedExhibitionId) : null;
    const requestedScope = requestedManager
      ? scopes.find((scope) => scope.managers.some((manager) => manager.id === requestedManager))
      : null;
    const nextScope = currentScope ?? requestedScope ?? scopes[0];

    if (selectedExhibitionId !== nextScope.id) {
      setSelectedExhibitionId(nextScope.id);
    }

    const managerStillInScope = nextScope.managers.some((manager) => manager.id === selectedId);
    const requestedManagerInScope = requestedManager && nextScope.managers.some((manager) => manager.id === requestedManager);
    if (!managerStillInScope) {
      setSelectedId(requestedManagerInScope ? requestedManager : nextScope.managers[0]?.id ?? null);
    }

    if (requestedScope) setDrawerOpen(true);
  }, [requestedManager, scopes, selectedExhibitionId, selectedId]);

  useEffect(() => {
    if (!drawerOpen || !selectedContact || !conversationContext) {
      setMessages([]);
      return;
    }

    let mounted = true;
    loadMessages();
    const interval = window.setInterval(loadMessages, 5000);

    async function loadMessages() {
      try {
        const response = await getConversationMessages(selectedContact.id, conversationContext);
        if (!mounted) return;
        setMessages(response.messages);
        setContacts((current) => current.map((contact) => contact.id === selectedContact.id ? { ...contact, unread: 0 } : contact));
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Could not load conversation.");
      }
    }

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [conversationContext?.exhibitionId, conversationContext?.projectId, drawerOpen, selectedContact?.id]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedContact?.id, selectedScope?.id]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2400);
  }

  function openScope(scope: ExhibitionScope) {
    setSelectedExhibitionId(scope.id);
    setSelectedId(scope.managers[0]?.id ?? null);
    setMessage("");
    setDrawerOpen(true);
  }

  async function sendMessage() {
    if (!selectedContact || !conversationContext || isSending) return;
    const text = message.trim();
    if (!text) return;

    setIsSending(true);
    setError("");
    try {
      const response = await sendConversationMessage(selectedContact.id, text, conversationContext);
      setMessages((current) => [...current, response.message]);
      setContacts((current) => current.map((contact) => contact.id === selectedContact.id ? {
        ...contact,
        lastMessage: text,
        time: "Just now",
        lastMessageAt: response.message.createdAt,
      } : contact));
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-5">
        <PageHeader title="Messages" breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Messages" }]}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{scopes.length} exhibitions</Badge>
            {totalUnread > 0 && <Badge variant="default">{totalUnread} unread</Badge>}
          </div>
        </PageHeader>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        <section className="rounded-lg border bg-card/40">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">Exhibition Threads</h2>
              <p className="mt-1 text-xs text-muted-foreground">One scoped conversation space per exhibition.</p>
            </div>
            <div className="relative w-full lg:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search exhibitions, clients, managers"
                className="bg-background/60 pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                data-testid="input-search-exhibitions"
              />
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredScopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => openScope(scope)}
                className={cn(
                  "group flex min-h-[178px] flex-col rounded-lg border bg-background/45 p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5",
                  selectedScope?.id === scope.id && drawerOpen && "border-primary/70 bg-primary/10",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{scope.name}</h3>
                      <Badge variant="outline" className={cn("shrink-0", statusBadgeClass(scope.status))}>
                        {scope.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{scope.clients.join(", ") || "No client linked"}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center justify-center gap-1 rounded-md border bg-card/50 px-2 py-1">
                    <Users className="h-3 w-3" /> {scope.managers.length || 0} PM
                  </span>
                  <span className="inline-flex items-center justify-center gap-1 rounded-md border bg-card/50 px-2 py-1">
                    <Briefcase className="h-3 w-3" /> {scope.projects.length}
                  </span>
                  <span className="inline-flex items-center justify-center gap-1 rounded-md border bg-card/50 px-2 py-1">
                    <CalendarDays className="h-3 w-3" /> {scope.deadline ? formatDate(scope.deadline) : "-"}
                  </span>
                </div>

                <div className="mt-auto pt-4">
                  <div className="flex items-start gap-2 rounded-md bg-card/50 p-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="line-clamp-2 text-xs text-muted-foreground">{scope.lastMessage}</p>
                  </div>
                </div>
              </button>
            ))}

            {!filteredScopes.length && (
              <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                {isLoading ? "Loading exhibitions..." : "No exhibitions found."}
              </div>
            )}
          </div>
        </section>

        <MessageDrawer
          open={drawerOpen && !!selectedScope}
          scope={selectedScope}
          managers={scopedManagers}
          selectedContact={selectedContact}
          messages={messages}
          message={message}
          isSending={isSending}
          messagesEnd={messagesEnd}
          onOpenChange={setDrawerOpen}
          onSelectManager={setSelectedId}
          onMessageChange={setMessage}
          onSend={sendMessage}
          onToast={showToast}
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

function MessageDrawer({
  open,
  scope,
  managers,
  selectedContact,
  messages,
  message,
  isSending,
  messagesEnd,
  onOpenChange,
  onSelectManager,
  onMessageChange,
  onSend,
  onToast,
}: {
  open: boolean;
  scope: ExhibitionScope | null;
  managers: MessageContact[];
  selectedContact: MessageContact | null;
  messages: DirectMessage[];
  message: string;
  isSending: boolean;
  messagesEnd: React.RefObject<HTMLDivElement | null>;
  onOpenChange: (open: boolean) => void;
  onSelectManager: (id: string) => void;
  onMessageChange: (message: string) => void;
  onSend: () => void;
  onToast: (message: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-[min(92vw,1080px)]">
        {scope && (
          <>
            <div className="border-b bg-card/60 px-6 py-4">
              <SheetHeader className="space-y-2 pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate text-xl">{scope.name}</SheetTitle>
                  <Badge variant="outline" className={statusBadgeClass(scope.status)}>{scope.status}</Badge>
                </div>
                <SheetDescription className="truncate">
                  {scope.clients.join(", ") || "No client linked"} / {scope.projects.length} project{scope.projects.length === 1 ? "" : "s"}
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="grid min-h-0 flex-1 md:grid-cols-[270px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-r bg-background/40">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Project Managers</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{managers.length} assigned</p>
                </div>
                <ScrollArea className="flex-1">
                  {managers.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => onSelectManager(contact.id)}
                      className={cn(
                        "flex w-full gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        selectedContact?.id === contact.id && "border-l-2 border-l-primary bg-primary/10 pl-[14px]",
                      )}
                    >
                      <div className="relative">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                          {initials(contact.name)}
                        </div>
                        <span className={cn(
                          "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card",
                          contact.online ? "bg-green-500" : "bg-muted",
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="truncate text-sm font-medium">{contact.name}</h4>
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">{contact.time}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{contact.lastMessage}</p>
                      </div>
                    </button>
                  ))}

                  {!managers.length && (
                    <div className="m-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      <AlertCircle className="mb-2 h-4 w-4" />
                      No project manager is assigned to this exhibition yet.
                    </div>
                  )}
                </ScrollArea>
              </aside>

              <section className="flex min-w-0 flex-col bg-background/20">
                {selectedContact ? (
                  <>
                    <div className="flex min-h-16 items-center justify-between gap-4 border-b bg-card/50 px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                          {initials(selectedContact.name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{selectedContact.name}</h3>
                          <p className="truncate text-xs text-muted-foreground">{selectedContact.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onToast(`Call started with ${selectedContact.name} for ${scope.name}`)}><Phone className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onToast(`Video room prepared for ${scope.name}`)}><Video className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onToast("Conversation options opened")}><MoreVertical className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    <div className="border-b bg-muted/25 px-5 py-2 text-xs text-muted-foreground">
                      Scoped to <span className="font-medium text-foreground">{scope.name}</span>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="mx-auto w-full max-w-3xl space-y-4 p-5">
                        {messages.map((item) => (
                          <div key={item.id} className={cn("flex", item.isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                              item.isMe ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm border border-border bg-card",
                            )}>
                              <p>{item.text}</p>
                              <div className={cn("mt-1 text-[10px]", item.isMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                {item.time}
                              </div>
                            </div>
                          </div>
                        ))}
                        {!messages.length && (
                          <div className="py-12 text-center text-sm text-muted-foreground">
                            No messages yet for {scope.name}.
                          </div>
                        )}
                        <div ref={messagesEnd} />
                      </div>
                    </ScrollArea>

                    <div className="border-t bg-card/50 p-4">
                      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl border bg-background/70 p-2">
                        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground" onClick={() => onToast(`Attachment picker opened for ${scope.name}`)}><Paperclip className="h-4 w-4" /></Button>
                        <div className="min-w-0 flex-1">
                          <Input
                            placeholder={`Message ${selectedContact.name} about ${scope.name}...`}
                            className="h-10 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                            value={message}
                            onChange={(event) => onMessageChange(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                onSend();
                              }
                            }}
                            data-testid="input-message"
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground" onClick={() => onMessageChange(`${message} :)`)}><Smile className="h-4 w-4" /></Button>
                        <Button className="h-10 shrink-0 px-4" onClick={onSend} disabled={!message.trim() || isSending} data-testid="button-send-message">
                          <Send className="mr-2 h-4 w-4" /> {isSending ? "Sending" : "Send"}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Select a project manager.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function buildExhibitionScopes(projects: ManagedProject[], contacts: MessageContact[]): ExhibitionScope[] {
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const contactsByName = new Map(contacts.map((contact) => [normalize(contact.name), contact]));
  const scopes = new Map<string, ExhibitionScope>();

  for (const project of projects) {
    const name = project.exhibition || project.name;
    const id = scopeId(name);
    const existing = scopes.get(id);
    const manager = project.managerId
      ? contactsById.get(project.managerId) ?? contactsByName.get(normalize(project.managerName))
      : contactsByName.get(normalize(project.managerName));
    const scope = existing ?? {
      id,
      name,
      clients: [],
      systems: [],
      status: project.status,
      deadline: project.deadline,
      projects: [],
      managers: [],
      unread: 0,
      lastMessage: "No messages yet",
      lastMessageAt: null,
    };

    scope.projects.push(project);
    scope.clients = appendUnique(scope.clients, project.client);
    scope.systems = appendUnique(scope.systems, project.system);
    scope.status = mergeStatus(scope.status, project.status);
    scope.deadline = earliestDate(scope.deadline, project.deadline);

    if (manager && !scope.managers.some((item) => item.id === manager.id)) {
      scope.managers.push(manager);
      scope.unread += manager.unread;
      if (!scope.lastMessageAt || (manager.lastMessageAt && manager.lastMessageAt > scope.lastMessageAt)) {
        scope.lastMessage = manager.lastMessage;
        scope.lastMessageAt = manager.lastMessageAt;
      }
    }

    scopes.set(id, scope);
  }

  return Array.from(scopes.values()).sort((a, b) => {
    const aDate = a.deadline ?? "9999-12-31";
    const bDate = b.deadline ?? "9999-12-31";
    return aDate.localeCompare(bDate) || a.name.localeCompare(b.name);
  });
}

function appendUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function mergeStatus(current: string, next: string) {
  const rank: Record<string, number> = { Delayed: 4, Active: 3, Pending: 2, Completed: 1 };
  return (rank[next] ?? 0) > (rank[current] ?? 0) ? next : current;
}

function earliestDate(current: string | null, next: string | null) {
  if (!current) return next;
  if (!next) return current;
  return next < current ? next : current;
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusBadgeClass(status: string) {
  if (status === "Delayed") return "border-red-500/60 bg-red-500/10 text-red-400";
  if (status === "Active") return "border-green-500/60 bg-green-500/10 text-green-400";
  if (status === "Completed") return "border-blue-500/60 bg-blue-500/10 text-blue-400";
  return "border-yellow-500/60 bg-yellow-500/10 text-yellow-400";
}

function scopeId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "exhibition";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
