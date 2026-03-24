import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import { Plus, Search, Building2, Phone, Mail, ChevronRight, Trash2, Save, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import SupplierEquipmentTab from "@/components/fournisseurs/SupplierEquipmentTab";
import { useSiretLookup, type EntrepriseResult } from "@/hooks/useSiretLookup";

const CATEGORIES = [
  { value: "sous-traitant", label: "Sous-traitant" },
  { value: "loueur", label: "Loueur" },
  { value: "fournisseur", label: "Fournisseur matériel" },
  { value: "balisage", label: "Balisage / Signalisation" },
  { value: "transport", label: "Transport" },
  { value: "autre", label: "Autre" },
];

const STATUS_COLORS: Record<string, string> = {
  actif: "bg-success/10 text-success border-success/20",
  inactif: "bg-muted text-muted-foreground border-border",
};

function SupplierForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const { nameResults, nameLoading, showNameResults, setShowNameResults, searchByName, fillFromEntreprise, siretLoading, lookupSiret } = useSiretLookup();

  const handleNameChange = (val: string) => {
    onChange({ ...data, name: val });
    searchByName(val);
  };

  const makeSetValue = () => {
    const updates: Record<string, any> = {};
    const setValue = (field: string, value: any) => { updates[field] = value; };
    return { setValue, getUpdates: () => updates };
  };

  const handleSelectEntreprise = (etab: EntrepriseResult) => {
    const { setValue, getUpdates } = makeSetValue();
    fillFromEntreprise(etab, setValue);
    onChange({ ...data, ...getUpdates() });
  };

  const handleSiretLookup = () => {
    if (!data.siret) return;
    const updates: Record<string, any> = {};
    const setValue = (field: string, value: any) => { updates[field] = value; };
    lookupSiret(data.siret, setValue).then(() => {
      if (Object.keys(updates).length > 0) onChange({ ...data, ...updates });
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5 relative">
          <Label className="text-xs">Nom *</Label>
          <Input value={data.name || ""} onChange={e => handleNameChange(e.target.value)} placeholder="Nom du fournisseur" autoComplete="off" />
          {showNameResults && nameResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {nameResults.map((etab) => (
                <button
                  key={etab.siren}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors text-sm border-b last:border-0"
                  onClick={() => handleSelectEntreprise(etab)}
                >
                  <div className="font-medium">{etab.nom_complet}</div>
                  <div className="text-xs text-muted-foreground">
                    SIRET {etab.siege?.siret} · {etab.siege?.commune}
                    {etab.activite_principale && ` · ${etab.activite_principale}`}
                  </div>
                </button>
              ))}
            </div>
          )}
          {nameLoading && <div className="absolute right-3 top-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Catégorie</Label>
          <Select value={data.category || "sous-traitant"} onValueChange={v => onChange({ ...data, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Statut</Label>
          <Select value={data.status || "actif"} onValueChange={v => onChange({ ...data, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="actif">Actif</SelectItem>
              <SelectItem value="inactif">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Contact</Label>
          <Input value={data.contact_name || ""} onChange={e => onChange({ ...data, contact_name: e.target.value })} placeholder="Nom du contact" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={data.email || ""} onChange={e => onChange({ ...data, email: e.target.value })} placeholder="email@exemple.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Téléphone</Label>
          <Input value={data.phone || ""} onChange={e => onChange({ ...data, phone: e.target.value })} placeholder="01 23 45 67 89" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">SIRET</Label>
          <div className="flex gap-1.5">
            <Input value={data.siret || ""} onChange={e => onChange({ ...data, siret: e.target.value })} placeholder="123 456 789 00012" className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={handleSiretLookup} disabled={siretLoading}>
              {siretLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Taux journalier (€)</Label>
          <Input type="number" value={data.daily_rate || ""} onChange={e => onChange({ ...data, daily_rate: Number(e.target.value) || null })} placeholder="450" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Taux horaire (€)</Label>
          <Input type="number" value={data.hourly_rate || ""} onChange={e => onChange({ ...data, hourly_rate: Number(e.target.value) || null })} placeholder="55" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Adresse</Label>
          <Input value={data.address || ""} onChange={e => onChange({ ...data, address: e.target.value })} placeholder="Adresse complète" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea value={data.notes || ""} onChange={e => onChange({ ...data, notes: e.target.value })} rows={3} placeholder="Notes internes..." />
        </div>
      </div>
    </div>
  );
}

export default function Fournisseurs() {
  const isMobile = useIsMobile();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .in("company_id", companyIds)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: companyIds.length > 0,
  });

  const filtered = suppliers.filter((s: any) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.contact_name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || s.category === catFilter;
    return matchSearch && matchCat;
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("suppliers").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fournisseur créé");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setCreateOpen(false);
      setForm({});
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase.from("suppliers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fournisseur mis à jour");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fournisseur supprimé");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const handleCreate = () => {
    if (!form.name?.trim()) return toast.error("Nom requis");
    createMutation.mutate({ ...form, company_id: companyIds[0] });
  };

  return (
    <div className={`max-w-7xl mx-auto animate-fade-in ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`page-title ${isMobile ? "!text-lg" : ""}`}>Fournisseurs & Sous-traitants</h1>
          {!isMobile && <p className="page-subtitle">Gérez vos partenaires et prestataires</p>}
        </div>
        <Button size={isMobile ? "sm" : "default"} onClick={() => { setForm({}); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          {!isMobile && "Ajouter"}
        </Button>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-card animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mb-4 opacity-20" />
          <p className="font-medium">Aucun fournisseur trouvé</p>
          <p className="text-sm mt-1">{suppliers.length === 0 ? "Ajoutez vos sous-traitants et fournisseurs" : "Modifiez vos filtres"}</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {filtered.map((s: any) => (
            <div key={s.id} onClick={() => { setSelected(s); setForm({ ...s }); }} className="card-interactive group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted flex items-center justify-center h-10 w-10 flex-shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CATEGORIES.find(c => c.value === s.category)?.label || s.category}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${STATUS_COLORS[s.status] || ""}`}>
                    {s.status === "actif" ? "Actif" : "Inactif"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {s.contact_name && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.contact_name}{s.phone ? ` · ${s.phone}` : ""}</div>}
                {s.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{s.email}</div>}
                {(s.daily_rate || s.hourly_rate) && (
                  <div className="text-primary font-medium">
                    {s.daily_rate ? `${s.daily_rate} €/jour` : ""}{s.daily_rate && s.hourly_rate ? " · " : ""}{s.hourly_rate ? `${s.hourly_rate} €/h` : ""}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau fournisseur</DialogTitle>
            <DialogDescription>Ajoutez un fournisseur ou sous-traitant</DialogDescription>
          </DialogHeader>
          <SupplierForm data={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{selected?.name || "Détails fournisseur"}</SheetTitle></SheetHeader>
          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informations</TabsTrigger>
              <TabsTrigger value="equipment" className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Matériel
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 mt-4">
              <SupplierForm data={form} onChange={setForm} />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Enregistrer
                </Button>
                <Button variant="destructive" size="icon" onClick={() => { if (confirm("Supprimer ce fournisseur ?")) deleteMutation.mutate(selected.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="equipment" className="mt-4">
              {selected && (
                <SupplierEquipmentTab
                  supplierId={selected.id}
                  companyId={selected.company_id}
                  supplierName={selected.name}
                />
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
