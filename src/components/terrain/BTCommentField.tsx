import { useState, useRef } from "react";
import { MessageSquare, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface BTCommentFieldProps {
  btId: string;
  initialValue: string;
}

export function BTCommentField({ btId, initialValue }: BTCommentFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (text: string) => {
    setValue(text);
    setDirty(text !== initialValue);
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("operations")
        .update({ notes: value.trim() || null })
        .eq("id", btId);
      if (error) throw error;
      setDirty(false);
      toast.success("Commentaire enregistré");
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        Commentaire chantier
      </div>
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => { if (dirty) save(); }}
        placeholder="Notes sur le déroulement du chantier..."
        className="min-h-[60px] text-xs resize-none"
      />
      {dirty && (
        <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Enregistrer
        </Button>
      )}
    </div>
  );
}
