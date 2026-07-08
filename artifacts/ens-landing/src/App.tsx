import { lazy, Suspense, useEffect, type ComponentType, type ReactElement } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY, ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, getRoleDashboard, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getPortalLoginPath, isRoleAllowedInPortal, PORTAL_MODE } from "@/lib/portal";
import { StaffGateway } from "@/components/StaffGateway";
import { RuntimeTextTranslator } from "@/i18n/RuntimeTextTranslator";
import { LoadingScreen } from "@/components/LoadingScreen";

const queryClient = new QueryClient();

function RedirectTo({ href }: { href: string }): ReactElement | null {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(href, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const lazyPage = (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>) =>
  lazy(loader) as unknown as ComponentType<Record<string, unknown>>;

const NotFound = lazyPage(() => import("@/pages/not-found"));
const Home = lazyPage(() => import("@/pages/Home"));
const TeamLanding = lazyPage(() => import("@/pages/TeamLanding"));
const Login = lazyPage(() => import("@/pages/auth/Login"));
const Signup = lazyPage(() => import("@/pages/auth/Signup"));
const ForgotPassword = lazyPage(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazyPage(() => import("@/pages/auth/ResetPassword"));

const INCLUDE_STAFF_ROUTES = import.meta.env.VITE_PORTAL !== "client";
const INCLUDE_CLIENT_ROUTES = import.meta.env.VITE_PORTAL !== "staff";
const ROUTER_BASE = import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
  ? import.meta.env.BASE_URL.replace(/\/$/, "")
  : undefined;

function PortalRoot() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user && isRoleAllowedInPortal(user.role)) {
      navigate(getRoleDashboard(user.role), { replace: true });
      return;
    }
    if (isAuthenticated && user && !isRoleAllowedInPortal(user.role)) {
      void logout().finally(() => navigate(getPortalLoginPath(), { replace: true }));
      return;
    }
    navigate(getPortalLoginPath(), { replace: true });
  }, [isAuthenticated, isLoading, logout, navigate, user]);

  return null;
}

function AuthModalRoute({ component: Component }: { component: React.ComponentType }) {
  const [, navigate] = useLocation();
  const Background = PORTAL_MODE === "staff" ? TeamLanding : Home;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 blur-md pointer-events-none select-none opacity-70 scale-[1.02]">
        <Background />
      </div>
      <div className="absolute inset-0 bg-background/55 backdrop-blur-sm" />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <button
          type="button"
          aria-label="Close auth modal"
          onClick={() => navigate("/", { replace: true })}
          className="absolute right-5 top-5 z-20 h-10 w-10 rounded-full border border-border/70 bg-background/75 backdrop-blur-xl text-xl leading-none text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
        >
          x
        </button>
        <div className="w-full animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-200">
          <Component />
        </div>
      </div>
    </div>
  );
}

const EmptyRoutes = () => null;

