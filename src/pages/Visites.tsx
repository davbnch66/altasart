import { motion, AnimatePresence } from "framer-motion";
import { ClipboardCheck, MapPin, Camera, Calendar, User, Search, Plus, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useCallback, useRef } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateVisiteDialog } from "@/components/forms/CreateVisiteDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────
const statusLabels: Record<string, string> = {
  planifiee: "Planifiées",
  realisee: "Réalisées",
  annulee: "Annulées",
};

const statusColors: Record<string, { bg: string; text: string; dot: string; headerBg: string }> = {
  planifiee: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", headerBg: "bg-blue-100/80 dark:bg-blue-900/40" },
  realisee: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", headerBg: "bg-emerald-100/80 dark:bg-emerald-900/40" },
  annulee: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", dot: "bg-red-500", headerBg: "bg-red-100/80 dark:bg-red-900/40" },
};

const statusEmojis: Record<string, string> = {
  planifiee: "🔵",
  realisee: "🟢",
  annulee: "🔴",
};

type PeriodFilter = "all" | "week" | "month";

// ─── Main Page ──────────────────────────────────────────
const Visites = () => {
  const { current, dbCompanies } = useCompany();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [techFilter, setTechFilter] = useState<string>("all");

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

  // Extract unique technicians
  const technicians = useMemo(() => {
    const map = new Map<string, string>();
    visites.forEach((v: any) => {
      const tech = v.resources as any;
      if (tech?.name && v.technician_id) {
        map.set(v.technician_id, tech.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [visites]);

  // Filter logic
  const filtered = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { locale: fr });
    const weekEnd = endOfWeek(now, { locale: fr });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return visites.filter((v: any) => {
      // Status
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      // Technician
      if (techFilter !== "all" && v.technician_id !== techFilter) return false;
      // Search
      if (search) {
        const s = search.toLowerCase();
        const matchClient = (v.clients as any)?.name?.toLowerCase().includes(s);
        const matchAddr = v.address?.toLowerCase().includes(s);
        const matchTitle = v.title?.toLowerCase().includes(s);
        const matchCode = v.code?.toLowerCase().includes(s);
        if (!matchClient && !matchAddr && !matchTitle && !matchCode) return false;
      }
      // Period
      if (periodFilter !== "all" && v.scheduled_date) {
        const d = new Date(v.scheduled_date);
        if (periodFilter === "week" && (d < weekStart || d > weekEnd)) return false;
        if (periodFilter === "month" && (d < monthStart || d > monthEnd)) return false;
      }
      return true;
    });
  }, [visites, search, statusFilter, periodFilter, techFilter]);

  const counts = useMemo(() => ({
    all: filtered.length,
    planifiee: filtered.filter((v: any) => v.status === "planifiee").length,
    realisee: filtered.filter((v: any) => v.status === "realisee").length,
    annulee: filtered.filter((v: any) => v.status === "annulee").length,
  }), [filtered]);

  const allFiltersDefault = statusFilter === "all" && periodFilter === "all" && techFilter === "all" && !search;

  return (
    <div className={`max-w-[1400px] mx-auto animate-fade-in ${isMobile ? "p-3 pb-24" : "p-6 lg:p-8"}`}>
      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Visites</h1>
          <span className="text-sm text-muted-foreground">{visites.length} visite{visites.length !== 1 ? "s" : ""}</span>
        </div>
        <CreateVisiteDialog
          trigger={
            isMobile ? (
              <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg bg-success hover:bg-success/90 text-white">
                <Plus className="h-6 w-6" />
              </Button>
            ) : (
              <Button className="bg-success hover:bg-success/90 text-white gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle visite
              </Button>
            )
          }
        />
      </motion.div>

      {/* ─── Filters ─── */}
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className={`flex gap-2 mb-5 ${isMobile ? "flex-col" : "items-center flex-wrap"}`}
      >
        {/* Status pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { key: "all", label: "Toutes" },
            { key: "planifiee", label: "Planifiées" },
            { key: "realisee", label: "Réalisées" },
            { key: "annulee", label: "Annulées" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
              <span className="ml-1 opacity-70">
                {key === "all" ? filtered.length : counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Period pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { key: "all" as PeriodFilter, label: "Tout" },
            { key: "week" as PeriodFilter, label: "Cette semaine" },
            { key: "month" as PeriodFilter, label: "Ce mois" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodFilter(key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                periodFilter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={`flex gap-2 ${isMobile ? "w-full" : "ml-auto"}`}>
          {/* Technician filter */}
          {technicians.length > 0 && (
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className={`h-9 text-xs ${isMobile ? "flex-1" : "w-[180px]"}`}>
                <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Technicien" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les techniciens</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search */}
          <div className={`relative ${isMobile ? "flex-1" : "w-[260px]"}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client, une adresse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </motion.div>

      {/* ─── Content ─── */}
      {isLoading ? (
        <LoadingSkeleton isMobile={isMobile} />
      ) : filtered.length === 0 ? (
        <EmptyState allFiltersDefault={allFiltersDefault} />
      ) : isMobile ? (
        <MobileVisiteList filtered={filtered} navigate={navigate} />
      ) : (
        <KanbanView filtered={filtered} counts={counts} navigate={navigate} />
      )}
    </div>
  );
};

// ─── Loading Skeleton ───────────────────────────────────
const LoadingSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className={isMobile ? "space-y-3" : "grid grid-cols-3 gap-5"}>
    {[1, 2, 3].map((i) => (
      <div key={i} className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

// ─── Empty State ────────────────────────────────────────
const EmptyState = ({ allFiltersDefault }: { allFiltersDefault: boolean }) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-20 text-center"
  >
    <div className="h-16 w-16 rounded-2xl bg-muted/80 flex items-center justify-center mb-4">
      <ClipboardCheck className="h-8 w-8 text-muted-foreground/60" />
    </div>
    <p className="text-lg font-medium text-muted-foreground mb-1">Aucune visite trouvée</p>
    <p className="text-sm text-muted-foreground/70 mb-4">
      {allFiltersDefault ? "Commencez par créer votre première visite" : "Essayez de modifier vos filtres"}
    </p>
    {allFiltersDefault && (
      <CreateVisiteDialog
        trigger={
          <Button className="bg-success hover:bg-success/90 text-white gap-2">
            <Plus className="h-4 w-4" />
            Créer une visite
          </Button>
        }
      />
    )}
  </motion.div>
);

// ─── Kanban Desktop View ────────────────────────────────
const KanbanView = ({ filtered, counts, navigate }: {
  filtered: any[];
  counts: Record<string, number>;
  navigate: (path: string) => void;
}) => {
  const columns: Array<{ status: string; label: string }> = [
    { status: "planifiee", label: "Planifiées" },
    { status: "realisee", label: "Réalisées" },
    { status: "annulee", label: "Annulées" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
      className="grid grid-cols-3 gap-5"
    >
      {columns.map(({ status, label }) => {
        const items = filtered.filter((v: any) => v.status === status);
        const colors = statusColors[status];
        return (
          <KanbanColumn key={status} status={status} label={label} items={items} count={counts[status]} colors={colors} navigate={navigate} />
        );
      })}
    </motion.div>
  );
};

const KanbanColumn = ({ status, label, items, count, colors, navigate }: {
  status: string; label: string; items: any[]; count: number;
  colors: typeof statusColors["planifiee"]; navigate: (path: string) => void;
}) => {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(items);

  return (
    <div className="flex flex-col rounded-xl border bg-card/50 overflow-hidden">
      {/* Column header */}
      <div className={`flex items-center justify-between px-4 py-3 ${colors.headerBg}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{statusEmojis[status]}</span>
          <span className={`text-sm font-semibold ${colors.text}`}>{label}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[calc(100vh-280px)]">
        <AnimatePresence>
          {visibleItems.map((visite: any) => (
            <KanbanCard key={visite.id} visite={visite} colors={colors} navigate={navigate} />
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-8">Aucune visite</p>
        )}

        <div ref={sentinelRef} className="flex items-center justify-center py-2">
          {hasMore && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
};

const KanbanCard = ({ visite, colors, navigate }: {
  visite: any;
  colors: typeof statusColors["planifiee"];
  navigate: (path: string) => void;
}) => {
  const client = visite.clients as any;
  const tech = visite.resources as any;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={() => navigate(`/visites/${visite.id}`)}
      className="rounded-xl border bg-card p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <p className="font-semibold text-sm leading-snug mb-1 group-hover:text-primary transition-colors">
        {client?.name || "—"}
      </p>
      {visite.address && (
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mb-2">
          <MapPin className="h-3 w-3 shrink-0" />
          {visite.address}
        </p>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2.5">
          {visite.scheduled_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(visite.scheduled_date), "d MMM", { locale: fr })}
            </span>
          )}
          {tech?.name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {tech.name}
            </span>
          )}
        </div>
        {(visite.photos_count || 0) > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground/80">
            <Camera className="h-3 w-3" />
            {visite.photos_count}
          </span>
        )}
      </div>
    </motion.div>
  );
};

// ─── Mobile List View ───────────────────────────────────
const MobileVisiteList = ({ filtered, navigate }: {
  filtered: any[];
  navigate: (path: string) => void;
}) => {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(filtered);

  return (
    <div className="space-y-2">
      {visibleItems.map((visite: any) => (
        <MobileCard key={visite.id} visite={visite} navigate={navigate} />
      ))}
      <div ref={sentinelRef} className="flex items-center justify-center py-3">
        {hasMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement…
          </div>
        )}
      </div>
    </div>
  );
};

const MobileCard = ({ visite, navigate }: { visite: any; navigate: (path: string) => void }) => {
  const client = visite.clients as any;
  const tech = visite.resources as any;
  const colors = statusColors[visite.status] || statusColors.planifiee;
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStatusChange = useCallback(async (newStatus: "planifiee" | "realisee" | "annulee") => {
    const { error } = await supabase
      .from("visites")
      .update({ status: newStatus })
      .eq("id", visite.id);
    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(`Visite marquée comme ${statusLabels[newStatus]?.toLowerCase() || newStatus}`);
    }
  }, [visite.id]);

  const onPointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
    }, 500);
  }, []);

  const onPointerUpOrLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <div
          onClick={() => { if (!menuOpen) navigate(`/visites/${visite.id}`); }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUpOrLeave}
          onPointerLeave={onPointerUpOrLeave}
          className="rounded-2xl border bg-card p-4 mb-2 active:bg-muted/30 transition-colors cursor-pointer select-none"
        >
          {/* Row 1: Client name + status badge */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-base font-semibold truncate">{client?.name || "—"}</p>
            <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
              {statusLabels[visite.status] || visite.status}
            </span>
          </div>

          {/* Row 2: Address */}
          {visite.address && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {visite.address}
            </p>
          )}

          {/* Row 3: Date + Tech */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-0.5">
            {visite.scheduled_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(visite.scheduled_date), "d MMM", { locale: fr })}
              </span>
            )}
            {tech?.name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {tech.name}
              </span>
            )}
          </div>

          {/* Row 4: Photos count */}
          {(visite.photos_count || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3 w-3" /> {visite.photos_count} photo{visite.photos_count > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleStatusChange("realisee")} className="text-emerald-600">
          ✓ Marquer Réalisée
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("annulee")} className="text-destructive">
          ✕ Annuler la visite
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Visites;
