import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, CheckCheck, X, Briefcase, Mail, Copy, Plus, UserRound } from "lucide-react";
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
  type PlatformProject,
} from "@/lib/platform-api";
import { cn } from "@/lib/utils";

export default function PMMessages() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  // Read deep-link param once on mount — stable across re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deepLinkContactId = useMemo(() => new URLSearchParams(window.location.search).get("contactId"), []);
  const deepLinkHandled = useRef(false);
  const [contacts,  setContacts]  = useState<MessageContact[]>([]);
  const [messages,  setMessages]  = useState<DirectMessage[]>([]);
  const [activeId,  setActiveId]  = useState<string | null>(null);
  const [projects, setProjects] = useState<PlatformProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [attachment, setAttachment] = useState<DirectMessageAttachment | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [search,    setSearch]    = useState("");
  const [toastMsg,     setToastMsg]     = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [error,     setError]     = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [chatCandidates, setChatCandidates] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = t("pm.messages.title");
  }, [t]);

  const active = contacts.find((c) => c.id === activeId) ?? contacts[0] ?? null;
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;
  const messageContext = activeProject ? {
    projectId: activeProject.id,
    exhibitionName: activeProject.exhibition,
  } : undefined;
  const scopeName = activeProject?.exhibition ?? activeProject?.name ?? t("pm.messages.generalThread");

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [contacts, search]);

  const filteredCandidates = useMemo(() => {
    const q = newChatSearch.toLowerCase();
    return chatCandidates.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [chatCandidates, newChatSearch]);

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0);

  useEffect(() => {
    let mounted = true;

    loadContacts().catch((reason: unknown) => {
      if (mounted) setError(reason instanceof Error ? reason.message : t("pm.messages.loadContactsError"));
    }).finally(() => {
      if (mounted) setIsLoading(false);
    });

    async function loadContacts() {
      const response = await getMessageContacts();
      if (!mounted) return;
      setContacts(response.contacts);
      setActiveId((current) =>
        current && response.contacts.some((c) => c.id === current)
          ? current
          : response.contacts[0]?.id ?? null,
      );
    }

    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    let mounted = true;

    getPlatformProjects({ limit: 100 })
      .then((payload) => {
        if (!mounted) return;
        setProjects(payload.projects);
        setActiveProjectId((current) =>
          current && payload.projects.some((project) => project.id === current)
            ? current
            : payload.projects[0]?.id ?? null,
        );
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : t("pm.messages.loadProjectsError"));
      });

    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    loadMessages();
    const interval = window.setInterval(loadMessages, 5000);

    async function loadMessages() {
      try {
        const response = await getConversationMessages(active.id, messageContext);
        if (!mounted) return;
        setMessages(response.messages);
        setContacts((current) =>
          current.map((c) => c.id === active.id ? { ...c, unread: 0 } : c),
        );
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : t("pm.messages.loadMessagesError"));
      }
    }

    return () => { mounted = false; window.clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, activeProject?.id, t]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, active?.id]);

  // Handle ?contactId= deep-link (e.g. from PMClients "Message" button)
  useEffect(() => {
    if (!deepLinkContactId || deepLinkHandled.current || isLoading) return;
    deepLinkHandled.current = true;

    // Clear the query param from the URL immediately so a reload doesn't re-trigger
    navigate("/pm/messages", { replace: true });

    const existing = contacts.find((c) => c.id === deepLinkContactId);
    if (existing) {
      setActiveId(existing.id);
      return;
    }

    // Contact not yet in list — look up from platform clients and inject
    getPlatformClients({ limit: 200 })
      .then((payload) => {
        const client = payload.clients.find((c) => c.id === deepLinkContactId);
        if (!client) return;
        const newContact: MessageContact = {
          id: client.id,
          name: client.contactName || client.company,
          email: client.contactEmail,
          role: "client",
          lastMessage: "",
          lastMessageAt: null,
          time: "",
          unread: 0,
          online: false,
        };
        setContacts((prev) => {
          if (prev.some((c) => c.id === newContact.id)) return prev;
          return [newContact, ...prev];
        });
        setActiveId(client.id);
      })
      .catch(() => { /* ignore — user lands on messages page normally */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkContactId, isLoading]);

  // Load new-chat candidates whenever the picker opens
  useEffect(() => {
    if (!showNewChat) return;
    let mounted = true;
    setIsLoadingCandidates(true);
    setChatCandidates([]);
    getPlatformClients({ limit: 200 })
      .then((payload) => {
        if (!mounted) return;
        const all: Array<{ id: string; name: string; email: string; role: string }> = [
          // Chief is always a potential recipient for PM
          { id: "mock-chief", name: "Owner Chief", email: "owner@ens.test", role: "chief" },
          ...payload.clients.map((c) => ({
            id: c.id,
            name: c.contactName || c.company,
            email: c.contactEmail,
            role: "client" as const,
          })),
        ];
        const existingEmails = new Set(contacts.map((c) => c.email.toLowerCase()));
        setChatCandidates(all.filter((c) => !existingEmails.has(c.email.toLowerCase())));
      })
      .catch(() => { if (mounted) setChatCandidates([]); })
      .finally(() => { if (mounted) setIsLoadingCandidates(false); });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewChat]);

  function selectContact(id: string) {
    setActiveId(id);
    setOptionsOpen(false);
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, unread: 0 } : c));
  }

  async function sendMessage() {
    if (!active || isSending || isUploading) return;
    const text = inputText.trim();
    if (!text && !attachment) return;
    const attachments = attachment ? [attachment] : [];
    const preview = text || attachment?.name || t("pm.messages.attachmentFallback");

    setIsSending(true);
    setError("");
    try {
      const response = await sendConversationMessage(active.id, text, messageContext, attachments);
      setMessages((current) => [...current, response.message]);
      setContacts((current) =>
        current.map((c) => c.id === active.id ? {
          ...c,
          lastMessage:   preview,
          lastMessageAt: response.message.createdAt,
          time:          t("pm.messages.justNow"),
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

  function showToast(message: string) {
    setToastMsg(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2400);
  }

  function openMailIntent(kind: "call" | "video" | "email") {
    if (!active) return;
    const labels = {
      call: "Call request",
      video: "Video meeting request",
      email: "Project message",
    };
    const query = new URLSearchParams({
      subject: `${labels[kind]}: ${scopeName}`,
      body: `Hi ${active.name},\n\nCan we discuss ${scopeName}?\n\nThanks.`,
    });
    window.location.href = `mailto:${active.email}?${query.toString()}`;
    setOptionsOpen(false);
    showToast(t(kind === "video" ? "pm.messages.toast.videoRequestOpened" : "pm.messages.toast.callRequestOpened", { name: active.name }));
  }

  async function copyThreadContext() {
    if (!active) return;
    const context = `${scopeName} / ${active.name} / ${active.email}`;
    try {
      await navigator.clipboard.writeText(context);
      showToast(t("pm.messages.toast.contextCopied"));
    } catch {
      showToast(t("pm.messages.toast.contextCopyError"));
    } finally {
      setOptionsOpen(false);
    }
  }

  function startNewChat(candidate: { id: string; name: string; email: string; role: string }) {
    // If this person is already a contact, just select them
    const existing = contacts.find((c) => c.email.toLowerCase() === candidate.email.toLowerCase());
    if (existing) {
      selectContact(existing.id);
    } else {
      const newContact: MessageContact = {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        role: candidate.role,
        lastMessage: "",
        lastMessageAt: null,
        time: "",
        unread: 0,
        online: false,
      };
      setContacts((prev) => [newContact, ...prev]);
      setActiveId(candidate.id);
    }
    setShowNewChat(false);
    setNewChatSearch("");
  }

  async function selectAttachment(file: File | null) {
    if (!file) return;
    if (file.size > 10_000_000) {
      showToast(t("pm.messages.toast.attachmentTooLarge"));
      return;
    }
    setIsUploading(true);
    setError("");
    try {
      const response = await uploadConversationAttachment(file);
      setAttachment(response.attachment);
      showToast(t("pm.messages.toast.attachmentSelected", { name: file.name }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.messages.toast.attachmentUploadError"));
    } finally {
      setIsUploading(false);
    }
  }

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
          {/* Contact sidebar */}
          <div className="w-72 border-r border-border flex flex-col bg-card/50 flex-shrink-0">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("pm.messages.searchPlaceholder")}
                    aria-label={t("pm.messages.searchPlaceholder")}
                    className="pl-8 pr-3 h-8 w-full text-xs border rounded-md bg-background/50 outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setShowNewChat((v) => !v); setNewChatSearch(""); }}
                  aria-label={t("pm.messages.newConversation")}
                  title={t("pm.messages.newConversation")}
                  aria-pressed={showNewChat}
                  className={cn(
                    "flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md border transition-colors",
                    showNewChat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="border-b border-border p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <Briefcase aria-hidden="true" className="h-3.5 w-3.5" />
                {t("pm.messages.projectScope")}
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {projects.map((project) => {
                  const selected = activeProject?.id === project.id;
                  return (
                    <button
                      key={project.id}
                      onClick={() => setActiveProjectId(project.id)}
                      aria-pressed={selected}
                      className={cn(
                        "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                        selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="block truncate text-xs font-semibold">{project.exhibition || project.name}</span>
                      <span className="block truncate text-[10px] font-mono">{project.client}</span>
                    </button>
                  );
                })}
                {!projects.length && (
                  <div className="rounded-md border border-dashed px-2.5 py-3 text-xs text-muted-foreground">
                    {t("pm.messages.noProjectScopes")}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {showNewChat ? (
                /* ── New conversation picker ── */
                <>
                  <div className="px-3 pt-3 pb-2 border-b border-border">
                    <div className="relative">
                      <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                      <input
                        autoFocus
                        value={newChatSearch}
                        onChange={(e) => setNewChatSearch(e.target.value)}
                        placeholder={t("pm.messages.newChatSearchPlaceholder")}
                        aria-label={t("pm.messages.newChatSearchPlaceholder")}
                        className="pl-8 pr-3 h-8 w-full text-xs border rounded-md bg-background/50 outline-none focus:border-primary"
                      />
                    </div>
                    <p className="mt-1.5 text-[9.5px] font-mono text-muted-foreground">
                      {t("pm.messages.newChatHint")}
                    </p>
                  </div>

                  {isLoadingCandidates ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    ))
                  ) : filteredCandidates.length === 0 ? (
                    <div className="p-6 text-center">
                      <UserRound aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">
                        {newChatSearch
                          ? t("pm.messages.newChatNoMatch")
                          : t("pm.messages.newChatAllAdded")}
                      </p>
                    </div>
                  ) : (
                    filteredCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => startNewChat(candidate)}
                        className="w-full p-3 flex gap-3 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border/40 text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-primary">{initials(candidate.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold truncate">{candidate.name}</h4>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{candidate.email}</p>
                          <span className="text-[10px] text-muted-foreground capitalize">{candidate.role}</span>
                        </div>
                        <Plus aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground self-center flex-shrink-0" />
                      </button>
                    ))
                  )}
                </>
              ) : (
                /* ── Regular contact list ── */
                <>
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => selectContact(contact.id)}
                      aria-pressed={active?.id === contact.id}
                      className={cn(
                        "w-full p-3 flex gap-3 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border/40 text-left",
                        active?.id === contact.id ? "bg-primary/10 border-l-2 border-l-primary" : "",
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-primary">{initials(contact.name)}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold truncate">{contact.name}</h4>
                          <span className="text-[9px] text-muted-foreground whitespace-nowrap ml-1">{contact.time}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{contact.email}</p>
                        <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{contact.lastMessage}</p>
                      </div>
                      {contact.unread > 0 && (
                        <span className="bg-primary text-primary-foreground text-[9px] h-4 min-w-4 rounded-full px-1 flex items-center justify-center font-bold flex-shrink-0 self-center">
                          {contact.unread}
                        </span>
                      )}
                    </button>
                  ))}
                  {isLoading && !filteredContacts.length && Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-3 border-b last:border-0">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                  {!filteredContacts.length && !isLoading && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {t("pm.messages.noContacts")}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Chat panel */}
          <div className="flex-1 flex flex-col bg-background/20 min-w-0">
            {active ? (
              <>
                <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-primary">{initials(active.name)}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold leading-tight">{active.name}</h4>
                      <p className="text-[10px] font-mono text-muted-foreground">{active.email}</p>
                      <span className="text-[10px] flex items-center gap-1 mt-0.5 text-muted-foreground">
                        {t("pm.messages.scopedTo", { project: scopeName })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openMailIntent("call")}
                      aria-label={t("pm.messages.actions.call")}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Phone aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openMailIntent("video")}
                      aria-label={t("pm.messages.actions.video")}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Video aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setOptionsOpen((open) => !open)}
                        aria-label={t("pm.messages.actions.more")}
                        aria-expanded={optionsOpen}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <MoreVertical aria-hidden="true" className="h-4 w-4" />
                      </button>
                      {optionsOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-xl">
                          <button
                            type="button"
                            onClick={() => openMailIntent("email")}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-muted"
                          >
                            <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                            {t("pm.messages.actions.email")}
                          </button>
                          <button
                            type="button"
                            onClick={copyThreadContext}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-muted"
                          >
                            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                            {t("pm.messages.actions.copyContext")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-5">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={cn("flex flex-col", msg.isMe ? "items-end" : "items-start")}>
                        {!msg.isMe && (
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mb-1">
                            <span className="text-[8px] font-bold text-primary">{initials(active.name)}</span>
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          msg.isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none",
                        )}>
                          {msg.text && !(msg.text === "[Attachment]" && msg.attachments?.length) && (
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          )}
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
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        aria-label={t("pm.messages.actions.clearAttachment")}
                        className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border">
                    <input
                      ref={fileInput}
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        void selectAttachment(event.target.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                    />
                    <button
                      onClick={() => fileInput.current?.click()}
                      disabled={isUploading}
                      aria-label={t("pm.messages.actions.attach")}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Paperclip aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <input
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={t("pm.messages.inputPlaceholder")}
                      data-testid="input-message"
                      className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60"
                    />
                    {inputText && (
                      <button
                        onClick={() => setInputText("")}
                        aria-label={t("pm.common.cancel")}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
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
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t("pm.messages.selectContact")}
              </div>
            )}
          </div>
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
      </div>
    </DashboardLayout>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1000))} KB`;
}
