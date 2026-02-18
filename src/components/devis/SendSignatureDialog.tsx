import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Copy, CheckCircle, Link, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SendSignatureDialogProps {
  devis: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendSignatureDialog = ({ devis, open, onOpenChange }: SendSignatureDialogProps) => {
  const queryClient = useQueryClient();
  const [recipientEmail, setRecipientEmail] = useState(devis.clients?.email || "");
  const [recipientName, setRecipientName] = useState(devis.clients?.name || "");
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [aiTone, setAiTone] = useState("cordial");
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    if (open) {
      setRecipientEmail(devis.clients?.email || "");
      setRecipientName(devis.clients?.name || "");
      setGeneratedLink(null);
      setEmailSubject("");
      setEmailBody("");
      if (devis.company_id) {
        loadTemplate();
      }
    }
  }, [open]);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-email-template", {
        body: {
          templateType: "devis_envoi",
          companyId: devis.company_id,
          devisId: devis.id,
        },
      });
      if (error) throw error;
      if (data?.found) {
        setEmailSubject(data.subject || "");
        setEmailBody(data.body || "");
      }
    } catch (e: any) {
      console.warn("Template not found:", e.message);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const generateWithAI = async () => {
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email-template", {
        body: {
          type: "devis_envoi",
          tone: aiTone,
          companyId: devis.company_id,
          context: {
            devisCode: devis.code,
            devisObjet: devis.objet,
            devisAmount: devis.amount,
            clientName: devis.clients?.name,
            companyName: devis.companies?.name || devis.companies?.short_name,
          },
        },
      });
      if (error) throw error;
      if (data?.subject) setEmailSubject(data.subject);
      if (data?.body) setEmailBody(data.body);
      toast.success("Contenu généré par l'IA");
    } catch (e: any) {
      toast.error("Erreur lors de la génération IA");
    } finally {
      setGeneratingAi(false);
    }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("devis_signatures")
        .select("token")
        .eq("devis_id", devis.id)
        .eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .single();

      if (existing) return existing.token;

      const { data, error } = await supabase
        .from("devis_signatures")
        .insert({
          devis_id: devis.id,
          company_id: devis.company_id,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data.token;
    },
    onSuccess: (token) => {
      const baseUrl = window.location.hostname.includes("lovableproject.com") || window.location.hostname.includes("lovable.app")
        ? "https://altasart.lovable.app"
        : window.location.origin;
      const url = `${baseUrl}/sign/${token}`;
      setGeneratedLink(url);
    },
    onError: () => toast.error("Erreur lors de la génération du lien"),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      let token = generatedLink?.split("/sign/")[1];
      if (!token) {
        token = await generateMutation.mutateAsync();
      }
      const baseUrl = window.location.hostname.includes("lovableproject.com") || window.location.hostname.includes("lovable.app")
        ? "https://altasart.lovable.app"
        : window.location.origin;
      const signatureUrl = `${baseUrl}/sign/${token}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const response = await supabase.functions.invoke("send-signature-email", {
        body: {
          devisId: devis.id,
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim(),
          signatureUrl,
          devisCode: devis.code,
          devisObjet: devis.objet,
          devisAmount: devis.amount,
          companyName: devis.companies?.name || devis.companies?.short_name,
          companyId: devis.company_id,
          // Pass resolved body/subject if template was loaded
          customSubject: emailSubject || undefined,
          customBody: emailBody || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);
    },
    onSuccess: () => {
      toast.success("Email envoyé avec succès !");
      queryClient.invalidateQueries({ queryKey: ["devis-detail", devis.id] });
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'envoi"),
  });

  const handleCopyLink = async () => {
    let link = generatedLink;
    if (!link) {
      const token = await generateMutation.mutateAsync();
      const baseUrl = window.location.hostname.includes("lovableproject.com") || window.location.hostname.includes("lovable.app")
        ? "https://altasart.lovable.app"
        : window.location.origin;
      link = `${baseUrl}/sign/${token}`;
    }
    await navigator.clipboard.writeText(link!);
    setLinkCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setLinkCopied(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoyer pour signature</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Un lien sécurisé sera envoyé au client pour qu'il puisse accepter le devis en ligne.
          </p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="sig-name">Nom du destinataire</Label>
              <Input
                id="sig-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Jean Dupont"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sig-email">Email du destinataire *</Label>
              <Input
                id="sig-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@exemple.fr"
                className="mt-1"
              />
            </div>
          </div>

          {/* AI generation */}
          <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium text-primary flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Générer avec l'IA
            </p>
            <div className="flex gap-2">
              <Select value={aiTone} onValueChange={setAiTone}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cordial">Cordial</SelectItem>
                  <SelectItem value="professionnel">Professionnel</SelectItem>
                  <SelectItem value="formel">Formel</SelectItem>
                  <SelectItem value="chaleureux">Chaleureux</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={generateWithAI}
                disabled={generatingAi}
              >
                {generatingAi ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generatingAi ? "Génération..." : "Générer"}
              </Button>
            </div>
          </div>

          {/* Email preview / customization */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Contenu de l'email</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 text-muted-foreground"
                onClick={loadTemplate}
                disabled={loadingTemplate}
              >
                {loadingTemplate ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Recharger modèle
              </Button>
            </div>
            <div>
              <Label className="text-xs">Objet</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={loadingTemplate ? "Chargement..." : "Devis {{devis_code}} — {{company_name}}"}
                className="mt-1 text-sm"
                disabled={loadingTemplate}
              />
            </div>
            <div>
              <Label className="text-xs">Corps du message</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder={loadingTemplate ? "Chargement du modèle..." : "Bonjour,\n\nVeuillez trouver ci-joint notre devis...\n\nCordialement,"}
                rows={7}
                className={`mt-1 text-sm font-mono resize-y ${loadingTemplate ? "opacity-50" : ""}`}
                disabled={loadingTemplate}
              />
            </div>
            {!emailBody && !loadingTemplate && (
              <p className="text-[10px] text-muted-foreground">
                Aucun modèle configuré — un email par défaut sera utilisé
              </p>
            )}
          </div>

          {generatedLink && (
            <div className="rounded-lg bg-muted p-3 break-all">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Link className="h-3 w-3" /> Lien de signature
              </p>
              <p className="text-xs font-mono">{generatedLink}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => sendEmailMutation.mutate()}
              disabled={!recipientEmail.trim() || sendEmailMutation.isPending || loadingTemplate}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendEmailMutation.isPending ? "Envoi en cours..." : "Envoyer par email"}
            </Button>

            <Button
              variant="outline"
              onClick={handleCopyLink}
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {linkCopied ? (
                <><CheckCircle className="h-4 w-4 mr-2 text-success" /> Lien copié !</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" /> Copier le lien</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
