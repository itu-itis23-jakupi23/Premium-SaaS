import { useEffect, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  Monitor,
  FileText,
  MessageSquare,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Layers,
  CheckCircle,
  FolderOpen,
  ClipboardList,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  ACCOUNT_SETTINGS_EVENT,
  PM_REQUESTS_UPDATED_EVENT,
  getAccountSettings,
  getNotifications,
  getPmRequests,
  markAllNotificationsRead,
  markNotificationRead,
  type PlatformNotification,
} from "@/lib/platform-api";

interface SidebarItem {
  icon: ElementType;
  labelKey: string;
  href: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  role: "chief" | "pm" | "client";
}

const sidebarItems: Record<DashboardLayoutProps["role"], SidebarItem[]> = {
  chief: [
    { icon: LayoutDashboard, labelKey: "chief.nav.dashboard",  href: "/chief" },
    { icon: Users,           labelKey: "chief.nav.clients",    href: "/chief/clients" },
    { icon: UserSquare2,     labelKey: "chief.nav.managers",   href: "/chief/managers" },
    { icon: Briefcase,       labelKey: "chief.nav.projects",   href: "/chief/projects" },
    { icon: CalendarDays,    labelKey: "chief.nav.calendar",   href: "/chief/calendar" },
    { icon: Monitor,         labelKey: "chief.nav.monitor",    href: "/chief/workspace-monitor" },
    { icon: BarChart3,       labelKey: "chief.nav.reports",    href: "/chief/reports" },
    { icon: MessageSquare,   labelKey: "chief.nav.messages",   href: "/chief/messages" },
    { icon: Settings,        labelKey: "chief.nav.settings",   href: "/chief/settings" },
  ],
  pm: [
    { icon: LayoutDashboard, labelKey: "pm.nav.dashboard",  href: "/pm" },
    { icon: Users,           labelKey: "pm.nav.myClients",  href: "/pm/clients" },
    { icon: Briefcase,       labelKey: "pm.nav.projects",   href: "/pm/projects" },
    { icon: CalendarDays,    labelKey: "pm.nav.calendar",   href: "/pm/calendar" },
    { icon: Layers,          labelKey: "pm.nav.workspace",  href: "/pm/workspace" },
    { icon: ClipboardList,   labelKey: "pm.nav.requests",   href: "/pm/requests" },
    { icon: MessageSquare,   labelKey: "pm.nav.messages",   href: "/pm/messages" },
    { icon: CheckCircle,     labelKey: "pm.nav.tasks",      href: "/pm/tasks" },
    { icon: BarChart3,       labelKey: "pm.nav.reports",    href: "/pm/reports" },
    { icon: Settings,        labelKey: "pm.nav.settings",   href: "/pm/settings" },
  ],
  client: [
    { icon: LayoutDashboard, labelKey: "client.nav.dashboard",  href: "/client" },
    { icon: FolderOpen,      labelKey: "client.nav.projects",   href: "/client/projects" },
    { icon: Layers,          labelKey: "client.nav.workspace",  href: "/client/workspace" },
    { icon: MessageSquare,   labelKey: "client.nav.messages",   href: "/client/messages" },
    { icon: CheckCircle,     labelKey: "client.nav.approvals",  href: "/client/approvals" },
    { icon: FileText,        labelKey: "client.nav.documents",  href: "/client/documents" },
    { icon: User,            labelKey: "client.nav.profile",    href: "/client/profile" },
  ],
};

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [location, navigate] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState<{ name: string; email: string; avatarUrl: string } | null>(null);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const items = sidebarItems[role];
  const accountHref = role === "client" ? "/client/profile" : role === "pm" ? "/pm/settings" : "/chief/settings";

  useEffect(() => {
    let mounted = true;

    function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      getAccountSettings()
        .then((settings) => {
          if (!mounted) return;
          setProfile({
            name: settings.profile.name || user.name,
            email: settings.profile.email || user.email,
            avatarUrl: settings.profile.avatarUrl || user.avatarUrl || "",
          });
        })
        .catch(() => {
          if (!mounted) return;
          setProfile({ name: user.name, email: user.email, avatarUrl: user.avatarUrl || "" });
        });
    }

    loadProfile();
    window.addEventListener(ACCOUNT_SETTINGS_EVENT, loadProfile);

    return () => {
      mounted = false;
      window.removeEventListener(ACCOUNT_SETTINGS_EVENT, loadProfile);
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;

    function loadNotifications() {
      if (!user) {
        setNotifications([]);
        setUnreadNotifications(0);
        return;
      }

      getNotifications()
        .then((payload) => {
          if (!mounted) return;
          setNotifications(payload.notifications);
          setUnreadNotifications(payload.unread);
        })
        .catch(() => {
          if (!mounted) return;
          setNotifications([]);
          setUnreadNotifications(0);
        });
    }

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (role !== "pm") return;
    let mounted = true;

    function loadPendingRequests() {
      getPmRequests({ status: "Pending", limit: 99 })
        .then((payload) => {
          if (!mounted) return;
          setPendingRequestsCount(payload.summary.pending);
        })
        .catch(() => {/* silently ignore — badge is best-effort */});
    }

    loadPendingRequests();
    const timer = window.setInterval(loadPendingRequests, 60_000);
    window.addEventListener(PM_REQUESTS_UPDATED_EVENT, loadPendingRequests);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener(PM_REQUESTS_UPDATED_EVENT, loadPendingRequests);
    };
  }, [role]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function openNotification(notification: PlatformNotification) {
    if (!notification.read) {
      try {
        const payload = await markNotificationRead(notification.id);
        setNotifications(payload.notifications);
        setUnreadNotifications(payload.unread);
      } catch {
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true, readAt: new Date().toISOString() } : item));
        setUnreadNotifications((current) => Math.max(0, current - 1));
      }
    }
    if (notification.href) navigate(notification.href);
  }

  async function markAllRead() {
    try {
      const payload = await markAllNotificationsRead();
      setNotifications(payload.notifications);
      setUnreadNotifications(payload.unread);
    } catch {
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true, readAt: notification.readAt ?? new Date().toISOString() })));
      setUnreadNotifications(0);
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"}>
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
              const isPmRequests = role === "pm" && item.href === "/pm/requests";
              const badge = isPmRequests && pendingRequestsCount > 0 ? pendingRequestsCount : 0;

              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={isActive ? "page" : undefined}>
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
                        {badge > 0 && isCollapsed && (
                          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                            {badge > 9 ? "9+" : badge}
                          </span>
                        )}
                      </div>
                      {isCollapsed
                        ? <span className="sr-only">{t(item.labelKey)}{badge > 0 ? ` (${badge} pending)` : ""}</span>
                        : (
                          <span className="relative z-10 flex flex-1 items-center justify-between font-medium">
                            {t(item.labelKey)}
                            {badge > 0 && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {badge > 9 ? "9+" : badge}
                              </span>
                            )}
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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-end border-b bg-background/80 px-6 backdrop-blur-md">
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
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto max-w-7xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
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
