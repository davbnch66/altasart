import React, { useState, useEffect } from "react";
import { Outlet, useLocation, NavLink, Navigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Menu, X, LayoutDashboard, FolderOpen, ClipboardCheck,
  CalendarDays, MoreHorizontal, HardHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useMyRole, canAccessRoute } from "@/hooks/useMyRole";
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
  { to: "/visites", icon: ClipboardCheck, label: "Visites" },
  { to: "/terrain", icon: HardHat, label: "Terrain" },
  { to: "/planning", icon: CalendarDays, label: "Planning" },
];

// Route guard component
function RouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role, loading } = useMyRole();

  if (loading) return null;

  // terrain role: always redirect to /terrain
  if (role === "terrain" && location.pathname !== "/terrain") {
    return <Navigate to="/terrain" replace />;
  }

  // Check route access for other roles
  if (!canAccessRoute(role, location.pathname)) {
    // Redirect to first allowed route
    if (role === "comptable") return <Navigate to="/finance" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const AppLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { role } = useMyRole();
  const { currentCompany } = useCompany();
  const watermarkLogo = companyLogoMap[currentCompany.color];

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const currentPageName = Object.entries(PAGE_NAMES)
    .filter(([path]) => path !== "/")
    .find(([path]) => location.pathname.startsWith(path))?.[1]
    ?? (location.pathname === "/" ? "Dashboard" : "");

  // Filter bottom nav based on role
  const bottomNav = ALL_BOTTOM_NAV.filter((item) => canAccessRoute(role, item.to));

  return (
    <div className="flex h-screen overflow-hidden max-w-[100vw]">
      {/* Desktop sidebar */}
      {!isMobile && <AppSidebar />}

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 animate-in slide-in-from-left duration-200">
            <AppSidebar />
          </div>
        </>
      )}

      <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-background">
        {watermarkLogo && (
          <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center" style={{ left: isMobile ? 0 : '15rem' }}>
            <img
              src={watermarkLogo}
              alt=""
              className="w-[40vw] max-w-[500px] opacity-[0.04] select-none"
              draggable={false}
            />
          </div>
        )}
        <OfflineBanner />
        <OnboardingWizard />
        {isMobile && (
          <div className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-3 py-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen((v) => !v)} className="h-9 w-9 shrink-0">
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <span className="text-sm font-semibold text-foreground">{currentPageName || "altasart.app"}</span>
          </div>
        )}
        <RouteGuard>
          <Outlet />
        </RouteGuard>
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t flex items-stretch h-16">
          {bottomNav.map((item) => {
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors">
                <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium leading-none ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
          <button
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <MoreHorizontal className={`h-5 w-5 ${sidebarOpen ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-medium leading-none ${sidebarOpen ? "text-primary" : "text-muted-foreground"}`}>Plus</span>
          </button>
        </nav>
      )}
    </div>
  );
};
