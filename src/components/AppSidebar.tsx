import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/NotificationBell";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FolderOpen,
  FileText,
  ClipboardCheck,
  Inbox,
  DollarSign,
  Wrench,
  Settings,
  Building2,
  ChevronDown,
  Kanban,
  Truck,
  Warehouse,
  LogOut,
  Bell,
  BarChart3,
  HardHat,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/pipeline", icon: Kanban, label: "Pipeline" },
  { to: "/planning", icon: CalendarDays, label: "Planning" },
  { to: "/dossiers", icon: FolderOpen, label: "Dossiers" },
  { to: "/devis", icon: FileText, label: "Devis" },
  { to: "/visites", icon: ClipboardCheck, label: "Visites" },
  { to: "/terrain", icon: HardHat, label: "Terrain" },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/finance", icon: DollarSign, label: "Finance" },
  { to: "/rentabilite", icon: BarChart3, label: "Rentabilité" },
  { to: "/flotte", icon: Truck, label: "Flotte" },
  { to: "/stockage", icon: Warehouse, label: "Stockage" },
  { to: "/ressources", icon: Wrench, label: "Ressources" },
  { to: "/parametres", icon: Settings, label: "Paramètres" },
];

const companyDotColor: Record<string, string> = {
  "global": "bg-primary",
  "company-art": "bg-company-art",
  "company-altigrues": "bg-company-altigrues",
  "company-asdgm": "bg-company-asdgm",
  "primary": "bg-primary",
};

export const AppSidebar: React.FC = () => {
  const { current, setCurrent, currentCompany, companies, dbCompanies } = useCompany();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
            <span className="flex-1 text-left text-sidebar-primary truncate">
              {currentCompany.name}
            </span>
            <ChevronDown className="h-4 w-4 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {companies.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => setCurrent(c.id)}
                className="flex items-center gap-3"
              >
                <div className={`h-2 w-2 rounded-full ${companyDotColor[c.color] || "bg-primary"}`} />
                <span>{c.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);

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
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-accent-foreground">
            {user?.email?.substring(0, 2).toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-primary truncate">
              {user?.user_metadata?.full_name || "Utilisateur"}
            </p>
            <p className="text-xs text-sidebar-muted truncate">{user?.email}</p>
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
