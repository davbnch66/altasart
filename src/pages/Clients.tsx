import { motion } from "framer-motion";
import { Search, Plus, Filter, MoreHorizontal } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

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
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", current],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("*, companies(short_name, color)")
        .order("created_at", { ascending: false });

      if (current !== "global") {
        query = query.eq("company_id", current);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = search
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code?.toLowerCase().includes(search.toLowerCase()) ||
          c.city?.toLowerCase().includes(search.toLowerCase()) ||
          c.contact_name?.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients / Agents</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} clients</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouveau client
        </button>
      </motion.div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par code, nom ou autre..."
            className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtres
        </button>
      </div>

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
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={9}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  Aucun client trouvé
                </td>
              </tr>
            ) : (
              filtered.map((client) => (
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
              ))
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Clients;
