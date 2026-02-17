import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FolderOpen, Euro, User, GripVertical, ChevronLeft, ChevronRight, LayoutGrid, List, ArrowRight } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const stages = [
  { key: "prospect", label: "Prospect", color: "border-muted-foreground/30 bg-muted/30" },
  { key: "devis", label: "Devis", color: "border-info/30 bg-info/5" },
  { key: "accepte", label: "Accepté", color: "border-success/30 bg-success/5" },
  { key: "planifie", label: "Planifié", color: "border-primary/30 bg-primary/5" },
  { key: "en_cours", label: "En cours", color: "border-warning/30 bg-warning/5" },
  { key: "termine", label: "Terminé", color: "border-success/30 bg-success/5" },
  { key: "facture", label: "Facturé", color: "border-info/30 bg-info/5" },
  { key: "paye", label: "Payé", color: "border-success/30 bg-success/5" },
];

const fmt = (n: number | null) => {
  if (!n) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
};

const PipelineKanban = () => {
  const { current, dbCompanies } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);

  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ["pipeline-dossiers", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("*, clients(name), companies(short_name)")
        .in("company_id", companyIds)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("dossiers").update({ stage: stage as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-dossiers"] });
      toast.success("Dossier déplacé");
      setMovingCardId(null);
    },
  });

  const handleDrop = (stage: string) => {
    if (draggedId) {
      moveMutation.mutate({ id: draggedId, stage });
      setDraggedId(null);
    }
  };

  const handleMoveToStage = (dossierId: string, newStage: string) => {
    moveMutation.mutate({ id: dossierId, stage: newStage });
    setMovingCardId(null);
  };

  // Group by stage
  const grouped: Record<string, any[]> = {};
  for (const s of stages) grouped[s.key] = [];
  for (const d of dossiers) {
    if (grouped[d.stage]) grouped[d.stage].push(d);
    else grouped["prospect"].push(d);
  }

  // Stats per column
  const colStats = stages.map((s) => ({
    ...s,
    count: grouped[s.key].length,
    total: grouped[s.key].reduce((sum: number, d: any) => sum + (d.amount || 0), 0),
  }));

  if (isLoading) {
    return (
      <div className={`max-w-full mx-auto ${isMobile ? "p-3" : "p-6"}`}>
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-96 w-72" />)}
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-full mx-auto ${isMobile ? "p-3 pb-20" : "p-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Pipeline</h1>
          {!isMobile && (
            <p className="text-muted-foreground mt-1">
              {dossiers.length} dossiers — {fmt(dossiers.reduce((s, d) => s + (d.amount || 0), 0))} total
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/dossiers")} className="gap-1.5">
          <List className="h-4 w-4" /> Liste
        </Button>
      </motion.div>

      <div className={`flex gap-3 overflow-x-auto pb-4 ${isMobile ? "-mx-3 px-3" : ""}`} style={{ minHeight: "70vh" }}>
        {colStats.map((col) => (
          <div
            key={col.key}
            className={`flex-shrink-0 rounded-xl border-2 ${col.color} ${isMobile ? "w-[260px]" : "w-[280px]"}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{col.label}</span>
                <span className="text-[10px] bg-background/80 rounded-full px-2 py-0.5 font-medium">{col.count}</span>
              </div>
              {col.total > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(col.total)}</p>
              )}
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[100px]">
              {grouped[col.key].map((d: any) => (
                <div
                  key={d.id}
                  draggable={!isMobile}
                  onDragStart={() => setDraggedId(d.id)}
                  className="rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start gap-2">
                    {!isMobile && (
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground mt-0.5 shrink-0 cursor-grab" />
                    )}
                    <div className="flex-1 min-w-0" onClick={() => navigate(`/dossiers/${d.id}`, { state: { fromPipeline: true } })}>
                      <p className="text-xs font-medium truncate">{d.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground truncate">{(d.clients as any)?.name || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-medium">{fmt(d.amount)}</span>
                        {(d.companies as any)?.short_name && (
                          <span className="text-[9px] bg-muted rounded px-1 py-0.5">{(d.companies as any).short_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile: move stage selector */}
                  {isMobile && (
                    <div className="mt-2 pt-2 border-t">
                      {movingCardId === d.id ? (
                        <div className="flex flex-wrap gap-1">
                          {stages.filter(s => s.key !== d.stage).map((s) => (
                            <button
                              key={s.key}
                              className="text-[9px] rounded-full px-2 py-0.5 border bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleMoveToStage(d.id, s.key); }}
                            >
                              {s.label}
                            </button>
                          ))}
                          <button
                            className="text-[9px] rounded-full px-2 py-0.5 border bg-muted text-muted-foreground"
                            onClick={(e) => { e.stopPropagation(); setMovingCardId(null); }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => { e.stopPropagation(); setMovingCardId(d.id); }}
                        >
                          <ArrowRight className="h-3 w-3" /> Déplacer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelineKanban;
