import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ENSLogo } from "@/components/ENSLogo";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Briefcase, Monitor, FileText, MessageSquare,
  Settings, Search, Bell, User, ChevronLeft, ChevronRight, LogOut,
  Layers, CheckCircle, FolderOpen, ClipboardList, BarChart3,
  CheckCircle2, AlertCircle, Clock, ArrowRight, X, Layers2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

// ── Types ─────────────────────────────────────────────────────────
interface SidebarItem { icon: any; label: string; href: string; }
interface DashboardLayoutProps { children: React.ReactNode; role: "chief" | "pm" | "client"; }

type NotifType = 'approval' | 'message' | 'update' | 'request' | 'alert';
interface Notification {
  id: string; type: NotifType; title: string; body: string;
  time: string; read: boolean; href?: string;
}

// ── Sidebar config ─────────────────────────────────────────────────
const sidebarItems: Record<string, SidebarItem[]> = {
  chief: [
    { icon: LayoutDashboard, label: "Dashboard",         href: "/chief" },
    { icon: Users,           label: "Clients",           href: "/chief/clients" },
    { icon: Users,           label: "Managers",          href: "/chief/managers" },
    { icon: Briefcase,       label: "Projects",          href: "/chief/projects" },
    { icon: Monitor,         label: "Workspace Monitor", href: "/chief/workspace-monitor" },
    { icon: BarChart3,       label: "Reports",           href: "/chief/reports" },
    { icon: MessageSquare,   label: "Messages",          href: "/chief/messages" },
    { icon: Settings,        label: "Settings",          href: "/chief/settings" },
  ],
  pm: [
    { icon: LayoutDashboard, label: "Dashboard",  href: "/pm" },
    { icon: Users,           label: "My Clients", href: "/pm/clients" },
    { icon: Briefcase,       label: "Projects",   href: "/pm/projects" },
    { icon: Layers,          label: "Workspace",  href: "/pm/workspace" },
    { icon: ClipboardList,   label: "Requests",   href: "/pm/requests" },
    { icon: MessageSquare,   label: "Messages",   href: "/pm/messages" },
    { icon: CheckCircle,     label: "Tasks",      href: "/pm/tasks" },
    { icon: BarChart3,       label: "Reports",    href: "/pm/reports" },
  ],
  client: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/client" },
    { icon: FolderOpen,      label: "Projects",  href: "/client/projects" },
    { icon: Layers,          label: "Workspace", href: "/client/workspace" },
    { icon: MessageSquare,   label: "Messages",  href: "/client/messages" },
    { icon: CheckCircle,     label: "Approvals", href: "/client/approvals" },
    { icon: FileText,        label: "Documents", href: "/client/documents" },
    { icon: User,            label: "Profile",   href: "/client/profile" },
  ],
};

// ── Notification config ────────────────────────────────────────────
const NOTIF_ICON: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
  approval: { icon: CheckCircle2, color: '#2f7d3a', bg: 'rgba(47,125,58,0.1)' },
  message:  { icon: MessageSquare, color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)' },
  update:   { icon: Layers2, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  request:  { icon: ClipboardList, color: '#c2410c', bg: 'rgba(194,65,12,0.1)' },
  alert:    { icon: AlertCircle, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id:'n1', type:'approval', title:'Design Approved', body:'TechCorp approved v2.4 of TechCon 2024.', time:'2m ago', read:false, href:'/pm/projects' },
  { id:'n2', type:'request',  title:'Change Request',  body:'MediLife requested fascia height increase.', time:'18m ago', read:false, href:'/pm/requests' },
  { id:'n3', type:'message',  title:'New Message',     body:'FastCars Co: "Can we review the layout?"', time:'1h ago', read:false, href:'/pm/messages' },
  { id:'n4', type:'alert',    title:'Deadline Alert',  body:'AutoShow stand deadline is in 3 days.', time:'3h ago', read:true, href:'/pm/projects' },
  { id:'n5', type:'update',   title:'Design Updated',  body:'Sarah M. updated HealthExpo stand to v1.3.', time:'5h ago', read:true },
  { id:'n6', type:'approval', title:'Review Requested', body:'GreenTech sent design for client review.', time:'1d ago', read:true, href:'/pm/projects' },
];

