import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, CalendarDays, FolderOpen, FileText,
  ClipboardCheck, Inbox, DollarSign, Wrench, Settings, Building2,
  ChevronDown, ChevronRight, Kanban, Truck, Warehouse, LogOut, BarChart3, HardHat, ShieldAlert,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyRole, ROLE_LABELS, canAccessRoute } from "@/hooks/useMyRole";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_CATEGORIES = [
  {
    label: "Commercial",
    items: [
      { to: "/clients", icon: Users, label: "Clients" },
      { to: "/pipeline", icon: Kanban, label: "Pipeline" },
      { to: "/devis", icon: FileText, label: "Devis" },
      { to: "/visites", icon: ClipboardCheck, label: "Visites" },
      { to: "/inbox", icon: Inbox, label: "Inbox" },
    ],
  },
  {
    label: "Exploitation",
    items: [
      { to: "/dossiers", icon: FolderOpen, label: "Dossiers" },
      { to: "/planning", icon: CalendarDays, label: "Planning" },
      { to: "/terrain", icon: HardHat, label: "Terrain" },
      { to: "/voirie", icon: ShieldAlert, label: "Voirie" },
    ],
  },
  {
    label: "Logistique",
    items: [
      { to: "/flotte", icon: Truck, label: "Flotte" },
      { to: "/stockage", icon: Warehouse, label: "Stockage" },
      { to: "/ressources", icon: Wrench, label: "Ressources" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/finance", icon: DollarSign, label: "Finance" },
      { to: "/rentabilite", icon: BarChart3, label: "Rentabilité" },
    ],
  },
];

const companyDotColor: Record<string, string> = {
  "global": "bg-primary",
  "company-art": "bg-company-art",
  "company-altigrues": "bg-company-altigrues",
  "company-asdgm": "bg-company-asdgm",
  "primary": "bg-primary",
};

const companyLogoMap: Record<string, string> = {
  "company-art": "/logos/artlevage.png",
  "company-altigrues": "/logos/altigrues.png",
  "company-asdgm": "/logos/asdgm.png",
};

const ROLE_BADGE_COLOR: Record<string, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  manager: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  commercial: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  exploitation: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  comptable: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  terrain: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  readonly: "bg-muted text-muted-foreground border-border",
};

export const AppSidebar: React.FC = () => {
  const { current, setCurrent, currentCompany, companies, dbCompanies } = useCompany();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useMyRole();

  // Track collapsed categories (all open by default)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCategory = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["inbox-pending-count", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return 0;
      const { count, error } = await supabase
        .from("inbound_emails")
        .select("id", { count: "exact", head: true })
        .in("company_id", companyIds)
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    enabled: companyIds.length > 0,
    refetchInterval: 30000,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Company Switcher */}
      <div className="p-4 border-b border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-sidebar-accent transition-colors outline-none">
            <div className={`h-2.5 w-2.5 rounded-full ${companyDotColor[currentCompany.color] || "bg-primary"}`} />
            <span className="flex-1 text-left text-sidebar-primary truncate">{currentCompany.name}</span>
            <ChevronDown className="h-4 w-4 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {companies.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setCurrent(c.id)} className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${companyDotColor[c.color] || "bg-primary"}`} />
                <span>{c.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <GlobalSearch />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-3">
        {/* Dashboard - always on top */}
        {canAccessRoute(role, "/") && (
          <NavLink
            to="/"
            className="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mb-1"
          >
            {location.pathname === "/" && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-md bg-sidebar-accent"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <LayoutDashboard className="relative z-10 h-4 w-4" />
            <span className={`relative z-10 flex-1 ${location.pathname === "/" ? "text-sidebar-accent-foreground font-medium" : ""}`}>
              Dashboard
            </span>
          </NavLink>
        )}

        {/* Categorized nav items */}
        {NAV_CATEGORIES.map((cat) => {
          const visibleItems = cat.items.filter((item) => canAccessRoute(role, item.to));
          if (visibleItems.length === 0) return null;
          const isCollapsed = !!collapsed[cat.label];
          const hasActiveChild = visibleItems.some(
            (item) => location.pathname.startsWith(item.to)
          );

          return (
            <div key={cat.label} className="mt-2">
              <button
                onClick={() => toggleCategory(cat.label)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`} />
                <span className="flex-1 text-left">{cat.label}</span>
                {isCollapsed && hasActiveChild && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 mt-0.5">
                      {visibleItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.to);
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          >
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active"
                                className="absolute inset-0 rounded-md bg-sidebar-accent"
                                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                              />
                            )}
                            <item.icon className="relative z-10 h-4 w-4" />
                            <span className={`relative z-10 flex-1 ${isActive ? "text-sidebar-accent-foreground font-medium" : ""}`}>
                              {item.label}
                            </span>
                            {item.to === "/inbox" && pendingCount > 0 && (
                              <span className="relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                                {pendingCount > 99 ? "99+" : pendingCount}
                              </span>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Settings - always at bottom of nav */}
        {canAccessRoute(role, "/parametres") && (
          <NavLink
            to="/parametres"
            className="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mt-2"
          >
            {location.pathname.startsWith("/parametres") && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-md bg-sidebar-accent"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <Settings className="relative z-10 h-4 w-4" />
            <span className={`relative z-10 flex-1 ${location.pathname.startsWith("/parametres") ? "text-sidebar-accent-foreground font-medium" : ""}`}>
              Paramètres
            </span>
          </NavLink>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-accent-foreground shrink-0">
            {user?.email?.substring(0, 2).toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-primary truncate">
              {user?.user_metadata?.full_name || "Utilisateur"}
            </p>
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE_COLOR[role] || ROLE_BADGE_COLOR.readonly}`}>
              {ROLE_LABELS[role] || role}
            </span>
          </div>
          <NotificationBell />
          <button onClick={handleSignOut} className="p-1.5 rounded hover:bg-sidebar-accent transition-colors" title="Se déconnecter">
            <LogOut className="h-4 w-4 text-sidebar-muted" />
          </button>
        </div>
      </div>
    </aside>
  );
};
