import { useState } from "react";
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
  Menu, 
  X, 
  Search, 
  Bell, 
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Layers,
  CheckCircle,
  FolderOpen,
  ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

interface SidebarItem {
  icon: any;
  label: string;
  href: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "chief" | "pm" | "client";
}

const sidebarItems: Record<string, SidebarItem[]> = {
  chief: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/chief" },
    { icon: Users, label: "Clients", href: "/chief/clients" },
    { icon: Users, label: "Managers", href: "/chief/managers" },
    { icon: Briefcase, label: "Projects", href: "/chief/projects" },
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

import { BarChart3 } from "lucide-react";

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const items = sidebarItems[role];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const displayName = user?.name ?? (role === 'chief' ? 'Chief Manager' : role === 'pm' ? 'Project Manager' : 'Client User');
  const displayEmail = user?.email ?? `${role}@ens-expo.com`;
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300",
          isCollapsed ? "w-[70px]" : "w-[260px]"
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <ENSLogo size="sm" iconOnly={isCollapsed} href="/" />
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const isActive = location === item.href;
              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full justify-center"
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
          <button onClick={handleLogout} className="mt-2 w-full flex items-center gap-3 rounded-lg px-3 py-2 text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors">
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          isCollapsed ? "pl-[70px]" : "pl-[260px]"
        )}
      >
        {/* Navbar */}
        <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background/80 backdrop-blur-md px-6">
          <div className="flex-1">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-full bg-muted/50 pl-9 border-transparent focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <MessageSquare className="h-5 w-5" />
            </Button>
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
                    {user?.company && (
                      <p className="text-[10px] leading-none text-muted-foreground/60 capitalize">{user.company}</p>
                    )}
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