function createStaffRoutes() {
  const ChiefDashboard = lazyPage(() => import("@/pages/chief/ChiefDashboard"));
  const ChiefClients = lazyPage(() => import("@/pages/chief/ChiefClients"));
  const ChiefManagers = lazyPage(() => import("@/pages/chief/ChiefManagers"));
  const ChiefProjects = lazyPage(() => import("@/pages/chief/ChiefProjects"));
  const ChiefWorkspaceMonitor = lazyPage(() => import("@/pages/chief/ChiefWorkspaceMonitor"));
  const ChiefReports = lazyPage(() => import("@/pages/chief/ChiefReports"));
  const ChiefMessages = lazyPage(() => import("@/pages/chief/ChiefMessages"));
  const ChiefSettings = lazyPage(() => import("@/pages/chief/ChiefSettings"));
  const ChiefCalendar = lazyPage(() => import("@/pages/chief/ChiefCalendar"));

  const PMDashboard = lazyPage(() => import("@/pages/pm/PMDashboard"));
  const PMCalendar = lazyPage(() => import("@/pages/pm/PMCalendar"));
  const PMClients = lazyPage(() => import("@/pages/pm/PMClients"));
  const PMProjects = lazyPage(() => import("@/pages/pm/PMProjects"));
  const PMWorkspace = lazyPage(() => import("@/pages/pm/PMWorkspace"));
  const PMRequests = lazyPage(() => import("@/pages/pm/PMRequests"));
  const PMMessages = lazyPage(() => import("@/pages/pm/PMMessages"));
  const PMTasks = lazyPage(() => import("@/pages/pm/PMTasks"));
  const PMReports = lazyPage(() => import("@/pages/pm/PMReports"));
  const PMSettings = lazyPage(() => import("@/pages/pm/PMSettings"));

  return function StaffRoutes() {
    return (
      <>
      <ErrorBoundary label="Chief Dashboard">
        <Route path="/chief">
          {(params) => <ProtectedRoute component={ChiefDashboard} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Chief Clients">
        <Route path="/chief/clients">
          {(params) => <ProtectedRoute component={ChiefClients} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Chief Managers">
        <Route path="/chief/managers">
          {(params) => <ProtectedRoute component={ChiefManagers} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Chief Projects">
        <Route path="/chief/projects">
          {(params) => <ProtectedRoute component={ChiefProjects} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <Route path="/chief/workspace-monitor">
        {() => <RedirectTo href="/chief/projects" />}
      </Route>
      <ErrorBoundary label="Chief Booth Workspace">
        <Route path="/chief/workspace">
          {(params) => <ProtectedRoute component={PMWorkspace} allowedRoles={["chief", "pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Chief Reports">
        <Route path="/chief/reports">
          {(params) => <ProtectedRoute component={ChiefReports} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Chief Messages">
        <Route path="/chief/messages">
          {(params) => <ProtectedRoute component={ChiefMessages} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Chief Settings">
        <Route path="/chief/settings">
          {(params) => <ProtectedRoute component={ChiefSettings} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Chief Calendar">
        <Route path="/chief/calendar">
          {(params) => <ProtectedRoute component={ChiefCalendar} allowedRoles={["chief"]} params={params} />}
        </Route>
      </ErrorBoundary>

      <ErrorBoundary label="PM Dashboard">
        <Route path="/pm">
          {(params) => <ProtectedRoute component={PMDashboard} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Calendar">
        <Route path="/pm/calendar">
          {(params) => <ProtectedRoute component={PMCalendar} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Clients">
        <Route path="/pm/clients">
          {(params) => <ProtectedRoute component={PMClients} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Projects">
        <Route path="/pm/projects">
          {(params) => <ProtectedRoute component={PMProjects} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Workspace">
        <Route path="/pm/workspace">
          {(params) => <ProtectedRoute component={PMWorkspace} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Requests">
        <Route path="/pm/requests">
          {(params) => <ProtectedRoute component={PMRequests} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Messages">
        <Route path="/pm/messages">
          {(params) => <ProtectedRoute component={PMMessages} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Tasks">
        <Route path="/pm/tasks">
          {(params) => <ProtectedRoute component={PMTasks} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Reports">
        <Route path="/pm/reports">
          {(params) => <ProtectedRoute component={PMReports} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="PM Settings">
        <Route path="/pm/settings">
          {(params) => <ProtectedRoute component={PMSettings} allowedRoles={["pm"]} params={params} />}
        </Route>
      </ErrorBoundary>
      </>
    );
  };
}

function createStaffPublicRoutes() {
  const PMJoin = lazyPage(() => import("@/pages/pm/PMJoin"));

  return function StaffPublicRoutes() {
    return <Route path="/pm/join">{() => <PMJoin />}</Route>;
  };
}

function createClientRoutes() {
  const ClientDashboard = lazyPage(() => import("@/pages/client/ClientDashboard"));
  const ClientProjects = lazyPage(() => import("@/pages/client/ClientProjects"));
  const ClientWorkspace = lazyPage(() => import("@/pages/client/ClientWorkspace"));
  const ClientMessages = lazyPage(() => import("@/pages/client/ClientMessages"));
  const ClientApprovals = lazyPage(() => import("@/pages/client/ClientApprovals"));
  const ClientDocuments = lazyPage(() => import("@/pages/client/ClientDocuments"));
  const ClientProfile = lazyPage(() => import("@/pages/client/ClientProfile"));

  return function ClientRoutes() {
    return (
      <>
      <ErrorBoundary label="Client Dashboard">
        <Route path="/client">
          {(params) => <ProtectedRoute component={ClientDashboard} allowedRoles={["client"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Client Projects">
        <Route path="/client/projects">
          {(params) => <ProtectedRoute component={ClientProjects} allowedRoles={["client"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Client Workspace">
        <Route path="/client/workspace">
          {(params) => <ProtectedRoute component={ClientWorkspace} allowedRoles={["client"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Client Messages">
        <Route path="/client/messages">
          {(params) => <ProtectedRoute component={ClientMessages} allowedRoles={["client"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Client Approvals">
        <Route path="/client/approvals">
          {(params) => <ProtectedRoute component={ClientApprovals} allowedRoles={["client"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Client Documents">
        <Route path="/client/documents">
          {(params) => <ProtectedRoute component={ClientDocuments} allowedRoles={["client"]} params={params} />}
        </Route>
      </ErrorBoundary>
      <ErrorBoundary label="Client Profile">
        <Route path="/client/profile">
          {(params) => <ProtectedRoute component={ClientProfile} allowedRoles={["client"]} params={params} />}
        </Route>
      </ErrorBoundary>
      </>
    );
  };
}

const StaffRoutes = INCLUDE_STAFF_ROUTES ? createStaffRoutes() : EmptyRoutes;
const StaffPublicRoutes = INCLUDE_STAFF_ROUTES ? createStaffPublicRoutes() : EmptyRoutes;
const ClientRoutes = INCLUDE_CLIENT_ROUTES ? createClientRoutes() : EmptyRoutes;

function Router() {
  const showMarketing = PORTAL_MODE === "all";
  const showStaff = PORTAL_MODE === "all" || PORTAL_MODE === "staff";
  const showClient = PORTAL_MODE === "all" || PORTAL_MODE === "client";
  const [location] = useLocation();
  const pathname = typeof window === "undefined" ? location.split(/[?#]/)[0] : window.location.pathname;
  const AuthComponent =
    pathname === "/login" ? Login :
    pathname === "/signup" ? Signup :
    pathname === "/forgot-password" ? ForgotPassword :
    pathname === "/reset-password" ? ResetPassword :
    null;

  if (AuthComponent) {
    return (
      <Suspense fallback={<LoadingScreen label="Loading page" />}>
        <StaffGateway>
          <AuthModalRoute component={AuthComponent} />
        </StaffGateway>
      </Suspense>
    );
  }

  if (showStaff && (pathname === "/pm" || pathname.startsWith("/pm/") || pathname === "/chief" || pathname.startsWith("/chief/"))) {
    return (
      <Suspense fallback={<LoadingScreen label="Loading page" />}>
        <StaffGateway>
          <StaffRoutes />
        </StaffGateway>
      </Suspense>
    );
  }

  if (showClient && (pathname === "/client" || pathname.startsWith("/client/"))) {
    return (
      <Suspense fallback={<LoadingScreen label="Loading page" />}>
        <ClientRoutes />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen label="Loading page" />}>
    <Switch>
      {showMarketing && <Route path="/">{() => <Home />}</Route>}
      {PORTAL_MODE === "staff" && <Route path="/">{() => <TeamLanding />}</Route>}
      {PORTAL_MODE === "client" && <Route path="/">{() => <Home />}</Route>}
      {showStaff && <Route path="/team">{() => <TeamLanding />}</Route>}

      {/* PM invitation join — accessible without authentication */}
      {showStaff && <StaffPublicRoutes />}

      <Route>{() => <NotFound />}</Route>
    </Switch>
    </Suspense>
  );
}

function App() {
  const router = (
    <>
      <Router />
      <RuntimeTextTranslator />
      <Toaster />
    </>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey={THEME_STORAGE_KEY} enableSystem disableTransitionOnChange>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {ROUTER_BASE ? <WouterRouter base={ROUTER_BASE}>{router}</WouterRouter> : <WouterRouter>{router}</WouterRouter>}
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
