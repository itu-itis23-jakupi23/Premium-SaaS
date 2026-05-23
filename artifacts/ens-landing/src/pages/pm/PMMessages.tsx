import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, CheckCheck, X } from "lucide-react";
import {
  getConversationMessages,
  getMessageContacts,
  sendConversationMessage,
  type DirectMessage,
  type MessageContact,
} from "@/lib/platform-api";

function cn(...args: (string | boolean | undefined)[]) { return args.filter(Boolean).join(" "); }

export default function PMMessages() {
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const active = contacts.find((contact) => contact.id === activeId) ?? contacts[0] ?? null;
  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((contact) => contact.name.toLowerCase().includes(q) || contact.email.toLowerCase().includes(q));
  }, [contacts, search]);
  const totalUnread = contacts.reduce((sum, contact) => sum + contact.unread, 0);

  useEffect(() => {
    let mounted = true;
    loadContacts()
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "Could not load chief contacts.");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    async function loadContacts() {
      const response = await getMessageContacts();
      if (!mounted) return;
      setContacts(response.contacts);
      setActiveId((current) => current && response.contacts.some((contact) => contact.id === current) ? current : response.contacts[0]?.id ?? null);
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    loadMessages();
    const interval = window.setInterval(loadMessages, 5000);

    async function loadMessages() {
      try {
        const response = await getConversationMessages(active.id);
        if (!mounted) return;
        setMessages(response.messages);
        setContacts((current) => current.map((contact) => contact.id === active.id ? { ...contact, unread: 0 } : contact));
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Could not load conversation.");
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

  const selectContact = (id: string) => {
    setActiveId(id);
    setContacts((prev) => prev.map((contact) => contact.id === id ? { ...contact, unread: 0 } : contact));
  };

  async function sendMessage() {
    if (!active || isSending) return;
    const text = inputText.trim();
    if (!text) return;

    setIsSending(true);
    setError("");
    try {
      const response = await sendConversationMessage(active.id, text);
      setMessages((current) => [...current, response.message]);
      setContacts((current) => current.map((contact) => contact.id === active.id ? {
        ...contact,
        lastMessage: text,
        lastMessageAt: response.message.createdAt,
        time: "Just now",
      } : contact));
      setInputText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <DashboardLayout role="pm">
      <div className="flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
        <PageHeader title="Messages" breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "Messages" }]}>
          {totalUnread > 0 && (
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
              {totalUnread} unread
            </span>
          )}
        </PageHeader>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-1 overflow-hidden rounded-xl border border-border bg-card/30">
          <div className="w-72 border-r border-border flex flex-col bg-card/50 flex-shrink-0">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chief..."
                  className="pl-8 pr-3 h-8 w-full text-xs border rounded-md bg-background/50 outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.map((contact) => (
                <button key={contact.id} onClick={() => selectContact(contact.id)}
                  className={cn("w-full p-3 flex gap-3 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border/40 text-left", active?.id === contact.id ? "bg-primary/10 border-l-2 border-l-primary" : "")}>
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
              {!filteredContacts.length && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {isLoading ? "Loading chief contacts..." : "No chief contacts found."}
                </div>
              )}
            </div>
          </div>

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
                        Chief portal
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => showToast(`Call started with ${active.name}`)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Phone className="h-4 w-4" />
                    </button>
                    <button onClick={() => showToast(`Video room prepared for ${active.name}`)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Video className="h-4 w-4" />
                    </button>
                    <button onClick={() => showToast("Conversation options opened")} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
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
                        <div className={cn("max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          msg.isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none")}>
                          {msg.text}
                        </div>
                        <div className={cn("flex items-center gap-1 text-[9.5px] font-mono text-muted-foreground mt-1", msg.isMe ? "pr-1" : "pl-1")}>
                          <span>{msg.time}</span>
                          {msg.isMe && <CheckCheck className="h-3 w-3" style={{ color: msg.read ? "#1d4ed8" : "#9ca3af" }} />}
                        </div>
                      </div>
                    ))}
                    {!messages.length && (
                      <div className="py-12 text-center text-sm text-muted-foreground">
                        No messages yet. Send a message to Chief.
                      </div>
                    )}
                    <div ref={messagesEnd} />
                  </div>
                </ScrollArea>

                <div className="p-3 border-t border-border bg-card/50 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border">
                    <button onClick={() => showToast("Attachment picker opened")} className="p-1 text-muted-foreground hover:text-foreground">
                      <Paperclip className="h-4 w-4" />
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
                      placeholder="Type your message... (Enter to send)"
                      data-testid="input-message"
                      className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60"
                    />
                    {inputText && (
                      <button onClick={() => setInputText("")} className="p-1 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={sendMessage} disabled={!inputText.trim() || isSending}
                      className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-sm"
                      data-testid="button-send-message">
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground mt-1.5 text-center">
                    Press Enter to send
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a Chief contact to start messaging.
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
