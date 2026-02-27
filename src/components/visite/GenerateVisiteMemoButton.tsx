import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  visiteId: string;
  onGenerated: (memo: string) => void;
  disabled?: boolean;
}

export const GenerateVisiteMemoButton = ({ visiteId, onGenerated, disabled }: Props) => {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-visite-memo", {
        body: { visite_id: visiteId },
      });
      if (error) throw new Error(error.message || "Erreur");
      if (data?.error) throw new Error(data.error);
      if (data?.memo) {
        onGenerated(data.memo);
        toast.success("Mémo généré par l'IA");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération du mémo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={generate}
      disabled={disabled || loading}
      className="gap-1.5 shrink-0"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {loading ? "Génération..." : "Générer par IA"}
    </Button>
  );
};
