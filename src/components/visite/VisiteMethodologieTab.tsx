import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Save, Loader2, Plus, Trash2, ClipboardList, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  text: string;
  done: boolean;
}

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisiteMethodologieTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: methodo } = useQuery({
    queryKey: ["visite-methodologie", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_methodologie").select("*").eq("visite_id", visiteId).order("sort_order").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (methodo) {
      setContent(methodo.content || "");
      setChecklist(Array.isArray(methodo.checklist) ? (methodo.checklist as unknown as ChecklistItem[]) : []);
      setExistingId(methodo.id);
    }
  }, [methodo]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { content, checklist: JSON.parse(JSON.stringify(checklist)) };
      if (existingId) {
        const { error } = await supabase.from("visite_methodologie").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("visite_methodologie").insert({
          visite_id: visiteId, company_id: companyId, title: "Méthodologie", ...payload, sort_order: 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Méthodologie enregistrée");
      queryClient.invalidateQueries({ queryKey: ["visite-methodologie", visiteId] });
    },
    onError: () => toast.error("Erreur"),
  });

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-methodologie", {
        body: { visite_id: visiteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (data?.content) setContent(data.content);
      if (data?.checklist && Array.isArray(data.checklist)) {
        setChecklist(data.checklist.map((text: string) => ({ text, done: false })));
      }
      toast.success("Méthodologie générée par IA — vérifiez et ajustez avant d'enregistrer");
    } catch (e: any) {
      toast.error(e.message || "Erreur génération IA");
    } finally {
      setGenerating(false);
    }
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklist((prev) => [...prev, { text: newCheckItem, done: false }]);
    setNewCheckItem("");
  };

  const toggleCheck = (idx: number) => {
    setChecklist((prev) => prev.map((item, i) => i === idx ? { ...item, done: !item.done } : item));
  };

  const removeCheck = (idx: number) => {
    setChecklist((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* AI Generate button */}
      <Card className="p-4 space-y-3 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-primary">Génération IA</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          L'IA analysera le matériel, les contraintes d'accès, les véhicules et les RH pour proposer une méthodologie conforme aux réglementations (Code du travail, normes de levage, sécurité).
        </p>
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-2 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>La méthodologie générée doit être vérifiée et validée avant utilisation.</span>
        </div>
        <Button onClick={handleGenerateAI} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Génération en cours..." : "Générer la méthodologie par IA"}
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-primary flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Méthodologie</h3>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={15}
          placeholder="Décrivez la méthodologie proposée, les étapes de l'opération, les précautions particulières..."
        />
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Checklist sécurité</h3>
        <div className="space-y-2">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Checkbox checked={item.done} onCheckedChange={() => toggleCheck(idx)} />
              <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCheck(idx)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCheckItem}
            onChange={(e) => setNewCheckItem(e.target.value)}
            placeholder="Nouvel élément..."
            onKeyDown={(e) => e.key === "Enter" && addCheckItem()}
          />
          <Button size="sm" variant="outline" onClick={addCheckItem} disabled={!newCheckItem.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
        Enregistrer la méthodologie
      </Button>
    </div>
  );
};
