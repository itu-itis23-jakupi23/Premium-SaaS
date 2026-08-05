type StaffRole = "chief" | "pm";

const staffRouteLoaders: Record<string, () => Promise<unknown>> = import.meta.env.VITE_PORTAL === "client" ? {} : {
  "/chief": () => import("@/pages/chief/ChiefDashboard"),
  "/chief/clients": () => import("@/pages/chief/ChiefClients"),
  "/chief/managers": () => import("@/pages/chief/ChiefManagers"),
  "/chief/projects": () => import("@/pages/chief/ChiefProjects"),
  "/chief/calendar": () => import("@/pages/chief/ChiefCalendar"),
  "/chief/reports": () => import("@/pages/chief/ChiefReports"),
  "/chief/workspace": () => import("@/pages/pm/PMWorkspace"),
  "/chief/workspace-monitor": () => import("@/pages/pm/PMWorkspace"),
  "/chief/messages": () => import("@/pages/chief/ChiefMessages"),
  "/chief/settings": () => import("@/pages/chief/ChiefSettings"),
  "/pm": () => import("@/pages/pm/PMDashboard"),
  "/pm/clients": () => import("@/pages/pm/PMClients"),
  "/pm/projects": () => import("@/pages/pm/PMProjects"),
  "/pm/calendar": () => import("@/pages/pm/PMCalendar"),
  "/pm/workspace": () => import("@/pages/pm/PMWorkspace"),
  "/pm/requests": () => import("@/pages/pm/PMRequests"),
  "/pm/reports": () => import("@/pages/pm/PMReports"),
  "/pm/messages": () => import("@/pages/pm/PMMessages"),
  "/pm/tasks": () => import("@/pages/pm/PMTasks"),
  "/pm/settings": () => import("@/pages/pm/PMSettings"),
};

const clientRouteLoaders: Record<string, () => Promise<unknown>> = import.meta.env.VITE_PORTAL === "staff" ? {} : {
  "/client": () => import("@/pages/client/ClientDashboard"),
  "/client/projects": () => import("@/pages/client/ClientProjects"),
  "/client/workspace": () => import("@/pages/client/ClientWorkspace"),
  "/client/messages": () => import("@/pages/client/ClientMessages"),
  "/client/documents": () => import("@/pages/client/ClientDocuments"),
  "/client/profile": () => import("@/pages/client/ClientProfile"),
};

const routeLoaders: Record<string, () => Promise<unknown>> = {
  ...staffRouteLoaders,
  ...clientRouteLoaders,
};

const preloadPromises = new Map<string, Promise<unknown>>();

export function preloadPortalRoute(href: string): Promise<unknown> | undefined {
  const path = href.split(/[?#]/)[0];
  const loader = routeLoaders[path];
  if (!loader) return undefined;

  const existing = preloadPromises.get(path);
  if (existing) return existing;

  const promise = loader().catch((error: unknown) => {
    preloadPromises.delete(path);
    throw error;
  });
  preloadPromises.set(path, promise);
  return promise;
}

export function scheduleStaffRoutePreloads(role: StaffRole): () => void {
  const paths = role === "chief"
    ? ["/chief/clients", "/chief/managers", "/chief/projects", "/chief/calendar", "/chief/messages", "/chief/settings"]
    : ["/pm/clients", "/pm/projects", "/pm/calendar", "/pm/messages", "/pm/tasks", "/pm/settings"];
  const timers = paths.map((path, index) => window.setTimeout(() => {
    void preloadPortalRoute(path)?.catch(() => undefined);
  }, 500 + (index * 180)));

  return () => timers.forEach((timer) => window.clearTimeout(timer));
}
