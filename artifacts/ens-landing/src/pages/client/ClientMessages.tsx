import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Paperclip, MoreVertical, Search, Phone, Video, X } from "lucide-react";
import {
  getConversationMessages,
  getMessageContacts,
  messageAttachmentHref,
  sendConversationMessage,
  uploadConversationAttachment,
  type DirectMessage,
  type DirectMessageAttachment,
  type MessageContact,
} from "@/lib/platform-api";

export default function ClientMessages() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachment, setAttachment] = useState<DirectMessageAttachment | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = t("client.messages.pageTitle");
  }, [t]);

  const active = contacts.find((contact) => contact.id === activeId) ?? contacts[0] ?? null;
  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((contact) => contact.name.toLowerCase().includes(q) || contact.email.toLowerCase().includes(q));
  }, [contacts, search]);

  useEffect(() => {
    let mounted = true;
    getMessageContacts()
      .then((response) => {
        if (!mounted) return;
        setContacts(response.contacts);
        setActiveId((current) => current && response.contacts.some((contact) => contact.id === current) ? current : response.contacts[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : t("client.messages.error.contacts"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    loadMessages();
    const interval = window.setInterval(loadMessages, 5000);

    async function loadMessages() {
      try {
        const response = await getConversationMessages(active!.id);
        if (!mounted) return;
        setMessages(response.messages);
        setContacts((current) => current.map((contact) => contact.id === active!.id ? { ...contact, unread: 0 } : contact));
      } catch (reason) {
        if (!mounted) return;
        const message = reason instanceof Error ? reason.message : t("client.messages.error.messages");
        if (isConversationAccessError(message)) {
          setContacts((current) => current.filter((contact) => contact.id !== active!.id));
          setMessages([]);
          setActiveId(null);
          mounted = false;
          return;
        }
        setError(message);
      }
    }

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [active?.id]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, active?.id]);

  async function handleSendMessage() {
    if (!active || isSending) return;
    const text = inputValue.trim();
    if (!text && !attachment) return;
    setIsSending(true);
    setError("");
    try {
      const attachments = attachment ? [attachment] : [];
      const preview = text || attachment?.name || "Attachment";
      const response = await sendConversationMessage(active.id, text, undefined, attachments);
      setMessages((current) => [...current, response.message]);
      setContacts((current) => current.map((contact) => contact.id === active.id ? {
        ...contact,
        lastMessage: preview,
        lastMessageAt: response.message.createdAt,
        time: t("client.messages.justNow"),
      } : contact));
      setInputValue("");
      setAttachment(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 25_000_000) {
      setError(t("client.messages.error.attachmentTooLarge"));
      return;
    }
    setIsUploading(true);
    setError("");
    try {
      const response = await uploadConversationAttachment(file);
      setAttachment(response.attachment);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload attachment.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <DashboardLayout role="client">
      <PageHeader
        title={t("client.messages.title")}
        breadcrumbs={[
          { label: t("client.messages.breadcrumbDashboard"), href: "/client" },
          { label: t("client.messages.title") },
        ]}
      />

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="mt-6 h-[calc(100vh-220px)] flex gap-6">
        <Card className="w-80 hidden md:flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="msg-search" className="sr-only">{t("client.messages.searchPlaceholder")}</label>
              <Input
                id="msg-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("client.messages.searchPlaceholder")}
                className="pl-9 bg-muted/50 border-transparent"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y" role="list" aria-label={t("client.messages.contactListLabel")}>
              {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading...</div>}
              {!isLoading && filteredContacts.map((contact) => {
                const selected = active?.id === contact.id;
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setActiveId(contact.id)}
                    className={`w-full p-4 cursor-pointer transition-colors text-left ${selected ? "bg-primary/5 border-l-4 border-primary" : "hover:bg-muted/50"}`}
                    role="listitem"
                  >
                    <div className="flex gap-3">
                      <Avatar aria-hidden="true">
                        <AvatarFallback className={selected ? "bg-primary/10 text-primary" : ""}>
                          {contact.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PM"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-bold truncate">{contact.name}</p>
                          <span className="text-[10px] text-muted-foreground">{contact.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden border-primary/10">
          <div className="p-4 border-b flex items-center justify-between bg-card/50">
            <div className="flex items-center gap-3">
              <Avatar aria-hidden="true">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {active?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PM"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-bold leading-none">{active?.name ?? t("client.messages.supportManager")}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{active?.email ?? ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={t("client.messages.actions.phone")}>
                <Phone className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={t("client.messages.actions.video")}>
                <Video className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={t("client.messages.actions.more")}>
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div role="log" aria-label={t("client.messages.threadLabel")} aria-live="polite" className="space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[80%] ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}>
                    <Avatar className="h-8 w-8 shrink-0" aria-hidden="true">
                      <AvatarFallback className={msg.isMe ? "bg-primary text-primary-foreground" : "bg-muted"}>
                        {msg.isMe ? t("client.messages.avatarYou") : t("client.messages.avatarPm")}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}>
                      <div className={`p-4 rounded-2xl text-sm ${msg.isMe ? "bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/20" : "bg-muted border rounded-tl-none"}`}>
                        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                        {Boolean(msg.attachments?.length) && (
                          <div className={msg.text ? "mt-2 space-y-1.5" : "space-y-1.5"}>
                            {msg.attachments?.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={messageAttachmentHref(attachment)}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                                  msg.isMe
                                    ? "border-white/25 bg-white/10 text-primary-foreground hover:bg-white/20"
                                    : "border-border bg-background/70 text-foreground hover:bg-background"
                                }`}
                              >
                                <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                                <span className={`shrink-0 font-mono text-[10px] ${msg.isMe ? "text-white/70" : "text-muted-foreground"}`}>
                                  {formatFileSize(attachment.size)}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-2 px-1">{msg.time}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!messages.length && !isLoading && (
                <div className="py-12 text-center text-sm text-muted-foreground">{t("client.messages.noMessages")}</div>
              )}
              <div ref={messagesEnd} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-card/50">
            {attachment && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-xs">
                <Paperclip className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{formatFileSize(attachment.size)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-2 border border-transparent focus-within:border-primary/30 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => void handleAttachmentChange(event)}
                aria-hidden="true"
                tabIndex={-1}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                aria-label={t("client.messages.actions.attach")}
                onClick={() => fileInputRef.current?.click()}
                disabled={!active || isUploading || isSending}
              >
                <Paperclip className="h-5 w-5" aria-hidden="true" />
              </Button>
              <label htmlFor="msg-input" className="sr-only">{t("client.messages.inputPlaceholder")}</label>
              <Input
                id="msg-input"
                placeholder={t("client.messages.inputPlaceholder")}
                className="border-0 bg-transparent focus-visible:ring-0 px-0 h-9"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSendMessage(); }}
                disabled={!active || isSending || isUploading}
              />
              <Button size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => void handleSendMessage()} disabled={!active || isSending || isUploading || (!inputValue.trim() && !attachment)} aria-label={t("client.messages.actions.send")}>
                <Send className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            {isUploading && <p className="mt-2 text-xs text-muted-foreground">{t("client.messages.uploading")}</p>}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1000))} KB`;
}

function isConversationAccessError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("forbidden") ||
    normalized.includes("contact was not found") ||
    normalized.includes("conversation is not available") ||
    normalized.includes("not accessible");
}
