import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertCircle, Briefcase, Building2, CalendarDays, ChevronLeft,
  ChevronRight, MessageSquare, MoreVertical, Paperclip, Phone,
  Search, Send, Smile, Users, Video,
} from "lucide-react";
import {
  getConversationMessages, getManagerWorkspace, getMessageContacts,
  sendConversationMessage,
  type DirectMessage, type ManagedClient, type ManagedProject, type MessageContact,
} from "@/lib/platform-api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const MESSAGE_MAX_LENGTH = 2000;

interface ExhibitionScope {
  id: string;
  name: string;
  clients: string[];
  systems: string[];
  status: string;
  deadline: string | null;
  projects: ManagedProject[];
  managers: MessageContact[];
  clientContacts: MessageContact[];
  unread: number;
  lastMessage: string;
  lastMessageAt: string | null;
}

export default function ChiefMessages() {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const requestedManager = new URLSearchParams(location.split("?")[1] ?? "").get("manager");
  const [contacts,             setContacts]             = useState<MessageContact[]>([]);
  const [allClients,           setAllClients]           = useState<ManagedClient[]>([]);
  const [projects,             setProjects]             = useState<ManagedProject[]>([]);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [selectedId,           setSelectedId]           = useState<string | null>(requestedManager);
  const [contactType,          setContactType]          = useState<"pm" | "client" | null>(null);
  const [drawerOpen,           setDrawerOpen]           = useState(false);
  const [messages,             setMessages]             = useState<DirectMessage[]>([]);
  const [message,              setMessage]              = useState("");
  const [search,               setSearch]               = useState("");
  const [toast,                setToast]                = useState("");
  const [isLoading,            setIsLoading]            = useState(true);
  const [isSending,            setIsSending]            = useState(false);
  const [error,                setError]                = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = t("chief.messages.title");
  }, [t]);

  const noMessagesDefault = t("chief.messages.noMessagesDefault");
  const scopes = useMemo(
    () => buildExhibitionScopes(projects, contacts, allClients, noMessagesDefault),
    [contacts, projects, allClients, noMessagesDefault],
  );

  const filteredScopes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopes;
    return scopes.filter((scope) =>
      [scope.name, ...scope.clients, ...scope.systems,
       ...scope.managers.map((m) => m.name),
       ...scope.clientContacts.map((c) => c.name)].some(
        (v) => v.toLowerCase().includes(q),
      ),
    );
  }, [scopes, search]);

  const selectedScope = scopes.find((scope) => scope.id === selectedExhibitionId) ?? null;

  const scopedContacts = contactType === "client"
    ? (selectedScope?.clientContacts ?? [])
    : (selectedScope?.managers ?? []);

  const selectedContact = scopedContacts.find((c) => c.id === selectedId) ?? scopedContacts[0] ?? null;

  const conversationContext = selectedScope
    ? { exhibitionId: selectedScope.id, exhibitionName: selectedScope.name, projectId: selectedScope.projects[0]?.id }
    : undefined;
  const totalUnread = scopes.reduce((sum, scope) => sum + scope.unread, 0);

  /* ── Initial inbox load ───────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    loadInbox()
      .catch((reason: unknown) => {
        if (mounted)
          setError(reason instanceof Error ? reason.message : t("chief.messages.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    async function loadInbox() {
      const [contactResponse, workspace] = await Promise.all([
        getMessageContacts(),
        getManagerWorkspace(),
      ]);
      if (!mounted) return;
      setContacts(contactResponse.contacts); // keep ALL contacts, PMs + clients
      setAllClients(workspace.clients ?? []);
      setProjects(workspace.projects);
    }

    return () => { mounted = false; };
  }, [t]);

  /* ── Scope / contact selection ────────────────────────────────── */
  useEffect(() => {
    if (!scopes.length) {
      setSelectedExhibitionId(null);
      setSelectedId(null);
      return;
    }

    const currentScope   = selectedExhibitionId ? scopes.find((s) => s.id === selectedExhibitionId) : null;
    const requestedScope = requestedManager ? scopes.find((s) => s.managers.some((m) => m.id === requestedManager)) : null;
    const nextScope      = currentScope ?? requestedScope ?? scopes[0];

    if (selectedExhibitionId !== nextScope.id) setSelectedExhibitionId(nextScope.id);

    const managerStillInScope     = nextScope.managers.some((m) => m.id === selectedId);
    const requestedManagerInScope = requestedManager && nextScope.managers.some((m) => m.id === requestedManager);
    if (!managerStillInScope) {
      setSelectedId(requestedManagerInScope ? requestedManager : nextScope.managers[0]?.id ?? null);
    }

    if (requestedScope) { setContactType("pm"); setDrawerOpen(true); }
  }, [requestedManager, scopes, selectedExhibitionId, selectedId]);

  /* ── Message polling with exponential back-off ────────────────── */
  useEffect(() => {
    if (!drawerOpen || !selectedContact || !conversationContext || !contactType) {
      setMessages([]);
      return;
    }

    const contact = selectedContact;
    const ctx     = conversationContext;
    let mounted   = true;
    let errorCount = 0;

    function scheduleNext() {
      const delay = errorCount === 0 ? 5_000 : Math.min(5_000 * Math.pow(2, errorCount - 1), 60_000);
      window.setTimeout(poll, delay);
    }

    async function poll() {
      if (!mounted) return;
      try {
        const response = await getConversationMessages(contact.id, ctx);
        if (!mounted) return;
        setMessages(response.messages);
        setError("");
        setContacts((current) => current.map((c) => c.id === contact.id ? { ...c, unread: 0 } : c));
        errorCount = 0;
        scheduleNext();
      } catch (reason) {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : t("chief.messages.conversationError"));
        errorCount++;
        scheduleNext();
      }
    }

    poll();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationContext?.exhibitionId, conversationContext?.projectId, drawerOpen, selectedContact?.id, contactType, t]);

  /* ── Scroll to bottom ─────────────────────────────────────────── */
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedContact?.id, selectedScope?.id]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2400);
  }

  function openScope(scope: ExhibitionScope) {
    setSelectedExhibitionId(scope.id);
    setContactType(null); // reset to 2-button chooser
    setSelectedId(null);
    setMessage("");
    setMessages([]);
    setDrawerOpen(true);
  }

  function handleContactTypeChange(type: "pm" | "client" | null) {
    setContactType(type);
    setSelectedId(null);
    setMessages([]);
    setMessage("");
    if (type === "pm") {
      setSelectedId(selectedScope?.managers[0]?.id ?? null);
    } else if (type === "client") {
      setSelectedId(selectedScope?.clientContacts[0]?.id ?? null);
    }
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
      setContacts((current) =>
        current.map((c) =>
          c.id === selectedContact.id
            ? { ...c, lastMessage: text, time: t("chief.messages.justNow"), lastMessageAt: response.message.createdAt }
            : c,
        ),
      );
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chief.messages.sendError"));
    } finally {
      setIsSending(false);
    }
  }

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      Delayed:   t("chief.messages.status.delayed"),
      Active:    t("chief.messages.status.active"),
      Completed: t("chief.messages.status.completed"),
      Pending:   t("chief.messages.status.pending"),
    };
    return map[status] ?? status;
  }

  return (
    <DashboardLayout role="chief">
      <div className="space-y-5">
        <PageHeader
          title={t("chief.messages.title")}
          breadcrumbs={[{ label: t("chief.nav.dashboard"), href: "/chief" }, { label: t("chief.nav.messages") }]}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t("chief.messages.badges.exhibitions", { count: scopes.length })}</Badge>
            {totalUnread > 0 && (
              <Badge variant="default">{t("chief.messages.badges.unread", { count: totalUnread })}</Badge>
            )}
          </div>
        </PageHeader>

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        <section className="rounded-lg border bg-card/40">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">{t("chief.messages.section.title")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("chief.messages.section.desc")}</p>
            </div>
            <div className="relative w-full lg:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("chief.messages.searchPlaceholder")}
                aria-label={t("chief.messages.searchPlaceholder")}
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
                aria-label={scope.name}
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
                        {statusLabel(scope.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {scope.clients.join(", ") || t("chief.messages.noClient")}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center justify-center gap-1 rounded-md border bg-card/50 px-2 py-1">
                    <Users className="h-3 w-3" /> {scope.managers.length} PM
                  </span>
                  <span className="inline-flex items-center justify-center gap-1 rounded-md border bg-card/50 px-2 py-1">
                    <Briefcase className="h-3 w-3" /> {scope.projects.length}
                  </span>
                  <span className="inline-flex items-center justify-center gap-1 rounded-md border bg-card/50 px-2 py-1">
                    <CalendarDays className="h-3 w-3" />
                    {scope.deadline ? formatDate(scope.deadline, i18n.language) : "-"}
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

            {isLoading && !filteredScopes.length && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-h-[178px] rounded-lg border bg-background/45 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-36" />
                      <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                    </div>
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-4 w-4 shrink-0 mt-1" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-7 rounded-md" />
                  <Skeleton className="h-7 rounded-md" />
                  <Skeleton className="h-7 rounded-md" />
                </div>
                <div className="mt-auto pt-2">
                  <div className="rounded-md bg-card/50 p-3 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              </div>
            ))}
            {!filteredScopes.length && !isLoading && (
              <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                {t("chief.messages.noExhibitions")}
              </div>
            )}
          </div>
        </section>

        <MessageDrawer
          open={drawerOpen && !!selectedScope}
          scope={selectedScope}
          contactType={contactType}
          contacts={scopedContacts}
          selectedContact={selectedContact}
          messages={messages}
          message={message}
          isSending={isSending}
          messagesEnd={messagesEnd}
          onOpenChange={(open) => {
            setDrawerOpen(open);
            if (!open) { setContactType(null); setSelectedId(null); setMessages([]); }
          }}
          onContactTypeChange={handleContactTypeChange}
          onSelectContact={setSelectedId}
          onMessageChange={(value) => setMessage(value.slice(0, MESSAGE_MAX_LENGTH))}
          onSend={sendMessage}
          onToast={showToast}
        />

        {/* Always-rendered ARIA live toast */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl transition-all duration-300 ${toast ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
        >
          {toast}
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ── MessageDrawer sub-component ──────────────────────────────────────────── */
function MessageDrawer({
  open, scope, contactType, contacts, selectedContact, messages, message,
  isSending, messagesEnd, onOpenChange, onContactTypeChange, onSelectContact,
  onMessageChange, onSend, onToast,
}: {
  open: boolean;
  scope: ExhibitionScope | null;
  contactType: "pm" | "client" | null;
  contacts: MessageContact[];
  selectedContact: MessageContact | null;
  messages: DirectMessage[];
  message: string;
  isSending: boolean;
  messagesEnd: React.RefObject<HTMLDivElement | null>;
  onOpenChange: (open: boolean) => void;
  onContactTypeChange: (type: "pm" | "client" | null) => void;
  onSelectContact: (id: string) => void;
  onMessageChange: (message: string) => void;
  onSend: () => void;
  onToast: (message: string) => void;
}) {
  const { t } = useTranslation();
  const charCount = message.length;
  const nearLimit = charCount >= MESSAGE_MAX_LENGTH * 0.9;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-[min(92vw,1080px)]">
        {scope && (
          <>
            {/* Header */}
            <div className="border-b bg-card/60 px-6 py-4">
              <SheetHeader className="space-y-2 pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  {contactType && (
                    <button
                      type="button"
                      onClick={() => onContactTypeChange(null)}
                      className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Back"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  <SheetTitle className="truncate text-xl">{scope.name}</SheetTitle>
                  <Badge variant="outline" className={statusBadgeClass(scope.status)}>
                    {scope.status}
                  </Badge>
                </div>
                <SheetDescription className="truncate">
                  {scope.clients.join(", ") || t("chief.messages.noClient")} / {" "}
                  {t("chief.messages.projectCount", { count: scope.projects.length })}
                </SheetDescription>
              </SheetHeader>
            </div>

            {/* Body */}
            {!contactType ? (
              /* ── Type chooser — 2 big buttons ── */
              <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
                <div className="text-center">
                  <p className="text-lg font-semibold">Who do you want to message?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a group to start a conversation within <strong>{scope.name}</strong>.
                  </p>
                </div>
                <div className="grid w-full max-w-md grid-cols-2 gap-5">
                  <button
                    type="button"
                    onClick={() => onContactTypeChange("pm")}
                    className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card/60 p-8 text-center transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold">Project Managers</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {scope.managers.length} assigned
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onContactTypeChange("client")}
                    className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card/60 p-8 text-center transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold">Clients</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {scope.clientContacts.length} in this exhibition
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* ── Contact sidebar + conversation ── */
              <div className="grid min-h-0 flex-1 md:grid-cols-[270px_minmax(0,1fr)]">
                {/* Contact sidebar */}
                <aside className="flex min-h-0 flex-col border-r bg-background/40">
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">
                      {contactType === "pm" ? t("chief.messages.sidebar.title") : "Clients"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {contactType === "pm"
                        ? t("chief.messages.sidebar.assigned", { count: contacts.length })
                        : `${contacts.length} in this exhibition`}
                    </p>
                  </div>
                  <ScrollArea className="flex-1">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => onSelectContact(contact.id)}
                        aria-label={contact.name}
                        className={cn(
                          "flex w-full gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                          selectedContact?.id === contact.id && "border-l-2 border-l-primary bg-primary/10 pl-[14px]",
                        )}
                      >
                        <div className="relative">
                          <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                            contactType === "pm" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-600",
                          )}>
                            {initials(contact.name)}
                          </div>
                          <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card", contact.online ? "bg-green-500" : "bg-muted")} />
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
                    {!contacts.length && (
                      <div className="m-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        <AlertCircle className="mb-2 h-4 w-4" />
                        {contactType === "pm" ? t("chief.messages.sidebar.noManager") : "No clients in this exhibition yet."}
                      </div>
                    )}
                  </ScrollArea>
                </aside>

                {/* Conversation pane */}
                <section className="flex min-w-0 flex-col bg-background/20">
                  {selectedContact ? (
                    <>
                      {/* Contact header */}
                      <div className="flex min-h-16 items-center justify-between gap-4 border-b bg-card/50 px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold",
                            contactType === "pm" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-600",
                          )}>
                            {initials(selectedContact.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">{selectedContact.name}</h3>
                            <p className="truncate text-xs text-muted-foreground">{selectedContact.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={t("chief.messages.actions.call")} onClick={() => onToast(t("chief.messages.toast.call", { name: selectedContact.name, exhibition: scope.name }))}>
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={t("chief.messages.actions.video")} onClick={() => onToast(t("chief.messages.toast.video", { exhibition: scope.name }))}>
                            <Video className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={t("chief.messages.actions.options")} onClick={() => onToast(t("chief.messages.toast.options"))}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="border-b bg-muted/25 px-5 py-2 text-xs text-muted-foreground">
                        {t("chief.messages.scopedTo")}{" "}
                        <span className="font-medium text-foreground">{scope.name}</span>
                        {" · "}
                        <span className="capitalize">{contactType}</span>
                      </div>

                      {/* Messages */}
                      <ScrollArea className="flex-1">
                        <div className="mx-auto w-full max-w-3xl space-y-4 p-5">
                          {messages.map((item) => (
                            <div key={item.id} className={cn("flex", item.isMe ? "justify-end" : "justify-start")}>
                              <div className={cn(
                                "max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                item.isMe
                                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                                  : "rounded-tl-sm border border-border bg-card",
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
                              {t("chief.messages.noMessages", { name: scope.name })}
                            </div>
                          )}
                          <div ref={messagesEnd} />
                        </div>
                      </ScrollArea>

                      {/* Input area */}
                      <div className="border-t bg-card/50 p-4">
                        <div className="mx-auto w-full max-w-3xl flex flex-col gap-1">
                          <div className="flex items-center gap-2 rounded-xl border bg-background/70 p-2">
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground" aria-label={t("chief.messages.actions.attach")} onClick={() => onToast(t("chief.messages.toast.attachment", { exhibition: scope.name }))}>
                              <Paperclip className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0 flex-1">
                              <Input
                                placeholder={t("chief.messages.inputPlaceholder", { manager: selectedContact.name, exhibition: scope.name })}
                                aria-label={t("chief.messages.inputPlaceholder", { manager: selectedContact.name, exhibition: scope.name })}
                                className="h-10 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                                value={message}
                                maxLength={MESSAGE_MAX_LENGTH}
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
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground" aria-label={t("chief.messages.actions.emoji")} onClick={() => onMessageChange(`${message}😊`)}>
                              <Smile className="h-4 w-4" />
                            </Button>
                            <Button
                              className="h-10 shrink-0 px-4"
                              onClick={onSend}
                              disabled={!message.trim() || isSending}
                              aria-label={t("chief.messages.actions.send")}
                              data-testid="button-send-message"
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {isSending ? t("chief.messages.sending") : t("chief.messages.send")}
                            </Button>
                          </div>
                          {charCount > 0 && (
                            <p className={cn("text-right text-[10px] transition-colors", nearLimit ? "text-red-500 font-medium" : "text-muted-foreground")}>
                              {charCount}/{MESSAGE_MAX_LENGTH}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      {contactType === "pm" ? t("chief.messages.selectManager") : "Select a client to start messaging."}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Pure helpers ─────────────────────────────────────────────────────────── */
function buildExhibitionScopes(
  projects: ManagedProject[],
  contacts: MessageContact[],
  managedClients: ManagedClient[],
  noMessagesText: string,
): ExhibitionScope[] {
  const pmContacts     = contacts.filter((c) => c.role === "pm" || c.role === "Project Manager");
  const clientContacts = contacts.filter((c) => !pmContacts.includes(c));

  const contactsById   = new Map(pmContacts.map((c) => [c.id, c]));
  const contactsByName = new Map(pmContacts.map((c) => [normalize(c.name), c]));

  const clientContactsByEmail = new Map(clientContacts.map((c) => [c.email.toLowerCase(), c]));
  const clientContactsByName  = new Map(clientContacts.map((c) => [normalize(c.name), c]));

  const scopes = new Map<string, ExhibitionScope>();

  for (const project of projects) {
    const name     = project.exhibition || project.name;
    const id       = scopeId(name);
    const existing = scopes.get(id);
    const manager  = project.managerId
      ? contactsById.get(project.managerId) ?? contactsByName.get(normalize(project.managerName))
      : contactsByName.get(normalize(project.managerName));

    const scope = existing ?? {
      id, name, clients: [], systems: [],
      status: project.status, deadline: project.deadline,
      projects: [], managers: [], clientContacts: [], unread: 0,
      lastMessage: noMessagesText, lastMessageAt: null,
    };

    scope.projects.push(project);
    scope.clients  = appendUnique(scope.clients, project.client);
    scope.systems  = appendUnique(scope.systems, project.system);
    scope.status   = mergeStatus(scope.status, project.status);
    scope.deadline = earliestDate(scope.deadline, project.deadline);

    if (manager && !scope.managers.some((m) => m.id === manager.id)) {
      scope.managers.push(manager);
      scope.unread += manager.unread;
      if (!scope.lastMessageAt || (manager.lastMessageAt && manager.lastMessageAt > scope.lastMessageAt)) {
        scope.lastMessage   = manager.lastMessage;
        scope.lastMessageAt = manager.lastMessageAt;
      }
    }

    scopes.set(id, scope);
  }

  // Match client contacts to each scope using managed clients' emails
  for (const scope of scopes.values()) {
    const exNorm    = normalize(scope.name);
    const exClients = managedClients.filter((c) =>
      normalize(c.exhibition?.trim() || c.name) === exNorm
    );
    const matched: MessageContact[] = [];
    for (const mc of exClients) {
      const contact =
        clientContactsByEmail.get((mc.contactEmail ?? "").toLowerCase()) ??
        clientContactsByName.get(normalize(mc.name ?? ""));
      if (contact && !matched.some((m) => m.id === contact.id)) {
        matched.push(contact);
      }
    }
    scope.clientContacts = matched;
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

function formatDate(date: string, locale: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function statusBadgeClass(status: string) {
  if (status === "Delayed")   return "border-red-500/60 bg-red-500/10 text-red-400";
  if (status === "Active")    return "border-green-500/60 bg-green-500/10 text-green-400";
  if (status === "Completed") return "border-blue-500/60 bg-blue-500/10 text-blue-400";
  return "border-yellow-500/60 bg-yellow-500/10 text-yellow-400";
}

function scopeId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "exhibition";
}

function normalize(value: string) {
  return (value ?? "").trim().toLowerCase();
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
