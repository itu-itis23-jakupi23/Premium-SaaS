import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TeamLanding from "@/pages/TeamLanding";

// Auth Pages
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

// Chief Pages
import ChiefDashboard from "@/pages/chief/ChiefDashboard";
import ChiefClients from "@/pages/chief/ChiefClients";
import ChiefManagers from "@/pages/chief/ChiefManagers";
import ChiefProjects from "@/pages/chief/ChiefProjects";
import ChiefWorkspaceMonitor from "@/pages/chief/ChiefWorkspaceMonitor";
import ChiefReports from "@/pages/chief/ChiefReports";
import ChiefMessages from "@/pages/chief/ChiefMessages";
import ChiefSettings from "@/pages/chief/ChiefSettings";

// PM Pages
import PMDashboard from "@/pages/pm/PMDashboard";
import PMClients from "@/pages/pm/PMClients";
import PMProjects from "@/pages/pm/PMProjects";
import PMWorkspace from "@/pages/pm/PMWorkspace";
import PMRequests from "@/pages/pm/PMRequests";
import PMMessages from "@/pages/pm/PMMessages";
import PMTasks from "@/pages/pm/PMTasks";
import PMReports from "@/pages/pm/PMReports";

// Client Pages
import ClientDashboard from "@/pages/client/ClientDashboard";
import ClientProjects from "@/pages/client/ClientProjects";
import ClientWorkspace from "@/pages/client/ClientWorkspace";
import ClientMessages from "@/pages/client/ClientMessages";
import ClientApprovals from "@/pages/client/ClientApprovals";
import ClientDocuments from "@/pages/client/ClientDocuments";
import ClientProfile from "@/pages/client/ClientProfile";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/team" component={TeamLanding} />

      {/* Auth Routes */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Chief Routes — restricted to chief role */}
      <Route path="/chief">
        {(params) => <ProtectedRoute component={ChiefDashboard} allowedRoles={['chief']} params={params} />}
      </Route>
      <Route path="/chief/clients">
        {(params) => <ProtectedRoute component={ChiefClients} allowedRoles={['chief']} params={params} />}
      </Route>
      <Route path="/chief/managers">
        {(params) => <ProtectedRoute component={ChiefManagers} allowedRoles={['chief']} params={params} />}
      </Route>
      <Route path="/chief/projects">
        {(params) => <ProtectedRoute component={ChiefProjects} allowedRoles={['chief']} params={params} />}
      </Route>
      <Route path="/chief/workspace-monitor">
        {(params) => <ProtectedRoute component={ChiefWorkspaceMonitor} allowedRoles={['chief']} params={params} />}
      </Route>
      <Route path="/chief/reports">
        {(params) => <ProtectedRoute component={ChiefReports} allowedRoles={['chief']} params={params} />}
      </Route>
      <Route path="/chief/messages">
        {(params) => <ProtectedRoute component={ChiefMessages} allowedRoles={['chief']} params={params} />}
      </Route>
      <Route path="/chief/settings">
        {(params) => <ProtectedRoute component={ChiefSettings} allowedRoles={['chief']} params={params} />}
      </Route>

      {/* PM Routes — restricted to pm role */}
      <Route path="/pm">
        {(params) => <ProtectedRoute component={PMDashboard} allowedRoles={['pm']} params={params} />}
      </Route>
      <Route path="/pm/clients">
        {(params) => <ProtectedRoute component={PMClients} allowedRoles={['pm']} params={params} />}
      </Route>
      <Route path="/pm/projects">
        {(params) => <ProtectedRoute component={PMProjects} allowedRoles={['pm']} params={params} />}
      </Route>
      <Route path="/pm/workspace">
        {(params) => <ProtectedRoute component={PMWorkspace} allowedRoles={['pm']} params={params} />}
      </Route>
      <Route path="/pm/requests">
        {(params) => <ProtectedRoute component={PMRequests} allowedRoles={['pm']} params={params} />}
      </Route>
      <Route path="/pm/messages">
        {(params) => <ProtectedRoute component={PMMessages} allowedRoles={['pm']} params={params} />}
      </Route>
      <Route path="/pm/tasks">
        {(params) => <ProtectedRoute component={PMTasks} allowedRoles={['pm']} params={params} />}
      </Route>
      <Route path="/pm/reports">
        {(params) => <ProtectedRoute component={PMReports} allowedRoles={['pm']} params={params} />}
      </Route>

      {/* Client Routes — restricted to client role */}
      <Route path="/client">
        {(params) => <ProtectedRoute component={ClientDashboard} allowedRoles={['client']} params={params} />}
      </Route>
      <Route path="/client/projects">
        {(params) => <ProtectedRoute component={ClientProjects} allowedRoles={['client']} params={params} />}
      </Route>
      <Route path="/client/workspace">
        {(params) => <ProtectedRoute component={ClientWorkspace} allowedRoles={['client']} params={params} />}
      </Route>
      <Route path="/client/messages">
        {(params) => <ProtectedRoute component={ClientMessages} allowedRoles={['client']} params={params} />}
      </Route>
      <Route path="/client/approvals">
        {(params) => <ProtectedRoute component={ClientApprovals} allowedRoles={['client']} params={params} />}
      </Route>
      <Route path="/client/documents">
        {(params) => <ProtectedRoute component={ClientDocuments} allowedRoles={['client']} params={params} />}
      </Route>
      <Route path="/client/profile">
        {(params) => <ProtectedRoute component={ClientProfile} allowedRoles={['client']} params={params} />}
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="ens-theme" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
