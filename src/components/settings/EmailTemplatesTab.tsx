import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Mail, Info, Sparkles, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TEMPLATE_TYPES = [
  { value: "devis_envoi", label: "Envoi de devis", description: "Email accompagnant le devis envoyé pour signature" },
  { value: "devis_relance_1", label: "1ère relance (J+3)", description: "Email de relance 3 jours après envoi" },
  { value: "devis_relance_2", label: "2ème relance (J+7)", description: "Email de relance 7 jours après envoi" },
  { value: "devis_relance_3", label: "3ème relance (J+14)", description: "Email de relance 14 jours après envoi" },
  { value: "rapport_visite", label: "Rapport de visite", description: "Email accompagnant le rapport PDF de visite" },
  { value: "suivi_client", label: "Suivi / Avis client", description: "Email post-déménagement pour demander un avis" },
];

const VARIABLES_BY_TYPE: Record<string, { key: string; label: string }[]> = {
  devis_envoi: [
    { key: "{{contact_name}}", label: "Prénom/nom du contact client" },
    { key: "{{client_name}}", label: "Raison sociale du client" },
    { key: "{{devis_code}}", label: "N° du devis" },
    { key: "{{devis_objet}}", label: "Objet du devis" },
    { key: "{{devis_amount}}", label: "Montant TTC du devis" },
    { key: "{{devis_valid_until}}", label: "Date de validité du devis" },
    { key: "{{signature_url}}", label: "Lien de signature en ligne" },
    { key: "{{sender_name}}", label: "Nom de l'utilisateur connecté" },
    { key: "{{company_name}}", label: "Nom de la société" },
  ],
  devis_relance_1: [
    { key: "{{contact_name}}", label: "Prénom/nom du contact client" },
    { key: "{{client_name}}", label: "Raison sociale du client" },
    { key: "{{devis_code}}", label: "N° du devis" },
    { key: "{{devis_objet}}", label: "Objet du devis" },
    { key: "{{devis_amount}}", label: "Montant TTC du devis" },
    { key: "{{devis_valid_until}}", label: "Date de validité du devis" },
    { key: "{{devis_sent_at}}", label: "Date d'envoi initial du devis" },
    { key: "{{signature_url}}", label: "Lien de signature en ligne" },
    { key: "{{sender_name}}", label: "Nom de l'utilisateur connecté" },
    { key: "{{company_name}}", label: "Nom de la société" },
  ],
  devis_relance_2: [
    { key: "{{contact_name}}", label: "Prénom/nom du contact client" },
    { key: "{{client_name}}", label: "Raison sociale du client" },
    { key: "{{devis_code}}", label: "N° du devis" },
    { key: "{{devis_objet}}", label: "Objet du devis" },
    { key: "{{devis_amount}}", label: "Montant TTC du devis" },
    { key: "{{devis_valid_until}}", label: "Date de validité du devis" },
    { key: "{{devis_sent_at}}", label: "Date d'envoi initial du devis" },
    { key: "{{signature_url}}", label: "Lien de signature en ligne" },
    { key: "{{sender_name}}", label: "Nom de l'utilisateur connecté" },
    { key: "{{company_name}}", label: "Nom de la société" },
  ],
  devis_relance_3: [
    { key: "{{contact_name}}", label: "Prénom/nom du contact client" },
    { key: "{{client_name}}", label: "Raison sociale du client" },
    { key: "{{devis_code}}", label: "N° du devis" },
    { key: "{{devis_objet}}", label: "Objet du devis" },
    { key: "{{devis_amount}}", label: "Montant TTC du devis" },
    { key: "{{devis_valid_until}}", label: "Date de validité du devis" },
    { key: "{{devis_sent_at}}", label: "Date d'envoi initial du devis" },
    { key: "{{signature_url}}", label: "Lien de signature en ligne" },
    { key: "{{sender_name}}", label: "Nom de l'utilisateur connecté" },
    { key: "{{company_name}}", label: "Nom de la société" },
  ],
  rapport_visite: [
    { key: "{{contact_name}}", label: "Prénom/nom du contact client" },
    { key: "{{client_name}}", label: "Raison sociale du client" },
    { key: "{{visite_title}}", label: "Titre de la visite" },
    { key: "{{visite_date}}", label: "Date de la visite" },
    { key: "{{visite_address}}", label: "Adresse de la visite" },
    { key: "{{dossier_code}}", label: "N° du dossier lié" },
    { key: "{{dossier_title}}", label: "Titre du dossier lié" },
    { key: "{{sender_name}}", label: "Nom de l'utilisateur connecté" },
    { key: "{{company_name}}", label: "Nom de la société" },
  ],
  suivi_client: [
    { key: "{{contact_name}}", label: "Prénom/nom du contact client" },
    { key: "{{client_name}}", label: "Raison sociale du client" },
    { key: "{{dossier_code}}", label: "N° du dossier" },
    { key: "{{dossier_title}}", label: "Titre du dossier / déménagement" },
    { key: "{{dossier_end_date}}", label: "Date de fin du dossier" },
    { key: "{{sender_name}}", label: "Nom de l'utilisateur connecté" },
    { key: "{{company_name}}", label: "Nom de la société" },
  ],
};

