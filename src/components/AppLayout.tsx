import React, { useState, useEffect } from "react";
import { Outlet, useLocation, NavLink, Navigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Menu, X, LayoutDashboard, FolderOpen,
  CalendarDays, MoreHorizontal, FileText, Euro,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { EmailNewMailToast } from "@/components/inbox/EmailNewMailToast";
import { useMyRole, canAccessRoute } from "@/hooks/useMyRole";
import { useCompany } from "@/contexts/CompanyContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useCompany } from "@/contexts/CompanyContext";

const companyLogoMap: Record<string, string> = {
  "company-art": "/logos/artlevage.png",
  "company-altigrues": "/logos/altigrues.png",
  "company-asdgm": "/logos/asdgm.png",
};

const PAGE_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clients",
  "/pipeline": "Pipeline",
  "/planning": "Planning",
  "/dossiers": "Dossiers",
  "/devis": "Devis",
  "/visites": "Visites",
  "/inbox": "Inbox",
  "/finance": "Finance",
  "/flotte": "Flotte",
  "/stockage": "Stockage",
  "/ressources": "Ressources",
  "/parametres": "Paramètres",
  "/terrain": "Espace Terrain",
  "/voirie": "Voirie",
  "/rentabilite": "Rentabilité",
};

const ALL_BOTTOM_NAV = [
  { to: "/", icon: LayoutDashboard, label: "Accueil", exact: true },
  { to: "/dossiers", icon: FolderOpen, label: "Dossiers" },
  { to: "/planning", icon: CalendarDays, label: "Planning" },
  { to: "/devis", icon: FileText, label: "Devis" },
  { to: "/finance", icon: Euro, label: "Finance" },
];

function RouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role, loading } = useMyRole();

  if (loading) return null;

  if (role === "terrain" && !canAccessRoute(role, location.pathname)) {
    return <Navigate to="/terrain" replace />;
  }

  if (!canAccessRoute(role, location.pathname)) {
    if (role === "comptable") return <Navigate to="/finance" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const AppLayout: React.FC = () => {
  useKeyboardShortcuts();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { role } = useMyRole();
  const { currentCompany } = useCompany();
  const watermarkLogo = companyLogoMap[currentCompany.id] ?? companyLogoMap[currentCompany.color];

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const currentPageName = Object.entries(PAGE_NAMES)
    .filter(([path]) => path !== "/")
    .find(([path]) => location.pathname.startsWith(path))?.[1]
    ?? (location.pathname === "/" ? "Dashboard" : "");

  const bottomNav = ALL_BOTTOM_NAV.filter((item) => canAccessRoute(role, item.to));

  return (
    <div className="flex h-screen overflow-hidden max-w-[100vw]">
      {/* Desktop sidebar */}
      {!isMobile && <AppSidebar />}

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px] animate-in slide-in-from-left duration-200">
            <AppSidebar />
          </div>
        </>
      )}

      <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-background">
        {watermarkLogo && (
          <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center" style={{ left: isMobile ? 0 : '248px' }}>
            <img
              src={watermarkLogo}
              alt=""
              className="w-[40vw] max-w-[500px] opacity-[0.03] select-none"
              draggable={false}
            />
          </div>
        )}
        <OfflineBanner />
        <OnboardingWizard />
        <EmailNewMailToast />
        {isMobile && (
          <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-background/95 backdrop-blur-xl px-3 py-2.5">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen((v) => !v)} className="h-8 w-8 shrink-0">
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <span className="text-sm font-semibold text-foreground tracking-tight border-b-2 border-primary/20 pb-0.5">{currentPageName || "altasart.app"}</span>
          </div>
        )}
        <RouteGuard>
          <Outlet />
        </RouteGuard>
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-t flex items-stretch h-14">
          {bottomNav.map((item) => {
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200">
                <item.icon className={`h-[18px] w-[18px] ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium leading-none ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
                {isActive && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
              </NavLink>
            );
          })}
          <button
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <MoreHorizontal className={`h-[18px] w-[18px] ${sidebarOpen ? "text-foreground" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-medium leading-none ${sidebarOpen ? "text-foreground" : "text-muted-foreground"}`}>Plus</span>
            {sidebarOpen && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
          </button>
        </nav>
      )}
    </div>
  );
};
