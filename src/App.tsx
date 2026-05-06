import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Employees from "./pages/Employees";
import LiveTracking from "./pages/LiveTracking";
import Leads from "./pages/Leads";
import Quotations from "./pages/Quotations";
import Recovery from "./pages/Recovery";
import CalendarPage from "./pages/CalendarPage";
import Partners from "./pages/Partners";
import SmartLeadHub from "./pages/SmartLeadHub";
import Settings from "./pages/Settings";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Financials from "./pages/Financials";
import Notifications from "./pages/Notifications";
import BroadcastHub from "./pages/BroadcastHub";
import CashCustody from "./pages/CashCustody";
import Verification from "./pages/Verification";
import Shifts from "./pages/Shifts";
import Assignments from "./pages/Assignments";
import FieldReports from "./pages/FieldReports";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login";
import FieldApp from "./pages/FieldApp";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { PrivacyShieldProvider } from "./contexts/PrivacyShieldContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PrivacyShieldProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route element={<ProtectedRoute />}>
              {/* Field sales mobile app — no sidebar chrome, mobile-first. */}
              <Route path="/field" element={<FieldApp />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/live-tracking" element={<LiveTracking />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/quotations" element={<Quotations />} />
                <Route path="/recovery" element={<Recovery />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/partners" element={<Partners />} />
                <Route path="/smart-leads" element={<SmartLeadHub />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/financials" element={<Financials />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/broadcast" element={<BroadcastHub />} />
                <Route path="/cash-custody" element={<CashCustody />} />
                                <Route path="/verification" element={<Verification />} />
                <Route path="/shifts" element={<Shifts />} />
                <Route path="/assignments" element={<Assignments />} />
                <Route path="/field-reports" element={<FieldReports />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </PrivacyShieldProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
