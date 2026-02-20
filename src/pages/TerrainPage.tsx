import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  HardHat, CalendarDays, ClipboardCheck, CheckCircle2, Circle,
  MapPin, Clock, ChevronRight, Phone, Camera, FileText, Loader2,
  Wrench, Package, AlertTriangle, Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const todayStr = () => new Date().toISOString().split("T")[0];

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
};

export default function TerrainPage() {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const today = todayStr();
  const userId = user?.id;

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  // Fetch resource_id linked to current user profile
  const { data: myResource } = useQuery({
    queryKey: ["my-resource", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("resources")
        .select("id")
        .eq("linked_profile_id", userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const myResourceId = myResource?.id;

  // BT du jour (opérations assignées à l'utilisateur connecté)
  const { data: bts = [], isLoading: btLoading } = useQuery({
    queryKey: ["terrain-bts", companyIds, today, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select("*, dossiers(title, code, clients(name, phone))")
        .in("company_id", companyIds)
        .eq("loading_date", today)
        .eq("assigned_to", userId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && !!userId,
  });

  // Visites planifiées du jour (assignées à l'utilisateur connecté)
  const { data: visites = [], isLoading: visiteLoading } = useQuery({
    queryKey: ["terrain-visites", companyIds, today, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visites")
        .select("*, clients(name, phone, email)")
        .in("company_id", companyIds)
        .eq("scheduled_date", today)
        .eq("technician_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && !!userId,
  });

  // Planning events du jour (liés à la ressource de l'utilisateur connecté)
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["terrain-events", companyIds, today, myResourceId],
    queryFn: async () => {
      const todayStart = `${today}T00:00:00`;
      const todayEnd = `${today}T23:59:59`;
      const { data, error } = await supabase
        .from("planning_events")
        .select("*, dossiers(title, code)")
        .in("company_id", companyIds)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .eq("resource_id", myResourceId!)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && !!myResourceId,
  });

  // Marquer BT comme complété
  const completeBT = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("operations")
        .update({ completed: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
      toast.success("BT marqué comme terminé");
    },
  });

  const uncompletedBTs = bts.filter((bt: any) => !bt.completed);
  const completedBTs = bts.filter((bt: any) => bt.completed);

  return (
    <div className="max-w-xl mx-auto px-3 pb-24 pt-2 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-0.5">
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Espace Terrain</h1>
        </div>
        <p className="text-xs text-muted-foreground capitalize">{formatDate(today)}</p>
      </motion.div>

      {/* Summary badges */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xl font-bold text-primary">{uncompletedBTs.length}</p>
          <p className="text-[10px] text-muted-foreground">BT restants</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xl font-bold text-info">{visites.length}</p>
          <p className="text-[10px] text-muted-foreground">Visites</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xl font-bold text-warning">{events.length}</p>
          <p className="text-[10px] text-muted-foreground">Événements</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bt">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="bt" className="text-xs">
            <Package className="h-3.5 w-3.5 mr-1" />
            BT ({bts.length})
          </TabsTrigger>
          <TabsTrigger value="visites" className="text-xs">
            <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
            Visites ({visites.length})
          </TabsTrigger>
          <TabsTrigger value="planning" className="text-xs">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            Planning ({events.length})
          </TabsTrigger>
        </TabsList>

        {/* ===== BT Tab ===== */}
        <TabsContent value="bt" className="mt-3 space-y-2">
          {btLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
          ) : bts.length === 0 ? (
            <EmptyState icon={Package} label="Aucun BT prévu aujourd'hui" />
          ) : (
            <>
              {uncompletedBTs.map((bt: any) => (
                <BTCard key={bt.id} bt={bt} onComplete={() => completeBT.mutate(bt.id)} onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)} />
              ))}
              {completedBTs.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground font-medium pt-1">Terminés ({completedBTs.length})</p>
                  {completedBTs.map((bt: any) => (
                    <BTCard key={bt.id} bt={bt} completed onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)} />
                  ))}
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== Visites Tab ===== */}
        <TabsContent value="visites" className="mt-3 space-y-2">
          {visiteLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
          ) : visites.length === 0 ? (
            <EmptyState icon={ClipboardCheck} label="Aucune visite planifiée aujourd'hui" />
          ) : (
            visites.map((visite: any) => (
              <VisiteCard key={visite.id} visite={visite} onNavigate={() => navigate(`/visites/${visite.id}`)} />
            ))
          )}
        </TabsContent>

        {/* ===== Planning Tab ===== */}
        <TabsContent value="planning" className="mt-3 space-y-2">
          {eventsLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : events.length === 0 ? (
            <EmptyState icon={CalendarDays} label="Aucun événement planifié aujourd'hui" />
          ) : (
            events.map((event: any) => (
              <EventCard key={event.id} event={event} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Sub-components =====

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function BTCard({ bt, completed, onComplete, onNavigate }: {
  bt: any; completed?: boolean; onComplete?: () => void; onNavigate: () => void;
}) {
  const client = bt.dossiers?.clients;
  return (
    <div className={`rounded-xl border bg-card p-3 space-y-2 ${completed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {completed
            ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
          }
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{bt.type} #{bt.operation_number}</p>
            <p className="text-xs text-muted-foreground truncate">{bt.dossiers?.code} · {bt.dossiers?.title}</p>
          </div>
        </div>
        <button onClick={onNavigate} className="shrink-0 p-1 hover:bg-muted rounded">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Addresses */}
      <div className="space-y-1">
        {bt.loading_address && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary shrink-0" />
            <span className="truncate"><span className="font-medium text-foreground">Chargement :</span> {bt.loading_address}{bt.loading_city ? `, ${bt.loading_city}` : ""}</span>
          </div>
        )}
        {bt.delivery_address && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-success shrink-0" />
            <span className="truncate"><span className="font-medium text-foreground">Livraison :</span> {bt.delivery_address}{bt.delivery_city ? `, ${bt.delivery_city}` : ""}</span>
          </div>
        )}
      </div>

      {/* Client phone */}
      {client?.phone && (
        <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs text-info">
          <Phone className="h-3 w-3" /> {client.name} — {client.phone}
        </a>
      )}

      {/* BT number */}
      {bt.lv_bt_number && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" /> BT n° {bt.lv_bt_number}
        </div>
      )}

      {/* Volume */}
      {bt.volume > 0 && (
        <p className="text-xs text-muted-foreground">Volume : {bt.volume} m³</p>
      )}

      {/* Notes */}
      {bt.notes && (
        <div className="rounded-lg bg-warning/10 p-2 text-xs text-warning flex items-start gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          {bt.notes}
        </div>
      )}

      {/* Actions */}
      {!completed && onComplete && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-success hover:bg-success/90 text-success-foreground"
            onClick={onComplete}
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Marquer terminé
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onNavigate}
          >
            <Camera className="h-3.5 w-3.5 mr-1" /> Photos
          </Button>
        </div>
      )}
    </div>
  );
}

function VisiteCard({ visite, onNavigate }: { visite: any; onNavigate: () => void }) {
  const client = visite.clients;
  const statusStyles: Record<string, string> = {
    planifiee: "bg-info/10 text-info",
    realisee: "bg-success/10 text-success",
    annulee: "bg-destructive/10 text-destructive",
  };
  const statusLabels: Record<string, string> = {
    planifiee: "Planifiée",
    realisee: "Réalisée",
    annulee: "Annulée",
  };

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{visite.title}</p>
          {client && <p className="text-xs text-muted-foreground truncate">{client.name}</p>}
        </div>
        <Badge className={`text-[10px] shrink-0 ${statusStyles[visite.status] || ""}`}>
          {statusLabels[visite.status] || visite.status}
        </Badge>
      </div>

      {visite.address && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{visite.address}</span>
        </div>
      )}

      {client?.phone && (
        <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs text-info">
          <Phone className="h-3 w-3" /> {client.phone}
        </a>
      )}

      {visite.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{visite.notes}</p>
      )}

      <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={onNavigate}>
        <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Ouvrir la visite
      </Button>
    </div>
  );
}

function EventCard({ event }: { event: any }) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold truncate">{event.title}</p>
        {event.start_time && (
          <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(event.start_time)}
          </span>
        )}
      </div>
      {event.dossiers?.title && (
        <p className="text-xs text-muted-foreground truncate">
          <span className="text-primary">{event.dossiers.code}</span> · {event.dossiers.title}
        </p>
      )}
      {event.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
      )}
    </div>
  );
}