// All unique variables for the global info banner
const ALL_VARIABLES = Array.from(
  new Map(
    Object.values(VARIABLES_BY_TYPE).flat().map((v) => [v.key, v])
  ).values()
);

const TONES = [
  { value: "cordial", label: "Cordial" },
  { value: "formel", label: "Formel" },
  { value: "direct", label: "Direct" },
];

const DEFAULT_SUBJECTS: Record<string, string> = {
  devis_envoi: "Devis {{devis_code}} — {{devis_objet}} — {{company_name}}",
  devis_relance_1: "Relance devis {{devis_code}} — {{company_name}}",
  devis_relance_2: "2ème relance devis {{devis_code}} — {{company_name}}",
  devis_relance_3: "Dernière relance devis {{devis_code}} — {{company_name}}",
  rapport_visite: "Rapport de visite — {{visite_title}} — {{company_name}}",
  suivi_client: "Comment s'est passé votre déménagement ? — {{company_name}}",
};

const DEFAULT_BODIES: Record<string, string> = {
  devis_envoi: `Bonjour {{contact_name}},

Veuillez trouver ci-joint notre devis n°{{devis_code}} concernant : {{devis_objet}}.

Montant total : {{devis_amount}}
Valable jusqu'au : {{devis_valid_until}}

Pour accepter ce devis en ligne, cliquez sur le lien suivant :
{{signature_url}}

N'hésitez pas à nous contacter pour toute question.

Cordialement,
{{sender_name}}
{{company_name}}`,
  devis_relance_1: `Bonjour {{contact_name}},

Nous revenons vers vous concernant notre devis n°{{devis_code}} ({{devis_objet}}) d'un montant de {{devis_amount}}, envoyé le {{devis_sent_at}}.

Avez-vous eu l'occasion de le consulter ? Nous sommes disponibles pour répondre à vos questions.

Vous pouvez l'accepter directement en ligne (valable jusqu'au {{devis_valid_until}}) :
{{signature_url}}

Cordialement,
{{sender_name}}
{{company_name}}`,
  devis_relance_2: `Bonjour {{contact_name}},

Nous vous contactons à nouveau concernant le devis n°{{devis_code}} — {{devis_objet}} ({{devis_amount}}) toujours en attente de votre validation.

Si vous souhaitez des modifications ou avez des questions, nous sommes à votre disposition.

Lien de signature (expire le {{devis_valid_until}}) :
{{signature_url}}

Cordialement,
{{sender_name}}
{{company_name}}`,
  devis_relance_3: `Bonjour {{contact_name}},

Ceci est notre dernière relance concernant le devis n°{{devis_code}} — {{devis_objet}} ({{devis_amount}}).

Ce devis arrive à expiration le {{devis_valid_until}}. Si votre projet a évolué ou si vous souhaitez discuter d'une autre solution, n'hésitez pas à nous contacter.

Lien de signature :
{{signature_url}}

Cordialement,
{{sender_name}}
{{company_name}}`,
  rapport_visite: `Bonjour {{contact_name}},

Veuillez trouver ci-joint le rapport de notre visite technique du {{visite_date}} pour : {{visite_title}}.
Adresse : {{visite_address}}

Ce document récapitule l'ensemble des observations et préconisations relevées lors de notre passage.

N'hésitez pas à revenir vers nous pour toute question ou précision.

Cordialement,
{{sender_name}}
{{company_name}}`,
  suivi_client: `Bonjour {{contact_name}},

Nous espérons que votre déménagement ({{dossier_title}}) s'est bien passé !

Votre satisfaction est notre priorité. Si vous avez quelques minutes, nous serions ravis de connaître votre avis sur notre prestation.

Un grand merci pour votre confiance et à bientôt.

Cordialement,
{{sender_name}}
{{company_name}}`,
};

interface TemplateFormData {
  type: string;
  name: string;
  subject: string;
  body: string;
}

const EMPTY_FORM: TemplateFormData = {
  type: "devis_envoi",
  name: "",
  subject: "",
  body: "",
};

