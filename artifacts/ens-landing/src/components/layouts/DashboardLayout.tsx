import { startTransition, useEffect, useState } from "react";
import type { ElementType, MouseEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { ENSLogo } from "@/components/ENSLogo";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserSquare2,
  Briefcase,
  FileText,
  MessageSquare,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Layers,
  FolderOpen,
  Bell,
  CalendarDays,
  CheckCheck,
  Search,
  Command,
  Sparkles,
  Plus,
  ArrowRight,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CurrencySwitcher } from "@/lib/currency";
import {
  ACCOUNT_SETTINGS_EVENT,
  getAccountSettings,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type PlatformNotification,
} from "@/lib/platform-api";
import { preloadPortalRoute } from "@/lib/route-preload";

interface SidebarItem {
  icon: ElementType;
  labelKey: string;
  href: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  role: "chief" | "pm" | "client";
}

type CachedProfile = { name: string; email: string; avatarUrl: string };

const cachedProfiles: Record<string, CachedProfile> = {};
const cachedNotificationsByUser: Record<string, PlatformNotification[]> = {};
const cachedUnreadNotificationsByUser: Record<string, number> = {};
const cachedProfileUpdatedAtByUser: Record<string, number> = {};
const cachedNotificationsUpdatedAtByUser: Record<string, number> = {};
const SHELL_CACHE_TTL_MS = 60_000;

