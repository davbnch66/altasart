import { motion } from "framer-motion";
import { Search, Users, Phone, MapPin, ChevronRight, Plus, Building2, Loader2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreateClientDialog } from "@/components/forms/CreateClientDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProgressiveList } from "@/hooks/useProgressiveList";

const statusLabels: Record<string, string> = {
  nouveau_lead: "Lead",
  actif: "Actif",
  inactif: "Inactif",
  relance: "Relance",
};

const statusStyles: Record<string, string> = {
  actif: "bg-success/10 text-success",
  nouveau_lead: "bg-info/10 text-info",
  relance: "bg-warning/10 text-warning",
  inactif: "bg-muted text-muted-foreground",
};

const Clients = () => {
  const { current, dbCompanies } = useCompany();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", current],
    queryFn: async () => {
      if (current !== "global") {
        const { data: links } = await supabase
          .from("client_companies" as any)
          .select("client_id")
          .eq("company_id", current);
        const clientIds = (links as any[])?.map((l: any) => l.client_id) || [];
        if (clientIds.length === 0) return [];
        const { data, error } = await supabase
          .from("clients")
          .select("*, companies(short_name, color)")
          .in("id", clientIds)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase
        .from("clients")
        .select("*, companies(short_name, color)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = clients.filter((c) => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: clients.length,
    actif: clients.filter((c) => c.status === "actif").length,
    nouveau_lead: clients.filter((c) => c.status === "nouveau_lead").length,
    relance: clients.filter((c) => c.status === "relance").length,
    inactif: clients.filter((c) => c.status === "inactif").length,
  };

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-5"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="page-header">
        <div>
          <h1 className={`font-semibold tracking-tight ${isMobile ? "text-lg" : "page-title"}`}>Clients</h1>
          {!isMobile && <p className="page-subtitle">{filtered.length} clients · {counts.actif} actifs</p>}
        </div>
        <CreateClientDialog
          trigger={isMobile ? (
            <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-premium-lg">
              <Plus className="h-6 w-6" />
            </Button>
          ) : undefined}
        />
      </motion.div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {([
            { key: "all", label: "Tous" },
            { key: "actif", label: "Actifs" },
            { key: "nouveau_lead", label: "Leads" },
            { key: "relance", label: "Relance" },
            { key: "inactif", label: "Inactifs" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`filter-chip ${statusFilter === key ? "filter-chip-active" : "filter-chip-inactive"}`}
            >
              {label}
              <span className={`ml-1.5 ${statusFilter === key ? "opacity-60" : "opacity-40"}`}>{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className={`w-full rounded-lg ${isMobile ? "h-16" : "h-14"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun client trouvé</p>
          <p className="text-xs mt-1">Modifiez vos filtres ou créez un nouveau client</p>
        </div>
      ) : <ClientList filtered={filtered} isMobile={isMobile} navigate={navigate} />}
    </div>
  );
};

const ClientList = ({ filtered, isMobile, navigate }: { filtered: any[]; isMobile: boolean; navigate: any }) => {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(filtered);

  return isMobile ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
          {visibleItems.map((client) => (
            <div
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="card-interactive rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                  {client.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    {client.code && <span className="text-2xs font-mono text-muted-foreground shrink-0">{client.code}</span>}
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5 text-2xs text-muted-foreground">
                    {client.city && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{client.city}</span>
                      </span>
                    )}
                    {(client.phone || client.mobile) && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Phone className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`badge-status ${statusStyles[client.status] || "bg-muted text-muted-foreground"}`}>
                    {statusLabels[client.status] || client.status}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              </div>
            </div>
          ))}
          <ScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated rounded-xl overflow-hidden">
          <table className="w-full table-premium">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left w-16">Code</th>
                <th className="text-left">Client</th>
                <th className="text-left hidden lg:table-cell">Ville</th>
                <th className="text-left hidden xl:table-cell">Email</th>
                <th className="text-left hidden md:table-cell">Téléphone</th>
                <th className="text-left hidden md:table-cell">Société</th>
                <th className="text-left">Statut</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="cursor-pointer"
                >
                  <td className="font-mono text-xs text-muted-foreground">{client.code || "—"}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                        {client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{client.name}</p>
                        {client.contact_name && <p className="text-xs text-muted-foreground">{client.contact_name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground hidden lg:table-cell">{client.city || "—"}</td>
                  <td className="text-muted-foreground hidden xl:table-cell text-xs">{client.email || "—"}</td>
                  <td className="text-muted-foreground hidden md:table-cell text-xs">{client.phone || client.mobile || "—"}</td>
                  <td className="hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {(client.companies as any)?.short_name || "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-status ${statusStyles[client.status] || ""}`}>
                      {statusLabels[client.status] || client.status}
                    </span>
                  </td>
                  <td>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
};

export default Clients;
