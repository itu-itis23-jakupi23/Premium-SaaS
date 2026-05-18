import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, CheckCheck, X } from "lucide-react";

interface Message { id: number; text: string; time: string; isMe: boolean; read?: boolean; }
interface Contact { id: number; name: string; company: string; lastMsg: string; time: string; unread: number; online: boolean; }

const INITIAL_CONTACTS: Contact[] = [
  { id:1, name:'Sarah TechCorp',  company:'TechCorp Industries', lastMsg:'The layout looks great!',          time:'10:30 AM', unread:2, online:true  },
  { id:2, name:'David MediLife',  company:'MediLife',            lastMsg:'When can we see the 3D model?',    time:'Yesterday', unread:0, online:false },
  { id:3, name:'Elena FastCars',  company:'FastCars Co',         lastMsg:'Please update the lighting.',      time:'Aug 8',     unread:0, online:true  },
  { id:4, name:'Tom GreenTech',   company:'GreenTech Ltd',       lastMsg:'Love the eco-green carpet option.', time:'Aug 7',     unread:1, online:false },
  { id:5, name:'Lisa RetailBrand',company:'RetailBrand',         lastMsg:'Can we add more display shelves?', time:'Aug 5',     unread:0, online:true  },
];

const INITIAL_THREADS: Record<number, Message[]> = {
  1: [
    { id:1, text:'Hi, I just saw the latest version of the booth.',                          time:'10:25 AM', isMe:false },
    { id:2, text:'Great! Did the Octanorm structure work for you?',                           time:'10:27 AM', isMe:true,  read:true },
    { id:3, text:'Yes, it looks solid. The layout looks great! Can we check the lighting?',  time:'10:30 AM', isMe:false },
  ],
  2: [
    { id:1, text:'Hello! The initial design looks promising.',   time:'Yesterday 2:00 PM', isMe:false },
    { id:2, text:'Glad to hear it. Revisions are in progress.', time:'Yesterday 2:15 PM', isMe:true, read:true },
    { id:3, text:'When can we see the 3D model?',               time:'Yesterday 2:30 PM', isMe:false },
  ],
  3: [
    { id:1, text:'I reviewed the latest render — looks powerful!', time:'Aug 8 9:00 AM', isMe:false },
    { id:2, text:"Glad you like it. We've added the racing stripes.", time:'Aug 8 9:30 AM', isMe:true, read:true },
    { id:3, text:'Please update the lighting — we need more drama.',  time:'Aug 8 10:00 AM', isMe:false },
  ],
  4: [
    { id:1, text:'The eco-green carpet option looks perfect for us.', time:'Aug 7 3:00 PM', isMe:false },
    { id:2, text:"Great choice — it pairs well with the oak veneer walls.", time:'Aug 7 3:10 PM', isMe:true, read:true },
    { id:3, text:'Love the eco-green carpet option.',                     time:'Aug 7 3:15 PM', isMe:false },
  ],
  5: [
    { id:1, text:'Initial concept looks clean. Love the open-front design.', time:'Aug 5 11:00 AM', isMe:false },
    { id:2, text:'Thank you! We can extend the display shelving on the right.', time:'Aug 5 11:30 AM', isMe:true, read:true },
  ],
};

function formatTime(): string {
  return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}

function cn(...args: (string|boolean|undefined)[]) { return args.filter(Boolean).join(' '); }

