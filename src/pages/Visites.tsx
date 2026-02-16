import { motion } from "framer-motion";
import { ClipboardCheck, Plus, MapPin, Camera, Calendar, Clock, User, Search, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateVisiteDialog } from "@/components/forms/CreateVisiteDialog";

const statusLabels: Record<string, string> = {
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
};

const statusStyle: Record<string, string> = {
  planifiee: "bg-info/10 text-info",
  realisee: "bg-success/10 text-success",
  annulee: "bg-destructive/10 text-destructive",
};

const Visites = () => {
  const { current, dbCompanies } = useCompany();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: visites = [], isLoading } = useQuery({
    queryKey: ["visites", current],
    queryFn: async () => {
      let q = supabase
        .from("visites")
        .select("*, clients(id, name, code), resources:technician_id(name)")
        .order("scheduled_date", { ascending: false });
      if (current !== "global") {
        q = q.eq("company_id", current);
      } else {
        const ids = dbCompanies.map((c) => c.id);
        q = q.in("company_id", ids);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const filtered = visites.filter((v: any) => {
    const matchSearch = !search || 
      v.title?.toLowerCase().includes(search.toLowerCase()) ||
      v.code?.toLowerCase().includes(search.toLowerCase()) ||
      (v.clients as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visites techniques</h1>
          <p className="text-muted-foreground mt-1">Planification et comptes rendus</p>
        </div>
        <CreateVisiteDialog />
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="all">Tous les statuts</option>
          <option value="planifiee">Planifiée</option>
          <option value="realisee">Réalisée</option>
          <option value="annulee">Annulée</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Aucune visite trouvée</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-4">
          {filtered.map((visite: any) => {
            const client = visite.clients as any;
            const tech = visite.resources as any;
            return (
              <div
                key={visite.id}
                onClick={() => navigate(`/visites/${visite.id}`)}
                className="rounded-xl border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                      <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{visite.title}</p>
                        {visite.code && <span className="text-xs font-mono text-muted-foreground">#{visite.code}</span>}
                        {visite.on_hold && <span className="text-xs bg-warning/10 text-warning rounded-full px-2 py-0.5">En attente</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{client?.name || "—"}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {visite.address && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {visite.address}</span>
                        )}
                        {visite.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(visite.scheduled_date), "d MMM yyyy", { locale: fr })}
                            {visite.scheduled_time && ` à ${visite.scheduled_time.slice(0, 5)}`}
                          </span>
                        )}
                        {visite.zone && (
                          <span className="flex items-center gap-1">Zone: {visite.zone}</span>
                        )}
                        {tech?.name && (
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {tech.name}</span>
                        )}
                        {visite.volume > 0 && (
                          <span>{visite.volume} m³</span>
                        )}
                        <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> {visite.photos_count || 0} photos</span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[visite.status] || "bg-muted text-muted-foreground"}`}>
                    {statusLabels[visite.status] || visite.status}
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default Visites;
