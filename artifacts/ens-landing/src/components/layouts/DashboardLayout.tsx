import { useEffect, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ENSLogo } from "@/components/ENSLogo";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
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
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ACCOUNT_SETTINGS_EVENT, getAccountSettings } from "@/lib/platform-api";

interface SidebarItem {
  icon: ElementType;
  label: string;
  href: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  role: "chief" | "pm" | "client";
}

const sidebarItems: Record<DashboardLayoutProps["role"], SidebarItem[]> = {
  chief: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/chief" },
    { icon: Users, label: "Clients", href: "/chief/clients" },
    { icon: Users, label: "Managers", href: "/chief/managers" },
    { icon: Briefcase, label: "Projects", href: "/chief/projects" },
    { icon: CalendarDays, label: "Calendar", href: "/chief/calendar" },
    { icon: Monitor, label: "Workspace Monitor", href: "/chief/workspace-monitor" },
    { icon: BarChart3, label: "Reports", href: "/chief/reports" },
    { icon: MessageSquare, label: "Messages", href: "/chief/messages" },
    { icon: Settings, label: "Settings", href: "/chief/settings" },
  ],
  pm: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/pm" },
    { icon: Users, label: "My Clients", href: "/pm/clients" },
    { icon: Briefcase, label: "Projects", href: "/pm/projects" },
    { icon: Layers, label: "Workspace", href: "/pm/workspace" },
    { icon: ClipboardList, label: "Requests", href: "/pm/requests" },
    { icon: MessageSquare, label: "Messages", href: "/pm/messages" },
    { icon: CheckCircle, label: "Tasks", href: "/pm/tasks" },
    { icon: BarChart3, label: "Reports", href: "/pm/reports" },
    { icon: Settings, label: "Settings", href: "/pm/settings" },
  ],
  client: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/client" },
    { icon: FolderOpen, label: "Projects", href: "/client/projects" },
    { icon: Layers, label: "Workspace", href: "/client/workspace" },
    { icon: MessageSquare, label: "Messages", href: "/client/messages" },
    { icon: CheckCircle, label: "Approvals", href: "/client/approvals" },
    { icon: FileText, label: "Documents", href: "/client/documents" },
    { icon: User, label: "Profile", href: "/client/profile" },
  ],
};

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState<{ name: string; email: string; avatarUrl: string } | null>(null);
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
            avatarUrl: settings.profile.avatarUrl,
          });
        })
        .catch(() => {
          if (!mounted) return;
          setProfile({ name: user.name, email: user.email, avatarUrl: "" });
        });
    }

    loadProfile();
    window.addEventListener(ACCOUNT_SETTINGS_EVENT, loadProfile);

    return () => {
      mounted = false;
      window.removeEventListener(ACCOUNT_SETTINGS_EVENT, loadProfile);
    };
  }, [user]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300",
          isCollapsed ? "w-[70px]" : "w-[260px]",
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <ENSLogo size="sm" iconOnly={isCollapsed} href="/" />
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const isActive = location.split("?")[0] === item.href;

              return (
                <li key={item.href}>
                  <Link href={item.href}>
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
                      <item.icon className="relative z-10 h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span className="relative z-10 font-medium">{item.label}</span>}
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
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-red-500 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          isCollapsed ? "pl-[70px]" : "pl-[260px]",
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
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-6">
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AC";
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
