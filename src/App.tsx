import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Planning from "@/pages/Planning";
import Dossiers from "@/pages/Dossiers";
import DossierDetail from "@/pages/DossierDetail";
import Devis from "@/pages/Devis";
import DevisDetail from "@/pages/DevisDetail";
import Visites from "@/pages/Visites";
import VisiteDetail from "@/pages/VisiteDetail";
import InboxPage from "@/pages/InboxPage";
import Finance from "@/pages/Finance";
import FactureDetail from "@/pages/FactureDetail";
import Ressources from "@/pages/Ressources";
import Parametres from "@/pages/Parametres";
import PipelineKanban from "@/pages/PipelineKanban";
import FleetPage from "@/pages/FleetPage";
import StoragePage from "@/pages/StoragePage";
import Auth from "@/pages/Auth";
import SignDevis from "@/pages/SignDevis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <CompanyProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/dossiers" element={<Dossiers />} />
          <Route path="/dossiers/:id" element={<DossierDetail />} />
          <Route path="/devis" element={<Devis />} />
          <Route path="/devis/:id" element={<DevisDetail />} />
          <Route path="/visites" element={<Visites />} />
          <Route path="/visites/:id" element={<VisiteDetail />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/finance/:id" element={<FactureDetail />} />
          <Route path="/ressources" element={<Ressources />} />
          <Route path="/pipeline" element={<PipelineKanban />} />
          <Route path="/flotte" element={<FleetPage />} />
          <Route path="/stockage" element={<StoragePage />} />
          <Route path="/parametres" element={<Parametres />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </CompanyProvider>
  );
};

const AuthRoute = () => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route path="/sign/:token" element={<SignDevis />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
