/** Clinical Transit Board — application shell keeps the experience calm, structured, and context-aware. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import DoctorConsole from "./pages/DoctorConsole";
import Cashier from "./pages/Cashier";
import FrontDesk from "./pages/FrontDesk";
import Home from "./pages/Home";
import MedicationCatalog from "./pages/MedicationCatalog";
import QueueBoard from "./pages/QueueBoard";
import Reports from "./pages/Reports";
import StaffManagement from "./pages/StaffManagement";
import SessionExpiryBoundary from "./components/SessionExpiryBoundary";

function ClinicalPage({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/front-desk" component={() => <ClinicalPage><FrontDesk /></ClinicalPage>} />
    <Route path="/queue" component={() => <ClinicalPage><QueueBoard /></ClinicalPage>} />
    <Route path="/doctor-console/:visitId" component={() => <ClinicalPage><DoctorConsole /></ClinicalPage>} />
    <Route path="/doctor-console" component={() => <ClinicalPage><DoctorConsole /></ClinicalPage>} />
    <Route path="/cashier" component={() => <ClinicalPage><Cashier /></ClinicalPage>} />
    <Route path="/medications" component={() => <ClinicalPage><MedicationCatalog /></ClinicalPage>} />
    <Route path="/reports" component={() => <ClinicalPage><Reports /></ClinicalPage>} />
    <Route path="/staff" component={() => <ClinicalPage><StaffManagement /></ClinicalPage>} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><SessionExpiryBoundary><Router /></SessionExpiryBoundary></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
