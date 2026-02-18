import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Copy, CheckCircle, Link } from "lucide-react";

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

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Check for existing pending signature
      const { data: existing } = await supabase
        .from("devis_signatures")
        .select("token")
        .eq("devis_id", devis.id)
        .eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .single();

      if (existing) return existing.token;

      // Create new signature token
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
      <DialogContent className="sm:max-w-md">
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
              disabled={!recipientEmail.trim() || sendEmailMutation.isPending}
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