// ── Search catalog ─────────────────────────────────────────────────
const SEARCH_CATALOG = [
  { cat:'Projects', items:[
    {label:'TechCon 2024 — Global Exhibit', sub:'TechCorp · Active', href:'/pm/workspace'},
    {label:'HealthExpo Booth',              sub:'MediLife · In Review', href:'/pm/projects'},
    {label:'AutoShow Premium Stand',        sub:'FastCars Co · Pending', href:'/pm/projects'},
    {label:'EcoFair Stand',                 sub:'GreenTech · Active', href:'/pm/projects'},
  ]},
  { cat:'Clients', items:[
    {label:'TechCorp Industries', sub:'3 active projects', href:'/pm/clients'},
    {label:'MediLife',            sub:'1 active project',  href:'/pm/clients'},
    {label:'FastCars Co',         sub:'2 active projects', href:'/pm/clients'},
  ]},
  { cat:'Components', items:[
    {label:'Solid Wall Panel',      sub:'SKU: OCT-SW-100', href:'/pm/workspace'},
    {label:'Reception Counter',     sub:'SKU: FUR-RC-04',  href:'/pm/workspace'},
    {label:'Spotlight',             sub:'SKU: LIT-SP-100', href:'/pm/workspace'},
    {label:'Meeting Table',         sub:'SKU: FUR-MT-01',  href:'/pm/workspace'},
  ]},
  { cat:'Pages', items:[
    {label:'Workspace',      sub:'Open design canvas',  href:'/pm/workspace'},
    {label:'Projects',       sub:'View all projects',   href:'/pm/projects'},
    {label:'Tasks Kanban',   sub:'Your task board',     href:'/pm/tasks'},
    {label:'Revision Requests', sub:'Pending actions',  href:'/pm/requests'},
  ]},
];