export const EmailTemplatesTab = () => {
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];
  const primaryCompanyId = current === "global" ? dbCompanies[0]?.id : current;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormData>(EMPTY_FORM);
  const [showVars, setShowVars] = useState(false);
  const [aiTone, setAiTone] = useState("cordial");
  const [aiGenerating, setAiGenerating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .in("company_id", companyIds)
        .order("type")
        .order("created_at");
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      if (editingId) {
        const { error } = await supabase
          .from("email_templates")
          .update({ ...data })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const companyId = primaryCompanyId || dbCompanies[0]?.id;
        if (!companyId) throw new Error("Aucune société sélectionnée");
        const { error } = await supabase
          .from("email_templates")
          .insert({ ...data, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Modèle mis à jour" : "Modèle créé");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modèle supprimé");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({ type: t.type, name: t.name, subject: t.subject, body: t.body });
    setDialogOpen(true);
  };

  const handleTypeChange = (type: string) => {
    setForm((f) => ({
      ...f,
      type,
      subject: f.subject || DEFAULT_SUBJECTS[type] || "",
      body: f.body || DEFAULT_BODIES[type] || "",
    }));
  };

  const loadDefault = () => {
    setForm((f) => ({
      ...f,
      subject: DEFAULT_SUBJECTS[f.type] || f.subject,
      body: DEFAULT_BODIES[f.type] || f.body,
    }));
  };

  const generateWithAI = async () => {
    setAiGenerating(true);
    try {
      const companyName = dbCompanies.find(c => c.id === primaryCompanyId)?.name || "";
      const { data, error } = await supabase.functions.invoke("generate-email-template", {
        body: {
          emailType: form.type,
          tone: aiTone,
          companyName,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setForm((f) => ({
        ...f,
        subject: data.subject || f.subject,
        body: data.body || f.body,
      }));
      toast.success("Contenu généré par l'IA ✨");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    } finally {
      setAiGenerating(false);
    }
  };

  const insertVariable = (variable: string) => {
    setForm((f) => ({ ...f, body: f.body + variable }));
  };

  const typeInfo = (type: string) => TEMPLATE_TYPES.find((t) => t.value === type);

  // Group templates by type
  const byType: Record<string, any[]> = {};
  templates.forEach((t: any) => {
    if (!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Modèles d'emails</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personnalisez les emails envoyés automatiquement à vos clients
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nouveau modèle
        </Button>
      </div>

      {/* Variables info banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">Variables disponibles :</strong>{" "}
          {ALL_VARIABLES.map((v) => (
            <code key={v.key} className="mx-0.5 px-1 py-0.5 bg-muted rounded text-xs font-mono" title={v.label}>
              {v.key}

            </code>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Chargement...</div>
      ) : TEMPLATE_TYPES.map((typeInfo) => {
        const typeTemplates = byType[typeInfo.value] || [];
        return (
          <div key={typeInfo.value} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{typeInfo.label}</p>
                <p className="text-xs text-muted-foreground">{typeInfo.description}</p>
              </div>
              <Badge variant={typeTemplates.length > 0 ? "default" : "outline"} className="text-[10px] shrink-0">
                {typeTemplates.length} modèle{typeTemplates.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="divide-y">
              {typeTemplates.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">Objet : {t.subject}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {typeTemplates.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground italic">
                  Aucun modèle — le texte par défaut sera utilisé
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingId ? "Modifier le modèle" : "Nouveau modèle d'email"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Type d'email *</Label>
                <Select
                  value={form.type}
                  onValueChange={handleTypeChange}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-sm">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du modèle *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex : Relance cordiale"
                  className="text-sm"
                />
              </div>
            </div>

            {/* AI generation block */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Générer avec l'IA</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Ton" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={generateWithAI}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Générer</>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                L'IA génère l'objet et le corps du message. Vous pouvez ensuite le modifier librement.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Objet de l'email *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Objet..."
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Corps du message *</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={() => setShowVars((v) => !v)}
                  >
                    {showVars ? "Masquer" : "Insérer variable"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2 text-muted-foreground"
                    onClick={loadDefault}
                  >
                    Texte par défaut
                  </Button>
                </div>
              </div>
              {showVars && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-lg">
                  {(VARIABLES_BY_TYPE[form.type] || ALL_VARIABLES).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="px-2 py-1 text-xs bg-background border rounded hover:bg-muted transition-colors font-mono"
                      title={v.label}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Corps de l'email..."
                rows={12}
                className="text-sm font-mono resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Les variables entre {"{{"}...{"}}"}  seront remplacées automatiquement lors de l'envoi.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={!form.name.trim() || !form.subject.trim() || !form.body.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer le modèle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le texte par défaut sera utilisé à la place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
