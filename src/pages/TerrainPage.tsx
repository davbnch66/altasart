import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Fuel, Wrench, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useMyRole } from "@/hooks/useMyRole";
import { useNavigate } from "react-router-dom";
import {
  HardHat, CalendarDays, ClipboardCheck, CheckCircle2, Circle,
  MapPin, Clock, ChevronRight, Phone, FileText, Send, Eye,
  Package, AlertTriangle, Check, ChevronLeft, Pen, Truck, Loader2, RotateCcw, Camera, WifiOff, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SignaturePad } from "@/components/terrain/SignaturePad";
import { BTPhotoUpload } from "@/components/terrain/BTPhotoUpload";
import { BTCommentField } from "@/components/terrain/BTCommentField";
import { BTReportPreviewDialog } from "@/components/terrain/BTReportPreviewDialog";
import { VehicleExpenseDialog } from "@/components/terrain/VehicleExpenseDialog";
import { Receipt } from "lucide-react";
import { PlanningOperationDialog } from "@/components/planning/PlanningOperationDialog";
import { ARPhotoOverlay } from "@/components/ar/ARPhotoOverlay";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cacheOperations, getCachedOperations, syncPendingData, getPendingUpdates, getPendingPhotos } from "@/lib/offlineTerrainDB";

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
type SignatureTarget = { btId: string; type: "start" | "end" | "operator" } | null;

