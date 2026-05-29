import { useEffect } from "react";
import { motion } from "framer-motion";
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
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TeamLanding from "@/pages/TeamLanding";

import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

import ChiefDashboard from "@/pages/chief/ChiefDashboard";
import ChiefClients from "@/pages/chief/ChiefClients";
import ChiefManagers from "@/pages/chief/ChiefManagers";
import ChiefProjects from "@/pages/chief/ChiefProjects";
import ChiefWorkspaceMonitor from "@/pages/chief/ChiefWorkspaceMonitor";
import ChiefReports from "@/pages/chief/ChiefReports";
import ChiefMessages from "@/pages/chief/ChiefMessages";
import ChiefSettings from "@/pages/chief/ChiefSettings";
import ChiefCalendar from "@/pages/chief/ChiefCalendar";

import PMDashboard from "@/pages/pm/PMDashboard";
import PMCalendar from "@/pages/pm/PMCalendar";
import PMJoin from "@/pages/pm/PMJoin";
import PMClients from "@/pages/pm/PMClients";
import PMProjects from "@/pages/pm/PMProjects";
import PMWorkspace from "@/pages/pm/PMWorkspace";
import PMRequests from "@/pages/pm/PMRequests";
import PMMessages from "@/pages/pm/PMMessages";
import PMTasks from "@/pages/pm/PMTasks";
import PMReports from "@/pages/pm/PMReports";
import PMSettings from "@/pages/pm/PMSettings";

import ClientDashboard from "@/pages/client/ClientDashboard";
import ClientProjects from "@/pages/client/ClientProjects";
import ClientWorkspace from "@/pages/client/ClientWorkspace";
import ClientMessages from "@/pages/client/ClientMessages";
import ClientApprovals from "@/pages/client/ClientApprovals";
import ClientDocuments from "@/pages/client/ClientDocuments";
import ClientProfile from "@/pages/client/ClientProfile";

const queryClient = new QueryClient();

function PortalRoot() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user && isRoleAllowedInPortal(user.role)) {
      navigate(getRoleDashboard(user.role), { replace: true });
      return;
    }
    navigate(getPortalLoginPath(), { replace: true });
  }, [isAuthenticated, isLoading, navigate, user]);

  return null;
}

function AuthModalRoute({ component: Component }: { component: React.ComponentType }) {
  const [, navigate] = useLocation();
  const Background = PORTAL_MODE === "staff" ? TeamLanding : Home;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: 0.7, scale: 1.02 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="absolute inset-0 blur-md pointer-events-none select-none"
      >
        <Background />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-background/55 backdrop-blur-sm"
      />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <button
          type="button"
          aria-label="Close auth modal"
          onClick={() => navigate("/", { replace: true })}
          className="absolute right-5 top-5 z-20 h-10 w-10 rounded-full border border-border/70 bg-background/75 backdrop-blur-xl text-xl leading-none text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
        >
          x
        </button>
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="w-full"
        >
          <Component />
        </motion.div>
      </div>
    </div>
  );
}

function StaffRoutes() {
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
      <ErrorBoundary label="Chief Workspace Monitor">
        <Route path="/chief/workspace-monitor">
          {(params) => <ProtectedRoute component={ChiefWorkspaceMonitor} allowedRoles={["chief"]} params={params} />}
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
}

function ClientRoutes() {
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
}

function Router() {
  const showMarketing = PORTAL_MODE === "all";
  const showStaff = PORTAL_MODE === "all" || PORTAL_MODE === "staff";
  const showClient = PORTAL_MODE === "all" || PORTAL_MODE === "client";

  return (
    <Switch>
      {showMarketing && <Route path="/" component={Home} />}
      {PORTAL_MODE === "staff" && <Route path="/" component={TeamLanding} />}
      {PORTAL_MODE === "client" && <Route path="/" component={Home} />}
      {showStaff && <Route path="/team" component={TeamLanding} />}

      {/* PM invitation join — accessible without authentication */}
      <Route path="/pm/join" component={PMJoin} />

      {/* Auth routes — wrapped in StaffGateway when running the staff portal */}
      <Route path="/login">
        {() => (
          <StaffGateway>
            <AuthModalRoute component={Login} />
          </StaffGateway>
        )}
      </Route>
      <Route path="/signup">
        {() => (
          <StaffGateway>
            <AuthModalRoute component={Signup} />
          </StaffGateway>
        )}
      </Route>
      <Route path="/forgot-password">
        {() => (
          <StaffGateway>
            <AuthModalRoute component={ForgotPassword} />
          </StaffGateway>
        )}
      </Route>
      <Route path="/reset-password">
        {() => (
          <StaffGateway>
            <AuthModalRoute component={ResetPassword} />
          </StaffGateway>
        )}
      </Route>

      {showStaff && <StaffGateway><StaffRoutes /></StaffGateway>}
      {showClient && <ClientRoutes />}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey={THEME_STORAGE_KEY} enableSystem disableTransitionOnChange>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
              <Router />
            </WouterRouter>
            <RuntimeTextTranslator />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
