import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Send, Paperclip, MoreVertical, Phone, Video, CheckCheck, X,
  Mail, Copy, UserRound, Building2, ChevronLeft,
  Lock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getConversationMessages,
  getMessageContacts,
  getPlatformClients,
  getPlatformProjects,
  messageAttachmentHref,
  sendConversationMessage,
  uploadConversationAttachment,
  type DirectMessage,
  type DirectMessageAttachment,
  type MessageContact,
  type PlatformClient,
  type PlatformProject,
} from "@/lib/platform-api";
import { cn } from "@/lib/utils";

// ── Data model ────────────────────────────────────────────────────────────────

interface PmExhibitionScope {
  exhibitionName: string;
  projectId: string;
  status: string;
  deadline: string | null;
  chiefContact: MessageContact | null;
  clientContact: MessageContact | null;
  unread: number;
}

function buildPmExhibitionScopes(
  projects: PlatformProject[],
  clients: PlatformClient[],
  contacts: MessageContact[],
): PmExhibitionScope[] {
  const seen = new Set<string>();
  const scopes: PmExhibitionScope[] = [];
  for (const p of projects) {
    const exhibitionName = p.exhibition || p.name;
    if (seen.has(exhibitionName)) continue;
    seen.add(exhibitionName);
    const clientRecord = clients.find((client) => client.id === p.clientId || normalize(client.company) === normalize(p.client));
    const clientContact = contacts.find(
      (c) =>
        c.role === "client" && (
          (clientRecord?.userId && c.id === clientRecord.userId) ||
          (clientRecord?.contactEmail && normalize(c.email) === normalize(clientRecord.contactEmail))
        ),
    ) ?? null;
    const chiefContact =
      contacts.find((c) => c.role === "chief") ??
      contacts.find((c) => c.role !== "client") ??
      null;
    const unread = [chiefContact, clientContact]
      .filter(Boolean)
      .reduce((sum, c) => sum + (c?.unread ?? 0), 0);
    scopes.push({ exhibitionName, projectId: p.id, status: p.status ?? "active", deadline: p.deadline ?? null, chiefContact, clientContact, unread });
  }
  return scopes;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PMMessages() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const deepLinkContactId = useMemo(() => new URLSearchParams(window.location.search).get("contactId"), []);
  const deepLinkHandled = useRef(false);

  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [projects, setProjects] = useState<PlatformProject[]>([]);
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [activeExhibitionName, setActiveExhibitionName] = useState<string | null>(null);
  const [contactType, setContactType] = useState<"chief" | "client" | null>(null);
  const [inputText, setInputText] = useState("");
  const [attachment, setAttachment] = useState<DirectMessageAttachment | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { toast } = useToast();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = t("pm.messages.title"); }, [t]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const scopes = useMemo(() => buildPmExhibitionScopes(projects, clients, contacts), [projects, clients, contacts]);
  const generalChiefContact = useMemo(
    () => contacts.find((c) => c.role === "chief") ?? contacts.find((c) => c.role === "owner" || c.role === "admin") ?? null,
    [contacts],
  );
  const visibleScopes = useMemo(() => {
    if (scopes.length || !generalChiefContact) return scopes;
    return [{
      exhibitionName: "General",
      projectId: "general",
      status: "active",
      deadline: null,
      chiefContact: generalChiefContact,
      clientContact: null,
      unread: generalChiefContact.unread ?? 0,
    }];
  }, [generalChiefContact, scopes]);

  const activeScope = visibleScopes.find((s) => s.exhibitionName === activeExhibitionName) ?? null;

  const activeContact: MessageContact | null = useMemo(() => {
    if (!activeScope || !contactType) return null;
    return contactType === "chief" ? activeScope.chiefContact : activeScope.clientContact;
  }, [activeScope, contactType]);

  const activeProject = useMemo(
    () => projects.find((p) => (p.exhibition || p.name) === activeExhibitionName) ?? null,
    [projects, activeExhibitionName],
  );

  const messageContext = contactType === "chief"
    ? undefined
    : activeScope && activeProject
    ? { projectId: activeProject.id, exhibitionName: activeScope.exhibitionName }
    : undefined;

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0);

  // ── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    getMessageContacts()
      .then((res) => { if (mounted) setContacts(res.contacts); })
      .catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : t("pm.messages.loadContactsError")); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getPlatformProjects({ limit: 100 }),
      getPlatformClients({ limit: 200 }),
    ])
      .then(([projectPayload, clientPayload]) => {
        if (!mounted) return;
        setProjects(projectPayload.projects);
        setClients(clientPayload.clients);
      })
      .catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : t("pm.messages.loadProjectsError")); });
    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    if (!activeContact) return;
    let mounted = true;
    loadMessages();
    const interval = window.setInterval(loadMessages, 5000);

    async function loadMessages() {
      try {
        const res = await getConversationMessages(activeContact!.id, messageContext);
        if (!mounted) return;
        setMessages(res.messages);
        setContacts((prev) => prev.map((c) => c.id === activeContact!.id ? { ...c, unread: 0 } : c));
      } catch (reason) {
        if (!mounted) return;
        const message = reason instanceof Error ? reason.message : t("pm.messages.loadMessagesError");
        if (isConversationAccessError(message)) {
          setError("");
          setContactType(null);
          setMessages([]);
          mounted = false;
          window.clearInterval(interval);
          return;
        }
        setError(message);
      }
    }

    return () => { mounted = false; window.clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContact?.id, activeProject?.id, t]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeContact?.id]);

  // Deep-link: ?contactId= → find the exhibition and contact type
  useEffect(() => {
    if (!deepLinkContactId || deepLinkHandled.current || isLoading || !visibleScopes.length) return;
    deepLinkHandled.current = true;
    navigate("/pm/messages", { replace: true });

    for (const scope of visibleScopes) {
      if (scope.chiefContact?.id === deepLinkContactId) {
        setActiveExhibitionName(scope.exhibitionName);
        setContactType("chief");
        return;
      }
      if (scope.clientContact?.id === deepLinkContactId) {
        setActiveExhibitionName(scope.exhibitionName);
        setContactType("client");
        return;
      }
    }

    // Contact not in scopes yet — look up from clients and open as client
    getPlatformClients({ limit: 200 }).then((payload) => {
      const client = payload.clients.find((c) => c.id === deepLinkContactId);
      if (!client?.userId) return;
      const newContact: MessageContact = {
        id: client.userId, name: client.contactName || client.company,
        email: client.contactEmail, role: "client",
        lastMessage: "", lastMessageAt: null, time: "", unread: 0, online: false,
      };
      setContacts((prev) => prev.some((c) => c.id === newContact.id) ? prev : [newContact, ...prev]);
      const scope = visibleScopes.find((item) => item.clientContact?.id === newContact.id);
      if (scope) {
        setActiveExhibitionName(scope.exhibitionName);
        setContactType("client");
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkContactId, isLoading, visibleScopes.length]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  function showToast(message: string) {
    toast({ title: message });
  }

  async function sendMessage() {
    if (!activeContact || isSending || isUploading) return;
    const text = inputText.trim();
    if (!text && !attachment) return;
    const attachments = attachment ? [attachment] : [];
    const preview = text || attachment?.name || t("pm.messages.attachmentFallback");
    setIsSending(true);
    setError("");
    try {
      const res = await sendConversationMessage(activeContact.id, text, messageContext, attachments);
      setMessages((prev) => [...prev, res.message]);
      setContacts((prev) =>
        prev.map((c) => c.id === activeContact.id ? {
          ...c, lastMessage: preview, lastMessageAt: res.message.createdAt, time: t("pm.messages.justNow"),
        } : c),
      );
      setInputText("");
      setAttachment(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.messages.sendError"));
    } finally {
      setIsSending(false);
    }
  }

  function openMailIntent(kind: "call" | "video" | "email") {
    if (!activeContact) return;
    const labels = { call: "Call request", video: "Video meeting request", email: "Project message" };
    const query = new URLSearchParams({
      subject: `${labels[kind]}: ${activeScope?.exhibitionName ?? ""}`,
      body: `Hi ${activeContact.name},\n\nCan we discuss ${activeScope?.exhibitionName ?? "this exhibition"}?\n\nThanks.`,
    });
    window.location.href = `mailto:${activeContact.email}?${query.toString()}`;
    setOptionsOpen(false);
    showToast(t(kind === "video" ? "pm.messages.toast.videoRequestOpened" : "pm.messages.toast.callRequestOpened", { name: activeContact.name }));
  }

  async function copyThreadContext() {
    if (!activeContact || !activeScope) return;
    const context = `${activeScope.exhibitionName} / ${activeContact.name} / ${activeContact.email}`;
    try {
      await navigator.clipboard.writeText(context);
      showToast(t("pm.messages.toast.contextCopied"));
    } catch {
      showToast(t("pm.messages.toast.contextCopyError"));
    } finally {
      setOptionsOpen(false);
    }
  }

  async function selectAttachment(file: File | null) {
    if (!file) return;
    if (file.size > 10_000_000) { showToast(t("pm.messages.toast.attachmentTooLarge")); return; }
    setIsUploading(true);
    setError("");
    try {
      const res = await uploadConversationAttachment(file);
      setAttachment(res.attachment);
      showToast(t("pm.messages.toast.attachmentSelected", { name: file.name }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.messages.toast.attachmentUploadError"));
    } finally {
      setIsUploading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="pm">
      <div className="flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
        <PageHeader
          title={t("pm.messages.title")}
          breadcrumbs={[{ label: t("pm.nav.dashboard"), href: "/pm" }, { label: t("pm.nav.messages") }]}
        >
          {totalUnread > 0 && (
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
              {t("pm.messages.unread", { count: totalUnread })}
            </span>
          )}
        </PageHeader>

        {error && (
          <div role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-1 overflow-hidden rounded-xl border border-border bg-card/30">

          {/* ── Left panel: Exhibition list ────────────────────────────────── */}
          <div className="w-72 border-r border-border flex flex-col bg-card/50 flex-shrink-0">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Exhibitions</p>
              <p className="text-xs text-muted-foreground">{t("pm.messages.selectExhibitionHint", { defaultValue: "Select an exhibition to message" })}</p>
            </div>
            <ScrollArea className="flex-1">
              {isLoading && !visibleScopes.length
                ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b border-border/40 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))
                : visibleScopes.length === 0
                ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {t("pm.messages.noProjectScopes")}
                  </div>
                )
                : visibleScopes.map((scope) => {
                  const active = scope.exhibitionName === activeExhibitionName;
                  return (
                    <button
                      key={scope.exhibitionName}
                      onClick={() => { setActiveExhibitionName(scope.exhibitionName); setContactType(null); setMessages([]); }}
                      aria-pressed={active}
                      className={cn(
                        "w-full px-4 py-3.5 flex gap-3 items-start text-left border-b border-border/40 transition-colors",
                        active
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-primary/5",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold truncate leading-tight">{scope.exhibitionName}</span>
                          {scope.unread > 0 && (
                            <span className="bg-primary text-primary-foreground text-[9px] h-4 min-w-4 rounded-full px-1 flex items-center justify-center font-bold flex-shrink-0">
                              {scope.unread}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn(
                            "text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded",
                            scope.status === "active" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground",
                          )}>{scope.status}</span>
                          {scope.deadline && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(scope.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {scope.chiefContact && (
                            <span className="text-[9px] bg-muted/60 rounded px-1 py-0.5 text-muted-foreground">Chief</span>
                          )}
                          {scope.clientContact && (
                            <span className="text-[9px] bg-muted/60 rounded px-1 py-0.5 text-muted-foreground truncate max-w-[100px]">{scope.clientContact.name}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              }
            </ScrollArea>
          </div>

          {/* ── Right panel ────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-background/20 min-w-0">

            {!activeExhibitionName ? (
              /* No exhibition selected */
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-8">
                <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
                  <Search aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">{t("pm.messages.selectExhibitionHint", { defaultValue: "Select an exhibition" })}</p>
                <p className="text-xs text-muted-foreground">{t("pm.messages.selectExhibitionSub", { defaultValue: "Choose an exhibition from the left to message your chief or client." })}</p>
              </div>

            ) : !contactType ? (
              /* ── Contact type chooser ── */
              <div className="flex flex-1 flex-col">
                <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => setActiveExhibitionName(null)}
                    aria-label="Back to exhibitions"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <div>
                    <h4 className="text-sm font-bold leading-tight">{activeExhibitionName}</h4>
                    <p className="text-[10px] font-mono text-muted-foreground">{t("pm.messages.chooser.prompt", { defaultValue: "Who do you want to message?" })}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
                  <button
                    onClick={() => setContactType("chief")}
                    disabled={!activeScope?.chiefContact}
                    className={cn(
                      "w-full max-w-sm rounded-xl border px-5 py-4 text-left transition-all",
                      activeScope?.chiefContact
                        ? "border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm cursor-pointer"
                        : "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <UserRound aria-hidden="true" className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">Chief Manager</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          {activeScope?.chiefContact?.name ?? t("pm.messages.chooser.noChief", { defaultValue: "No chief assigned" })}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setContactType("client")}
                    disabled={!activeScope?.clientContact}
                    className={cn(
                      "w-full max-w-sm rounded-xl border px-5 py-4 text-left transition-all",
                      activeScope?.clientContact
                        ? "border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm cursor-pointer"
                        : "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Building2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">Client</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          {activeScope?.clientContact?.name ?? t("pm.messages.chooser.noClient", { defaultValue: "No client contact" })}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

            ) : !activeContact ? (
              /* Contact not found */
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <button
                  onClick={() => setContactType(null)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
                >
                  <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("pm.messages.back", { defaultValue: "Back" })}
                </button>
                <p className="text-sm text-muted-foreground">
                  {contactType === "chief"
                    ? t("pm.messages.chooser.noChief", { defaultValue: "No chief manager assigned to this exhibition." })
                    : t("pm.messages.chooser.noClient", { defaultValue: "No client contact found for this exhibition." })}
                </p>
              </div>

            ) : (
              /* ── Conversation ── */
              <>
                <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setContactType(null)}
                      aria-label="Back to chooser"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-primary">{initials(activeContact.name)}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold leading-tight">{activeContact.name}</h4>
                      <p className="text-[10px] font-mono text-muted-foreground">{activeContact.email}</p>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        {activeExhibitionName} · {contactType === "chief" ? "Chief Manager" : "Client"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openMailIntent("call")} aria-label={t("pm.messages.actions.call")} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Phone aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button onClick={() => openMailIntent("video")} aria-label={t("pm.messages.actions.video")} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Video aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setOptionsOpen((o) => !o)}
                        aria-label={t("pm.messages.actions.more")}
                        aria-expanded={optionsOpen}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <MoreVertical aria-hidden="true" className="h-4 w-4" />
                      </button>
                      {optionsOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-xl">
                          <button type="button" onClick={() => openMailIntent("email")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-muted">
                            <Mail aria-hidden="true" className="h-3.5 w-3.5" /> {t("pm.messages.actions.email")}
                          </button>
                          <button type="button" onClick={copyThreadContext} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-muted">
                            <Copy aria-hidden="true" className="h-3.5 w-3.5" /> {t("pm.messages.actions.copyContext")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ScrollArea
                  className="flex-1 p-5"
                  role="log"
                  aria-label="Message thread"
                  aria-live="polite"
                >
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={cn("flex flex-col", msg.isMe ? "items-end" : "items-start")}>
                        {!msg.isMe && (
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mb-1">
                            <span className="text-[8px] font-bold text-primary">{initials(activeContact.name)}</span>
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          msg.isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none",
                        )}>
                          {msg.undecryptable ? (
                            // Not message text: the row exists but was written
                            // under an encryption key the server no longer has,
                            // so there is nothing to show. Rendering it as
                            // ordinary text made it look like something the
                            // sender had typed.
                            <p className="flex items-center gap-1.5 text-xs italic opacity-70">
                              <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
                              {t("pm.messages.undecryptable")}
                            </p>
                          ) : msg.text && !(msg.text === "[Attachment]" && msg.attachments?.length) ? (
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          ) : null}
                          {Boolean(msg.attachments?.length) && (
                            <div className={cn("space-y-1.5", msg.text && msg.text !== "[Attachment]" ? "mt-2" : "")}>
                              {msg.attachments?.map((item) => (
                                <a
                                  key={item.id}
                                  href={messageAttachmentHref(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(
                                    "flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-xs",
                                    msg.isMe ? "border-white/25 bg-white/10 text-primary-foreground" : "border-border bg-muted/40 text-foreground",
                                  )}
                                >
                                  <Paperclip aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                  <span className={cn("shrink-0 font-mono text-[10px]", msg.isMe ? "text-white/70" : "text-muted-foreground")}>
                                    {formatFileSize(item.size)}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={cn("flex items-center gap-1 text-[9.5px] font-mono text-muted-foreground mt-1", msg.isMe ? "pr-1" : "pl-1")}>
                          <span>{msg.time}</span>
                          {msg.isMe && <CheckCheck aria-hidden="true" className="h-3 w-3" style={{ color: msg.read ? "#1d4ed8" : "#9ca3af" }} />}
                        </div>
                      </div>
                    ))}
                    {!messages.length && (
                      <div className="py-12 text-center text-sm text-muted-foreground">
                        {t("pm.messages.noMessages")}
                      </div>
                    )}
                    <div ref={messagesEnd} />
                  </div>
                </ScrollArea>

                <div className="p-3 border-t border-border bg-card/50 flex-shrink-0">
                  {isUploading && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
                      {t("pm.messages.uploadingAttachment")}
                    </div>
                  )}
                  {attachment && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{t("pm.messages.attachmentDraft", { name: attachment.name })}</span>
                        <span className="shrink-0 font-mono text-[10px]">{formatFileSize(attachment.size)}</span>
                      </span>
                      <button type="button" onClick={() => setAttachment(null)} aria-label={t("pm.messages.actions.clearAttachment")} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground">
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border">
                    <input
                      ref={fileInput}
                      type="file"
                      className="hidden"
                      onChange={(event) => { void selectAttachment(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }}
                    />
                    <button onClick={() => fileInput.current?.click()} disabled={isUploading} aria-label={t("pm.messages.actions.attach")} className="p-1 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
                      <Paperclip aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <input
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
                      placeholder={t("pm.messages.inputPlaceholder")}
                      data-testid="input-message"
                      className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                    />
                    {inputText && (
                      <button onClick={() => setInputText("")} aria-label={t("pm.common.cancel")} className="p-1 text-muted-foreground hover:text-foreground">
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={sendMessage}
                      disabled={(!inputText.trim() && !attachment) || isSending || isUploading}
                      aria-label={t("pm.messages.actions.send")}
                      className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-sm"
                      data-testid="button-send-message"
                    >
                      <Send aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground mt-1.5 text-center">
                    {t("pm.messages.enterToSend")}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

function isConversationAccessError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("not assigned") ||
    normalized.includes("forbidden") ||
    normalized.includes("contact was not found") ||
    normalized.includes("conversation is not available") ||
    normalized.includes("not accessible");
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1000))} KB`;
}
