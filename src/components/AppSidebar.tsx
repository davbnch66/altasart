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
  admin: "bg-primary/10 text-primary",
  manager: "bg-blue-500/10 text-blue-600",
  commercial: "bg-emerald-500/10 text-emerald-600",
  exploitation: "bg-orange-500/10 text-orange-600",
  comptable: "bg-purple-500/10 text-purple-600",
  terrain: "bg-yellow-500/10 text-yellow-700",
  readonly: "bg-muted text-muted-foreground",
};

export const AppSidebar: React.FC = () => {
  const { current, setCurrent, currentCompany, companies, dbCompanies } = useCompany();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useMyRole();

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
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("id, ai_analysis")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error || !data) return 0;
      return data.filter((e: any) => {
        const types: string[] = e.ai_analysis?.type_demande || [];
        if (types.length === 0) return true;
        return types.some((t: string) => t !== "autre");
      }).length;
    },
    enabled: companyIds.length > 0,
    refetchInterval: 30000,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <aside className="flex h-screen w-[240px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Company Switcher */}
      <div className="px-3 pt-4 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-sidebar-accent transition-colors outline-none">
            {companyLogoMap[currentCompany.color] ? (
              <img src={companyLogoMap[currentCompany.color]} alt={currentCompany.name} className="h-6 w-6 rounded object-contain" />
            ) : (
              <div className="h-6 w-6 rounded-md bg-sidebar-accent flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-sidebar-foreground" />
              </div>
            )}
            <span className="flex-1 text-left text-sidebar-primary truncate text-[13px]">{currentCompany.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {companies.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setCurrent(c.id)} className="flex items-center gap-2.5">
                {companyLogoMap[c.color] ? (
                  <img src={companyLogoMap[c.color]} alt={c.name} className="h-5 w-5 rounded object-contain" />
                ) : (
                  <div className={`h-2 w-2 rounded-full ${companyDotColor[c.color] || "bg-primary"}`} />
                )}
                <span className="text-[13px]">{c.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <GlobalSearch />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-1 px-2">
        {/* Dashboard */}
        {canAccessRoute(role, "/") && (
          <SidebarNavLink
            to="/"
            icon={LayoutDashboard}
            label="Dashboard"
            isActive={location.pathname === "/"}
          />
        )}

        {/* Categorized nav items */}
        {NAV_CATEGORIES.map((cat) => {
          const visibleItems = cat.items.filter((item) => canAccessRoute(role, item.to));
          if (visibleItems.length === 0) return null;
          const isCollapsed = !!collapsed[cat.label];
          const hasActiveChild = visibleItems.some((item) => location.pathname.startsWith(item.to));

          return (
            <div key={cat.label} className="mt-3">
              <button
                onClick={() => toggleCategory(cat.label)}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted hover:text-sidebar-foreground transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`} />
                <span className="flex-1 text-left">{cat.label}</span>
                {isCollapsed && hasActiveChild && (
                  <div className="h-1.5 w-1.5 rounded-full bg-sidebar-ring" />
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
                    <div className="mt-0.5 space-y-px">
                      {visibleItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.to);
                        return (
                          <SidebarNavLink
                            key={item.to}
                            to={item.to}
                            icon={item.icon}
                            label={item.label}
                            isActive={isActive}
                            badge={item.to === "/inbox" && pendingCount > 0 ? pendingCount : undefined}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Settings */}
        {canAccessRoute(role, "/parametres") && (
          <div className="mt-3">
            <SidebarNavLink
              to="/parametres"
              icon={Settings}
              label="Paramètres"
              isActive={location.pathname.startsWith("/parametres")}
            />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-sidebar-accent flex items-center justify-center text-[11px] font-semibold text-sidebar-accent-foreground shrink-0">
            {user?.email?.substring(0, 2).toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-sidebar-primary truncate">
              {user?.user_metadata?.full_name || "Utilisateur"}
            </p>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE_COLOR[role] || ROLE_BADGE_COLOR.readonly}`}>
              {ROLE_LABELS[role] || role}
            </span>
          </div>
          <NotificationBell />
          <button onClick={handleSignOut} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors" title="Se déconnecter">
            <LogOut className="h-3.5 w-3.5 text-sidebar-muted" />
          </button>
        </div>
      </div>
    </aside>
  );
};

// Extracted nav link component for consistency
function SidebarNavLink({ to, icon: Icon, label, isActive, badge }: {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-muted"}`} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
