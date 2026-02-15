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
import Devis from "@/pages/Devis";
import Visites from "@/pages/Visites";
import InboxPage from "@/pages/InboxPage";
import Finance from "@/pages/Finance";
import Ressources from "@/pages/Ressources";
import Parametres from "@/pages/Parametres";
import Auth from "@/pages/Auth";
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
          <Route path="/devis" element={<Devis />} />
          <Route path="/visites" element={<Visites />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/ressources" element={<Ressources />} />
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
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