// ── Notification Bell ──────────────────────────────────────────────
function NotifBell({ role }: { role: string }) {
  const [notifs, setNotifs] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAll = () => setNotifs(prev => prev.map(n => ({...n, read:true})));
  const markOne = (id: string) => setNotifs(prev => prev.map(n => n.id===id?{...n,read:true}:n));
  const dismiss = (id: string) => setNotifs(prev => prev.filter(n => n.id!==id));

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="button-notifications-bell"
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:'7px', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-foreground)' }}>
        <Bell style={{ width:18, height:18 }}/>
        {unread > 0 && (
          <span style={{ position:'absolute', top:4, right:4, minWidth:16, height:16, borderRadius:8, background:'#dc2626', color:'#fff', fontSize:9, fontWeight:700, fontFamily:'"JetBrains Mono",monospace', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:360, background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 40px rgba(0,0,0,0.14)', zIndex:200, overflow:'hidden' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'var(--muted-foreground)', textTransform:'uppercase' }}>Notifications</span>
              {unread > 0 && <span style={{ background:'#dc2626', color:'#fff', fontSize:9, fontWeight:700, borderRadius:10, padding:'1px 6px', fontFamily:'"JetBrains Mono",monospace' }}>{unread} new</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAll} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--primary)', fontWeight:600, padding:0 }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Notif list */}
          <div style={{ maxHeight:340, overflowY:'auto' }}>
            {notifs.length === 0 && (
              <div style={{ textAlign:'center', padding:'28px 0', color:'var(--muted-foreground)', fontSize:12, fontFamily:'"JetBrains Mono",monospace' }}>
                All caught up!
              </div>
            )}
            {notifs.map(n => {
              const cfg = NOTIF_ICON[n.type];
              const Icon = cfg.icon;
              return (
                <div key={n.id}
                  onClick={() => markOne(n.id)}
                  style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)', background:n.read?'transparent':'var(--muted)/30', cursor:'pointer', transition:'background 0.1s', position:'relative' }}
                  onMouseEnter={e => (e.currentTarget.style.background='var(--muted)')}
                  onMouseLeave={e => (e.currentTarget.style.background=n.read?'transparent':'color-mix(in srgb, var(--muted) 50%, transparent)')}>
                  <div style={{ width:30, height:30, borderRadius:6, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                    <Icon style={{ width:14, height:14, color:cfg.color }}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:n.read?500:700, color:'var(--foreground)', lineHeight:1.2 }}>{n.title}</span>
                      {!n.read && <span style={{ width:6, height:6, borderRadius:'50%', background:'#1d4ed8', flexShrink:0 }}/>}
                    </div>
                    <p style={{ fontSize:11.5, color:'var(--muted-foreground)', lineHeight:1.4, margin:'2px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.body}</p>
                    <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:9, color:'var(--muted-foreground)' }}>{n.time}</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted-foreground)', padding:2, opacity:0.6, display:'flex', flexShrink:0 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity='1')} onMouseLeave={e => (e.currentTarget.style.opacity='0.6')}>
                    <X style={{ width:12, height:12 }}/>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'center' }}>
            <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:11.5, color:'var(--primary)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              View all notifications <ArrowRight style={{ width:12, height:12 }}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Global Search (Cmd+K) ──────────────────────────────────────────
function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if(e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if(open) { setTimeout(() => inputRef.current?.focus(), 50); }
    else      { setQuery(''); }
  }, [open]);

  const filtered = SEARCH_CATALOG.map(group => ({
    ...group,
    items: query
      ? group.items.filter(i => `${i.label} ${i.sub}`.toLowerCase().includes(query.toLowerCase()))
      : group.items.slice(0, 3),
  })).filter(g => g.items.length > 0);

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
        style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid var(--border)', borderRadius:6, padding:'6px 12px', background:'var(--muted)/40', cursor:'pointer', minWidth:180, color:'var(--muted-foreground)' }}>
        <Search style={{ width:13, height:13, flexShrink:0 }}/>
        <span style={{ fontSize:12, flex:1, textAlign:'left' }}>Search…</span>
        <span style={{ fontSize:10, fontFamily:'"JetBrains Mono",monospace', background:'var(--muted)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 5px', flexShrink:0 }}>⌘K</span>
      </button>

      {/* Modal */}
      {open && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300 }} onClick={() => setOpen(false)}/>
          <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)', width:'min(600px, 90vw)', background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', zIndex:301, overflow:'hidden' }}>
            {/* Search input */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
              <Search style={{ width:16, height:16, color:'var(--muted-foreground)', flexShrink:0 }}/>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search projects, clients, components, pages…"
                data-testid="input-global-search"
                style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'var(--foreground)', fontFamily:'Inter,system-ui,sans-serif' }}/>
              {query && (
                <button onClick={() => setQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted-foreground)', display:'flex' }}>
                  <X style={{ width:14, height:14 }}/>
                </button>
              )}
              <kbd style={{ fontSize:10, fontFamily:'"JetBrains Mono",monospace', background:'var(--muted)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 6px', flexShrink:0, color:'var(--muted-foreground)' }}>ESC</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight:420, overflowY:'auto', padding:'8px 0' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted-foreground)', fontSize:13 }}>
                  No results for "{query}"
                </div>
              )}
              {filtered.map(group => (
                <div key={group.cat}>
                  <div style={{ padding:'6px 16px 4px', fontFamily:'"JetBrains Mono",monospace', fontSize:9.5, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted-foreground)' }}>
                    {group.cat}
                  </div>
                  {group.items.map((item, idx) => (
                    <Link key={idx} href={item.href}>
                      <div
                        onClick={() => setOpen(false)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 16px', cursor:'pointer', transition:'background 0.08s' }}
                        onMouseEnter={e => (e.currentTarget.style.background='var(--muted)')}
                        onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                        <div>
                          <p style={{ fontSize:13, fontWeight:600, color:'var(--foreground)', lineHeight:1.2 }}>{item.label}</p>
                          <p style={{ fontSize:11, color:'var(--muted-foreground)', marginTop:1, fontFamily:'"JetBrains Mono",monospace' }}>{item.sub}</p>
                        </div>
                        <ArrowRight style={{ width:13, height:13, color:'var(--muted-foreground)', flexShrink:0 }}/>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div style={{ borderTop:'1px solid var(--border)', padding:'8px 16px', display:'flex', gap:16 }}>
              {[['↑↓','Navigate'],['↵','Select'],['Esc','Close']].map(([key,label]) => (
                <span key={key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--muted-foreground)', fontFamily:'"JetBrains Mono",monospace' }}>
                  <kbd style={{ background:'var(--muted)', border:'1px solid var(--border)', borderRadius:3, padding:'1px 5px', fontSize:10 }}>{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Main Layout ────────────────────────────────────────────────────
export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const items = sidebarItems[role];

  function handleLogout() { logout(); navigate('/login'); }

  const displayName  = user?.name  ?? (role==='chief'?'Chief Manager':role==='pm'?'Project Manager':'Client User');
  const displayEmail = user?.email ?? `${role}@ens-expo.com`;
  const initials     = displayName.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300", isCollapsed?"w-[70px]":"w-[260px]")}>
        <div className="flex h-16 items-center border-b px-4">
          <ENSLogo size="sm" iconOnly={isCollapsed} href="/" />
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {items.map(item => {
              const isActive = location === item.href;
              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <div className={cn("flex items-center gap-3 rounded-lg px-3 py-2 transition-colors cursor-pointer", isActive?"bg-primary text-primary-foreground shadow-lg shadow-primary/20":"text-muted-foreground hover:bg-muted hover:text-foreground")}>
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span className="font-medium">{item.label}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t p-3">
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="w-full justify-center">
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
          <button onClick={handleLogout} className="mt-2 w-full flex items-center gap-3 rounded-lg px-3 py-2 text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors">
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn("flex flex-1 flex-col transition-all duration-300", isCollapsed?"pl-[70px]":"pl-[260px]")}>
        {/* Top Navbar */}
        <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background/80 backdrop-blur-md px-6 gap-4">
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotifBell role={role} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" alt={displayName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{displayEmail}</p>
                    {user?.company && <p className="text-[10px] leading-none text-muted-foreground/60 capitalize">{user.company}</p>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500 cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