export default function TerrainPage() {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const { role } = useMyRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { permission, subscribed, subscribe: subscribePush } = usePushNotifications();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [signatureTarget, setSignatureTarget] = useState<SignatureTarget>(null);
  const [activeTerrainTab, setActiveTerrainTab] = useState("bt");
  const isOnline = useOnlineStatus();
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

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
        .select("id, type, resource_companies(company_id)")
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

  // Fetch personnel resources for operator signature dropdown
  const { data: personnelResources = [] } = useQuery({
    queryKey: ["terrain-personnel", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("resource_companies")
        .select("resource_id, resources!inner(id, name, type)")
        .in("company_id", companyIds)
        .in("resources.type", ["employe", "equipe"]);
      return (data || []).map((rc: any) => ({ id: rc.resources.id, name: rc.resources.name }));
    },
    enabled: companyIds.length > 0,
  });

  // ===== DATA QUERIES =====

  const { data: bts = [], isLoading: btLoading } = useQuery({
    queryKey: ["terrain-bts", companyIds, dateToUse, userId, mode, myResource?.id],
    queryFn: async () => {
      if (mode !== "admin" && myResource?.id) {
        const { data: linkedOps } = await supabase
          .from("operation_resources")
          .select("operation_id")
          .eq("resource_id", myResource.id);
        
        const opIds = (linkedOps || []).map((lo: any) => lo.operation_id);
        
        if (opIds.length === 0) {
          const { data, error } = await supabase
            .from("operations")
            .select("*, dossiers(title, code, clients(name, phone))")
            .in("company_id", companyIds)
            .eq("loading_date", dateToUse)
            .eq("assigned_to", userId!)
            .order("sort_order", { ascending: true });
          if (error) throw error;
          return data || [];
        }

        const { data, error } = await supabase
          .from("operations")
          .select("*, dossiers(title, code, clients(name, phone))")
          .in("id", opIds)
          .eq("loading_date", dateToUse)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        return data || [];
      }

      const { data, error } = await supabase
        .from("operations")
        .select("*, dossiers(title, code, clients(name, phone))")
        .in("company_id", companyIds)
        .eq("loading_date", dateToUse)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && !!userId,
  });

  // Cache BTs for offline and check pending sync count
  useEffect(() => {
    if (bts.length > 0 && isOnline) {
      cacheOperations(bts).catch(() => {});
    }
  }, [bts, isOnline]);

  useEffect(() => {
    Promise.all([getPendingUpdates(), getPendingPhotos()]).then(([u, p]) => {
      setPendingSyncCount(u.length + p.length);
    });
  }, [bts]);

  const handleOfflineSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncPendingData(supabase);
      if (result.updates + result.photos > 0) {
        toast.success(`${result.updates} mise(s) à jour + ${result.photos} photo(s) synchronisée(s)`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} erreur(s) de sync`);
      }
      setPendingSyncCount(0);
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
    } catch {
      toast.error("Erreur de synchronisation");
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient]);

  const { data: recentExpenses = [] } = useQuery({
    queryKey: ["terrain-vehicle-expenses", myResource?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_expenses")
        .select("*")
        .eq("resource_id", myResource!.id)
        .order("expense_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!myResource?.id && mode === "vehicle",
  });

  const EXPENSE_ICONS: Record<string, React.ElementType> = {
    gasoil: Fuel, entretien: Wrench, reparation: Wrench,
  };
  const fmtCurrency = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

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

  // ===== REALTIME PUSH FOR BT CHANGES =====
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("bt-changes-push")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "operations" },
        async (payload) => {
          const op = payload.new as any;
          if (op.loading_date === todayStr() && document.hidden) {
            await supabase.functions.invoke("send-push-notification", {
              body: {
                user_id: userId,
                title: "📋 Mission mise à jour",
                body: `BT ${op.lv_bt_number || op.operation_number} — ${op.loading_city || ""}`,
                link: "/terrain",
              },
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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
    mutationFn: async ({ btId, type, dataUrl, signerName }: { btId: string; type: "start" | "end" | "operator"; dataUrl: string; signerName?: string }) => {
      const updates = type === "operator"
        ? { operator_signature_url: dataUrl, operator_signer_name: signerName || null, operator_signed_at: new Date().toISOString() }
        : type === "start"
          ? { start_signature_url: dataUrl, start_signed_at: new Date().toISOString(), start_signer_name: signerName || null }
          : { end_signature_url: dataUrl, end_signed_at: new Date().toISOString(), end_signer_name: signerName || null, completed: true };

      const { error } = await supabase
        .from("operations")
        .update(updates)
        .eq("id", btId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
      const msgs: Record<string, string> = {
        operator: "Signature opérateur enregistrée",
        start: "Signature de début enregistrée",
        end: "Signature de fin enregistrée — BT terminé",
      };
      toast.success(msgs[vars.type]);
      setSignatureTarget(null);
    },
  });

  const handleSignatureSave = useCallback((dataUrl: string, signerName?: string) => {
    if (!signatureTarget) return;
    saveSignature.mutate({ btId: signatureTarget.btId, type: signatureTarget.type, dataUrl, signerName });
  }, [signatureTarget, saveSignature]);

  const resetSignature = useMutation({
    mutationFn: async ({ btId, type }: { btId: string; type: "operator" | "start" | "end" }) => {
      const updates: Record<string, any> = type === "operator"
        ? { operator_signature_url: null, operator_signer_name: null, operator_signed_at: null }
        : type === "start"
          ? { start_signature_url: null, start_signer_name: null, start_signed_at: null }
          : { end_signature_url: null, end_signer_name: null, end_signed_at: null, completed: false };
      const { error } = await supabase.from("operations").update(updates).eq("id", btId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
      toast.success("Signature réinitialisée");
    },
  });

  const [reportBtId, setReportBtId] = useState<string | null>(null);
  const [editBtId, setEditBtId] = useState<string | null>(null);
  const [showAR, setShowAR] = useState(false);

  const handlePhotosChange = useCallback((btId: string, photos: string[]) => {
    queryClient.setQueryData(["terrain-bts", companyIds, dateToUse, userId, mode], (old: any[]) =>
      old?.map((bt: any) => bt.id === btId ? { ...bt, photos } : bt) || []
    );
  }, [queryClient, companyIds, dateToUse, userId, mode]);

  const uncompletedBTs = bts.filter((bt: any) => !bt.completed);
  const completedBTs = bts.filter((bt: any) => bt.completed);

  // Signature overlay
  if (signatureTarget) {
    const isOperator = signatureTarget.type === "operator";
    return (
      <SignaturePad
        title={isOperator ? "Signature opérateur" : signatureTarget.type === "start" ? "Signature début de chantier" : "Signature fin de chantier"}
        signerLabel={isOperator ? "Nom de l'opérateur" : "Nom du client"}
        signerOptions={isOperator ? personnelResources : undefined}
        onSave={handleSignatureSave}
        onCancel={() => setSignatureTarget(null)}
      />
    );
  }

  const renderBTList = () => {
    if (btLoading) {
      return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>;
    }
    if (bts.length === 0) {
      return <EmptyState icon={Package} label="Aucun BT prévu" />;
    }
    return (
      <>
        {uncompletedBTs.map((bt: any) => (
          <BTCard
            key={bt.id}
            bt={bt}
            showSignature
            onComplete={() => completeBT.mutate(bt.id)}
            onSignOperator={() => setSignatureTarget({ btId: bt.id, type: "operator" })}
            onSignStart={() => setSignatureTarget({ btId: bt.id, type: "start" })}
            onSignEnd={() => setSignatureTarget({ btId: bt.id, type: "end" })}
            onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)}
            onPhotosChange={(photos) => handlePhotosChange(bt.id, photos)}
            onResetSignature={(type) => resetSignature.mutate({ btId: bt.id, type })}
            onEdit={() => setEditBtId(bt.id)}
            onSendReport={() => setReportBtId(bt.id)}
          />
        ))}
        {completedBTs.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Terminés ({completedBTs.length})</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {completedBTs.map((bt: any) => (
              <BTCard key={bt.id} bt={bt} completed showSignature
                onNavigate={() => navigate(`/dossiers/${bt.dossier_id}`)}
                onEdit={() => setEditBtId(bt.id)}
                onPhotosChange={(photos) => handlePhotosChange(bt.id, photos)}
                onResetSignature={(type) => resetSignature.mutate({ btId: bt.id, type })}
                onSendReport={() => setReportBtId(bt.id)}
                onSignOperator={() => setSignatureTarget({ btId: bt.id, type: "operator" })}
                onSignStart={() => setSignatureTarget({ btId: bt.id, type: "start" })}
                onSignEnd={() => setSignatureTarget({ btId: bt.id, type: "end" })}
              />
            ))}
          </>
        )}
      </>
    );
  };

  const tabs = [
    { value: "bt", label: `BT (${bts.length})`, icon: Package },
    ...(showVisites ? [{ value: "visites", label: `Visites (${visites.length})`, icon: ClipboardCheck }] : []),
    ...(showEvents ? [{ value: "planning", label: `Planning (${events.length})`, icon: CalendarDays }] : []),
  ];

  return (
    <div className="max-w-xl mx-auto px-3 pb-24 pt-2 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
            mode === "vehicle" ? "bg-warning/15" : "bg-primary/15"
          }`}>
            {mode === "vehicle" ? <Truck className="h-5 w-5 text-warning" /> : <HardHat className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black tracking-tight">Espace Terrain</h1>
            <p className="text-xs text-muted-foreground capitalize">{formatDate(dateToUse)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAR(true)} className="gap-1.5 text-xs shrink-0">
            <Camera className="h-3.5 w-3.5" /> AR
          </Button>
          {isAdmin && (
            <Badge variant="secondary" className="text-[10px] shrink-0">Admin</Badge>
          )}
        </div>

        {/* Navigation date admin */}
        {isAdmin && (
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setSelectedDate(todayStr())}
              className={`text-sm flex-1 text-center font-medium capitalize ${selectedDate === todayStr() ? "text-primary" : "text-foreground"}`}
            >
              {formatDate(selectedDate)}
              {selectedDate !== todayStr() && (
                <span className="block text-[10px] text-primary">↩ Revenir à aujourd'hui</span>
              )}
            </button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Push notification banners */}
      {permission === "default" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <span>Recevez vos missions en temps réel</span>
          </div>
          <Button size="sm" onClick={subscribePush} className="shrink-0 gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Activer
          </Button>
        </div>
      )}
      {permission === "denied" && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          🔕 Notifications bloquées — allez dans les paramètres de votre navigateur pour les autoriser
        </div>
      )}
      {permission === "granted" && subscribed && (
        <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success flex items-center gap-2">
          <Bell className="h-4 w-4" /> Notifications activées ✓
        </div>
      )}

      {/* Stats summary */}
      <div className={`grid gap-2 ${showVisites ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
          <p className="text-2xl font-black text-primary tabular-nums">{uncompletedBTs.length}</p>
          <p className="text-[10px] text-primary/70 font-medium">BT restants</p>
        </div>
        <div className="rounded-xl bg-success/10 border border-success/20 p-3 text-center">
          <p className="text-2xl font-black text-success tabular-nums">{completedBTs.length}</p>
          <p className="text-[10px] text-success/70 font-medium">Terminés</p>
        </div>
        {showVisites && (
          <div className="rounded-xl bg-info/10 border border-info/20 p-3 text-center">
            <p className="text-2xl font-black text-info tabular-nums">{visites.length}</p>
            <p className="text-[10px] text-info/70 font-medium">Visites</p>
          </div>
        )}
      </div>

      {/* Content */}
      {mode === "vehicle" ? (
        <div className="space-y-3">
          {myResource?.id && (
            <VehicleExpenseDialog
              resourceId={myResource.id}
              companyId={(myResource as any).resource_companies?.[0]?.company_id || companyIds[0]}
              trigger={
                <Button variant="outline" className="w-full gap-2 border-dashed">
                  <Receipt className="h-4 w-4" /> Ajouter une dépense (gasoil, entretien...)
                </Button>
              }
            />
          )}

          {recentExpenses.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Dépenses récentes</p>
              {recentExpenses.map((exp: any) => {
                const ExpIcon = EXPENSE_ICONS[exp.expense_type] || Receipt;
                return (
                  <div key={exp.id} className="flex items-center gap-2 rounded-lg border bg-card p-2">
                    <ExpIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs flex-1 truncate">{exp.vendor || exp.expense_type}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(exp.expense_date), "d MMM", { locale: fr })}</span>
                    <span className="text-xs font-semibold">{fmtCurrency(Number(exp.amount))}</span>
                  </div>
                );
              })}
            </div>
          )}

          {renderBTList()}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pill tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {tabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTerrainTab(tab.value)}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTerrainTab === tab.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTerrainTab === "bt" && (
            <div className="space-y-3">
              {renderBTList()}
            </div>
          )}

          {activeTerrainTab === "visites" && showVisites && (
            <div className="space-y-3">
              {visiteLoading ? (
                <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
              ) : visites.length === 0 ? (
                <EmptyState icon={ClipboardCheck} label="Aucune visite planifiée" />
              ) : (
                visites.map((visite: any) => (
                  <VisiteCard key={visite.id} visite={visite} onNavigate={() => navigate(`/visites/${visite.id}`)} />
                ))
              )}
            </div>
          )}

          {activeTerrainTab === "planning" && showEvents && (
            <div className="space-y-3">
              {eventsLoading ? (
                <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
              ) : events.length === 0 ? (
                <EmptyState icon={CalendarDays} label="Aucun événement planifié" />
              ) : (
                events.map((event: any) => (
                  <EventCard key={event.id} event={event} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Report preview dialog */}
      {reportBtId && (
        <BTReportPreviewDialog
          open={!!reportBtId}
          onOpenChange={(val) => { if (!val) setReportBtId(null); }}
          btId={reportBtId}
          companyIds={companyIds}
        />
      )}

      {/* Edit BT dialog */}
      <PlanningOperationDialog
        open={!!editBtId}
        onOpenChange={(val) => { if (!val) { setEditBtId(null); queryClient.invalidateQueries({ queryKey: ["terrain-bts"] }); } }}
        operationId={editBtId}
      />

      {/* AR Overlay */}
      <ARPhotoOverlay open={showAR} onClose={() => setShowAR(false)} />
    </div>
  );
}

// ===== Sub-components =====

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function BTCard({ bt, completed, showSignature, onComplete, onSignOperator, onSignStart, onSignEnd, onResetSignature, onNavigate, onEdit, onPhotosChange, onSendReport }: {
  bt: any; completed?: boolean; showSignature?: boolean;
  onComplete?: () => void; onSignOperator?: () => void; onSignStart?: () => void; onSignEnd?: () => void;
  onResetSignature?: (type: "operator" | "start" | "end") => void;
  onNavigate: () => void;
  onEdit?: () => void;
  onPhotosChange?: (photos: string[]) => void;
  onSendReport?: () => void;
}) {
  const client = bt.dossiers?.clients;
  const hasOperatorSig = !!bt.operator_signature_url;
  const hasStartSig = !!bt.start_signature_url;
  const hasEndSig = !!bt.end_signature_url;
  const photos: string[] = bt.photos || [];

  const sigSteps = [hasOperatorSig, hasStartSig, hasEndSig];
  const sigCount = sigSteps.filter(Boolean).length;
  const sigPercent = Math.round((sigCount / 3) * 100);

  return (
    <div className={`rounded-2xl border-2 bg-card overflow-hidden transition-all ${
      completed
        ? "border-success/30 bg-success/[0.03]"
        : hasEndSig
        ? "border-success/50"
        : hasStartSig
        ? "border-warning/50"
        : hasOperatorSig
        ? "border-primary/50"
        : "border-border"
    }`}>

      {/* Header BT */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        completed ? "bg-success/10" : hasEndSig ? "bg-success/5" : "bg-muted/30"
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
            completed ? "bg-success text-success-foreground" : "bg-primary/15 text-primary"
          }`}>
            {completed ? <CheckCircle2 className="h-5 w-5" /> : <Package className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {bt.lv_bt_number && (
                <span className="text-xs font-mono bg-background rounded px-1.5 py-0.5 text-muted-foreground shrink-0">
                  BT {bt.lv_bt_number}
                </span>
              )}
              {!bt.lv_bt_number && bt.operation_number && (
                <span className="text-xs font-mono bg-background rounded px-1.5 py-0.5 text-muted-foreground shrink-0">
                  #{bt.operation_number}
                </span>
              )}
              {completed && <span className="text-[10px] font-semibold text-success">✓ Terminé</span>}
            </div>
            <p className="text-sm font-bold truncate">{client?.name || bt.dossiers?.title || "Mission"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Pen className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <button onClick={onNavigate} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Corps */}
      <div className="px-4 py-3 space-y-3">
        {/* Infos mission */}
        <div className="space-y-2 text-xs">
          {(bt.loading_city || bt.delivery_city) && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate font-medium">{bt.loading_city || "—"} → {bt.delivery_city || "—"}</span>
            </div>
          )}
          <div className="flex gap-2">
            {bt.volume > 0 && (
              <div className="rounded-lg bg-muted/50 px-2.5 py-1.5 flex-1">
                <p className="text-muted-foreground text-[10px]">Volume</p>
                <p className="font-semibold">{bt.volume} m³</p>
              </div>
            )}
            {bt.loading_date && (
              <div className="rounded-lg bg-muted/50 px-2.5 py-1.5 flex-1">
                <p className="text-muted-foreground text-[10px]">Date</p>
                <p className="font-semibold">{new Date(bt.loading_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact client */}
        {client?.phone && (
          <a href={`tel:${client.phone}`}
            className="flex items-center gap-2 rounded-xl bg-info/10 border border-info/20 px-3 py-2 text-xs text-info font-medium">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.name} — {client.phone}</span>
          </a>
        )}

        {/* Notes */}
        {bt.notes && (
          <div className="rounded-xl bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{bt.notes}</span>
          </div>
        )}

        {/* Progression signatures */}
        {showSignature && (
          <div className="space-y-2">
            {/* Barre de progression */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  sigPercent === 100 ? "bg-success" : sigPercent > 0 ? "bg-primary" : "bg-muted"
                }`} style={{ width: `${sigPercent}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium shrink-0">{sigCount}/3</span>
            </div>

            {/* Étapes signatures */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Opérateur", done: hasOperatorSig, name: bt.operator_signer_name, time: bt.operator_signed_at, icon: HardHat, resetType: "operator" as const },
                { label: "Début", done: hasStartSig, name: bt.start_signer_name, time: bt.start_signed_at, icon: Pen, resetType: "start" as const },
                { label: "Fin", done: hasEndSig, name: bt.end_signer_name, time: bt.end_signed_at, icon: CheckCircle2, resetType: "end" as const },
              ].map((step, i) => (
                <div key={i} className={`rounded-xl p-2 text-center transition-colors relative ${
                  step.done ? "bg-success/10 border border-success/30" : "bg-muted/50 border border-border"
                }`}>
                  <step.icon className={`h-4 w-4 mx-auto mb-1 ${step.done ? "text-success" : "text-muted-foreground"}`} />
                  <p className={`text-[9px] font-semibold ${step.done ? "text-success" : "text-muted-foreground"}`}>{step.label}</p>
                  {step.done && step.time && (
                    <p className="text-[9px] text-success/70">{formatTime(step.time)}</p>
                  )}
                  {step.done && onResetSignature && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onResetSignature(step.resetType); }}
                      className="absolute top-1 right-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Boutons signature — 1 seul à la fois visible */}
            {!completed && (() => {
              if (!hasOperatorSig && onSignOperator) return (
                <Button onClick={onSignOperator} className="w-full h-11 gap-2 bg-primary hover:bg-primary/90 text-sm font-semibold">
                  <HardHat className="h-4 w-4" /> Signer — Opérateur
                </Button>
              );
              if (hasOperatorSig && !hasStartSig && onSignStart) return (
                <Button onClick={onSignStart} variant="outline" className="w-full h-11 gap-2 border-warning text-warning hover:bg-warning/10 text-sm font-semibold">
                  <Pen className="h-4 w-4" /> Signer début — Client
                </Button>
              );
              if (hasOperatorSig && hasStartSig && !hasEndSig && onSignEnd) return (
                <Button onClick={onSignEnd} className="w-full h-11 gap-2 bg-success hover:bg-success/90 text-success-foreground text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Signer fin — Client
                </Button>
              );
              return null;
            })()}
          </div>
        )}

        {/* Bouton terminer (sans signature) */}
        {!completed && !showSignature && onComplete && (
          <Button onClick={onComplete} className="w-full h-11 gap-2 bg-success hover:bg-success/90 text-success-foreground text-sm font-semibold">
            <Check className="h-4 w-4" /> Marquer terminé
          </Button>
        )}

        {/* Commentaire chantier */}
        <BTCommentField btId={bt.id} initialValue={bt.notes || ""} />

        {/* Photos */}
        {onPhotosChange && (
          <BTPhotoUpload btId={bt.id} photos={photos} onPhotosChange={onPhotosChange} />
        )}

        {/* Actions rapport */}
        {onSendReport && (hasOperatorSig || hasStartSig || hasEndSig || completed) && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5 text-xs" onClick={e => { e.stopPropagation(); onSendReport(); }}>
              <Eye className="h-3.5 w-3.5" /> Aperçu PDF
            </Button>
            {completed && (
              <Button size="sm" className="flex-1 h-9 gap-1.5 text-xs" onClick={e => { e.stopPropagation(); onSendReport(); }}>
                <Send className="h-3.5 w-3.5" /> Envoyer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VisiteCard({ visite, onNavigate }: { visite: any; onNavigate: () => void }) {
  const client = visite.clients;
  const statusStyles: Record<string, string> = {
    planifiee: "bg-info/10 text-info border-info/20",
    realisee: "bg-success/10 text-success border-success/20",
    annulee: "bg-destructive/10 text-destructive border-destructive/20",
  };
  const statusLabels: Record<string, string> = {
    planifiee: "Planifiée",
    realisee: "Réalisée",
    annulee: "Annulée",
  };

  return (
    <div className="rounded-2xl border-2 bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{visite.title}</p>
          {client && <p className="text-xs text-muted-foreground truncate">{client.name}</p>}
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyles[visite.status] || "bg-muted text-muted-foreground"}`}>
          {statusLabels[visite.status] || visite.status}
        </span>
      </div>

      <div className="px-4 pb-3 space-y-2">
        {visite.address && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{visite.address}</span>
          </div>
        )}

        {client?.phone && (
          <a href={`tel:${client.phone}`}
            className="flex items-center gap-2 rounded-xl bg-info/10 border border-info/20 px-3 py-2 text-xs text-info font-medium">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.phone}</span>
          </a>
        )}

        {visite.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{visite.notes}</p>
        )}

        <Button size="sm" variant="outline" className="w-full h-9 text-xs gap-1.5" onClick={onNavigate}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Ouvrir la visite
        </Button>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: any }) {
  return (
    <div className="rounded-2xl border-2 bg-card overflow-hidden">
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold truncate">{event.title}</p>
          {event.start_time && (
            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-0.5">
              <Clock className="h-3 w-3" />
              {formatTime(event.start_time)}
            </span>
          )}
        </div>
        {event.dossiers?.title && (
          <p className="text-xs text-muted-foreground truncate">
            <span className="text-primary font-medium">{event.dossiers.code}</span> · {event.dossiers.title}
          </p>
        )}
        {event.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
        )}
      </div>
    </div>
  );
}
