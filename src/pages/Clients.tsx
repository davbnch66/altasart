import { motion } from "framer-motion";
import { Search, MoreHorizontal, Users, Phone, MapPin, ChevronRight, Plus } from "lucide-react";
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

const statusLabels: Record<string, string> = {
  nouveau_lead: "Nouveau lead",
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
        // Get client IDs linked to the selected company via junction table
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
    <div className={`max-w-7xl mx-auto space-y-4 ${isMobile ? "p-3 pb-20" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Clients / Agents</h1>
          {!isMobile && <p className="text-muted-foreground mt-1">{filtered.length} clients</p>}
        </div>
        <CreateClientDialog
          trigger={isMobile ? (
            <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          ) : undefined}
        />
      </motion.div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
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
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par code, nom, ville..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className={`w-full rounded-xl ${isMobile ? "h-20" : "h-14"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Aucun client trouvé</div>
      ) : isMobile ? (
        /* Mobile cards */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-3">
          {filtered.map((client) => (
            <div
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="rounded-xl border bg-card p-3 active:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    {client.code && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{client.code}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {client.city && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{client.city}</span>
                      </span>
                    )}
                    {(client.phone || client.mobile) && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Phone className="h-3 w-3" />
                        {(client.mobile || client.phone || "").replace(/\s/g, "").slice(-4)}
                      </span>
                    )}
                    {(client.companies as any)?.short_name && (
                      <span className="shrink-0">{(client.companies as any).short_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[client.status] || "bg-muted text-muted-foreground"}`}>
                    {statusLabels[client.status] || client.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      ) : (
        /* Desktop table */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-4 py-3 w-16">Code</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Nom</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell w-16">CP</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Ville</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">Email</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Téléphone</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Société</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{client.code || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground lg:hidden">{client.city}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{client.postal_code || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{client.city || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell text-xs">{client.email || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{client.phone || client.mobile || "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {(client.companies as any)?.short_name || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[client.status] || ""}`}>
                      {statusLabels[client.status] || client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-muted transition-colors">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
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
