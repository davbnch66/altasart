import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ArrowLeft, MapPin, Calendar, Clock, User, FileText, FolderOpen, BookOpen, Save, Loader2, LayoutGrid, Package, Users, Truck, ShieldAlert, ClipboardList, Download, Camera, ChevronDown, Wrench, Info, Mail, ImageIcon, MoreHorizontal, Phone, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { VisitePiecesTab } from "@/components/visite/VisitePiecesTab";
import { VisiteMaterielTab } from "@/components/visite/VisiteMaterielTab";
import { VisiteAffectationTab } from "@/components/visite/VisiteAffectationTab";
import { VisiteRHTab } from "@/components/visite/VisiteRHTab";
import { VisiteVehiculesTab } from "@/components/visite/VisiteVehiculesTab";
import { VisiteContraintesTab } from "@/components/visite/VisiteContraintesTab";
import { VisiteMethodologieTab } from "@/components/visite/VisiteMethodologieTab";
import { VisiteSmartAlerts } from "@/components/visite/VisiteSmartAlerts";
import { generateVisitePdf } from "@/lib/generateVisitePdf";
import { ApplyTemplateDialog } from "@/components/visite/ApplyTemplateDialog";
import { GenerateDevisDialog } from "@/components/visite/GenerateDevisDialog";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { VisiteDevisHistory } from "@/components/visite/VisiteDevisHistory";
import { DetailBreadcrumb } from "@/components/DetailBreadcrumb";
import { PdfPreviewDialog } from "@/components/visite/PdfPreviewDialog";
import { ARPhotoOverlay } from "@/components/ar/ARPhotoOverlay";
import { DownloadWordButton } from "@/components/shared/DownloadWordButton";
import { GenerateVisiteMemoButton } from "@/components/visite/GenerateVisiteMemoButton";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { VisiteMobileView } from "@/components/visite/mobile/VisiteMobileView";
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