const sidebarItems: Record<DashboardLayoutProps["role"], SidebarItem[]> = {
  chief: [
    { icon: LayoutDashboard, labelKey: "chief.nav.dashboard",  href: "/chief" },
    { icon: Users,           labelKey: "chief.nav.clients",    href: "/chief/clients" },
    { icon: UserSquare2,     labelKey: "chief.nav.managers",   href: "/chief/managers" },
    { icon: Briefcase,       labelKey: "chief.nav.projects",   href: "/chief/projects" },
    { icon: CalendarDays,    labelKey: "chief.nav.calendar",   href: "/chief/calendar" },
    { icon: MessageSquare,   labelKey: "chief.nav.messages",   href: "/chief/messages" },
    { icon: Settings,        labelKey: "chief.nav.settings",   href: "/chief/settings" },
  ],
  pm: [
    { icon: LayoutDashboard, labelKey: "pm.nav.dashboard",  href: "/pm" },
    { icon: Users,           labelKey: "pm.nav.myClients",  href: "/pm/clients" },
    { icon: Briefcase,       labelKey: "pm.nav.projects",   href: "/pm/projects" },
    { icon: CalendarDays,    labelKey: "pm.nav.calendar",   href: "/pm/calendar" },
    { icon: MessageSquare,   labelKey: "pm.nav.messages",   href: "/pm/messages" },
    { icon: Layers,          labelKey: "pm.nav.tasks",      href: "/pm/tasks" },
    { icon: Settings,        labelKey: "pm.nav.settings",   href: "/pm/settings" },
  ],
  client: [
    { icon: LayoutDashboard, labelKey: "client.nav.dashboard",  href: "/client" },
    { icon: FolderOpen,      labelKey: "client.nav.projects",   href: "/client/projects" },
    { icon: Layers,          labelKey: "client.nav.workspace",  href: "/client/workspace" },
    { icon: MessageSquare,   labelKey: "client.nav.messages",   href: "/client/messages" },
    { icon: FileText,        labelKey: "client.nav.documents",  href: "/client/documents" },
    { icon: User,            labelKey: "client.nav.profile",    href: "/client/profile" },
  ],
};

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [location, navigate] = useLocation();
  // Phones start with the icon rail; desktop starts expanded.
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const { logout, user } = useAuth();
  const cacheKey = user?.id || user?.email || "anonymous";
  const [profile, setProfile] = useState<CachedProfile | null>(() => cachedProfiles[cacheKey] ?? null);
  const [notifications, setNotifications] = useState<PlatformNotification[]>(() => cachedNotificationsByUser[cacheKey] ?? []);
  const [unreadNotifications, setUnreadNotifications] = useState(() => cachedUnreadNotificationsByUser[cacheKey] ?? 0);
  const items = sidebarItems[role];
  const accountHref = role === "client" ? "/client/profile" : role === "pm" ? "/pm/settings" : "/chief/settings";
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdPaletteOpen((open) => !open);
      }
    }
    function handleScroll() {
      setShowScrollTop(window.scrollY > 300);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    function loadProfile(force = false) {
      if (!user) {
        setProfile(null);
        return;
      }

      const cachedProfile = cachedProfiles[cacheKey];
      setProfile(cachedProfile ?? { name: user.name, email: user.email, avatarUrl: user.avatarUrl || "" });
      if (!force && cachedProfile && Date.now() - (cachedProfileUpdatedAtByUser[cacheKey] ?? 0) < SHELL_CACHE_TTL_MS) {
        return;
      }

      getAccountSettings()
        .then((settings) => {
          if (!mounted) return;
          const nextProfile = {
            name: settings.profile.name || user.name,
            email: settings.profile.email || user.email,
            avatarUrl: settings.profile.avatarUrl || user.avatarUrl || "",
          };
          setProfile(nextProfile);
          cachedProfiles[cacheKey] = nextProfile;
          cachedProfileUpdatedAtByUser[cacheKey] = Date.now();
        })
        .catch(() => {
          if (!mounted) return;
          const fallback = { name: user.name, email: user.email, avatarUrl: user.avatarUrl || "" };
          cachedProfiles[cacheKey] = fallback;
          cachedProfileUpdatedAtByUser[cacheKey] = Date.now();
          setProfile(fallback);
        });
    }

    loadProfile();
    const handleAccountSettingsUpdate = () => loadProfile(true);
    window.addEventListener(ACCOUNT_SETTINGS_EVENT, handleAccountSettingsUpdate);

    return () => {
      mounted = false;
      window.removeEventListener(ACCOUNT_SETTINGS_EVENT, handleAccountSettingsUpdate);
    };
  }, [cacheKey, user]);

  useEffect(() => {
    let mounted = true;

    function loadNotifications() {
      if (!user) {
        setNotifications([]);
        setUnreadNotifications(0);
        return;
      }

      setNotifications(cachedNotificationsByUser[cacheKey] ?? []);
      setUnreadNotifications(cachedUnreadNotificationsByUser[cacheKey] ?? 0);
      if (cachedNotificationsByUser[cacheKey] && Date.now() - (cachedNotificationsUpdatedAtByUser[cacheKey] ?? 0) < SHELL_CACHE_TTL_MS) {
        return;
      }

      getNotifications()
        .then((payload) => {
          if (!mounted) return;
          setNotifications(payload.notifications);
          setUnreadNotifications(payload.unread);
          cachedNotificationsByUser[cacheKey] = payload.notifications;
          cachedUnreadNotificationsByUser[cacheKey] = payload.unread;
          cachedNotificationsUpdatedAtByUser[cacheKey] = Date.now();
        })
        .catch(() => {
          if (!mounted) return;
          setNotifications([]);
          setUnreadNotifications(0);
          cachedNotificationsByUser[cacheKey] = [];
          cachedUnreadNotificationsByUser[cacheKey] = 0;
          cachedNotificationsUpdatedAtByUser[cacheKey] = Date.now();
        });
    }

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [cacheKey, user]);


  function handleLogout() {
    logout();
    navigate("/login");
  }

  function openSidebarRoute(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void preloadPortalRoute(href)?.catch(() => undefined);
    startTransition(() => navigate(href));
  }

  async function openNotification(notification: PlatformNotification) {
    if (!notification.read) {
      try {
        const payload = await markNotificationRead(notification.id);
        setNotifications(payload.notifications);
        setUnreadNotifications(payload.unread);
        cachedNotificationsByUser[cacheKey] = payload.notifications;
        cachedUnreadNotificationsByUser[cacheKey] = payload.unread;
      } catch {
        const readAt = new Date().toISOString();
        setNotifications((current) => {
          const next = current.map((item) => item.id === notification.id ? { ...item, read: true, readAt } : item);
          cachedNotificationsByUser[cacheKey] = next;
          return next;
        });
        setUnreadNotifications((current) => {
          const next = Math.max(0, current - 1);
          cachedUnreadNotificationsByUser[cacheKey] = next;
          return next;
        });
      }
    }
    if (notification.href) navigate(notification.href);
  }

  async function markAllRead() {
    try {
      const payload = await markAllNotificationsRead();
      setNotifications(payload.notifications);
      setUnreadNotifications(payload.unread);
      cachedNotificationsByUser[cacheKey] = payload.notifications;
      cachedUnreadNotificationsByUser[cacheKey] = payload.unread;
    } catch {
      const readAt = new Date().toISOString();
      setNotifications((current) => {
        const next = current.map((notification) => ({ ...notification, read: true, readAt: notification.readAt ?? readAt }));
        cachedNotificationsByUser[cacheKey] = next;
        return next;
      });
      setUnreadNotifications(0);
      cachedUnreadNotificationsByUser[cacheKey] = 0;
    }
  }

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-clip bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-[200] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t("layout.skipToContent")}
      </a>
      <aside
        aria-label={t("layout.navigation")}
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col border-bg-card transition-all duration-300",
          isRtl ? "right-0 border-l" : "left-0 border-r",
          isCollapsed ? "w-[70px]" : "w-[260px]",
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <ENSLogo size="sm" iconOnly={isCollapsed} href="/" />
        </div>

        <nav aria-label={t("layout.navigation")} className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const isActive = location.split("?")[0] === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onPointerEnter={() => { void preloadPortalRoute(item.href)?.catch(() => undefined); }}
                    onFocus={() => { void preloadPortalRoute(item.href)?.catch(() => undefined); }}
                    onClick={(event) => openSidebarRoute(event, item.href)}
                  >
                    <div
                      className={cn(
                        "relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                        isActive
                          ? "text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId={`active-nav-${role}`}
                          className="absolute inset-0 rounded-lg bg-primary"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <div className="relative z-10 flex-shrink-0">
                        <item.icon aria-hidden="true" className="h-5 w-5" />
                      </div>
                      {isCollapsed
                        ? <span className="sr-only">{t(item.labelKey)}</span>
                        : (
                          <span className="relative z-10 flex flex-1 items-center font-medium">
                            {t(item.labelKey)}
                          </span>
                        )
                      }
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full justify-center"
            aria-label={isCollapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed
              ? (isRtl ? <ChevronLeft aria-hidden="true" className="h-5 w-5" /> : <ChevronRight aria-hidden="true" className="h-5 w-5" />)
              : (isRtl ? <ChevronRight aria-hidden="true" className="h-5 w-5" /> : <ChevronLeft aria-hidden="true" className="h-5 w-5" />)
            }
          </Button>
          <button
            onClick={handleLogout}
            aria-label={t("layout.logout")}
            className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-red-500 transition-colors hover:bg-red-500/10"
          >
            <LogOut aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="font-medium">{t("layout.logout")}</span>}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          isCollapsed
            ? (isRtl ? "pr-[70px]" : "pl-[70px]")
            : (isRtl ? "pr-[260px]" : "pl-[260px]"),
        )}
      >
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          {/* Quick Search Command Bar Trigger */}
          <button
            type="button"
            onClick={() => setCmdPaletteOpen(true)}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline font-medium">Quick Search &amp; Actions...</span>
            <span className="sm:hidden font-medium">Search...</span>
            <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shadow-xs">
              <span className="text-[9px]">⌘</span>K
            </kbd>
          </button>

          <div className="flex items-center gap-3">
            {user && (
              <Link href={accountHref}>
                <div className="flex cursor-pointer items-center gap-2 rounded-full border bg-card/60 py-1 pl-1 pr-3 transition-colors hover:bg-muted">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatarUrl ?? ""} alt={profile?.name ?? user.name} />
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials(profile?.name ?? user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 text-left sm:block">
                    <p className="max-w-[160px] truncate text-xs font-medium">{profile?.name ?? user.name}</p>
                    <p className="max-w-[160px] truncate text-[11px] text-muted-foreground">{profile?.email ?? user.email}</p>
                  </div>
                </div>
              </Link>
            )}
            <NotificationCenter
              notifications={notifications}
              unread={unreadNotifications}
              onOpen={openNotification}
              onMarkAllRead={markAllRead}
            />
            <CurrencySwitcher />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" className="relative min-w-0 flex-1 overflow-x-auto p-4 sm:p-6 bg-background">
          {/* Architectural Blueprint Grid Background */}
          <div className="pointer-events-none absolute inset-0 bg-blueprint-grid opacity-70 dark:opacity-40" aria-hidden="true" />
          {/* Ambient Glow Gradient */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-96 w-full max-w-5xl bg-primary/5 blur-3xl rounded-full" aria-hidden="true" />

          <div className="relative z-10 mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* ── Global ⌘K Command Palette Dialog ── */}
      <Dialog open={cmdPaletteOpen} onOpenChange={setCmdPaletteOpen}>
        <DialogContent className="max-w-xl overflow-hidden p-0 gap-0 border-border bg-card/95 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center border-b px-4 py-3 bg-muted/30">
            <Search className="mr-3 h-4 w-4 shrink-0 text-primary" />
            <Input
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              placeholder="Search pages, projects, actions..."
              className="h-8 border-0 bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="ml-2 inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <ScrollArea className="max-h-[360px] p-2">
            <div className="space-y-1">
              <p className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Navigation &amp; Pages
              </p>
              {items
                .filter((item) => !cmdQuery || t(item.labelKey).toLowerCase().includes(cmdQuery.toLowerCase()))
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        setCmdPaletteOpen(false);
                        setCmdQuery("");
                        void preloadPortalRoute(item.href)?.catch(() => undefined);
                        navigate(item.href);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors hover:bg-primary/10 hover:text-primary group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-medium">{t(item.labelKey)}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}

              <p className="mt-3 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Quick Actions
              </p>
              {[
                { label: "New Exhibition", icon: Plus, href: "/chief/projects" },
                { label: "Invite Project Manager", icon: UserSquare2, href: "/chief/managers" },
                { label: "Messages & Direct Chat", icon: MessageSquare, href: `/${role}/messages` },
                { label: "Calendar & Schedule", icon: CalendarDays, href: `/${role}/calendar` },
              ]
                .filter((act) => !cmdQuery || act.label.toLowerCase().includes(cmdQuery.toLowerCase()))
                .map((act, i) => {
                  const ActIcon = act.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCmdPaletteOpen(false);
                        setCmdQuery("");
                        navigate(act.href);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted/80 group"
                    >
                      <div className="flex items-center gap-3">
                        <ActIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{act.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">Jump →</span>
                    </button>
                  );
                })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Scroll To Top Floating Button ── */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur-md transition-all hover:border-primary/50 hover:bg-primary hover:text-primary-foreground hover:scale-110 active:scale-95"
          title="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function NotificationCenter({
  notifications,
  unread,
  onOpen,
  onMarkAllRead,
}: {
  notifications: PlatformNotification[];
  unread: number;
  onOpen: (notification: PlatformNotification) => void;
  onMarkAllRead: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full" aria-label={t("layout.notifications")}>
          <Bell aria-hidden="true" className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <p className="text-sm font-semibold">{t("layout.notifications")}</p>
            <p className="text-xs text-muted-foreground">{t("layout.unread", { count: unread })}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onMarkAllRead} disabled={!unread}>
            <CheckCheck aria-hidden="true" className="mr-2 h-4 w-4" /> {t("layout.markAllRead")}
          </Button>
        </div>
        <ScrollArea className="max-h-[360px]">
          <div className="space-y-1 p-2">
            {notifications.length ? notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={cn(
                  "w-full rounded-md border p-3 text-left transition-colors hover:bg-muted",
                  !notification.read && "border-primary/30 bg-primary/5",
                )}
                onClick={() => onOpen(notification)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{notification.title}</p>
                  {!notification.read && <Badge variant="secondary" className="text-[10px]">{t("layout.notificationNew")}</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{notification.time}</p>
              </button>
            )) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t("layout.noNotifications")}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AC";
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
