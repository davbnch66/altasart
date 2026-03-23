import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DevisLinesManager } from "@/components/DevisLinesManager";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Pencil, FileText, Check, X, Send, CalendarPlus, Loader2, FolderOpen, Plus, Eye, ChevronRight, CheckCircle } from "lucide-react";
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

  // Fetch signature status
  const { data: signatureData } = useQuery({
    queryKey: ["devis-signature", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("devis_signatures")
        .select("status, signed_at, signer_name")
        .eq("devis_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
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
      <div className={`max-w-6xl mx-auto space-y-4 ${isMobile ? "p-3" : "p-6 lg:p-8 space-y-6"}`}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!devis) {
    return (
      <div className={`max-w-6xl mx-auto text-center py-20 ${isMobile ? "p-3" : "p-6 lg:p-8"}`}>
        <p className="text-muted-foreground">Devis introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/devis")}>Retour</Button>
      </div>
    );
  }

  const client = devis.clients as any;
  const company = devis.companies as any;
  const dossier = devis.dossiers as any;

  const breadcrumbItems = [
    ...(fromClient && client?.id ? [{ label: client.name, path: `/clients/${client.id}` }] : []),
    ...(fromDossier && dossier ? [{ label: dossier.code || dossier.title, path: `/dossiers/${fromDossier}`, state: { fromClient } }] : !fromClient ? [{ label: "Devis", path: "/devis" }] : []),
    { label: devis.code || "Devis" },
  ];

  const hasSigPending = signatureData?.status === "pending";
  const hasSigSigned = signatureData?.status === "signed" || devis.status === "accepte";

  // --- Sidebar content (shared mobile/desktop) ---
  const sidebarContent = (
    <div className="space-y-4">
      {/* Carte principale */}
      <div className="card-elevated p-5 space-y-4">
        <div className="flex items-center justify-between">
          <DevisStatusSelect devisId={devis.id} currentStatus={devis.status} />
          <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{devis.code}</span>
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight leading-tight">{devis.objet}</h1>
        </div>
        {/* Montant */}
        <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Montant HT</p>
          <p className="text-2xl font-black tabular-nums text-primary">{formatAmount(devis.amount || 0)}</p>
        </div>
        {/* Client */}
        {client && (
          <div>
            <p className="section-label mb-2">Client</p>
            <button onClick={() => navigate(`/clients/${client.id}`)}
              className="w-full flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors text-left group">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {client.name?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{client.name}</p>
                {client.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-muted-foreground mb-0.5">Créé le</p>
            <p className="font-medium">{formatDate(devis.created_at)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-muted-foreground mb-0.5">Valide jusqu'au</p>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-left group flex items-center gap-1 w-full" title="Modifier la date de validité">
                  <span className={`font-medium group-hover:underline group-hover:decoration-dashed ${devis.valid_until && new Date(devis.valid_until) < new Date() && devis.status !== "accepte" ? "text-destructive" : ""}`}>
                    {devis.valid_until ? formatDate(devis.valid_until) : <span className="text-muted-foreground italic">Non définie</span>}
                  </span>
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
      </div>

      {/* Statut signature */}
      {(hasSigPending || hasSigSigned) && (
        <div className={`card-elevated p-4 space-y-2 ${hasSigSigned ? "border-success/30 bg-success/[0.03]" : "border-info/30 bg-info/[0.03]"}`}>
          <p className="section-label">Signature électronique</p>
          {hasSigSigned ? (
            <div className="flex items-center gap-2 text-success text-sm font-semibold">
              <CheckCircle className="h-5 w-5" /> Devis accepté et signé
            </div>
          ) : (
            <div className="flex items-center gap-2 text-info text-sm">
              <Send className="h-4 w-4" /> Lien envoyé — en attente
            </div>
          )}
          {signatureData?.signed_at && (
            <p className="text-xs text-muted-foreground">Signé le {formatDate(signatureData.signed_at)}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="card-elevated p-4 space-y-2">
        <p className="section-label mb-3">Actions</p>
        {devis.status !== "accepte" && devis.status !== "refuse" && (
          <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-sm h-10 btn-primary-glow"
            onClick={() => setSendingSignature(true)}>
            <Send className="h-4 w-4" />
            {hasSigPending ? "Renvoyer pour signature" : "Envoyer pour signature"}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9"
            onClick={async () => {
              try {
                const result = await generateDevisPdf(devis.id, false, true);
                if (result && typeof result === "object" && "blobUrl" in result) setPdfPreview(result as any);
              } catch { toast.error("Erreur PDF"); }
            }}>
            <Eye className="h-3.5 w-3.5" /> Aperçu PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9"
            onClick={() => generateDevisPdf(devis.id).catch(() => toast.error("Erreur PDF"))}>
            <Download className="h-3.5 w-3.5" /> Télécharger
          </Button>
        </div>
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> Modifier le devis
        </Button>
        {dossier ? (
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9 text-left justify-start truncate"
            onClick={() => navigate(`/dossiers/${dossier.id}`)}>
            <FolderOpen className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{dossier.code} — {dossier.title}</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9"
            onClick={() => setLinkingDossier(true)}>
            <FolderOpen className="h-3.5 w-3.5" /> Rattacher à un dossier
          </Button>
        )}
        {devis.status === "accepte" && dossier && (
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9"
            onClick={() => setScheduling(true)}>
            <CalendarPlus className="h-3.5 w-3.5" /> Planifier le chantier
          </Button>
        )}
        {devis.status === "accepte" && !dossier && (
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9" disabled={creatingDossier}
            onClick={async () => {
              setCreatingDossier(true);
              try {
                const cl = devis.clients as any;
                const { data: newDossier, error } = await supabase.from("dossiers").insert({
                  title: devis.objet,
                  client_id: devis.client_id,
                  company_id: devis.company_id,
                  stage: "accepte" as any,
                  amount: devis.amount,
                  address: cl?.address || null,
                  origin: "devis",
                }).select("id, code, title, stage, loading_address, loading_postal_code, loading_city, loading_floor, loading_elevator, delivery_address, delivery_postal_code, delivery_city, delivery_floor, delivery_elevator, volume, weight").single();
                if (error) throw error;
                await supabase.from("devis").update({ dossier_id: newDossier.id }).eq("id", devis.id);
                if (devis.visite_id) {
                  await supabase.from("visites").update({ dossier_id: newDossier.id }).eq("id", devis.visite_id);
                  queryClient.invalidateQueries({ queryKey: ["visites"] });
                  queryClient.invalidateQueries({ queryKey: ["dossier-visites"] });
                }
                await queryClient.invalidateQueries({ queryKey: ["devis-detail", id] });
                toast.success("Dossier créé et lié automatiquement");
                setTimeout(() => setScheduling(true), 300);
              } catch (e: any) {
                toast.error("Erreur : " + (e.message || "Impossible de créer le dossier"));
              } finally {
                setCreatingDossier(false);
              }
            }}>
            {creatingDossier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            Créer dossier & programmer
          </Button>
        )}
        <DownloadWordButton companyId={devis.company_id} documentType="devis" documentId={devis.id}
          fileName={`Devis_${devis.code || devis.id.slice(0, 8)}.docx`} size="sm"
          className="w-full text-xs h-9" />
        <GeneratePpspsButton devis={devis} />
      </div>

      {/* Dossier linking panel */}
      {linkingDossier && !dossier && (
        <div className="card-elevated p-4 space-y-2">
          <p className="section-label mb-2">Rattacher à un dossier</p>
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
      )}

      {/* Société */}
      {company && (
        <div className="card-elevated p-4">
          <p className="section-label mb-1.5">Société</p>
          <p className="text-sm font-medium">{company.name || company.short_name}</p>
        </div>
      )}
    </div>
  );

  // --- Main content (right column) ---
  const mainContent = (
    <div className="space-y-5 min-w-0">
      {/* Contenu du devis */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold">Contenu du devis</h2>
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

      {/* Notes */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold">Notes</h2>
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
    </div>
  );

  return (
    <div className={`max-w-6xl mx-auto animate-fade-in ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <DetailBreadcrumb items={breadcrumbItems} />
      </div>

      {/* Layout */}
      {isMobile ? (
        <div className="space-y-4">
          {sidebarContent}
          {mainContent}
        </div>
      ) : (
        <div className="grid grid-cols-[300px_1fr] gap-6 items-start">
          <div className="sticky top-6">
            {sidebarContent}
          </div>
          {mainContent}
        </div>
      )}

      {/* Dialogs */}
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
