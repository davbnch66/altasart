import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DevisLinesManager } from "@/components/DevisLinesManager";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Pencil, FileText, Check, X, Send, CalendarPlus, Loader2, FolderOpen, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { format } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { GenerateDevisContentButton } from "@/components/devis/GenerateDevisContentButton";

import { EditDevisDialog } from "@/components/forms/EditDevisDialog";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
import { DevisStatusSelect } from "@/components/DevisStatusSelect";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DetailBreadcrumb } from "@/components/DetailBreadcrumb";
import { DevisApplyTemplateDialog } from "@/components/devis/ApplyTemplateDialog";
import { SendSignatureDialog } from "@/components/devis/SendSignatureDialog";
import { DevisRelancesSection } from "@/components/devis/DevisRelancesSection";
import { ScheduleChantierDialog } from "@/components/devis/ScheduleChantierDialog";
import { GeneratePpspsButton } from "@/components/devis/GeneratePpspsButton";
import { DownloadWordButton } from "@/components/shared/DownloadWordButton";
import { GenerateDevisMemoButton } from "@/components/devis/GenerateDevisMemoButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GenericPdfPreviewDialog } from "@/components/shared/GenericPdfPreviewDialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const statusStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  refuse: "bg-destructive/10 text-destructive",
  expire: "bg-warning/10 text-warning",
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd/MM/yyyy"); } catch { return "—"; }
};

// Inline editable field component
const InlineEdit = ({ value, onSave, type = "text", label, multiline = false }: {
  value: string;
  onSave: (val: string) => void;
  type?: string;
  label: string;
  multiline?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="w-full text-left group"
        title={`Modifier ${label}`}
      >
        <span className="group-hover:underline group-hover:decoration-dashed group-hover:underline-offset-2 group-hover:decoration-muted-foreground/50">
          {value || <span className="text-muted-foreground italic">Cliquez pour ajouter</span>}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 inline ml-1.5 transition-colors" />
      </button>
    );
  }

  return (
    <div className="flex items-start gap-1.5">
      {multiline ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="text-xs min-h-[60px]"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Escape") handleCancel(); }}
        />
      ) : (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          type={type}
          className="h-8 text-xs"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
      )}
      <button onClick={handleSave} className="p-1 rounded hover:bg-success/10 shrink-0 mt-0.5">
        <Check className="h-3.5 w-3.5 text-success" />
      </button>
      <button onClick={handleCancel} className="p-1 rounded hover:bg-muted shrink-0 mt-0.5">
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
};

const DevisDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [sendingSignature, setSendingSignature] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ blobUrl: string; fileName: string; dataUri: string } | null>(null);
  const [creatingDossier, setCreatingDossier] = useState(false);
  const isMobile = useIsMobile();
  const fromClient = (location.state as any)?.fromClient === true;
  const fromDossier = (location.state as any)?.fromDossier as string | undefined;
  const customContentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: devis, isLoading } = useQuery({
    queryKey: ["devis-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis")
        .select("*, clients(id, name, email, phone, address, city, postal_code), companies(short_name, name, color), dossiers(id, code, title, stage, loading_address, loading_postal_code, loading_city, loading_floor, loading_elevator, delivery_address, delivery_postal_code, delivery_city, delivery_floor, delivery_elevator, volume, weight)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["devis-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis_lines")
        .select("*")
        .eq("devis_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch client dossiers for linking
  const { data: clientDossiers = [] } = useQuery({
    queryKey: ["client-dossiers", devis?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("id, code, title, stage")
        .eq("client_id", devis!.client_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!devis?.client_id,
  });

  const [linkingDossier, setLinkingDossier] = useState(false);
  const [creatingNewDossier, setCreatingNewDossier] = useState(false);
  const [newDossierTitle, setNewDossierTitle] = useState("");

  const updateField = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("devis").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis mis à jour");
      queryClient.invalidateQueries({ queryKey: ["devis-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["devis"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const linkDossier = async (dossierId: string) => {
    await supabase.from("devis").update({ dossier_id: dossierId }).eq("id", id!);
    // Also link the associated visite to the same dossier
    if (devis?.visite_id) {
      await supabase.from("visites").update({ dossier_id: dossierId }).eq("id", devis.visite_id);
      queryClient.invalidateQueries({ queryKey: ["visites"] });
    }
    queryClient.invalidateQueries({ queryKey: ["devis-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["devis"] });
    queryClient.invalidateQueries({ queryKey: ["dossier-visites"] });
    setLinkingDossier(false);
    toast.success("Dossier rattaché");
  };

  const createAndLinkDossier = async () => {
    if (!newDossierTitle.trim() || !devis) return;
    try {
      const { data: newD, error } = await supabase.from("dossiers").insert({
        title: newDossierTitle.trim(),
        client_id: devis.client_id,
        company_id: devis.company_id,
        stage: "prospect" as any,
        amount: devis.amount,
        origin: "devis",
      }).select("id").single();
      if (error) throw error;
      await supabase.from("devis").update({ dossier_id: newD.id }).eq("id", id!);
      // Also link the associated visite to the new dossier
      if (devis.visite_id) {
        await supabase.from("visites").update({ dossier_id: newD.id }).eq("id", devis.visite_id);
        queryClient.invalidateQueries({ queryKey: ["visites"] });
        queryClient.invalidateQueries({ queryKey: ["dossier-visites"] });
      }
      queryClient.invalidateQueries({ queryKey: ["devis-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["client-dossiers", devis.client_id] });
      setCreatingNewDossier(false);
      setLinkingDossier(false);
      setNewDossierTitle("");
      toast.success("Dossier créé et rattaché");
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || "Impossible de créer le dossier"));
    }
  };

  if (isLoading) {
    return (
      <div className={`max-w-5xl mx-auto space-y-4 ${isMobile ? "p-3" : "p-6 lg:p-8 space-y-6"}`}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!devis) {
    return (
      <div className={`max-w-5xl mx-auto text-center py-20 ${isMobile ? "p-3" : "p-6 lg:p-8"}`}>
        <p className="text-muted-foreground">Devis introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/devis")}>Retour</Button>
      </div>
    );
  }

  const client = devis.clients as any;
  const company = devis.companies as any;
  const dossier = devis.dossiers as any;

  return (
    <div className={`max-w-5xl mx-auto animate-fade-in ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Breadcrumb */}
      <DetailBreadcrumb items={[
        ...(fromClient && client?.id ? [{ label: client.name, path: `/clients/${client.id}` }] : []),
        ...(fromDossier && dossier ? [{ label: dossier.code || dossier.title, path: `/dossiers/${fromDossier}`, state: { fromClient } }] : !fromClient ? [{ label: "Devis", path: "/devis" }] : []),
        { label: devis.code || "Devis" },
      ]} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className={isMobile ? "h-8 w-8" : ""}>
          <ArrowLeft className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className={`font-bold tracking-tight flex items-center gap-2 ${isMobile ? "text-base" : "text-2xl gap-3"}`}>
            {!isMobile && <FileText className="h-6 w-6 text-muted-foreground" />}
            <span className="truncate">{devis.code || `Devis ${devis.id.slice(0, 8)}`}</span>
          </h1>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={async () => {
              try {
                const result = await generateDevisPdf(devis.id, false, true);
                if (result && typeof result === "object") setPdfPreview(result as any);
              } catch { toast.error("Erreur PDF"); }
            }}>
            <Eye className="h-4 w-4" />
            {!isMobile && <span className="ml-1">Aperçu</span>}
          </Button>
          <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={() => generateDevisPdf(devis.id).catch(() => toast.error("Erreur PDF"))}>
            <Download className="h-4 w-4" />
            {!isMobile && <span className="ml-1">PDF</span>}
          </Button>
          <DownloadWordButton
            companyId={devis.company_id}
            documentType="devis"
            documentId={devis.id}
            fileName={`Devis_${devis.code || devis.id.slice(0, 8)}.docx`}
            size={isMobile ? "sm" : "sm"}
          />
          <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={() => setSendingSignature(true)}>
            <Send className="h-4 w-4" />
            {!isMobile && <span className="ml-1">Envoyer</span>}
          </Button>
          <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            {!isMobile && <span className="ml-1">Modifier</span>}
          </Button>
          {devis.status === "accepte" && (
            <GeneratePpspsButton devis={devis} isMobile={isMobile} />
          )}
          {devis.status === "accepte" && dossier && (
            <Button size={isMobile ? "icon" : "sm"} onClick={() => setScheduling(true)}>
              <CalendarPlus className="h-4 w-4" />
              {!isMobile && <span className="ml-1">Programmer</span>}
            </Button>
          )}
          {devis.status === "accepte" && !dossier && (
            <Button size={isMobile ? "icon" : "sm"} disabled={creatingDossier} onClick={async () => {
              setCreatingDossier(true);
              try {
                const client = devis.clients as any;
                const { data: newDossier, error } = await supabase.from("dossiers").insert({
                  title: devis.objet,
                  client_id: devis.client_id,
                  company_id: devis.company_id,
                  stage: "accepte" as any,
                  amount: devis.amount,
                  address: client?.address || null,
                  origin: "devis",
                }).select("id, code, title, stage, loading_address, loading_postal_code, loading_city, loading_floor, loading_elevator, delivery_address, delivery_postal_code, delivery_city, delivery_floor, delivery_elevator, volume, weight").single();
                if (error) throw error;
                // Link devis to dossier
                await supabase.from("devis").update({ dossier_id: newDossier.id }).eq("id", devis.id);
                // Also link the associated visite to the new dossier
                if (devis.visite_id) {
                  await supabase.from("visites").update({ dossier_id: newDossier.id }).eq("id", devis.visite_id);
                  queryClient.invalidateQueries({ queryKey: ["visites"] });
                  queryClient.invalidateQueries({ queryKey: ["dossier-visites"] });
                }
                await queryClient.invalidateQueries({ queryKey: ["devis-detail", id] });
                toast.success("Dossier créé et lié automatiquement");
                // Open scheduling dialog after a short delay for the query to refetch
                setTimeout(() => setScheduling(true), 300);
              } catch (e: any) {
                toast.error("Erreur : " + (e.message || "Impossible de créer le dossier"));
              } finally {
                setCreatingDossier(false);
              }
            }}>
              {creatingDossier ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {!isMobile && <span className="ml-1">Programmer</span>}
            </Button>
          )}
        </div>
      </motion.div>

      {/* Objet — editable inline */}
      <div className={`card-elevated ${isMobile ? "p-3" : "p-4"}`}>
        <h3 className="section-label mb-1">Objet</h3>
        <div className={isMobile ? "text-sm" : "text-base"}>
          <InlineEdit
            value={devis.objet}
            onSave={(val) => val.trim() && updateField.mutate({ objet: val.trim() })}
            label="l'objet"
          />
        </div>
      </div>

      {/* Status + montant */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4 gap-4"}`}>
        <div className={`stat-card ${isMobile ? "!p-3" : ""}`}>
          <p className="stat-label">Statut</p>
          <div className="mt-1">
            <DevisStatusSelect devisId={devis.id} currentStatus={devis.status} />
          </div>
        </div>
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <p className="text-[11px] text-muted-foreground">Montant global</p>
          <div className={`font-bold mt-0.5 ${isMobile ? "text-sm" : "text-lg"}`}>
            <InlineEdit
              value={String(devis.amount)}
              onSave={(val) => {
                const num = parseFloat(val);
                if (!isNaN(num) && num >= 0) updateField.mutate({ amount: num });
              }}
              type="number"
              label="le montant"
            />
          </div>
        </div>
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <p className="text-[11px] text-muted-foreground">Création</p>
          <p className={`font-medium mt-0.5 ${isMobile ? "text-xs" : "text-sm"}`}>{formatDate(devis.created_at)}</p>
        </div>
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <p className="text-[11px] text-muted-foreground">Validité</p>
          <div className={`font-medium mt-0.5 ${isMobile ? "text-xs" : "text-sm"}`}>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-left group flex items-center gap-1" title="Modifier la date de validité">
                  <span className="group-hover:underline group-hover:decoration-dashed group-hover:underline-offset-2 group-hover:decoration-muted-foreground/50">
                    {devis.valid_until ? formatDate(devis.valid_until) : <span className="text-muted-foreground italic text-xs">Non définie</span>}
                  </span>
                  <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={devis.valid_until ? new Date(devis.valid_until) : undefined}
                  onSelect={(date) => {
                    if (date) updateField.mutate({ valid_until: date.toISOString().split("T")[0] });
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </motion.div>

      {/* Client + Société + Dossier */}
      <div className={`grid gap-3 ${isMobile ? "" : "lg:grid-cols-3 gap-4"}`}>
        <div className={`rounded-xl border bg-card space-y-1.5 ${isMobile ? "p-3" : "p-5 space-y-2"}`}>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Client</h3>
          <p className={`font-medium ${isMobile ? "text-sm" : ""}`}>
            {client?.id ? <button onClick={() => navigate(`/clients/${client.id}`)} className="hover:underline text-left">{client.name}</button> : "—"}
          </p>
          {client?.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
          {client?.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
          {client?.address && <p className="text-xs text-muted-foreground truncate">{client.address}{client.postal_code ? `, ${client.postal_code}` : ""}{client.city ? ` ${client.city}` : ""}</p>}
        </div>
        <div className={`rounded-xl border bg-card space-y-1.5 ${isMobile ? "p-3" : "p-5 space-y-2"}`}>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Dossier</h3>
          {dossier ? (
            <>
              <p className={`font-medium ${isMobile ? "text-sm" : ""}`}>
                <button onClick={() => navigate(`/dossiers/${dossier.id}`)} className="hover:underline text-left">
                  {dossier.code ? `${dossier.code} — ` : ""}{dossier.title}
                </button>
              </p>
              {dossier.stage && <p className="text-xs text-muted-foreground capitalize">Étape : {dossier.stage.replace(/_/g, " ")}</p>}
              <button onClick={() => setLinkingDossier(true)} className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">Changer</button>
            </>
          ) : linkingDossier ? (
            <div className="space-y-2">
              {!creatingNewDossier ? (
                <>
                  {clientDossiers.length > 0 && (
                    <Select onValueChange={(v) => linkDossier(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choisir un dossier existant" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientDossiers.map((d) => (
                          <SelectItem key={d.id} value={d.id} className="text-xs">
                            {d.code ? `${d.code} — ` : ""}{d.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <button onClick={() => { setCreatingNewDossier(true); setNewDossierTitle(devis.objet); }} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="h-3 w-3" /> Créer un nouveau dossier
                  </button>
                  <button onClick={() => setLinkingDossier(false)} className="text-[10px] text-muted-foreground hover:underline">Annuler</button>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    value={newDossierTitle}
                    onChange={(e) => setNewDossierTitle(e.target.value)}
                    placeholder="Titre du dossier"
                    className="h-8 text-xs"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") createAndLinkDossier(); if (e.key === "Escape") setCreatingNewDossier(false); }}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs" onClick={createAndLinkDossier} disabled={!newDossierTitle.trim()}>Créer</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreatingNewDossier(false)}>Annuler</Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setLinkingDossier(true)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <FolderOpen className="h-3.5 w-3.5" /> Rattacher à un dossier
            </button>
          )}
        </div>
        <div className={`rounded-xl border bg-card space-y-1.5 ${isMobile ? "p-3" : "p-5 space-y-2"}`}>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Société</h3>
          <p className={`font-medium ${isMobile ? "text-sm" : ""}`}>{company?.name || company?.short_name || "—"}</p>
        </div>
      </div>

      {/* Mode de contenu du devis */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mode de contenu du devis</h3>
          <Select value={devis.content_mode || "lines"} onValueChange={(v) => updateField.mutate({ content_mode: v })}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lines">Lignes détaillées</SelectItem>
              <SelectItem value="custom">Contenu libre</SelectItem>
              <SelectItem value="both">Les deux</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom content editor */}
        {(devis.content_mode === "custom" || devis.content_mode === "both") && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Contenu libre — affiché dans le PDF{devis.content_mode === "both" ? " avant les lignes de prix" : ""}.</p>
              <GenerateDevisContentButton
                devisId={devis.id}
                onGenerated={(html) => {
                  updateField.mutate({ custom_content: html });
                }}
              />
            </div>
            <RichTextEditor
              value={devis.custom_content || ""}
              onChange={(html) => {
                if (customContentTimer.current) clearTimeout(customContentTimer.current);
                customContentTimer.current = setTimeout(() => {
                  updateField.mutate({ custom_content: html });
                }, 1000);
              }}
              minHeight="200px"
            />
          </div>
        )}

        {/* Lines editor */}
        {(devis.content_mode === "lines" || devis.content_mode === "both" || !devis.content_mode) && (
          <>
            {devis.content_mode === "both" && <Separator className="my-4" />}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Lignes & Templates</p>
              <DevisApplyTemplateDialog onApply={async (templateLines) => {
                for (const line of templateLines) {
                  await supabase.from("devis_lines").insert({
                    devis_id: devis.id,
                    description: line.description,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    sort_order: lines.length + templateLines.indexOf(line),
                  });
                }
                const totalTemplate = templateLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
                const newTotal = lines.reduce((s, l) => s + (l.total ?? l.quantity * l.unit_price), 0) + totalTemplate;
                await supabase.from("devis").update({ amount: newTotal }).eq("id", devis.id);
                queryClient.invalidateQueries({ queryKey: ["devis-lines", id] });
                queryClient.invalidateQueries({ queryKey: ["devis-detail", id] });
                toast.success("Template appliqué");
              }} />
            </div>
            <DevisLinesManager devisId={devis.id} lines={lines} totalAmount={devis.amount} devisObjet={devis.objet} companyId={devis.company_id} />
          </>
        )}
      </div>

      {/* Notes — editable inline */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Notes</h3>
          <GenerateDevisMemoButton
            devisId={devis.id}
            onGenerated={(memo) => updateField.mutate({ notes: memo })}
            size="sm"
          />
        </div>
        <div className="text-xs whitespace-pre-wrap">
          <InlineEdit
            value={devis.notes || ""}
            onSave={(val) => updateField.mutate({ notes: val.trim() || null })}
            label="les notes"
            multiline
          />
        </div>
      </div>

      {/* Relances */}
      <DevisRelancesSection devis={devis} />

      {editing && (
        <EditDevisDialog devis={devis} open={editing} onOpenChange={(v) => !v && setEditing(false)} />
      )}
      {sendingSignature && (
        <SendSignatureDialog devis={devis} open={sendingSignature} onOpenChange={(v) => !v && setSendingSignature(false)} />
      )}
      {scheduling && dossier && (
        <ScheduleChantierDialog devis={devis} dossier={dossier} open={scheduling} onOpenChange={(v) => !v && setScheduling(false)} />
      )}
      <GenericPdfPreviewDialog
        open={!!pdfPreview}
        onClose={() => setPdfPreview(null)}
        blobUrl={pdfPreview?.blobUrl || null}
        dataUri={pdfPreview?.dataUri || null}
        fileName={pdfPreview?.fileName || ""}
      />
    </div>
  );
};

export default DevisDetail;
