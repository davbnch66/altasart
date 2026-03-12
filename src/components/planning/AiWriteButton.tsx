import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AiWriteButtonProps {
  field: "instructions" | "description" | "notes";
  context: string;
  currentText: string;
  onGenerated: (text: string) => void;
  label?: string;
}

export const AiWriteButton = ({ field, context, currentText, onGenerated, label }: AiWriteButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!context.trim()) {
      toast.error("Pas assez de contexte pour générer du contenu. Remplissez d'abord les informations de l'événement.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-event-text", {
        body: { field, context, current_text: currentText },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.text) {
        onGenerated(data.text);
        toast.success("Texte généré par l'IA");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur de génération IA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-primary"
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {label || "IA"}
    </Button>
  );
};
