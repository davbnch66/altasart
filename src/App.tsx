import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Clients = lazy(() => import("@/pages/Clients"));
const ClientDetail = lazy(() => import("@/pages/ClientDetail"));
const Planning = lazy(() => import("@/pages/Planning"));
const Dossiers = lazy(() => import("@/pages/Dossiers"));
const DossierDetail = lazy(() => import("@/pages/DossierDetail"));
const Devis = lazy(() => import("@/pages/Devis"));
const DevisDetail = lazy(() => import("@/pages/DevisDetail"));
const Visites = lazy(() => import("@/pages/Visites"));
const VisiteDetail = lazy(() => import("@/pages/VisiteDetail"));
const InboxPage = lazy(() => import("@/pages/InboxPage"));
const Finance = lazy(() => import("@/pages/Finance"));
const FactureDetail = lazy(() => import("@/pages/FactureDetail"));
const Ressources = lazy(() => import("@/pages/Ressources"));
const Parametres = lazy(() => import("@/pages/Parametres"));
const PipelineKanban = lazy(() => import("@/pages/PipelineKanban"));
const FleetPage = lazy(() => import("@/pages/FleetPage"));
const StoragePage = lazy(() => import("@/pages/StoragePage"));
const Auth = lazy(() => import("@/pages/Auth"));
const SignDevis = lazy(() => import("@/pages/SignDevis"));
const RentabiliteReport = lazy(() => import("@/pages/RentabiliteReport"));
const TerrainPage = lazy(() => import("@/pages/TerrainPage"));
const VoiriePage = lazy(() => import("@/pages/VoiriePage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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
          <Route path="/rentabilite" element={<RentabiliteReport />} />
          <Route path="/terrain" element={<TerrainPage />} />
          <Route path="/voirie" element={<VoiriePage />} />
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

const App = () => {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[Global] Unhandled rejection:", event.reason);
      toast.error("Une erreur inattendue est survenue.");
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  return (
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
};

export default App;
