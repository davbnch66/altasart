import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

interface DevisLine {
  id: string;
  devis_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number | null;
  sort_order: number;
}

interface Props {
  devisId: string;
  lines: DevisLine[];
  totalAmount: number;
}

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

const emptyLine = { description: "", quantity: 1, unit_price: 0 };

export const DevisLinesManager = ({ devisId, lines, totalAmount }: Props) => {
  const isMobile = useIsMobile();
  const computedTotal = lines.reduce((sum, l) => sum + (l.total ?? l.quantity * l.unit_price), 0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (lines.length > 0 && Math.abs(computedTotal - totalAmount) > 0.01) {
      supabase.from("devis").update({ amount: computedTotal }).eq("id", devisId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["devis-detail", devisId] });
        queryClient.invalidateQueries({ queryKey: ["devis"] });
      });
    }
  }, [computedTotal, totalAmount, devisId, lines.length]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyLine);
  const [adding, setAdding] = useState(false);
  const [newLine, setNewLine] = useState(emptyLine);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["devis-lines", devisId] });
    queryClient.invalidateQueries({ queryKey: ["devis-detail", devisId] });
    queryClient.invalidateQueries({ queryKey: ["devis"] });
  };

  const addMutation = useMutation({
    mutationFn: async (line: typeof emptyLine) => {
      const lineTotal = line.quantity * line.unit_price;
      const { error } = await supabase.from("devis_lines").insert({
        devis_id: devisId,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        sort_order: lines.length,
      });
      if (error) throw error;
      const newTotal = computedTotal + lineTotal;
      await supabase.from("devis").update({ amount: newTotal }).eq("id", devisId);
    },
    onSuccess: () => {
      toast.success("Ligne ajoutée");
      invalidate();
      setAdding(false);
      setNewLine(emptyLine);
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...line }: typeof emptyLine & { id: string }) => {
      const lineTotal = line.quantity * line.unit_price;
      const { error } = await supabase.from("devis_lines").update({
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
      }).eq("id", id);
      if (error) throw error;
      const oldLine = lines.find((l) => l.id === id);
      const oldTotal = oldLine ? (oldLine.total ?? oldLine.quantity * oldLine.unit_price) : 0;
      const newAmount = computedTotal - oldTotal + lineTotal;
      await supabase.from("devis").update({ amount: newAmount }).eq("id", devisId);
    },
    onSuccess: () => {
      toast.success("Ligne modifiée");
      invalidate();
      setEditingId(null);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (line: DevisLine) => {
      const { error } = await supabase.from("devis_lines").delete().eq("id", line.id);
      if (error) throw error;
      const lineTotal = line.total ?? line.quantity * line.unit_price;
      const newAmount = Math.max(0, computedTotal - lineTotal);
      await supabase.from("devis").update({ amount: newAmount }).eq("id", devisId);
    },
    onSuccess: () => {
      toast.success("Ligne supprimée");
      invalidate();
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const startEdit = (line: DevisLine) => {
    setEditingId(line.id);
    setEditForm({ description: line.description, quantity: line.quantity, unit_price: line.unit_price });
  };

  // Mobile form for adding/editing a line
  const MobileLineForm = ({ form, setForm, onSubmit, onCancel, isPending }: {
    form: typeof emptyLine;
    setForm: (f: typeof emptyLine | ((prev: typeof emptyLine) => typeof emptyLine)) => void;
    onSubmit: () => void;
    onCancel: () => void;
    isPending: boolean;
  }) => (
    <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
      <Input
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="h-8 text-xs"
        placeholder="Description"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Quantité</label>
          <Input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
            className="h-8 text-xs"
            min={0}
            step="0.01"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Prix unitaire (€)</label>
          <Input
            type="number"
            value={form.unit_price}
            onChange={(e) => setForm((f) => ({ ...f, unit_price: Number(e.target.value) }))}
            className="h-8 text-xs"
            min={0}
            step="0.01"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{formatAmount(form.quantity * form.unit_price)}</span>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 px-2 text-xs">
            <X className="h-3 w-3 mr-1" /> Annuler
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={!form.description.trim() || isPending} className="h-7 px-2 text-xs">
            <Check className="h-3 w-3 mr-1" /> OK
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lignes du devis</h3>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="h-7 text-xs px-2">
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          )}
        </div>

        <div className="divide-y">
          {lines.map((line) =>
            editingId === line.id ? (
              <div key={line.id} className="p-3">
                <MobileLineForm
                  form={editForm}
                  setForm={setEditForm}
                  onSubmit={() => updateMutation.mutate({ id: line.id, ...editForm })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              </div>
            ) : (
              <div key={line.id} className="px-3 py-2.5 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{line.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {line.quantity} × {formatAmount(line.unit_price)}
                  </p>
                </div>
                <span className="text-xs font-semibold shrink-0">
                  {formatAmount(line.total ?? line.quantity * line.unit_price)}
                </span>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => startEdit(line)} className="p-1 rounded hover:bg-muted">
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(line)} disabled={deleteMutation.isPending} className="p-1 rounded hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              </div>
            )
          )}

          {adding && (
            <div className="p-3">
              <MobileLineForm
                form={newLine}
                setForm={setNewLine}
                onSubmit={() => addMutation.mutate(newLine)}
                onCancel={() => { setAdding(false); setNewLine(emptyLine); }}
                isPending={addMutation.isPending}
              />
            </div>
          )}

          {lines.length === 0 && !adding && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Aucune ligne. Cliquez sur "Ajouter" pour commencer.
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t bg-muted/20 px-3 py-2.5 flex justify-between items-center">
            <span className="text-xs font-semibold text-muted-foreground">Total HT</span>
            <span className="text-sm font-bold">{formatAmount(computedTotal)}</span>
          </div>
        )}
      </motion.div>
    );
  }

  // Desktop table (unchanged)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lignes du devis</h3>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
          </Button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Description</th>
            <th className="text-right font-medium text-muted-foreground px-3 py-2.5 w-20">Qté</th>
            <th className="text-right font-medium text-muted-foreground px-3 py-2.5 w-28">P.U. (€)</th>
            <th className="text-right font-medium text-muted-foreground px-5 py-2.5 w-28">Total</th>
            <th className="px-3 py-2.5 w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((line) =>
            editingId === line.id ? (
              <tr key={line.id} className="bg-muted/10">
                <td className="px-5 py-2">
                  <Input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="h-8 text-sm" placeholder="Description" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: Number(e.target.value) }))} className="h-8 text-sm text-right w-full" min={0} step="0.01" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" value={editForm.unit_price} onChange={(e) => setEditForm((f) => ({ ...f, unit_price: Number(e.target.value) }))} className="h-8 text-sm text-right w-full" min={0} step="0.01" />
                </td>
                <td className="px-5 py-2 text-right font-semibold text-muted-foreground">{formatAmount(editForm.quantity * editForm.unit_price)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => updateMutation.mutate({ id: line.id, ...editForm })} disabled={!editForm.description.trim() || updateMutation.isPending} className="p-1 rounded hover:bg-success/10 disabled:opacity-50">
                      <Check className="h-3.5 w-3.5 text-success" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">{line.description}</td>
                <td className="px-3 py-3 text-right">{line.quantity}</td>
                <td className="px-3 py-3 text-right">{formatAmount(line.unit_price)}</td>
                <td className="px-5 py-3 text-right font-semibold">{formatAmount(line.total ?? line.quantity * line.unit_price)}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(line)} className="p-1 rounded hover:bg-muted" title="Modifier">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(line)} disabled={deleteMutation.isPending} className="p-1 rounded hover:bg-destructive/10" title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}

          {adding && (
            <tr className="bg-muted/10">
              <td className="px-5 py-2">
                <Input value={newLine.description} onChange={(e) => setNewLine((f) => ({ ...f, description: e.target.value }))} className="h-8 text-sm" placeholder="Description de la ligne" autoFocus />
              </td>
              <td className="px-3 py-2">
                <Input type="number" value={newLine.quantity} onChange={(e) => setNewLine((f) => ({ ...f, quantity: Number(e.target.value) }))} className="h-8 text-sm text-right w-full" min={0} step="0.01" />
              </td>
              <td className="px-3 py-2">
                <Input type="number" value={newLine.unit_price} onChange={(e) => setNewLine((f) => ({ ...f, unit_price: Number(e.target.value) }))} className="h-8 text-sm text-right w-full" min={0} step="0.01" />
              </td>
              <td className="px-5 py-2 text-right font-semibold text-muted-foreground">{formatAmount(newLine.quantity * newLine.unit_price)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <button onClick={() => addMutation.mutate(newLine)} disabled={!newLine.description.trim() || addMutation.isPending} className="p-1 rounded hover:bg-success/10 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5 text-success" />
                  </button>
                  <button onClick={() => { setAdding(false); setNewLine(emptyLine); }} className="p-1 rounded hover:bg-muted">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </td>
            </tr>
          )}

          {lines.length === 0 && !adding && (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                Aucune ligne. Cliquez sur "Ajouter" pour commencer.
              </td>
            </tr>
          )}
        </tbody>
        {lines.length > 0 && (
          <tfoot>
            <tr className="border-t bg-muted/20">
              <td colSpan={3} className="px-5 py-3 text-right font-semibold">Total HT</td>
              <td className="px-5 py-3 text-right font-bold">{formatAmount(computedTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
    </motion.div>
  );
};
