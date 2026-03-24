import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, Sparkles, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const EQUIPMENT_TYPES = [
  { value: "grue", label: "Grue" },
  { value: "camion", label: "Camion" },
  { value: "nacelle", label: "Nacelle" },
  { value: "chariot", label: "Chariot élévateur" },
  { value: "remorque", label: "Remorque" },
  { value: "outillage", label: "Outillage" },
  { value: "balisage", label: "Balisage" },
  { value: "autre", label: "Autre" },
];

const AVAILABILITY_COLORS: Record<string, string> = {
  disponible: "bg-success/10 text-success border-success/20",
  loué: "bg-warning/10 text-warning border-warning/20",
  maintenance: "bg-destructive/10 text-destructive border-destructive/20",
  indisponible: "bg-muted text-muted-foreground border-border",
};

interface Props {
  supplierId: string;
  companyId: string;
  supplierName: string;
}

function EquipmentForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type *</Label>
          <Select value={data.type || "grue"} onValueChange={v => onChange({ ...data, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Disponibilité</Label>
          <Select value={data.availability || "disponible"} onValueChange={v => onChange({ ...data, availability: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="disponible">Disponible</SelectItem>
              <SelectItem value="loué">Loué</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="indisponible">Indisponible</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Marque</Label>
          <Input value={data.brand || ""} onChange={e => onChange({ ...data, brand: e.target.value })} placeholder="Ex: KLAAS" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Modèle</Label>
          <Input value={data.model || ""} onChange={e => onChange({ ...data, model: e.target.value })} placeholder="Ex: K900 RSX" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Capacité (tonnes)</Label>
          <Input type="number" value={data.capacity_tons ?? ""} onChange={e => onChange({ ...data, capacity_tons: e.target.value ? Number(e.target.value) : null })} placeholder="Ex: 2.5" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Portée (m)</Label>
          <Input type="number" value={data.reach_meters ?? ""} onChange={e => onChange({ ...data, reach_meters: e.target.value ? Number(e.target.value) : null })} placeholder="Ex: 18" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Hauteur (m)</Label>
          <Input type="number" value={data.height_meters ?? ""} onChange={e => onChange({ ...data, height_meters: e.target.value ? Number(e.target.value) : null })} placeholder="Ex: 25" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tarif jour (€)</Label>
          <Input type="number" value={data.daily_rate ?? ""} onChange={e => onChange({ ...data, daily_rate: e.target.value ? Number(e.target.value) : null })} placeholder="450" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tarif semaine (€)</Label>
          <Input type="number" value={data.weekly_rate ?? ""} onChange={e => onChange({ ...data, weekly_rate: e.target.value ? Number(e.target.value) : null })} placeholder="1800" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tarif mois (€)</Label>
          <Input type="number" value={data.monthly_rate ?? ""} onChange={e => onChange({ ...data, monthly_rate: e.target.value ? Number(e.target.value) : null })} placeholder="5000" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea value={data.notes || ""} onChange={e => onChange({ ...data, notes: e.target.value })} rows={2} placeholder="Informations complémentaires..." />
        </div>
      </div>
    </div>
  );
}

export default function SupplierEquipmentTab({ supplierId, companyId, supplierName }: Props) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [aiLoading, setAiLoading] = useState(false);

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["supplier-equipment", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_equipment")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("supplier_equipment").insert({
        ...data,
        supplier_id: supplierId,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Équipement ajouté");
      queryClient.invalidateQueries({ queryKey: ["supplier-equipment", supplierId] });
      setAddOpen(false);
      setForm({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase.from("supplier_equipment").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Équipement mis à jour");
      queryClient.invalidateQueries({ queryKey: ["supplier-equipment", supplierId] });
      setEditItem(null);
      setForm({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Équipement supprimé");
      queryClient.invalidateQueries({ queryKey: ["supplier-equipment", supplierId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAiAnalyze = async () => {
    if (!form.brand && !form.model) {
      toast.error("Renseignez au moins la marque ou le modèle");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-supplier-equipment", {
        body: {
          brand: form.brand || "",
          model: form.model || "",
          type: form.type || "grue",
          supplier_name: supplierName,
        },
      });
      if (error) throw error;
      if (data?.specs) {
        setForm((prev: any) => ({
          ...prev,
          capacity_tons: data.specs.capacity_tons ?? prev.capacity_tons,
          reach_meters: data.specs.reach_meters ?? prev.reach_meters,
          height_meters: data.specs.height_meters ?? prev.height_meters,
          daily_rate: data.specs.daily_rate ?? prev.daily_rate,
          weekly_rate: data.specs.weekly_rate ?? prev.weekly_rate,
          monthly_rate: data.specs.monthly_rate ?? prev.monthly_rate,
          notes: data.specs.description
            ? (prev.notes ? prev.notes + "\n\n" + data.specs.description : data.specs.description)
            : prev.notes,
        }));
        toast.success("Caractéristiques extraites par l'IA");
      } else {
        toast.info("Aucune information trouvée pour ce modèle");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur d'analyse IA");
    } finally {
      setAiLoading(false);
    }
  };

  const formatPrice = (v: number | null) => v ? `${v} €` : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Catalogue matériel ({equipment.length})</h3>
        <Button size="sm" variant="outline" onClick={() => { setForm({}); setAddOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 rounded-lg border bg-card animate-pulse" />)}
        </div>
      ) : equipment.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun équipement enregistré</p>
          <p className="text-xs mt-1">Ajoutez les grues, camions et matériels de ce fournisseur</p>
        </div>
      ) : (
        <div className="space-y-2">
          {equipment.map((eq: any) => (
            <div
              key={eq.id}
              onClick={() => { setEditItem(eq); setForm({ ...eq }); }}
              className="rounded-lg border bg-card p-3 cursor-pointer hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{eq.brand} {eq.model}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {EQUIPMENT_TYPES.find(t => t.value === eq.type)?.label || eq.type}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${AVAILABILITY_COLORS[eq.availability] || ""}`}>
                      {eq.availability}
                    </Badge>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    {eq.capacity_tons && <span>{eq.capacity_tons}t</span>}
                    {eq.reach_meters && <span>{eq.reach_meters}m portée</span>}
                    {eq.height_meters && <span>{eq.height_meters}m haut.</span>}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-primary font-medium">
                    {eq.daily_rate && <span>{eq.daily_rate}€/j</span>}
                    {eq.weekly_rate && <span>{eq.weekly_rate}€/sem</span>}
                    {eq.monthly_rate && <span>{eq.monthly_rate}€/mois</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm("Supprimer ?")) deleteMut.mutate(eq.id); }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un équipement</DialogTitle>
            <DialogDescription>Renseignez les caractéristiques ou laissez l'IA les remplir</DialogDescription>
          </DialogHeader>
          <EquipmentForm data={form} onChange={setForm} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAiAnalyze} disabled={aiLoading} className="flex-1">
              {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Remplir avec l'IA
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'équipement</DialogTitle>
            <DialogDescription>Modifiez les caractéristiques ou relancez l'IA</DialogDescription>
          </DialogHeader>
          <EquipmentForm data={form} onChange={setForm} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAiAnalyze} disabled={aiLoading} className="flex-1">
              {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Remplir avec l'IA
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Annuler</Button>
            <Button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}>
              {updateMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
