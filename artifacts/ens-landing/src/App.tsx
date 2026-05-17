import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TeamLanding from "@/pages/TeamLanding";

// Auth Pages
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";

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

      {/* Chief Routes */}
      <Route path="/chief" component={ChiefDashboard} />
      <Route path="/chief/clients" component={ChiefClients} />
      <Route path="/chief/managers" component={ChiefManagers} />
      <Route path="/chief/projects" component={ChiefProjects} />
      <Route path="/chief/workspace-monitor" component={ChiefWorkspaceMonitor} />
      <Route path="/chief/reports" component={ChiefReports} />
      <Route path="/chief/messages" component={ChiefMessages} />
      <Route path="/chief/settings" component={ChiefSettings} />

      {/* PM Routes */}
      <Route path="/pm" component={PMDashboard} />
      <Route path="/pm/clients" component={PMClients} />
      <Route path="/pm/projects" component={PMProjects} />
      <Route path="/pm/workspace" component={PMWorkspace} />
      <Route path="/pm/requests" component={PMRequests} />
      <Route path="/pm/messages" component={PMMessages} />
      <Route path="/pm/tasks" component={PMTasks} />
      <Route path="/pm/reports" component={PMReports} />

      {/* Client Routes */}
      <Route path="/client" component={ClientDashboard} />
      <Route path="/client/projects" component={ClientProjects} />
      <Route path="/client/workspace" component={ClientWorkspace} />
      <Route path="/client/messages" component={ClientMessages} />
      <Route path="/client/approvals" component={ClientApprovals} />
      <Route path="/client/documents" component={ClientDocuments} />
      <Route path="/client/profile" component={ClientProfile} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="ens-theme" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
