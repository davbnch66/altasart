import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Check, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

interface DevisLine {
  id: string;
  devis_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number | null;
  sort_order: number;
  tva_rate?: number;
}

interface Props {
  devisId: string;
  lines: DevisLine[];
  totalAmount: number;
  devisObjet?: string;
  companyId?: string;
}

const TVA_OPTIONS = [
  { value: "0", label: "0%" },
  { value: "5.5", label: "5.5%" },
  { value: "10", label: "10%" },
  { value: "20", label: "20%" },
];

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

const emptyLine = { description: "", quantity: 1, unit_price: 0, tva_rate: 20 };

export const DevisLinesManager = ({ devisId, lines, totalAmount, devisObjet, companyId }: Props) => {
  const isMobile = useIsMobile();
  const computedTotalHT = lines.reduce((sum, l) => sum + (l.total ?? l.quantity * l.unit_price), 0);
  const computedTVA = lines.reduce((sum, l) => {
    const ht = l.total ?? l.quantity * l.unit_price;
    return sum + ht * ((l.tva_rate ?? 20) / 100);
  }, 0);
  const computedTotalTTC = computedTotalHT + computedTVA;
  const queryClient = useQueryClient();

  // AI suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<{ description: string; quantity: number; unit_price: number }[]>([]);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (lines.length > 0 && Math.abs(computedTotalHT - totalAmount) > 0.01) {
      supabase.from("devis").update({ amount: computedTotalHT }).eq("id", devisId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["devis-detail", devisId] });
        queryClient.invalidateQueries({ queryKey: ["devis"] });
      });
    }
  }, [computedTotalHT, totalAmount, devisId, lines.length]);

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
        tva_rate: line.tva_rate,
      });
      if (error) throw error;
      const newTotal = computedTotalHT + lineTotal;
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

  const addBulkMutation = useMutation({
    mutationFn: async (newLines: typeof aiSuggestions) => {
      let sortOffset = lines.length;
      for (const line of newLines) {
        await supabase.from("devis_lines").insert({
          devis_id: devisId,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          sort_order: sortOffset++,
        });
      }
      const newTotal = newLines.reduce((s, l) => s + l.quantity * l.unit_price, computedTotalHT);
      await supabase.from("devis").update({ amount: newTotal }).eq("id", devisId);
    },
    onSuccess: () => {
      toast.success(`${aiSuggestions.length} lignes insérées`);
      setAiSuggestions([]);
      setShowSuggestions(false);
      invalidate();
    },
    onError: () => toast.error("Erreur lors de l'insertion des lignes"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...line }: typeof emptyLine & { id: string }) => {
      const lineTotal = line.quantity * line.unit_price;
      const { error } = await supabase.from("devis_lines").update({
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tva_rate: line.tva_rate,
      }).eq("id", id);
      if (error) throw error;
      const oldLine = lines.find((l) => l.id === id);
      const oldTotal = oldLine ? (oldLine.total ?? oldLine.quantity * oldLine.unit_price) : 0;
      const newAmount = computedTotalHT - oldTotal + lineTotal;
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
      const newAmount = Math.max(0, computedTotalHT - lineTotal);
      await supabase.from("devis").update({ amount: newAmount }).eq("id", devisId);
    },
    onSuccess: () => {
      toast.success("Ligne supprimée");
      invalidate();
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const generateAiLines = async () => {
    if (!devisObjet) {
      toast.error("L'objet du devis est requis pour générer des suggestions IA");
      return;
    }
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-devis-from-visite", {
        body: {
          mode: "lines_only",
          objet: devisObjet,
          companyId,
          existingLines: lines.map((l) => l.description),
        },
      });
      if (error) throw error;
      const suggested = data?.lines || data?.devis_lines || [];
      if (suggested.length === 0) throw new Error("Aucune ligne générée");
      setAiSuggestions(suggested);
      setShowSuggestions(true);
      toast.success(`${suggested.length} lignes suggérées par l'IA — vérifiez avant d'insérer`);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération IA");
    } finally {
      setGeneratingAi(false);
    }
  };

  const startEdit = (line: DevisLine) => {
    setEditingId(line.id);
    setEditForm({ description: line.description, quantity: line.quantity, unit_price: line.unit_price, tva_rate: line.tva_rate ?? 20 });
  };

  // TVA selector component
  const TvaSelect = ({ value, onChange, className = "" }: { value: number; onChange: (v: number) => void; className?: string }) => (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={`h-8 text-xs ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TVA_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

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
      <div className="grid grid-cols-3 gap-2">
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
        <div>
          <label className="text-[10px] text-muted-foreground">TVA</label>
          <TvaSelect value={form.tva_rate} onChange={(v) => setForm((f) => ({ ...f, tva_rate: v }))} />
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

  // AI suggestions panel
  const AiSuggestionsPanel = () => (
    <AnimatePresence>
      {showSuggestions && aiSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Suggestions IA — vérifiez avant d'insérer
            </p>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setShowSuggestions(false); setAiSuggestions([]); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {aiSuggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-background border px-3 py-2 text-xs gap-2">
                <span className="flex-1 min-w-0 truncate">{s.description}</span>
                <span className="text-muted-foreground shrink-0">{s.quantity} × {formatAmount(s.unit_price)}</span>
                <span className="font-semibold shrink-0">{formatAmount(s.quantity * s.unit_price)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => addBulkMutation.mutate(aiSuggestions)}
              disabled={addBulkMutation.isPending}
            >
              {addBulkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Insérer toutes les lignes
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setShowSuggestions(false); setAiSuggestions([]); }}>
              Ignorer
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Footer with HT/TVA/TTC breakdown
  const TotalsFooter = ({ className = "" }: { className?: string }) => (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Total HT</span>
        <span className="font-semibold">{formatAmount(computedTotalHT)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">TVA</span>
        <span className="font-medium">{formatAmount(computedTVA)}</span>
      </div>
      <div className="flex justify-between text-sm border-t pt-1">
        <span className="font-semibold">Total TTC</span>
        <span className="font-bold">{formatAmount(computedTotalTTC)}</span>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        <AiSuggestionsPanel />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lignes du devis</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={generateAiLines}
                disabled={generatingAi}
                className="h-7 text-xs px-2 text-primary"
              >
                {generatingAi ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                IA
              </Button>
              {!adding && (
                <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="h-7 text-xs px-2">
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              )}
            </div>
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
                      {line.quantity} × {formatAmount(line.unit_price)} · TVA {line.tva_rate ?? 20}%
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
            <div className="border-t bg-muted/20 px-3 py-2.5">
              <TotalsFooter />
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Desktop table
  return (
    <div className="space-y-3">
      <AiSuggestionsPanel />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lignes du devis</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateAiLines}
              disabled={generatingAi}
              className="text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
            >
              {generatingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generatingAi ? "Génération..." : "Suggérer avec l'IA"}
            </Button>
            {!adding && (
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
              </Button>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Description</th>
              <th className="text-right font-medium text-muted-foreground px-3 py-2.5 w-20">Qté</th>
              <th className="text-right font-medium text-muted-foreground px-3 py-2.5 w-28">P.U. (€)</th>
              <th className="text-center font-medium text-muted-foreground px-3 py-2.5 w-24">TVA</th>
              <th className="text-right font-medium text-muted-foreground px-5 py-2.5 w-28">Total HT</th>
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
                  <td className="px-3 py-2">
                    <TvaSelect value={editForm.tva_rate} onChange={(v) => setEditForm((f) => ({ ...f, tva_rate: v }))} className="w-full" />
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
                  <td className="px-3 py-3 text-center text-xs text-muted-foreground">{line.tva_rate ?? 20}%</td>
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
                <td className="px-3 py-2">
                  <TvaSelect value={newLine.tva_rate} onChange={(v) => setNewLine((f) => ({ ...f, tva_rate: v }))} className="w-full" />
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
                <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                  Aucune ligne. Cliquez sur "Ajouter" pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {lines.length > 0 && (
          <div className="border-t bg-muted/20 px-5 py-3">
            <div className="flex justify-end">
              <TotalsFooter className="w-64" />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
