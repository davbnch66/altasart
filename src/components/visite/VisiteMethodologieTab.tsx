import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Save, Loader2, Plus, Trash2, ClipboardList } from "lucide-react";
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
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-primary flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Notes techniques / Méthodologie</h3>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="Décrivez la méthodologie proposée, les étapes de l'opération, les précautions particulières..."
        />
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Checklist</h3>
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