/* Collapsible section wrapper */
const Section = ({ title, icon: Icon, defaultOpen = false, badge, children }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  badge?: string | number;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-xl border bg-card px-4 py-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          {badge !== undefined && <span className="text-xs font-normal bg-muted rounded-full px-2 py-0.5">{badge}</span>}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

const VisiteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { current, dbCompanies } = useCompany();
  const fromClient = (location.state as any)?.fromClient === true;
  const fromDossier = (location.state as any)?.fromDossier as string | undefined;
  const fromPlanning = (location.state as any)?.fromPlanning === true;
  const planningTab = (location.state as any)?.planningTab as string | undefined;
  const isOnline = useOnlineStatus();
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [photosPerRow, setPhotosPerRow] = useState<1 | 2>(1);
  const [exporting, setExporting] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ blobUrl: string; fileName: string; dataUri?: string } | null>(null);
  const [activeTab, setActiveTab] = useState("rdv");
  const isMobile = useIsMobile();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [capturedPhotoFile, setCapturedPhotoFile] = useState<File | null>(null);
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  // Fetch personnel resources for technician assignment
  const { data: personnelResources = [] } = useQuery({
    queryKey: ["personnel-resources", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("resource_companies")
        .select("resource_id, resources(id, name, type, status)")
        .in("company_id", companyIds);
      if (error) throw error;
      const seen = new Set<string>();
      return (data || [])
        .map((rc: any) => rc.resources)
        .filter((r: any) => r && (r.type === "employe" || r.type === "equipe") && !seen.has(r.id) && seen.add(r.id))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: companyIds.length > 0,
  });

  const { data: visite, isLoading } = useQuery({
    queryKey: ["visite-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visites")
        .select("*, clients(id, name, code, phone, mobile, email, address, postal_code, city), resources:technician_id(name), dossiers:dossier_id(id, code, title)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (visite && !editData) {
      setEditData({ ...visite });
    }
  }, [visite]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { clients, resources, dossiers, ...rest } = data;
      delete rest.created_at;
      delete rest.updated_at;
      if (!isOnline) {
        addToQueue({ table: "visites", operation: "update", data: rest, matchColumn: "id", matchValue: id! });
        return;
      }
      const { error } = await supabase.from("visites").update(rest).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isOnline ? "Visite mise à jour" : "Modifications sauvegardées hors-ligne");
      queryClient.invalidateQueries({ queryKey: ["visite-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["visites"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const handleSave = useCallback(async () => {
    if (!editData) return false;
    try {
      await saveMutation.mutateAsync(editData);
      return true;
    } catch {
      return false;
    }
  }, [editData, saveMutation]);

  // Dirty detection: compare editData to fetched visite
  const isDirty = useMemo(() => {
    if (!visite || !editData) return false;
    const fieldsToCheck = [
      "title", "status", "on_hold", "scheduled_date", "scheduled_time", "duration", "zone", "call_date",
      "address", "origin_postal_code", "origin_city", "origin_country",
      "origin_address_line1", "origin_address_line2", "origin_floor", "origin_access",
      "dest_address_line1", "dest_address_line2", "dest_city", "dest_postal_code", "dest_floor", "dest_access",
      "advisor", "coordinator", "technician_id", "origin", "visit_type",
      "comment", "instructions", "notes", "loading_date",
      "needs_voirie", "voirie_status", "voirie_type", "voirie_address", "voirie_notes",
      "nature", "contractor", "distance", "volume", "period",
      "voirie_requested_at", "voirie_obtained_at",
    ];
    return fieldsToCheck.some((f) => {
      const editVal = editData[f] ?? "";
      const origVal = (visite as any)[f] ?? "";
      return String(editVal) !== String(origVal);
    });
  }, [visite, editData]);

  const { isBlocked, proceed, reset, saveAndProceed, triggerBlock } = useUnsavedChangesGuard(isDirty, handleSave);

  const updateField = (field: string, value: any) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  };

  const convertToDossier = useMutation({
    mutationFn: async () => {
      if (!visite) throw new Error("No visite");
      const { data, error } = await supabase.from("dossiers").insert({
        company_id: visite.company_id,
        client_id: visite.client_id,
        title: visite.title,
        address: visite.address,
        description: visite.comment || visite.notes || "",
        notes: visite.instructions || "",
        code: visite.code ? `DOS-${visite.code}` : null,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("visites").update({ dossier_id: data.id }).eq("id", visite.id);
      return data.id;
    },
    onSuccess: (dossierId) => {
      toast.success("Dossier créé à partir de la visite");
      queryClient.invalidateQueries({ queryKey: ["visite-detail", id] });
      navigate(`/dossiers/${dossierId}`);
    },
    onError: () => toast.error("Erreur lors de la conversion"),
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!visite || !editData) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-center">
        <p className="text-muted-foreground">Visite introuvable</p>
        <Button variant="outline" onClick={() => navigate("/visites")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const client = visite.clients as any;
  const tech = visite.resources as any;
  const dossier = visite.dossiers as any;

  if (isMobile) {
    return (
      <>
        <VisiteMobileView
          visite={visite}
          editData={editData}
          updateField={updateField}
          handleSave={handleSave}
          saving={saveMutation.isPending}
          isDirty={isDirty}
        />
        <UnsavedChangesDialog
          open={isBlocked}
          onStay={reset}
          onDiscard={proceed}
          onSave={saveAndProceed}
          saving={saveMutation.isPending}
        />
      </>
    );
  }

    return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
      {/* ===== LINE 1: Breadcrumb + Status Badge ===== */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => {
            if (!triggerBlock("/visites")) navigate(-1);
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <DetailBreadcrumb items={[
            ...(fromPlanning ? [{ label: "Planning", path: "/planning", state: { planningTab } }] : []),
            ...(fromClient && client?.id && !fromPlanning ? [{ label: client.name, path: `/clients/${client.id}` }] : []),
            ...(fromDossier && dossier && !fromPlanning ? [{ label: dossier.code || dossier.title, path: `/dossiers/${fromDossier}`, state: { fromClient } }] : !fromClient && !fromPlanning ? [{ label: "Visites", path: "/visites" }] : []),
            { label: client?.name || visite.title },
          ]} />
        </div>
        <select
          value={editData.status}
          onChange={(e) => updateField("status", e.target.value)}
          className={`flex h-8 rounded-full border-0 px-3 py-1 text-xs font-medium cursor-pointer ${statusStyle[editData.status]}`}
        >
          <option value="planifiee">Planifiée</option>
          <option value="realisee">Réalisée</option>
          <option value="annulee">Annulée</option>
        </select>
      </div>

      {/* ===== Title ===== */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {client?.name || visite.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {visite.code ? `#${visite.code}` : "Visite technique"}
          {visite.on_hold && <span className="ml-2 text-xs bg-warning/10 text-warning rounded-full px-2 py-0.5">En attente</span>}
        </p>
      </div>

      {/* ===== LINE 2: Quick info + Actions ===== */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border pb-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {client && (
            <button onClick={() => navigate(`/clients/${client.id}`)} className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{client.name}</span>
            </button>
          )}
          {visite.scheduled_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(visite.scheduled_date), "dd MMM yyyy", { locale: fr })}
              {visite.scheduled_time && ` à ${visite.scheduled_time.slice(0, 5)}`}
            </span>
          )}
          {tech?.name && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {tech.name}
            </span>
          )}
          {visite.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visite.address + (visite.origin_city ? ` ${visite.origin_city}` : ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate max-w-[200px]">{visite.address}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {(client?.phone || client?.mobile) && (
            <a
              href={`tel:${client.mobile || client.phone}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-1 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              {client.mobile || client.phone}
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setExporting(true);
              try {
                const result = await generateVisitePdf(id!, { photosPerRow });
                setPdfPreview(result);
              } catch (e: any) {
                toast.error(e.message || "Erreur export PDF");
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Rapport PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4 mr-1" />
                Plus d'actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <div>
                  <DownloadWordButton
                    companyId={visite.company_id}
                    documentType="visite"
                    documentId={visite.id}
                    fileName={`Visite_${(visite as any).code || visite.id.slice(0, 8)}.docx`}
                  />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <div>
                  <ApplyTemplateDialog visiteId={visite.id} companyId={visite.company_id} />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <div>
                  <GenerateDevisDialog visiteId={visite.id} companyId={visite.company_id} dossierId={visite.dossier_id} />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPhotosPerRow(photosPerRow === 1 ? 2 : 1)}>
                Photos : {photosPerRow}/ligne
              </DropdownMenuItem>
              <DropdownMenuItem>
                <label className="flex items-center gap-2 cursor-pointer w-full">
                  <Checkbox checked={editData.on_hold || false} onCheckedChange={(v) => updateField("on_hold", v)} />
                  En attente
                </label>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Enregistrer
          </Button>
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={async () => {
            setExporting(true);
            try {
              const result = await generateVisitePdf(id!, { photosPerRow });
              setPdfPreview(result);
            } catch (e: any) { toast.error(e.message || "Erreur export PDF"); } finally { setExporting(false); }
          }} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Smart Alerts */}
      <VisiteSmartAlerts visiteId={visite.id} companyId={visite.company_id} />

      {/* ===== 2-Column Layout on desktop ===== */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN — 35% */}
        <div className="lg:w-[35%] space-y-4 shrink-0">
          {/* Client Card */}
          {client && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Client</h3>
              <p className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/clients/${client.id}`)}>
                {client.name} {client.code ? <span className="text-muted-foreground font-normal">({client.code})</span> : ""}
              </p>
              <div className="space-y-2 text-sm">
                {(client.phone || client.mobile) && (
                  <a href={`tel:${client.mobile || client.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Phone className="h-3.5 w-3.5" /> {client.mobile || client.phone}
                  </a>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground truncate">
                    <Mail className="h-3.5 w-3.5" /> {client.email}
                  </a>
                )}
                {(client.address || client.city) && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([client.address, client.postal_code, client.city].filter(Boolean).join(" "))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{[client.address, client.postal_code, client.city].filter(Boolean).join(", ")}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Dossier lié */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dossier</h3>
            {dossier ? (
              <p className="text-primary cursor-pointer hover:underline flex items-center gap-2 font-medium" onClick={() => navigate(`/dossiers/${dossier.id}`)}>
                <FolderOpen className="h-4 w-4" /> {dossier.code || dossier.title}
              </p>
            ) : (
              <Button variant="outline" size="sm" onClick={() => convertToDossier.mutate()} disabled={convertToDossier.isPending} className="w-full gap-2">
                <FolderOpen className="h-4 w-4" />
                {convertToDossier.isPending ? "Conversion..." : "Convertir en dossier"}
              </Button>
            )}
          </div>

          {/* Notes / Instructions */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notes & Instructions</h3>
            <Textarea
              value={editData.instructions || ""}
              onChange={(e) => updateField("instructions", e.target.value)}
              onBlur={handleSave}
              rows={4}
              placeholder="Instructions pour l'opération…"
              className="text-sm"
            />
            <Textarea
              value={editData.comment || ""}
              onChange={(e) => updateField("comment", e.target.value)}
              onBlur={handleSave}
              rows={3}
              placeholder="Commentaires…"
              className="text-sm"
            />
          </div>

          {/* Status */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Statut</h3>
            <select
              value={editData.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="planifiee">Planifiée</option>
              <option value="realisee">Réalisée</option>
              <option value="annulee">Annulée</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={editData.on_hold || false} onCheckedChange={(v) => updateField("on_hold", v)} />
              En attente
            </label>
          </div>
        </div>

        {/* RIGHT COLUMN — 65% with Tabs */}
        <div className="lg:w-[65%] min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full h-11 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="rdv" className="h-9 text-[13px] gap-2 flex items-center justify-center data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md">
                <Calendar className="h-4 w-4" /> RDV
              </TabsTrigger>
              <TabsTrigger value="site" className="h-9 text-[13px] gap-2 flex items-center justify-center data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md">
                <LayoutGrid className="h-4 w-4" /> Site
                {(visite.photos_count || 0) > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{visite.photos_count}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="moyens" className="h-9 text-[13px] gap-2 flex items-center justify-center data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md">
                <Wrench className="h-4 w-4" /> Moyens
              </TabsTrigger>
              <TabsTrigger value="devis" className="h-9 text-[13px] gap-2 flex items-center justify-center data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md">
                <FileText className="h-4 w-4" /> Devis
              </TabsTrigger>
            </TabsList>

            {/* ============ TAB 1 : RENDEZ-VOUS ============ */}
            <TabsContent value="rdv" className="space-y-3">
              <Section title="Rendez-vous" icon={Calendar} defaultOpen>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border bg-card p-5 space-y-4">
                    <h3 className="font-semibold text-primary flex items-center gap-2"><Calendar className="h-4 w-4" /> Date & Heure</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Zone</Label>
                        <Input value={editData.zone || ""} onChange={(e) => updateField("zone", e.target.value)} placeholder="Ex: Paris" />
                      </div>
                      <div>
                        <Label>Date d'appel</Label>
                        <Input type="date" value={editData.call_date || ""} onChange={(e) => updateField("call_date", e.target.value)} />
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input type="date" value={editData.scheduled_date ? editData.scheduled_date.slice(0, 10) : ""} onChange={(e) => updateField("scheduled_date", e.target.value)} />
                      </div>
                      <div>
                        <Label>Heure</Label>
                        <Input type="time" value={editData.scheduled_time || ""} onChange={(e) => updateField("scheduled_time", e.target.value)} />
                      </div>
                      <div>
                        <Label>Durée</Label>
                        <Input value={editData.duration || "01:00:00"} onChange={(e) => updateField("duration", e.target.value)} placeholder="01:00" />
                      </div>
                    </div>
                  </div>
                   <div className="rounded-xl border bg-card p-5 space-y-4">
                    <h3 className="font-semibold text-primary flex items-center gap-2"><User className="h-4 w-4" /> Intervenants</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Conseiller</Label>
                        <Input value={editData.advisor || ""} onChange={(e) => updateField("advisor", e.target.value)} />
                      </div>
                      <div>
                        <Label>Coordinateur</Label>
                        <Input value={editData.coordinator || ""} onChange={(e) => updateField("coordinator", e.target.value)} />
                      </div>
                      <div>
                        <Label>Technicien assigné</Label>
                        <Select value={editData.technician_id || "none"} onValueChange={(v) => updateField("technician_id", v === "none" ? null : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Non assigné" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non assigné</SelectItem>
                            {personnelResources.map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Origine</Label>
                        <Input value={editData.origin || ""} onChange={(e) => updateField("origin", e.target.value)} placeholder="AC, NC..." />
                      </div>
                      <div>
                        <Label>Type visite</Label>
                        <Input value={editData.visit_type || ""} onChange={(e) => updateField("visit_type", e.target.value)} placeholder="VT, VC..." />
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Adresses" icon={MapPin}>
                <div className="space-y-3">
                  <div className="rounded-xl border bg-card p-5 space-y-3">
                    <h3 className="font-semibold text-primary">Adresse du rendez-vous</h3>
                    <AddressAutocomplete
                      value={editData.address || ""}
                      onChange={(v) => updateField("address", v)}
                      onSelect={(s) => {
                        if (s.postcode) updateField("origin_postal_code", s.postcode);
                        if (s.city) updateField("origin_city", s.city);
                      }}
                      placeholder="Adresse"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <Input value={editData.origin_postal_code || ""} onChange={(e) => updateField("origin_postal_code", e.target.value)} placeholder="Code postal" />
                      <Input value={editData.origin_city || ""} onChange={(e) => updateField("origin_city", e.target.value)} placeholder="Ville" className="col-span-2" />
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-5 space-y-3">
                    <h3 className="font-semibold text-primary">Période</h3>
                    <Input value={editData.period || ""} onChange={(e) => updateField("period", e.target.value)} placeholder="Ex: JUIN 2026 ET FIN AOUT 2026" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AddressBlock title="Adresse origine" prefix="origin" data={editData} onChange={updateField} />
                    <AddressBlock title="Adresse destination" prefix="dest" data={editData} onChange={updateField} />
                  </div>
                </div>
              </Section>

              <Section title="Informations complémentaires" icon={Info}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Distance (km)</Label>
                    <Input type="number" value={editData.distance || ""} onChange={(e) => updateField("distance", e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Volume (m³)</Label>
                    <Input type="number" step="0.01" value={editData.volume || 0} onChange={(e) => updateField("volume", Number(e.target.value))} />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Nature</Label>
                    <Input value={editData.nature || ""} onChange={(e) => updateField("nature", e.target.value)} placeholder="MANUTENTION..." />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Type opération</Label>
                    <Input value={editData.operation_type || ""} onChange={(e) => updateField("operation_type", e.target.value)} placeholder="M, D..." />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Type de devis</Label>
                    <Input value={editData.devis_type || ""} onChange={(e) => updateField("devis_type", e.target.value)} placeholder="DN, DA..." />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Tractionnaire</Label>
                    <Input value={editData.contractor || ""} onChange={(e) => updateField("contractor", e.target.value)} />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Qualité</Label>
                    <Input type="number" value={editData.quality || 1} onChange={(e) => updateField("quality", Number(e.target.value))} min={1} />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <Label>Photos</Label>
                    <p className="text-2xl font-bold mt-1">{visite.photos_count || 0}</p>
                  </div>
                </div>
              </Section>
            </TabsContent>

            {/* ============ TAB 2 : SITE ============ */}
            <TabsContent value="site" className="space-y-3">
              <Section title="Pièces / Zones" icon={LayoutGrid} defaultOpen>
                <VisitePiecesTab visiteId={visite.id} companyId={visite.company_id} />
              </Section>

              <Section title="Inventaire matériel" icon={Package}>
                <VisiteMaterielTab visiteId={visite.id} companyId={visite.company_id} />
              </Section>

              <Section title="Affectation matériel ↔ pièces" icon={Package}>
                <VisiteAffectationTab visiteId={visite.id} companyId={visite.company_id} />
              </Section>

              <Section title="Contraintes d'accès" icon={ShieldAlert}>
                <VisiteContraintesTab visiteId={visite.id} companyId={visite.company_id} />
              </Section>
            </TabsContent>

            {/* ============ TAB 3 : MOYENS & MÉTHODOLOGIE ============ */}
            <TabsContent value="moyens" className="space-y-3">
              <Section title="Ressources humaines" icon={Users} defaultOpen>
                <VisiteRHTab visiteId={visite.id} companyId={visite.company_id} />
              </Section>

              <Section title="Véhicules et engins" icon={Truck}>
                <VisiteVehiculesTab visiteId={visite.id} companyId={visite.company_id} />
              </Section>

              <Section title="Démarches voirie" icon={ShieldAlert} badge={editData.needs_voirie ? (editData.voirie_status === "obtenue" ? "✓" : editData.voirie_status === "refusee" ? "✗" : "…") : undefined}>
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="needs-voirie"
                      checked={!!editData.needs_voirie}
                      onCheckedChange={(checked) => {
                        updateField("needs_voirie", !!checked);
                        if (checked) {
                          updateField("voirie_status", "a_faire");
                          if (!editData.voirie_address) {
                            updateField("voirie_address", editData.address || visite.address || "");
                          }
                        } else {
                          updateField("voirie_status", "non_requise");
                        }
                      }}
                    />
                    <Label htmlFor="needs-voirie" className="cursor-pointer text-sm font-medium">
                      Démarches voirie nécessaires (arrêté, autorisation stationnement…)
                    </Label>
                  </div>
                  {editData.needs_voirie && (
                    <div className="space-y-4 pl-7">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Statut</Label>
                          <Select value={editData.voirie_status || "a_faire"} onValueChange={(v) => {
                            updateField("voirie_status", v);
                            if (v === "demandee" && !editData.voirie_requested_at) {
                              updateField("voirie_requested_at", new Date().toISOString());
                            }
                            if (v === "obtenue" && !editData.voirie_obtained_at) {
                              updateField("voirie_obtained_at", new Date().toISOString());
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a_faire">À faire</SelectItem>
                              <SelectItem value="demandee">Demandée</SelectItem>
                              <SelectItem value="en_attente">En attente</SelectItem>
                              <SelectItem value="obtenue">Obtenue</SelectItem>
                              <SelectItem value="refusee">Refusée</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Type de démarche</Label>
                          <Select value={editData.voirie_type || ""} onValueChange={(v) => updateField("voirie_type", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="arrete_stationnement">Arrêté de stationnement</SelectItem>
                              <SelectItem value="plan_voirie">Plan voirie (1/200ème)</SelectItem>
                              <SelectItem value="emprise">Emprise voirie</SelectItem>
                              <SelectItem value="autorisation_grue">Autorisation grue</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {(() => {
                        const statusConfig: Record<string, { label: string; className: string }> = {
                          a_faire: { label: "À faire", className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
                          demandee: { label: "Demandée", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
                          en_attente: { label: "En attente", className: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
                          obtenue: { label: "Obtenue", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
                          refusee: { label: "Refusée", className: "bg-red-500/15 text-red-600 border-red-500/30" },
                        };
                        const s = statusConfig[editData.voirie_status] || statusConfig.a_faire;
                        return (
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${s.className}`}>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {s.label}
                            {editData.voirie_requested_at && (
                              <span className="text-[10px] opacity-70">
                                · demandée le {format(new Date(editData.voirie_requested_at), "dd/MM/yyyy")}
                              </span>
                            )}
                            {editData.voirie_obtained_at && editData.voirie_status === "obtenue" && (
                              <span className="text-[10px] opacity-70">
                                · obtenue le {format(new Date(editData.voirie_obtained_at), "dd/MM/yyyy")}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Documents reçus</Label>
                        <div className="flex flex-wrap gap-2">
                          {editData.voirie_plan_storage_path ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                              <FileText className="h-3 w-3" /> Plan ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" /> Plan —
                            </span>
                          )}
                          {editData.voirie_pv_roc_storage_path ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                              <FileText className="h-3 w-3" /> PV ROC ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" /> PV ROC —
                            </span>
                          )}
                          {editData.voirie_arrete_storage_path ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                              <FileText className="h-3 w-3" /> Arrêté ✓
                              {editData.voirie_arrete_date && (
                                <span className="text-[10px] opacity-70">({format(new Date(editData.voirie_arrete_date), "dd/MM/yyyy")})</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" /> Arrêté —
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Adresse concernée</Label>
                        <AddressAutocomplete
                          value={editData.voirie_address || ""}
                          onChange={(v) => updateField("voirie_address", v)}
                          placeholder="Adresse pour la démarche voirie"
                        />
                        {editData.address && editData.voirie_address !== editData.address && (
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={() => updateField("voirie_address", editData.address)}
                          >
                            ↩ Utiliser l'adresse du chantier
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>Notes voirie</Label>
                        <Textarea
                          value={editData.voirie_notes || ""}
                          onChange={(e) => updateField("voirie_notes", e.target.value)}
                          rows={3}
                          placeholder="Observations, remarques sur la démarche voirie…"
                        />
                      </div>

                      <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/voirie")}>
                        <ShieldAlert className="h-4 w-4" />
                        Voir le tableau voirie complet
                      </Button>

                      {(editData.voirie_address || "").toLowerCase().includes("paris") && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                          <p className="text-sm font-medium text-primary flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Demande de plan voirie — Paris
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Envoyer un email formel à la DVD de Paris pour demander un plan au 1/200ème et une autorisation d'emprise voirie.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2"
                            onClick={async () => {
                              const addr = editData.voirie_address || "";
                              const visiteCode = visite.code || visite.id.slice(0, 8);
                              const clientName = visite.clients?.name || "notre client";
                              
                              const subject = `Demande de plan au 1/200ème – Emprise voirie – ${addr}`;
                              const body = `Madame, Monsieur,\n\nDans le cadre d'une intervention de levage et manutention lourde prévue pour le compte de ${clientName}, nous avons l'honneur de solliciter auprès de vos services :\n\n1. La communication d'un plan au 1/200ème de la voirie située à l'adresse suivante :\n   ${addr}\n\n2. Les informations relatives aux conditions d'occupation temporaire de la voie publique (emprise voirie) nécessaires à la mise en place de nos engins de levage.\n\nCette demande s'inscrit dans le cadre de la visite technique référence ${visiteCode}.\n\nNous vous serions reconnaissants de bien vouloir nous transmettre ces éléments dans les meilleurs délais afin de nous permettre d'établir notre plan d'installation et de constituer le dossier de demande d'autorisation.\n\nNous restons à votre entière disposition pour tout renseignement complémentaire.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`;
                              
                              try {
                                const { error } = await supabase.functions.invoke("send-visite-email", {
                                  body: {
                                    to: "dvd-pvp.dvd@paris.fr",
                                    subject,
                                    body,
                                    visiteId: visite.id,
                                    companyId: visite.company_id,
                                    clientName,
                                  },
                                });
                                if (error) throw error;
                                toast.success("Demande de plan voirie envoyée à la DVD Paris");
                              } catch (e: any) {
                                toast.error(e.message || "Erreur lors de l'envoi");
                              }
                            }}
                          >
                            <Mail className="h-4 w-4" />
                            Envoyer la demande à la DVD Paris
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Méthodologie IA" icon={ClipboardList}>
                <VisiteMethodologieTab visiteId={visite.id} companyId={visite.company_id} />
              </Section>
            </TabsContent>

            {/* ============ TAB 4 : DEVIS & DOSSIER ============ */}
            <TabsContent value="devis" className="space-y-3">
              <Section title="Mémo devis" icon={FileText} defaultOpen>
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Le texte saisi dans le champ Mémo devis sera disponible au moment de la création du devis.</p>
                    <GenerateVisiteMemoButton
                      visiteId={visite.id}
                      onGenerated={async (memo) => {
                        updateField("notes", memo);
                        const { error } = await supabase.from("visites").update({ notes: memo }).eq("id", visite.id);
                        if (!error) {
                          queryClient.invalidateQueries({ queryKey: ["visite-detail", id] });
                        }
                      }}
                    />
                  </div>
                  <Textarea value={editData.notes || ""} onChange={(e) => updateField("notes", e.target.value)} rows={8} placeholder="Description détaillée pour le devis..." />
                </div>
              </Section>

              <Section title="Historique des devis IA" icon={FileText}>
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-end mb-2">
                    <GenerateDevisDialog visiteId={visite.id} companyId={visite.company_id} dossierId={visite.dossier_id} />
                  </div>
                  <VisiteDevisHistory visiteId={visite.id} />
                </div>
              </Section>

              <Section title="Codification" icon={FolderOpen}>
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Date prévisionnelle de chargement</Label>
                      <Input type="date" value={editData.loading_date || ""} onChange={(e) => updateField("loading_date", e.target.value)} />
                    </div>
                  </div>
                </div>
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {/* Hidden photo input for mobile quick action */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setCapturedPhotoFile(file);
          setTimeout(() => { if (e.target) e.target.value = ""; }, 500);
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setCapturedPhotoFile(file);
          setTimeout(() => { if (e.target) e.target.value = ""; }, 500);
        }}
      />

      {/* AR overlay after photo capture */}
      <ARPhotoOverlay
        open={!!capturedPhotoFile}
        onClose={() => setCapturedPhotoFile(null)}
        initialPhotoFile={capturedPhotoFile || undefined}
        onSaveOriginal={async (file) => {
          try {
            let { data: piecesData } = await supabase.from("visite_pieces").select("id").eq("visite_id", visite.id).order("sort_order").limit(1);
            let pieceId = piecesData?.[0]?.id;
            if (!pieceId) {
              const { data: newPiece, error: pieceErr } = await supabase.from("visite_pieces").insert({
                visite_id: visite.id,
                company_id: visite.company_id,
                name: "Général",
                sort_order: 0,
              }).select("id").single();
              if (pieceErr) throw pieceErr;
              pieceId = newPiece.id;
              queryClient.invalidateQueries({ queryKey: ["visite-pieces", visite.id] });
            }
            const path = `${visite.id}/${pieceId}/${Date.now()}_${file.name}`;
            const { error: uploadErr } = await supabase.storage.from("visite-photos").upload(path, file);
            if (uploadErr) throw uploadErr;
            await supabase.from("visite_photos").insert({
              visite_id: visite.id, piece_id: pieceId, company_id: visite.company_id,
              storage_path: path, file_name: file.name,
            });
            toast.success("Photo ajoutée");
            queryClient.invalidateQueries({ queryKey: ["visite-photos", visite.id] });
            setActiveTab("site");
          } catch (err: any) {
            toast.error(err.message || "Erreur upload");
          }
        }}
        onExport={async (blob) => {
          try {
            let { data: piecesData } = await supabase.from("visite_pieces").select("id").eq("visite_id", visite.id).order("sort_order").limit(1);
            let pieceId = piecesData?.[0]?.id;
            if (!pieceId) {
              const { data: newPiece, error: pieceErr } = await supabase.from("visite_pieces").insert({
                visite_id: visite.id,
                company_id: visite.company_id,
                name: "Général",
                sort_order: 0,
              }).select("id").single();
              if (pieceErr) throw pieceErr;
              pieceId = newPiece.id;
              queryClient.invalidateQueries({ queryKey: ["visite-pieces", visite.id] });
            }
            const fileName = `ar-crane-${Date.now()}.png`;
            const path = `${visite.id}/${pieceId}/${fileName}`;
            const file = new File([blob], fileName, { type: "image/png" });
            const { error: uploadErr } = await supabase.storage.from("visite-photos").upload(path, file);
            if (uploadErr) throw uploadErr;
            await supabase.from("visite_photos").insert({
              visite_id: visite.id, piece_id: pieceId, company_id: visite.company_id,
              storage_path: path, file_name: fileName,
            });
            queryClient.invalidateQueries({ queryKey: ["visite-photos", visite.id] });
            setActiveTab("site");
          } catch (err: any) {
            toast.error(err.message || "Erreur upload");
          }
        }}
      />

      {/* Mobile floating action bar - 4 tabs */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border px-2 py-2 safe-area-bottom">
          <div className="flex items-center justify-around gap-1">
            <button
              onClick={() => setActiveTab("rdv")}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeTab === "rdv" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <Calendar className="h-5 w-5" />
              <span>RDV</span>
            </button>
            <button
              onClick={() => setActiveTab("site")}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeTab === "site" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-5 w-5" />
              <span>Site</span>
            </button>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Camera className="h-5 w-5" />
              <span>Photo</span>
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <ImageIcon className="h-5 w-5" />
              <span>Galerie</span>
            </button>
            <button
              onClick={() => setActiveTab("moyens")}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeTab === "moyens" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <Wrench className="h-5 w-5" />
              <span>Moyens</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs text-primary font-medium"
            >
              {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              <span>Sauver</span>
            </button>
          </div>
        </div>
      )}
      <PdfPreviewDialog
        open={!!pdfPreview}
        onClose={() => setPdfPreview(null)}
        blobUrl={pdfPreview?.blobUrl || null}
        dataUri={pdfPreview?.dataUri || null}
        fileName={pdfPreview?.fileName || ""}
        clientEmail={client?.email || ""}
        clientName={client?.name || ""}
        visiteCode={visite.code || ""}
        visiteTitle={visite.title || ""}
        visiteId={visite.id}
        companyId={visite.company_id}
      />
      <UnsavedChangesDialog
        open={isBlocked}
        onStay={reset}
        onDiscard={proceed}
        onSave={saveAndProceed}
        saving={saveMutation.isPending}
      />
    </div>
  );
};

/* Reusable address block */
interface AddressBlockProps {
  title: string;
  prefix: "origin" | "dest";
  data: any;
  onChange: (field: string, value: any) => void;
}

const AddressBlock = ({ title, prefix, data, onChange }: AddressBlockProps) => (
  <div className="rounded-xl border bg-card p-5 space-y-3">
    <h3 className="font-semibold text-primary flex items-center gap-2"><MapPin className="h-4 w-4" /> {title}</h3>
    <Input value={data[`${prefix}_reference`] || ""} onChange={(e) => onChange(`${prefix}_reference`, e.target.value)} placeholder="Référence" />
    <Input value={data[`${prefix}_name`] || ""} onChange={(e) => onChange(`${prefix}_name`, e.target.value)} placeholder="Nom / Société" />
    <AddressAutocomplete
      value={data[`${prefix}_address_line1`] || ""}
      onChange={(v) => onChange(`${prefix}_address_line1`, v)}
      onSelect={(s) => {
        if (s.postcode) onChange(`${prefix}_postal_code`, s.postcode);
        if (s.city) onChange(`${prefix}_city`, s.city);
      }}
      placeholder="Adresse ligne 1"
    />
    <Input value={data[`${prefix}_address_line2`] || ""} onChange={(e) => onChange(`${prefix}_address_line2`, e.target.value)} placeholder="Adresse ligne 2" />
    <div className="grid grid-cols-3 gap-3">
      <Input value={data[`${prefix}_postal_code`] || ""} onChange={(e) => onChange(`${prefix}_postal_code`, e.target.value)} placeholder="CP" />
      <Input value={data[`${prefix}_city`] || ""} onChange={(e) => onChange(`${prefix}_city`, e.target.value)} placeholder="Ville" className="col-span-2" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Input value={data[`${prefix}_floor`] || ""} onChange={(e) => onChange(`${prefix}_floor`, e.target.value)} placeholder="Étage" />
      <div>
        <Label>Portage</Label>
        <Input type="number" value={data[`${prefix}_portage`] || 0} onChange={(e) => onChange(`${prefix}_portage`, Number(e.target.value))} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={data[`${prefix}_elevator`] || false} onCheckedChange={(v) => onChange(`${prefix}_elevator`, v)} />
        Ascenseur
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={data[`${prefix}_furniture_lift`] || false} onCheckedChange={(v) => onChange(`${prefix}_furniture_lift`, v)} />
        Monte-meubles
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={data[`${prefix}_transshipment`] || false} onCheckedChange={(v) => onChange(`${prefix}_transshipment`, v)} />
        Transbordement
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={data[`${prefix}_window`] || false} onCheckedChange={(v) => onChange(`${prefix}_window`, v)} />
        Passage fenêtre
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={data[`${prefix}_heavy_vehicle`] || false} onCheckedChange={(v) => onChange(`${prefix}_heavy_vehicle`, v)} />
        Poids lourd
      </label>
    </div>
    <div>
      <Label>Accès</Label>
      <Input value={data[`${prefix}_access`] || ""} onChange={(e) => onChange(`${prefix}_access`, e.target.value)} placeholder="Conditions d'accès" />
    </div>
  </div>
);

export default VisiteDetail;
