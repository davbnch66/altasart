import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useMyRole } from "@/hooks/useMyRole";
import { useNavigate } from "react-router-dom";
import {
  HardHat, CalendarDays, ClipboardCheck, CheckCircle2, Circle,
  MapPin, Clock, ChevronRight, Phone, FileText, Send,
  Package, AlertTriangle, Check, ChevronLeft, Pen, Truck, Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SignaturePad } from "@/components/terrain/SignaturePad";
import { BTPhotoUpload } from "@/components/terrain/BTPhotoUpload";
import { generateBTReportPdf } from "@/lib/generateBTReportPdf";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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

const shiftDate = (dateStr: string, days: number) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

type TerrainMode = "vehicle" | "person" | "admin";
type SignatureTarget = { btId: string; type: "start" | "end" } | null;

export default function TerrainPage() {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const { role } = useMyRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [signatureTarget, setSignatureTarget] = useState<SignatureTarget>(null);

  const userId = user?.id;

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  // Determine linked resource and its type
  const { data: myResource } = useQuery({
    queryKey: ["my-resource", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("resources")
        .select("id, type")
        .eq("linked_profile_id", userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  // Determine mode
  const isAdmin = role === "admin" || role === "manager";
  const mode: TerrainMode = isAdmin
    ? "admin"
    : myResource?.type === "vehicule"
      ? "vehicle"
      : "person";

  const dateToUse = isAdmin ? selectedDate : todayStr();

  // ===== DATA QUERIES =====

  // BTs - filtered based on mode
  const { data: bts = [], isLoading: btLoading } = useQuery({
    queryKey: ["terrain-bts", companyIds, dateToUse, userId, mode],
    queryFn: async () => {
      let query = supabase
        .from("operations")
        .select("*, dossiers(title, code, clients(name, phone)), start_signature_url, start_signed_at, start_signer_name, end_signature_url, end_signed_at, end_signer_name")
        .in("company_id", companyIds)
        .eq("loading_date", dateToUse)
        .order("sort_order", { ascending: true });

      // Vehicle & person mode: only assigned to me
      if (mode !== "admin" && userId) {
        query = query.eq("assigned_to", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && !!userId,
  });

  // Visites - only for person & admin modes
  const showVisites = mode === "person" || mode === "admin";
  const { data: visites = [], isLoading: visiteLoading } = useQuery({
    queryKey: ["terrain-visites", companyIds, dateToUse, userId, mode],
    queryFn: async () => {
      let query = supabase
        .from("visites")
        .select("*, clients(name, phone, email)")
        .in("company_id", companyIds)
        .eq("scheduled_date", dateToUse)
        .order("created_at", { ascending: true });

      if (mode === "person" && userId) {
        query = query.eq("technician_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && showVisites && !!userId,
  });

  // Events - only for person & admin modes
  const showEvents = mode === "person" || mode === "admin";
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["terrain-events", companyIds, dateToUse, myResource?.id, mode],
    queryFn: async () => {
      const dayStart = `${dateToUse}T00:00:00`;
      const dayEnd = `${dateToUse}T23:59:59`;
      let query = supabase
        .from("planning_events")
        .select("*, dossiers(title, code)")
        .in("company_id", companyIds)
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .order("start_time", { ascending: true });

      if (mode === "person" && myResource?.id) {
        query = query.eq("resource_id", myResource.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && showEvents && (mode === "admin" || !!myResource?.id),
  });

  // ===== MUTATIONS =====

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

  const saveSignature = useMutation({
    mutationFn: async ({ btId, type, dataUrl }: { btId: string; type: "start" | "end"; dataUrl: string }) => {
      const updates = type === "start"
        ? { start_signature_url: dataUrl, start_signed_at: new Date().toISOString() }
        : { end_signature_url: dataUrl, end_signed_at: new Date().toISOString(), completed: true };

      const { error } = await supabase
        .from("operations")
        .update(updates)
        .eq("id", btId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
      toast.success(vars.type === "start" ? "Signature de début enregistrée" : "Signature de fin enregistrée — BT terminé");
      setSignatureTarget(null);
    },
  });

  const handleSignatureSave = useCallback((dataUrl: string) => {
    if (!signatureTarget) return;
    saveSignature.mutate({ btId: signatureTarget.btId, type: signatureTarget.type, dataUrl });
  }, [signatureTarget, saveSignature]);

  const [sendingReport, setSendingReport] = useState<string | null>(null);

  const handlePhotosChange = useCallback((btId: string, photos: string[]) => {
    queryClient.setQueryData(["terrain-bts", companyIds, dateToUse, userId, mode], (old: any[]) =>
      old?.map((bt: any) => bt.id === btId ? { ...bt, photos } : bt) || []
    );
  }, [queryClient, companyIds, dateToUse, userId, mode]);

  const handleSendReport = useCallback(async (btId: string) => {
    setSendingReport(btId);
    try {
      const { pdfBase64, fileName, clientEmail } = await generateBTReportPdf(btId);
      if (!clientEmail) {
        toast.error("Aucun email client trouvé pour ce dossier");
        return;
      }

      const { data: companyData } = await supabase.from("companies").select("name").in("id", companyIds).limit(1).single();

      const { error } = await supabase.functions.invoke("send-bt-report", {
        body: { to: clientEmail, pdfBase64, fileName, operationId: btId, companyName: companyData?.name || "" },
      });
      if (error) throw error;
      toast.success(`Rapport envoyé à ${clientEmail}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'envoi du rapport");
    } finally {
      setSendingReport(null);
    }
  }, [companyIds]);

  const uncompletedBTs = bts.filter((bt: any) => !bt.completed);
  const completedBTs = bts.filter((bt: any) => bt.completed);

  // Mode label
  const modeLabels: Record<TerrainMode, string> = {
    vehicle: "Mode Véhicule",
    person: "Mode Personnel",
    admin: "Mode Admin",
  };
  const modeIcons: Record<TerrainMode, React.ReactNode> = {
    vehicle: <Truck className="h-4 w-4 text-primary" />,
    person: <HardHat className="h-4 w-4 text-primary" />,
    admin: <HardHat className="h-4 w-4 text-primary" />,
  };

  // Signature overlay
  if (signatureTarget) {
    return (
      <SignaturePad
        title={signatureTarget.type === "start" ? "Signature début de chantier" : "Signature fin de chantier"}
        signerLabel="Nom du client"
        onSave={handleSignatureSave}
        onCancel={() => setSignatureTarget(null)}
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto px-3 pb-24 pt-2 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <div className="flex items-center gap-2">
          {modeIcons[mode]}
          <h1 className="text-lg font-bold">Espace Terrain</h1>
          <Badge variant="secondary" className="text-[10px] ml-auto">{modeLabels[mode]}</Badge>
        </div>

        {/* Date navigation for admin */}
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setSelectedDate(todayStr())}
              className={`text-xs capitalize flex-1 text-center ${selectedDate === todayStr() ? "font-bold text-primary" : "text-muted-foreground"}`}
            >
              {formatDate(selectedDate)}
              {selectedDate !== todayStr() && (
                <span className="block text-[10px] text-primary">↩ Revenir à aujourd'hui</span>
              )}
            </button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground capitalize">{formatDate(dateToUse)}</p>
        )}
      </motion.div>

      {/* Summary badges */}
      <div className={`grid gap-2 ${showVisites ? "grid-cols-3" : "grid-cols-1"}`}>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xl font-bold text-primary">{uncompletedBTs.length}</p>
          <p className="text-[10px] text-muted-foreground">BT restants</p>
        </div>
        {showVisites && (
          <div className="rounded-xl border bg-card p-3 text-center">
            <p className="text-xl font-bold text-info">{visites.length}</p>
            <p className="text-[10px] text-muted-foreground">Visites</p>
          </div>
        )}
        {showEvents && (
          <div className="rounded-xl border bg-card p-3 text-center">
            <p className="text-xl font-bold text-warning">{events.length}</p>
            <p className="text-[10px] text-muted-foreground">Événements</p>
          </div>
        )}
      </div>

      {/* Content */}
      {mode === "vehicle" ? (
        // VEHICLE MODE: Only BTs, no tabs
        <div className="space-y-2">
          {btLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
          ) : bts.length === 0 ? (
            <EmptyState icon={Package} label="Aucun BT assigné aujourd'hui" />
          ) : (
            <>
              {uncompletedBTs.map((bt: any) => (
                <BTCard
                  key={bt.id}
                  bt={bt}
                  showSignature
                  onComplete={() => completeBT.mutate(bt.id)}
                  onSignStart={() => setSignatureTarget({ btId: bt.id, type: "start" })}
                  onSignEnd={() => setSignatureTarget({ btId: bt.id, type: "end" })}
                  onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)}
                  onPhotosChange={(photos) => handlePhotosChange(bt.id, photos)}
                />
              ))}
              {completedBTs.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground font-medium pt-2">Terminés ({completedBTs.length})</p>
                  {completedBTs.map((bt: any) => (
                    <BTCard key={bt.id} bt={bt} completed showSignature onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)} onPhotosChange={(photos) => handlePhotosChange(bt.id, photos)} onSendReport={() => handleSendReport(bt.id)} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      ) : (
        // PERSON & ADMIN MODES: Tabs
        <Tabs defaultValue="bt">
          <TabsList className={`w-full grid ${showVisites && showEvents ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="bt" className="text-xs">
              <Package className="h-3.5 w-3.5 mr-1" />
              BT ({bts.length})
            </TabsTrigger>
            {showVisites && (
              <TabsTrigger value="visites" className="text-xs">
                <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                Visites ({visites.length})
              </TabsTrigger>
            )}
            {showEvents && (
              <TabsTrigger value="planning" className="text-xs">
                <CalendarDays className="h-3.5 w-3.5 mr-1" />
                Planning ({events.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="bt" className="mt-3 space-y-2">
            {btLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
            ) : bts.length === 0 ? (
              <EmptyState icon={Package} label="Aucun BT prévu" />
            ) : (
              <>
                {uncompletedBTs.map((bt: any) => (
                  <BTCard
                    key={bt.id}
                    bt={bt}
                    showSignature={mode === "person"}
                    onComplete={() => completeBT.mutate(bt.id)}
                    onSignStart={() => setSignatureTarget({ btId: bt.id, type: "start" })}
                    onSignEnd={() => setSignatureTarget({ btId: bt.id, type: "end" })}
                    onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)}
                    onPhotosChange={(photos) => handlePhotosChange(bt.id, photos)}
                  />
                ))}
                {completedBTs.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium pt-1">Terminés ({completedBTs.length})</p>
                    {completedBTs.map((bt: any) => (
                      <BTCard key={bt.id} bt={bt} completed showSignature={mode === "person"} onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)} onPhotosChange={(photos) => handlePhotosChange(bt.id, photos)} onSendReport={() => handleSendReport(bt.id)} />
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>

          {showVisites && (
            <TabsContent value="visites" className="mt-3 space-y-2">
              {visiteLoading ? (
                <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
              ) : visites.length === 0 ? (
                <EmptyState icon={ClipboardCheck} label="Aucune visite planifiée" />
              ) : (
                visites.map((visite: any) => (
                  <VisiteCard key={visite.id} visite={visite} onNavigate={() => navigate(`/visites/${visite.id}`)} />
                ))
              )}
            </TabsContent>
          )}

          {showEvents && (
            <TabsContent value="planning" className="mt-3 space-y-2">
              {eventsLoading ? (
                <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
              ) : events.length === 0 ? (
                <EmptyState icon={CalendarDays} label="Aucun événement planifié" />
              ) : (
                events.map((event: any) => (
                  <EventCard key={event.id} event={event} />
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      )}
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

function BTCard({ bt, completed, showSignature, onComplete, onSignStart, onSignEnd, onNavigate, onPhotosChange, onSendReport }: {
  bt: any; completed?: boolean; showSignature?: boolean;
  onComplete?: () => void; onSignStart?: () => void; onSignEnd?: () => void;
  onNavigate: () => void;
  onPhotosChange?: (photos: string[]) => void;
  onSendReport?: () => void;
}) {
  const client = bt.dossiers?.clients;
  const hasStartSig = !!bt.start_signature_url;
  const hasEndSig = !!bt.end_signature_url;
  const photos: string[] = bt.photos || [];

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

      {/* Signature status */}
      {showSignature && (
        <div className="flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1 ${hasStartSig ? "text-success" : "text-muted-foreground"}`}>
            <Pen className="h-3 w-3" />
            Début : {hasStartSig ? "✓ Signé" : "En attente"}
          </span>
          <span className={`flex items-center gap-1 ${hasEndSig ? "text-success" : "text-muted-foreground"}`}>
            <Pen className="h-3 w-3" />
            Fin : {hasEndSig ? "✓ Signé" : "En attente"}
          </span>
        </div>
      )}

      {/* Photos - always available, even after completion */}
      {onPhotosChange && (
        <BTPhotoUpload btId={bt.id} photos={photos} onPhotosChange={onPhotosChange} />
      )}

      {/* Actions */}
      {!completed && (
        <div className="flex flex-wrap gap-2 pt-1">
          {showSignature && !hasStartSig && onSignStart && (
            <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={onSignStart}>
              <Pen className="h-3.5 w-3.5 mr-1" /> Signer début
            </Button>
          )}
          {showSignature && hasStartSig && !hasEndSig && onSignEnd && (
            <Button size="sm" className="h-8 text-xs flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={onSignEnd}>
              <Pen className="h-3.5 w-3.5 mr-1" /> Signer fin
            </Button>
          )}
          {!showSignature && onComplete && (
            <Button size="sm" className="flex-1 h-8 text-xs bg-success hover:bg-success/90 text-success-foreground" onClick={onComplete}>
              <Check className="h-3.5 w-3.5 mr-1" /> Marquer terminé
            </Button>
          )}
        </div>
      )}

      {/* Send report - available when completed (end signature done) */}
      {completed && onSendReport && (
        <Button size="sm" className="w-full h-8 text-xs" onClick={onSendReport}>
          <Send className="h-3.5 w-3.5 mr-1" /> Envoyer rapport au client
        </Button>
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
