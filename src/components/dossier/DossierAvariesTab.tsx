import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  dossierId: string;
  companyId: string;
  clientId: string;
}

const statusLabels: Record<string, string> = {
  ouverte: "Ouverte",
  en_cours: "En cours",
  resolue: "Résolue",
  fermee: "Fermée",
};
const statusStyles: Record<string, string> = {
  ouverte: "bg-destructive/10 text-destructive",
  en_cours: "bg-warning/10 text-warning",
  resolue: "bg-success/10 text-success",
  fermee: "bg-muted text-muted-foreground",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export const DossierAvariesTab = ({ dossierId, companyId, clientId }: Props) => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responsibility, setResponsibility] = useState("");
  const [amount, setAmount] = useState(0);

  const { data: avaries = [] } = useQuery({
    queryKey: ["dossier-avaries", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaries")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("avaries").insert({
        company_id: companyId,
        dossier_id: dossierId,
        client_id: clientId,
        title,
        description: description || null,
        responsibility: responsibility || null,
        amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avarie ajoutée");
      setShowForm(false);
      setTitle(""); setDescription(""); setResponsibility(""); setAmount(0);
      queryClient.invalidateQueries({ queryKey: ["dossier-avaries", dossierId] });
    },
    onError: () => toast.error("Erreur"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("avaries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dossier-avaries", dossierId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("avaries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avarie supprimée");
      queryClient.invalidateQueries({ queryKey: ["dossier-avaries", dossierId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Signaler une avarie
        </Button>
      </div>

      {avaries.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune avarie signalée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {avaries.map((a: any) => (
            <div key={a.id} className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{a.title}</span>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${statusStyles[a.status] || ""}`}>
                      {statusLabels[a.status] || a.status}
                    </span>
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                  <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    {a.responsibility && <span>Resp: {a.responsibility}</span>}
                    {a.amount > 0 && <span>Montant: {fmt(a.amount)}</span>}
                    <span>{new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <select
                    value={a.status}
                    onChange={(e) => updateStatus.mutate({ id: a.id, status: e.target.value })}
                    className="h-7 text-[10px] rounded border border-input bg-background px-1.5"
                  >
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <button onClick={() => deleteMutation.mutate(a.id)} className="p-1 rounded hover:bg-muted">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Signaler une avarie</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Intitulé *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dégât, casse..." /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Responsabilité</Label><Input value={responsibility} onChange={(e) => setResponsibility(e.target.value)} placeholder="Client, équipe..." /></div>
              <div><Label>Montant (€)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending}>
                {createMutation.isPending ? "Ajout..." : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
