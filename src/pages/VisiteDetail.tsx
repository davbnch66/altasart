import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Pencil, MapPin, Calendar, Clock, User, ClipboardCheck, FileText, FolderOpen, BookOpen, Save, Loader2, LayoutGrid, Package, Link2, Users, Truck, ShieldAlert, ClipboardList, Download, Camera } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect, useRef } from "react";
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

const VisiteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("rdv");
  const isMobile = useIsMobile();
  const photoInputRef = useRef<HTMLInputElement>(null);

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
      // Remove read-only fields
      delete rest.created_at;
      delete rest.updated_at;
      const { error } = await supabase.from("visites").update(rest).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visite mise à jour");
      queryClient.invalidateQueries({ queryKey: ["visite-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["visites"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const handleSave = () => {
    if (editData) saveMutation.mutate(editData);
  };

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
      // Link visite to dossier
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

  return (
    <div className={`p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 md:space-y-6 ${isMobile ? "pb-24" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/visites")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate">
              Visite {visite.code ? `#${visite.code}` : visite.title}
            </h1>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[visite.status]}`}>
              {statusLabels[visite.status] || visite.status}
            </span>
            {visite.on_hold && <span className="text-xs bg-warning/10 text-warning rounded-full px-2 py-0.5">En attente</span>}
          </div>
          {client && (
            <p className="text-muted-foreground text-sm mt-0.5 truncate cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/clients/${client.id}`)}>
              {client.name} {client.code ? `(${client.code})` : ""}
            </p>
          )}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <select
            value={editData.status}
            onChange={(e) => updateField("status", e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="planifiee">Planifiée</option>
            <option value="realisee">Réalisée</option>
            <option value="annulee">Annulée</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={editData.on_hold || false} onCheckedChange={(v) => updateField("on_hold", v)} />
            En attente
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setExporting(true);
              try {
                await generateVisitePdf(id!);
                toast.success("Rapport PDF généré");
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
          <ApplyTemplateDialog visiteId={visite.id} companyId={visite.company_id} />
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Enregistrer
          </Button>
        </div>
        {/* Mobile: compact save button */}
        <div className="flex md:hidden items-center gap-1">
          <Button size="icon" variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Client info bar */}
      {client && (
        <div className="rounded-xl border bg-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">Client</span><p className="font-medium">{client.name}</p></div>
          <div><span className="text-muted-foreground">Tél.</span><p className="font-medium">{client.mobile || client.phone || "—"}</p></div>
          <div><span className="text-muted-foreground">Email</span><p className="font-medium truncate">{client.email || "—"}</p></div>
          <div><span className="text-muted-foreground">Adresse</span><p className="font-medium">{client.address || "—"}</p></div>
        </div>
      )}

      {/* Smart Alerts */}
      <VisiteSmartAlerts visiteId={visite.id} companyId={visite.company_id} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full">
          <TabsTrigger value="rdv" className="text-xs">RDV</TabsTrigger>
          <TabsTrigger value="visite" className="text-xs">Visite</TabsTrigger>
          <TabsTrigger value="pieces" className="text-xs"><LayoutGrid className="h-3 w-3 mr-1" />Pièces</TabsTrigger>
          <TabsTrigger value="materiel" className="text-xs"><Package className="h-3 w-3 mr-1" />Matériel</TabsTrigger>
          <TabsTrigger value="affectation" className="text-xs"><Link2 className="h-3 w-3 mr-1" />Affectation</TabsTrigger>
          <TabsTrigger value="rh" className="text-xs"><Users className="h-3 w-3 mr-1" />RH</TabsTrigger>
          <TabsTrigger value="vehicules" className="text-xs"><Truck className="h-3 w-3 mr-1" />Véhicules</TabsTrigger>
          <TabsTrigger value="contraintes" className="text-xs"><ShieldAlert className="h-3 w-3 mr-1" />Accès</TabsTrigger>
          <TabsTrigger value="methodologie" className="text-xs"><ClipboardList className="h-3 w-3 mr-1" />Méthodo</TabsTrigger>
          <TabsTrigger value="dossier" className="text-xs">Dossier</TabsTrigger>
          <TabsTrigger value="devis" className="text-xs">Devis</TabsTrigger>
          <TabsTrigger value="instructions" className="text-xs">Instructions</TabsTrigger>
        </TabsList>

        {/* Tab: Rendez-vous */}
        <TabsContent value="rdv" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-primary flex items-center gap-2"><Calendar className="h-4 w-4" /> Rendez-vous</h3>
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
              <h3 className="font-semibold text-primary flex items-center gap-2"><User className="h-4 w-4" /> Destinataire de la visite</h3>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="font-semibold text-primary flex items-center gap-2"><MapPin className="h-4 w-4" /> Adresse du rendez-vous</h3>
              <Input value={editData.address || ""} onChange={(e) => updateField("address", e.target.value)} placeholder="Adresse" />
              <div className="grid grid-cols-3 gap-3">
                <Input value={editData.origin_postal_code || ""} onChange={(e) => updateField("origin_postal_code", e.target.value)} placeholder="Code postal" />
                <Input value={editData.origin_city || ""} onChange={(e) => updateField("origin_city", e.target.value)} placeholder="Ville" className="col-span-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input value={editData.origin_floor || ""} onChange={(e) => updateField("origin_floor", e.target.value)} placeholder="Étage" />
                <Input value={editData.origin_country || "FRANCE"} onChange={(e) => updateField("origin_country", e.target.value)} placeholder="Pays" />
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="font-semibold text-primary">Commentaire</h3>
              <Textarea value={editData.comment || ""} onChange={(e) => updateField("comment", e.target.value)} rows={6} placeholder="Commentaires sur la visite..." />
            </div>
          </div>
        </TabsContent>

        {/* Tab: Visite */}
        <TabsContent value="visite" className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-primary">Période</h3>
            <Input value={editData.period || ""} onChange={(e) => updateField("period", e.target.value)} placeholder="Ex: JUIN 2026 ET FIN AOUT 2026" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AddressBlock title="Adresse origine" prefix="origin" data={editData} onChange={updateField} />
            <AddressBlock title="Adresse destination" prefix="dest" data={editData} onChange={updateField} />
          </div>

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
              <Label>Photos</Label>
              <p className="text-2xl font-bold mt-1">{visite.photos_count || 0}</p>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Pièces / Zones */}
        <TabsContent value="pieces">
          <VisitePiecesTab visiteId={visite.id} companyId={visite.company_id} />
        </TabsContent>

        {/* Tab: Matériel */}
        <TabsContent value="materiel">
          <VisiteMaterielTab visiteId={visite.id} companyId={visite.company_id} />
        </TabsContent>

        {/* Tab: Affectation */}
        <TabsContent value="affectation">
          <VisiteAffectationTab visiteId={visite.id} companyId={visite.company_id} />
        </TabsContent>

        {/* Tab: Ressources Humaines */}
        <TabsContent value="rh">
          <VisiteRHTab visiteId={visite.id} companyId={visite.company_id} />
        </TabsContent>

        {/* Tab: Véhicules et Engins */}
        <TabsContent value="vehicules">
          <VisiteVehiculesTab visiteId={visite.id} companyId={visite.company_id} />
        </TabsContent>

        {/* Tab: Contraintes */}
        <TabsContent value="contraintes">
          <VisiteContraintesTab visiteId={visite.id} companyId={visite.company_id} />
        </TabsContent>

        {/* Tab: Méthodologie */}
        <TabsContent value="methodologie">
          <VisiteMethodologieTab visiteId={visite.id} companyId={visite.company_id} />
        </TabsContent>

        {/* Tab: Dossier */}
        <TabsContent value="dossier" className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-primary">Codification complémentaire</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Date prévisionnelle de chargement</Label>
                <Input type="date" value={editData.loading_date || ""} onChange={(e) => updateField("loading_date", e.target.value)} />
              </div>
              <div>
                <Label>Type de devis</Label>
                <Input value={editData.devis_type || ""} onChange={(e) => updateField("devis_type", e.target.value)} placeholder="DN, DA..." />
              </div>
              <div>
                <Label>Nature</Label>
                <Input value={editData.nature || ""} onChange={(e) => updateField("nature", e.target.value)} placeholder="MANUTENTION, DEMENAGEMENT..." />
              </div>
              <div>
                <Label>Type opération</Label>
                <Input value={editData.operation_type || ""} onChange={(e) => updateField("operation_type", e.target.value)} placeholder="M, D..." />
              </div>
              <div>
                <Label>Tractionnaire</Label>
                <Input value={editData.contractor || ""} onChange={(e) => updateField("contractor", e.target.value)} />
              </div>
              <div>
                <Label>Qualité</Label>
                <Input type="number" value={editData.quality || 1} onChange={(e) => updateField("quality", Number(e.target.value))} min={1} />
              </div>
            </div>
          </div>

          {dossier ? (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold mb-2">Dossier lié</h3>
              <p className="text-primary cursor-pointer hover:underline flex items-center gap-2" onClick={() => navigate(`/dossiers/${dossier.id}`)}>
                <FolderOpen className="h-4 w-4" /> {dossier.code || dossier.title}
              </p>
            </div>
          ) : (
            <Button variant="outline" onClick={() => convertToDossier.mutate()} disabled={convertToDossier.isPending} className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              {convertToDossier.isPending ? "Conversion..." : "Convertir la visite en dossier"}
            </Button>
          )}
        </TabsContent>

        {/* Tab: Éléments du devis */}
        <TabsContent value="devis" className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-primary flex items-center gap-2"><FileText className="h-4 w-4" /> Mémo devis</h3>
            <Textarea value={editData.notes || ""} onChange={(e) => updateField("notes", e.target.value)} rows={12} placeholder="Description détaillée pour le devis..." />
            <p className="text-xs text-muted-foreground">Le texte saisi dans le champ Mémo devis sera disponible au moment de la création du devis.</p>
          </div>
        </TabsContent>

        {/* Tab: Instructions */}
        <TabsContent value="instructions" className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-primary flex items-center gap-2"><BookOpen className="h-4 w-4" /> Instructions</h3>
            <Textarea value={editData.instructions || ""} onChange={(e) => updateField("instructions", e.target.value)} rows={15} placeholder="Instructions détaillées pour l'opération..." />
          </div>
        </TabsContent>
      </Tabs>

      {/* Hidden photo input for mobile quick action */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          // Upload to first piece or general
          try {
            const { data: piecesData } = await supabase.from("visite_pieces").select("id").eq("visite_id", visite.id).order("sort_order").limit(1);
            const pieceId = piecesData?.[0]?.id || null;
            const path = `${visite.id}/${pieceId || "general"}/${Date.now()}_${file.name}`;
            const { error: uploadErr } = await supabase.storage.from("visite-photos").upload(path, file);
            if (uploadErr) throw uploadErr;
            await supabase.from("visite_photos").insert({
              visite_id: visite.id,
              piece_id: pieceId,
              company_id: visite.company_id,
              storage_path: path,
              file_name: file.name,
            });
            toast.success("Photo ajoutée");
            queryClient.invalidateQueries({ queryKey: ["visite-photos", visite.id] });
          } catch (err: any) {
            toast.error(err.message || "Erreur upload");
          }
          e.target.value = "";
        }}
      />

      {/* Mobile floating action bar */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border px-2 py-2 safe-area-bottom">
          <div className="flex items-center justify-around gap-1">
            <button
              onClick={() => setActiveTab("pieces")}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeTab === "pieces" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-5 w-5" />
              <span>Pièces</span>
            </button>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Camera className="h-5 w-5" />
              <span>Photo</span>
            </button>
            <button
              onClick={() => setActiveTab("materiel")}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeTab === "materiel" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <Package className="h-5 w-5" />
              <span>Matériel</span>
            </button>
            <button
              onClick={() => setActiveTab("affectation")}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeTab === "affectation" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <Link2 className="h-5 w-5" />
              <span>Affecter</span>
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
    <Input value={data[`${prefix}_address_line1`] || ""} onChange={(e) => onChange(`${prefix}_address_line1`, e.target.value)} placeholder="Adresse ligne 1" />
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
