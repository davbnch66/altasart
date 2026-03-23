import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Check, X, Users, Truck, CreditCard, Package } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const CATEGORIES = {
  personnel: { label: "Personnel", icon: Users, color: "text-info" },
  vehicule: { label: "Véhicules", icon: Truck, color: "text-warning" },
  credit: { label: "Crédits / Leasing", icon: CreditCard, color: "text-destructive" },
  materiel: { label: "Matériel", icon: Package, color: "text-primary" },
} as const;

const UNITS: Record<string, string> = {
  jour: "/ jour",
  heure: "/ heure",
  mois: "/ mois",
  km: "/ km",
  forfait: "forfait",
};

type Category = keyof typeof CATEGORIES;

interface DefaultCost {
  category: Category;
  label: string;
  unit: string;
  unit_cost: number;
  charges_rate: number;
  notes: string;
}

const DEFAULT_COSTS: DefaultCost[] = [
  { category: "personnel", label: "Chef d'équipe", unit: "jour", unit_cost: 180, charges_rate: 45, notes: "Coût marché moyen" },
  { category: "personnel", label: "Manutentionnaire", unit: "jour", unit_cost: 130, charges_rate: 45, notes: "Coût marché moyen" },
  { category: "personnel", label: "Grutier", unit: "jour", unit_cost: 220, charges_rate: 45, notes: "Coût marché moyen" },
  { category: "personnel", label: "Chauffeur PL", unit: "jour", unit_cost: 160, charges_rate: 45, notes: "Coût marché moyen" },
  { category: "personnel", label: "Chauffeur SPL", unit: "jour", unit_cost: 180, charges_rate: 45, notes: "Coût marché moyen" },
  { category: "vehicule", label: "Camion 20m³", unit: "jour", unit_cost: 120, charges_rate: 0, notes: "Location ou amortissement" },
  { category: "vehicule", label: "Camion 50m³", unit: "jour", unit_cost: 200, charges_rate: 0, notes: "Location ou amortissement" },
  { category: "vehicule", label: "Monte-meubles", unit: "jour", unit_cost: 250, charges_rate: 0, notes: "Location journalière" },
  { category: "vehicule", label: "Utilitaire 12m³", unit: "jour", unit_cost: 80, charges_rate: 0, notes: "Location ou amortissement" },
  { category: "vehicule", label: "Carburant camion", unit: "km", unit_cost: 0.45, charges_rate: 0, notes: "Coût estimé au km" },
  { category: "credit", label: "Leasing véhicule", unit: "mois", unit_cost: 800, charges_rate: 0, notes: "Mensualité moyenne" },
  { category: "credit", label: "Crédit matériel", unit: "mois", unit_cost: 500, charges_rate: 0, notes: "" },
  { category: "materiel", label: "Couvertures (lot 50)", unit: "forfait", unit_cost: 150, charges_rate: 0, notes: "Remplacement annuel" },
  { category: "materiel", label: "Cartons (lot 100)", unit: "forfait", unit_cost: 80, charges_rate: 0, notes: "" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export const FixedCostsTab = () => {
  const isMobile = useIsMobile();
  const { currentCompany, dbCompanies } = useCompany();
  const companyId = currentCompany?.id === "global" ? dbCompanies[0]?.id : currentCompany?.id;
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DefaultCost>({
    category: "personnel", label: "", unit: "jour", unit_cost: 0, charges_rate: 0, notes: "",
  });
  const [editForm, setEditForm] = useState<DefaultCost & { id: string }>({
    id: "", category: "personnel", label: "", unit: "jour", unit_cost: 0, charges_rate: 0, notes: "",
  });
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: costs = [], isLoading } = useQuery({
    queryKey: ["company-fixed-costs", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase.from("company_fixed_costs" as any).select("*") as any)
        .eq("company_id", companyId)
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.label.trim()) throw new Error("Libellé requis");
      const { error } = await (supabase.from("company_fixed_costs" as any) as any).insert({
        company_id: companyId,
        category: form.category,
        label: form.label.trim(),
        unit: form.unit,
        unit_cost: form.unit_cost,
        charges_rate: form.charges_rate,
        notes: form.notes || null,
        sort_order: costs.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coût fixe ajouté");
      queryClient.invalidateQueries({ queryKey: ["company-fixed-costs", companyId] });
      setForm({ category: "personnel", label: "", unit: "jour", unit_cost: 0, charges_rate: 0, notes: "" });
      setAdding(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("company_fixed_costs" as any) as any).update({
        category: editForm.category,
        label: editForm.label.trim(),
        unit: editForm.unit,
        unit_cost: editForm.unit_cost,
        charges_rate: editForm.charges_rate,
        notes: editForm.notes || null,
      }).eq("id", editForm.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mis à jour");
      queryClient.invalidateQueries({ queryKey: ["company-fixed-costs", companyId] });
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("company_fixed_costs" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      queryClient.invalidateQueries({ queryKey: ["company-fixed-costs", companyId] });
    },
  });

  const loadDefaults = useMutation({
    mutationFn: async () => {
      const inserts = DEFAULT_COSTS.map((d, i) => ({
        company_id: companyId,
        category: d.category,
        label: d.label,
        unit: d.unit,
        unit_cost: d.unit_cost,
        charges_rate: d.charges_rate,
        notes: d.notes || null,
        sort_order: i,
      }));
      const { error } = await (supabase.from("company_fixed_costs" as any) as any).insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grille tarifaire par défaut chargée");
      queryClient.invalidateQueries({ queryKey: ["company-fixed-costs", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      id: item.id,
      category: item.category,
      label: item.label,
      unit: item.unit,
      unit_cost: Number(item.unit_cost),
      charges_rate: Number(item.charges_rate),
      notes: item.notes || "",
    });
  };

  const filtered = filterCat === "all" ? costs : costs.filter((c: any) => c.category === filterCat);
  const grouped: Record<string, any[]> = {};
  for (const c of filtered) {
    const cat = (c as any).category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(c);
  }

  if (!companyId) return <p className="text-sm text-muted-foreground p-4">Sélectionnez une société</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Grille tarifaire & coûts fixes</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Définissez vos coûts de référence : personnel, véhicules, crédits. Ces tarifs servent de base pour le calcul de rentabilité.
        </p>
      </div>

      {/* Empty state */}
      {costs.length === 0 && !isLoading && (
        <div className="rounded-xl border bg-card p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Aucun coût fixe défini. Commencez avec la grille estimative du marché.</p>
          <Button size="sm" onClick={() => loadDefaults.mutate()} disabled={loadDefaults.isPending}>
            Charger les tarifs par défaut
          </Button>
        </div>
      )}

      {costs.length > 0 && (
        <>
          {/* Filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCat("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCat === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              Tout ({costs.length})
            </button>
            {(Object.entries(CATEGORIES) as [Category, typeof CATEGORIES[Category]][]).map(([key, val]) => {
              const count = costs.filter((c: any) => c.category === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilterCat(key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${filterCat === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  <val.icon className="h-3 w-3" />
                  {val.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Grouped list */}
          {Object.entries(grouped).map(([cat, items]) => {
            const catInfo = CATEGORIES[cat as Category] || { label: cat, icon: Package, color: "text-muted-foreground" };
            const CatIcon = catInfo.icon;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <CatIcon className={`h-4 w-4 ${catInfo.color}`} />
                  <h3 className="text-sm font-semibold">{catInfo.label}</h3>
                </div>
                <div className="rounded-xl border bg-card divide-y">
                  {items.map((item: any) => {
                    if (editingId === item.id) {
                      return (
                        <div key={item.id} className="p-3 space-y-2 bg-muted/30">
                          <div className={`grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-5"}`}>
                            <div>
                              <Label className="text-[10px]">Catégorie</Label>
                              <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v as Category })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px]">Libellé</Label>
                              <Input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-[10px]">Coût unitaire €</Label>
                              <Input type="number" step="0.01" value={editForm.unit_cost} onChange={(e) => setEditForm({ ...editForm, unit_cost: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-[10px]">Charges %</Label>
                              <Input type="number" value={editForm.charges_rate} onChange={(e) => setEditForm({ ...editForm, charges_rate: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-[10px]">Unité</Label>
                              <Select value={editForm.unit} onValueChange={(v) => setEditForm({ ...editForm, unit: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(UNITS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Input placeholder="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="h-8 text-xs" />
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                              <Check className="h-3 w-3 mr-1" /> Enregistrer
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                              <X className="h-3 w-3 mr-1" /> Annuler
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    const totalCost = Number(item.unit_cost) * (1 + Number(item.charges_rate) / 100);
                    return (
                      <div key={item.id} className={`flex items-center gap-3 ${isMobile ? "px-3 py-2.5 flex-wrap" : "px-4 py-2.5"}`}>
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{fmt(Number(item.unit_cost))} {UNITS[item.unit]}</span>
                        {Number(item.charges_rate) > 0 && (
                          <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">+{item.charges_rate}% charges</span>
                        )}
                        <span className="text-sm font-bold text-primary min-w-[80px] text-right">{fmt(totalCost)} {UNITS[item.unit]}</span>
                        {item.notes && <span className="text-[10px] text-muted-foreground hidden md:block max-w-[120px] truncate">{item.notes}</span>}
                        <button onClick={() => startEdit(item)} className="p-1 rounded hover:bg-muted">
                          <Edit2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 rounded hover:bg-muted">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Add form */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Ajouter un coût fixe
        </Button>
        {costs.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => loadDefaults.mutate()} disabled={loadDefaults.isPending} className="text-xs">
            + Charger les tarifs par défaut
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className={`grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-5"}`}>
            <div>
              <Label className="text-[10px]">Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Libellé *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-8 text-xs" placeholder="Ex: Chef d'équipe" />
            </div>
            <div>
              <Label className="text-[10px]">Coût unitaire €</Label>
              <Input type="number" step="0.01" value={form.unit_cost || ""} onChange={(e) => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Charges %</Label>
              <Input type="number" value={form.charges_rate || ""} onChange={(e) => setForm({ ...form, charges_rate: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" placeholder="Ex: 45" />
            </div>
            <div>
              <Label className="text-[10px]">Unité</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(UNITS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input placeholder="Notes (optionnel)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-8 text-xs" />
          <div className="flex gap-2">
            <Button size="sm" className="h-8" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.label.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
};