export default function PMMessages() {
  const [contacts,    setContacts]   = useState<Contact[]>(INITIAL_CONTACTS);
  const [threads,     setThreads]    = useState<Record<number,Message[]>>(INITIAL_THREADS);
  const [activeId,    setActiveId]   = useState(1);
  const [inputText,   setInputText]  = useState('');
  const [search,      setSearch]     = useState('');
  const [toast,       setToast]      = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);

  const active   = contacts.find(c => c.id === activeId)!;
  const messages = threads[activeId] ?? [];

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages.length, activeId]);

  const selectContact = (id: number) => {
    setActiveId(id);
    setContacts(prev => prev.map(c => c.id === id ? {...c, unread:0} : c));
  };

  const sendMessage = () => {
    const text = inputText.trim();
    if(!text) return;
    const newMsg: Message = { id: Date.now(), text, time: formatTime(), isMe: true, read: false };
    setThreads(prev => ({ ...prev, [activeId]: [...(prev[activeId]??[]), newMsg] }));
    setContacts(prev => prev.map(c => c.id === activeId ? {...c, lastMsg: text, time: 'Just now'} : c));
    setInputText('');

    // Simulate reply after 1.5 s
    const replies = [
      "Thanks for the update! Looking forward to the next revision.",
      "Noted — I'll review this with the team and get back to you.",
      "Perfect. Can we schedule a call to discuss the details?",
      "Great work! The client should be happy with this.",
      "Got it. Please send me the latest BOM when you have it.",
    ];
    setTimeout(() => {
      const reply: Message = { id: Date.now()+1, text: replies[Math.floor(Math.random()*replies.length)], time: formatTime(), isMe: false };
      setThreads(prev => ({ ...prev, [activeId]: [...(prev[activeId]??[]), reply] }));
      setContacts(prev => prev.map(c => c.id === activeId ? {...c, lastMsg: reply.text.slice(0,40)+'…', time: 'Just now'} : c));
    }, 1500);
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0);

  return (
    <DashboardLayout role="pm">
      <div className="flex flex-col" style={{height:'calc(100vh - 140px)'}}>
        <PageHeader title="Messages" breadcrumbs={[{label:'Dashboard',href:'/pm'},{label:'Messages'}]}>
          {totalUnread > 0 && (
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
              {totalUnread} unread
            </span>
          )}
        </PageHeader>

        <div className="mt-4 flex flex-1 overflow-hidden rounded-xl border border-border bg-card/30">
          {/* Contact sidebar */}
          <div className="w-72 border-r border-border flex flex-col bg-card/50 flex-shrink-0">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="pl-8 pr-3 h-8 w-full text-xs border rounded-md bg-background/50 outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.map(contact => (
                <div key={contact.id} onClick={() => selectContact(contact.id)}
                  className={cn('p-3 flex gap-3 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border/40', activeId === contact.id ? 'bg-primary/10 border-l-2 border-l-primary' : '')}>
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-primary">{contact.name.slice(0,2).toUpperCase()}</span>
                    </div>
                    {contact.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold truncate">{contact.name}</h4>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap ml-1">{contact.time}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{contact.company}</p>
                    <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{contact.lastMsg}</p>
                  </div>
                  {contact.unread > 0 && (
                    <span className="bg-primary text-primary-foreground text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-bold flex-shrink-0 self-center">
                      {contact.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col bg-background/20 min-w-0">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-primary">{active.name.slice(0,2).toUpperCase()}</span>
                  </div>
                  {active.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background"/>}
                </div>
                <div>
                  <h4 className="text-sm font-bold leading-tight">{active.name}</h4>
                  <p className="text-[10px] font-mono text-muted-foreground">{active.company}</p>
                  <span className="text-[10px] flex items-center gap-1 mt-0.5" style={{color:active.online?'#2f7d3a':'#9ca3af'}}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{background:active.online?'#2f7d3a':'#9ca3af'}}/>
                    {active.online ? 'Active now' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {[Phone,Video,MoreVertical].map((Icon,i) => (
                  <button key={i} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Icon className="h-4 w-4"/>
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex flex-col', msg.isMe ? 'items-end' : 'items-start')}>
                  {!msg.isMe && (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mb-1">
                      <span className="text-[8px] font-bold text-primary">{active.name.slice(0,2).toUpperCase()}</span>
                    </div>
                  )}
                  <div className={cn('max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                    msg.isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border border-border rounded-tl-none')}>
                    {msg.text}
                  </div>
                  <div className={cn('flex items-center gap-1 text-[9.5px] font-mono text-muted-foreground mt-1', msg.isMe ? 'pr-1' : 'pl-1')}>
                    <span>{msg.time}</span>
                    {msg.isMe && <CheckCheck className="h-3 w-3" style={{color:msg.read?'#1d4ed8':'#9ca3af'}}/>}
                  </div>
                </div>
              ))}
              <div ref={messagesEnd}/>
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card/50 flex-shrink-0">
              <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border">
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4"/>
                </button>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type your message… (Enter to send)"
                  data-testid="input-message"
                  className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60"
                />
                {inputText && (
                  <button onClick={() => setInputText('')} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5"/>
                  </button>
                )}
                <button onClick={sendMessage} disabled={!inputText.trim()}
                  className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-sm"
                  data-testid="button-send-message">
                  <Send className="h-3.5 w-3.5"/>
                </button>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mt-1.5 text-center">
                Press Enter to send · AI-assisted replies simulated
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
