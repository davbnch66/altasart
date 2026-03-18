import { motion } from "framer-motion";
import { ClipboardCheck, MapPin, Camera, Calendar, User, Search, ChevronRight, Plus, ArrowUpDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateVisiteDialog } from "@/components/forms/CreateVisiteDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProgressiveList } from "@/hooks/useProgressiveList";

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
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");

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

  const filtered = useMemo(() => {
    const base = visites.filter((v: any) => {
      const matchSearch = !search || 
        v.title?.toLowerCase().includes(search.toLowerCase()) ||
        v.code?.toLowerCase().includes(search.toLowerCase()) ||
        (v.clients as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.address?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || v.status === statusFilter;
      return matchSearch && matchStatus;
    });

    return [...base].sort((a: any, b: any) => {
      switch (sortBy) {
        case "date_asc":
          return (a.scheduled_date || "").localeCompare(b.scheduled_date || "");
        case "date_desc":
          return (b.scheduled_date || "").localeCompare(a.scheduled_date || "");
        case "client_asc":
          return ((a.clients as any)?.name || "").localeCompare((b.clients as any)?.name || "");
        case "client_desc":
          return ((b.clients as any)?.name || "").localeCompare((a.clients as any)?.name || "");
        case "title_asc":
          return (a.title || "").localeCompare(b.title || "");
        case "title_desc":
          return (b.title || "").localeCompare(a.title || "");
        case "created_desc":
          return (b.created_at || "").localeCompare(a.created_at || "");
        case "created_asc":
          return (a.created_at || "").localeCompare(b.created_at || "");
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        default:
          return 0;
      }
    });
  }, [visites, search, statusFilter, sortBy]);

  const counts = {
    all: visites.length,
    planifiee: visites.filter((v: any) => v.status === "planifiee").length,
    realisee: visites.filter((v: any) => v.status === "realisee").length,
    annulee: visites.filter((v: any) => v.status === "annulee").length,
  };

  return (
    <div className={`max-w-7xl mx-auto animate-fade-in space-y-4 ${isMobile ? "p-3 pb-20" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`page-title ${isMobile ? "!text-lg" : ""}`}>Visites techniques</h1>
          {!isMobile && <p className="page-subtitle">Planification et comptes rendus</p>}
        </div>
        <CreateVisiteDialog
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
          { key: "all", label: "Toutes" },
          { key: "planifiee", label: "Planifiées" },
          { key: "realisee", label: "Réalisées" },
          { key: "annulee", label: "Annulées" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`filter-chip ${
              statusFilter === key
                ? "filter-chip-active"
                : "filter-chip-inactive"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Search + Sort */}
      <div className={`flex gap-2 ${isMobile ? "flex-col" : "items-center"}`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher client, adresse, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className={`h-9 ${isMobile ? "w-full" : "w-[200px]"} shrink-0`}>
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Trier par..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Date ↓ (récent)</SelectItem>
            <SelectItem value="date_asc">Date ↑ (ancien)</SelectItem>
            <SelectItem value="client_asc">Client A→Z</SelectItem>
            <SelectItem value="client_desc">Client Z→A</SelectItem>
            <SelectItem value="title_asc">Titre A→Z</SelectItem>
            <SelectItem value="title_desc">Titre Z→A</SelectItem>
            <SelectItem value="created_desc">Réception ↓</SelectItem>
            <SelectItem value="created_asc">Réception ↑</SelectItem>
            <SelectItem value="status">Statut</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className={`w-full rounded-xl ${isMobile ? "h-20" : "h-24"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Aucune visite trouvée</div>
      ) : (
        <VisiteList filtered={filtered} isMobile={isMobile} navigate={navigate} statusStyle={statusStyle} statusLabels={statusLabels} />
      )}
    </div>
  );
};

const VisiteList = ({ filtered, isMobile, navigate, statusStyle, statusLabels }: any) => {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(filtered);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-3">
      {visibleItems.map((visite: any) => {
        const client = visite.clients as any;
        const tech = visite.resources as any;

        if (isMobile) {
          return (
            <div
              key={visite.id}
              onClick={() => navigate(`/visites/${visite.id}`)}
              className="rounded-xl border bg-card p-3 active:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm break-words">{visite.title}</p>
                    {visite.on_hold && <span className="text-[10px] bg-warning/10 text-warning rounded-full px-1.5 py-0.5 shrink-0">Att.</span>}
                  </div>
                  <p className="text-xs text-muted-foreground break-words">{client?.name || "—"}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {visite.scheduled_date && (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(visite.scheduled_date), "d MMM", { locale: fr })}
                      </span>
                    )}
                    {visite.address && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{visite.address.length > 20 ? visite.address.slice(0, 20) + "…" : visite.address}</span>
                      </span>
                    )}
                    {(visite.photos_count || 0) > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Camera className="h-3 w-3" /> {visite.photos_count}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[visite.status] || "bg-muted text-muted-foreground"}`}>
                    {statusLabels[visite.status] || visite.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          );
        }

        // Desktop card
        return (
          <div
            key={visite.id}
            onClick={() => navigate(`/visites/${visite.id}`)}
            className="card-interactive p-5"
          >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                 <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mt-0.5 shrink-0">
                   <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                 </div>
                 <div className="min-w-0">
                   <div className="flex items-center gap-2 flex-wrap">
                     <p className="font-medium break-words">{visite.title}</p>
                    {visite.code && <span className="text-xs font-mono text-muted-foreground">#{visite.code}</span>}
                    {visite.on_hold && <span className="text-xs bg-warning/10 text-warning rounded-full px-2 py-0.5">En attente</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{client?.name || "—"}</p>
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
      <div ref={sentinelRef} className="flex items-center justify-center py-3">
        {hasMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement…
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Visites;
