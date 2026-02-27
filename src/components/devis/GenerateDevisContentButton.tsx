import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface GenerateDevisContentButtonProps {
  devisId: string;
  onGenerated: (html: string) => void;
  disabled?: boolean;
  size?: "sm" | "default" | "icon";
  className?: string;
}

export const GenerateDevisContentButton = ({
  devisId,
  onGenerated,
  disabled,
  size = "sm",
  className,
}: GenerateDevisContentButtonProps) => {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-devis-content", {
        body: { devis_id: devisId },
      });
      if (error) throw new Error(error.message || "Erreur");
      if (data?.error) throw new Error(data.error);
      if (data?.content) {
        onGenerated(data.content);
        toast.success("Contenu généré par l'IA");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération du contenu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={generate}
      disabled={disabled || loading}
      className={`gap-1.5 ${className || ""}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {loading ? "Génération..." : "Générer par IA"}
    </Button>
  );
};
