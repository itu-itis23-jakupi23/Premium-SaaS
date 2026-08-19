import { lazy, Suspense, useEffect, type ComponentType, type ReactElement } from "react";
import { X } from "lucide-react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY, ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/lib/currency";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getRequestPortal, PORTAL_MODE } from "@/lib/portal";
import { StaffGateway } from "@/components/StaffGateway";
import { RuntimeTextTranslator } from "@/i18n/RuntimeTextTranslator";
import { LoadingScreen } from "@/components/LoadingScreen";
import { scheduleStaffRoutePreloads } from "@/lib/route-preload";
import { LEGAL_SLUGS } from "@/pages/legal/slugs";
import { DesktopOnlyGuard } from "@/components/workspace/DesktopOnlyGuard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

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
const LegalPage = lazyPage(() => import("@/pages/legal/LegalPage"));
const GetQuote = lazyPage(() => import("@/pages/GetQuote"));

const INCLUDE_STAFF_ROUTES = import.meta.env.VITE_PORTAL !== "client";
const INCLUDE_CLIENT_ROUTES = import.meta.env.VITE_PORTAL !== "staff";
const ROUTER_BASE = import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
  ? import.meta.env.BASE_URL.replace(/\/$/, "")
  : undefined;

function AuthModalRoute({ component: Component }: { component: React.ComponentType }) {
  const [, navigate] = useLocation();

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/*
        Decorative backdrop only.

        This previously rendered the entire <Home /> (or <TeamLanding />)
        marketing page, blurred, behind the form. That put the whole marketing
        page into the accessibility tree ahead of the login fields — a screen
        reader met the marketing hero before "Welcome back" — and paid a full
        marketing render, animations and cursor field included, on every auth
        route. /login carried more body text than the home page it imitated.

        The grid and glows match the ambient treatment already used by
        GetQuote and not-found, so the screen still reads as part of the app.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        <div className="absolute inset-0 bg-blueprint-grid opacity-60 dark:opacity-30" />
        <div className="absolute left-1/2 top-0 h-96 w-full max-w-4xl -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-blue-500/10 blur-[100px]" />
      </div>
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <button
          type="button"
          aria-label="Close and return to the home page"
          onClick={() => navigate("/", { replace: true })}
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/75 backdrop-blur-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <X aria-hidden="true" className="h-4 w-4" />
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
  const ChiefReports = lazyPage(() => import("@/pages/chief/ChiefReports"));
  const ChiefMessages = lazyPage(() => import("@/pages/chief/ChiefMessages"));
  const ChiefSettings = lazyPage(() => import("@/pages/chief/ChiefSettings"));
  const ChiefCalendar = lazyPage(() => import("@/pages/chief/ChiefCalendar"));
  const ChiefPipeline = lazyPage(() => import("@/pages/chief/ChiefPipeline"));
  const StaffQuotes = lazyPage(() => import("@/pages/staff/Quotes"));
  const ChiefQuotes = () => <StaffQuotes role="chief" />;
  const PMQuotes = () => <StaffQuotes role="pm" />;
  const StaffInvoices = lazyPage(() => import("@/pages/staff/Invoices"));
  const ChiefInvoices = () => <StaffInvoices role="chief" />;
  const PMInvoices = () => <StaffInvoices role="pm" />;

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
  function StaffRoutePreloader() {
    const { user } = useAuth();

    useEffect(() => {
      if (user?.role !== "chief" && user?.role !== "pm") return;
      return scheduleStaffRoutePreloads(user.role);
    }, [user?.role]);

    return null;
  }

  return function StaffRoutes() {
    return (
      <>
      <StaffRoutePreloader />
      {/*
        Every child of this <Switch> must be a <Route> carrying its own `path`.
        wouter parses a missing path as "*", so any wrapper element placed
        directly in a Switch matches every location and shadows the routes
        after it. Error boundaries therefore live inside each route's render
        function rather than around it — which also scopes a boundary to the
        route that actually matched instead of mounting it for every location.
      */}
      <Switch>
        <Route path="/chief">
          {(params) => (
            <ErrorBoundary label="Chief Dashboard">
              <ProtectedRoute component={ChiefDashboard} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/clients">
          {(params) => (
            <ErrorBoundary label="Chief Clients">
              <ProtectedRoute component={ChiefClients} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/managers">
          {(params) => (
            <ErrorBoundary label="Chief Managers">
              <ProtectedRoute component={ChiefManagers} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/projects">
          {(params) => (
            <ErrorBoundary label="Chief Projects">
              <ProtectedRoute component={ChiefProjects} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/pipeline">
          {() => (
            <ErrorBoundary label="Chief Pipeline">
              <ProtectedRoute component={ChiefPipeline} allowedRoles={["chief"]} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/quotes">
          {() => (
            <ErrorBoundary label="Chief Quotes">
              <ProtectedRoute component={ChiefQuotes} allowedRoles={["chief"]} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/invoices">
          {() => (
            <ErrorBoundary label="Chief Invoices">
              <ProtectedRoute component={ChiefInvoices} allowedRoles={["chief"]} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/workspace-monitor">
          {() => <RedirectTo href="/chief/workspace" />}
        </Route>
        {/* WS-18: same desktop-only editor as /pm/workspace. */}
        <Route path="/chief/workspace">
          {(params) => (
            <ErrorBoundary label="Chief Booth Workspace">
              <DesktopOnlyGuard backTo="/chief">
                <ProtectedRoute component={PMWorkspace} allowedRoles={["chief", "pm"]} params={params} />
              </DesktopOnlyGuard>
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/reports">
          {(params) => (
            <ErrorBoundary label="Chief Reports">
              <ProtectedRoute component={ChiefReports} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/messages">
          {(params) => (
            <ErrorBoundary label="Chief Messages">
              <ProtectedRoute component={ChiefMessages} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/settings">
          {(params) => (
            <ErrorBoundary label="Chief Settings">
              <ProtectedRoute component={ChiefSettings} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/chief/calendar">
          {(params) => (
            <ErrorBoundary label="Chief Calendar">
              <ProtectedRoute component={ChiefCalendar} allowedRoles={["chief"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>

        <Route path="/pm">
          {(params) => (
            <ErrorBoundary label="PM Dashboard">
              <ProtectedRoute component={PMDashboard} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/calendar">
          {(params) => (
            <ErrorBoundary label="PM Calendar">
              <ProtectedRoute component={PMCalendar} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/clients">
          {(params) => (
            <ErrorBoundary label="PM Clients">
              <ProtectedRoute component={PMClients} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/projects">
          {(params) => (
            <ErrorBoundary label="PM Projects">
              <ProtectedRoute component={PMProjects} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/quotes">
          {() => (
            <ErrorBoundary label="PM Quotes">
              <ProtectedRoute component={PMQuotes} allowedRoles={["pm"]} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/invoices">
          {() => (
            <ErrorBoundary label="PM Invoices">
              <ProtectedRoute component={PMInvoices} allowedRoles={["pm"]} />
            </ErrorBoundary>
          )}
        </Route>
        {/* WS-18: the 3D editor has no touch or small-viewport design. */}
        <Route path="/pm/workspace">
          {(params) => (
            <ErrorBoundary label="PM Workspace">
              <DesktopOnlyGuard>
                <ProtectedRoute component={PMWorkspace} allowedRoles={["pm"]} params={params} />
              </DesktopOnlyGuard>
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/requests">
          {(params) => (
            <ErrorBoundary label="PM Requests">
              <ProtectedRoute component={PMRequests} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/messages">
          {(params) => (
            <ErrorBoundary label="PM Messages">
              <ProtectedRoute component={PMMessages} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/tasks">
          {(params) => (
            <ErrorBoundary label="PM Tasks">
              <ProtectedRoute component={PMTasks} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/reports">
          {(params) => (
            <ErrorBoundary label="PM Reports">
              <ProtectedRoute component={PMReports} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/pm/settings">
          {(params) => (
            <ErrorBoundary label="PM Settings">
              <ProtectedRoute component={PMSettings} allowedRoles={["pm"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route>{() => <NotFound />}</Route>
      </Switch>
      </>
    );
  };
}

/**
 * The public PM-invitation page.
 *
 * Returns the page itself, not a <Route>. A <Switch> child must carry its own
 * `path` prop: wouter parses a missing path as "*", so any wrapper element
 * placed directly in a Switch matches every location and shadows every route
 * declared after it — which is how the NotFound route below went dead.
 * The caller registers this behind an explicit <Route path="/pm/join">.
 */
function createStaffPublicPage() {
  const PMJoin = lazyPage(() => import("@/pages/pm/PMJoin"));

  return function StaffPublicPage() {
    return <PMJoin />;
  };
}

function createClientRoutes() {
  const ClientDashboard = lazyPage(() => import("@/pages/client/ClientDashboard"));
  const ClientProjects = lazyPage(() => import("@/pages/client/ClientProjects"));
  const ClientQuotes = lazyPage(() => import("@/pages/client/ClientQuotes"));
  const ClientInvoices = lazyPage(() => import("@/pages/client/ClientInvoices"));
  const ClientWorkspace = lazyPage(() => import("@/pages/client/ClientWorkspace"));
  const ClientMessages = lazyPage(() => import("@/pages/client/ClientMessages"));
  const ClientDocuments = lazyPage(() => import("@/pages/client/ClientDocuments"));
  const ClientProfile = lazyPage(() => import("@/pages/client/ClientProfile"));

  // See the note in createStaffRoutes: every Switch child must carry a `path`.
  return function ClientRoutes() {
    return (
      <Switch>
        <Route path="/client">
          {(params) => (
            <ErrorBoundary label="Client Dashboard">
              <ProtectedRoute component={ClientDashboard} allowedRoles={["client"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/client/projects">
          {(params) => (
            <ErrorBoundary label="Client Projects">
              <ProtectedRoute component={ClientProjects} allowedRoles={["client"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/client/quotes">
          {(params) => (
            <ErrorBoundary label="Client Quotes">
              <ProtectedRoute component={ClientQuotes} allowedRoles={["client"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/client/invoices">
          {(params) => (
            <ErrorBoundary label="Client Invoices">
              <ProtectedRoute component={ClientInvoices} allowedRoles={["client"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        {/* WS-18: ClientWorkspace mounts Booth3D and has no breakpoints either. */}
        <Route path="/client/workspace">
          {(params) => (
            <ErrorBoundary label="Client Workspace">
              <DesktopOnlyGuard backTo="/client">
                <ProtectedRoute component={ClientWorkspace} allowedRoles={["client"]} params={params} />
              </DesktopOnlyGuard>
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/client/messages">
          {(params) => (
            <ErrorBoundary label="Client Messages">
              <ProtectedRoute component={ClientMessages} allowedRoles={["client"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/client/approvals">
          {() => <RedirectTo href="/client/workspace" />}
        </Route>
        <Route path="/client/documents">
          {(params) => (
            <ErrorBoundary label="Client Documents">
              <ProtectedRoute component={ClientDocuments} allowedRoles={["client"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/client/profile">
          {(params) => (
            <ErrorBoundary label="Client Profile">
              <ProtectedRoute component={ClientProfile} allowedRoles={["client"]} params={params} />
            </ErrorBoundary>
          )}
        </Route>
        <Route>{() => <NotFound />}</Route>
      </Switch>
    );
  };
}

const StaffRoutes = INCLUDE_STAFF_ROUTES ? createStaffRoutes() : EmptyRoutes;
const StaffPublicPage = INCLUDE_STAFF_ROUTES ? createStaffPublicPage() : EmptyRoutes;
const ClientRoutes = INCLUDE_CLIENT_ROUTES ? createClientRoutes() : EmptyRoutes;

function Router() {
  const showMarketing = PORTAL_MODE === "all";
  const showStaff = PORTAL_MODE === "all" || PORTAL_MODE === "staff";
  const showClient = PORTAL_MODE === "all" || PORTAL_MODE === "client";
  const [location] = useLocation();
  const pathname = typeof window === "undefined" ? location.split(/[?#]/)[0] : window.location.pathname;
  const isPublicPmJoin = pathname === "/pm/join";
  const AuthComponent =
    pathname === "/login" ? Login :
    pathname === "/signup" ? Signup :
    pathname === "/forgot-password" ? ForgotPassword :
    pathname === "/reset-password" ? ResetPassword :
    null;

  if (AuthComponent) {
    const authRoute = <AuthModalRoute component={AuthComponent} />;
    return (
      <Suspense fallback={<LoadingScreen label="Loading page" />}>
        {getRequestPortal() === "staff" ? <StaffGateway>{authRoute}</StaffGateway> : authRoute}
      </Suspense>
    );
  }

  if (showStaff && !isPublicPmJoin && (pathname === "/pm" || pathname.startsWith("/pm/") || pathname === "/chief" || pathname.startsWith("/chief/"))) {
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

      {/* Legal documents — public in every portal mode, no authentication */}
      {LEGAL_SLUGS.map((slug) => (
        <Route key={slug} path={`/${slug}`}>{() => <LegalPage slug={slug} />}</Route>
      ))}

      {/* Public lead intake — "Request a quote", no authentication */}
      <Route path="/get-quote">{() => <GetQuote />}</Route>

      {/* PM invitation join — accessible without authentication */}
      {showStaff && <Route path="/pm/join">{() => <StaffPublicPage />}</Route>}

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
          <CurrencyProvider>
            <TooltipProvider>
              {ROUTER_BASE ? <WouterRouter base={ROUTER_BASE}>{router}</WouterRouter> : <WouterRouter>{router}</WouterRouter>}
            </TooltipProvider>
          </CurrencyProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
