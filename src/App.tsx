import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Planning from "@/pages/Planning";
import Dossiers from "@/pages/Dossiers";
import Visites from "@/pages/Visites";
import InboxPage from "@/pages/InboxPage";
import Finance from "@/pages/Finance";
import Ressources from "@/pages/Ressources";
import Parametres from "@/pages/Parametres";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CompanyProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/dossiers" element={<Dossiers />} />
              <Route path="/visites" element={<Visites />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/ressources" element={<Ressources />} />
              <Route path="/parametres" element={<Parametres />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CompanyProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
