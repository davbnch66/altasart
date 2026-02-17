import { useState } from "react";
import { motion } from "framer-motion";
import { Truck, Wrench, Plus, Search, Pencil, Trash2, AlertTriangle, ShieldCheck, Calendar } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { differenceInDays, format } from "date-fns";

const typeLabels: Record<string, string> = {
  grue: "Grue", camion: "Camion", nacelle: "Nacelle", chariot: "Chariot élévateur",
  remorque: "Remorque", utilitaire: "Utilitaire", autre: "Autre",
};

const statusLabels: Record<string, string> = {
  disponible: "Disponible", en_mission: "En mission", maintenance: "Maintenance", hors_service: "Hors service",
};

const statusStyles: Record<string, string> = {
  disponible: "bg-success/10 text-success", en_mission: "bg-info/10 text-info",
  maintenance: "bg-warning/10 text-warning", hors_service: "bg-destructive/10 text-destructive",
};

const typeIcons: Record<string, typeof Truck> = {
  grue: Wrench, camion: Truck, nacelle: Wrench, chariot: Wrench,
  remorque: Truck, utilitaire: Truck, autre: Wrench,
};

function getAlerts(v: any): string[] {
  const alerts: string[] = [];
  const today = new Date();
  if (v.insurance_expiry) {
    const d = differenceInDays(new Date(v.insurance_expiry), today);
    if (d < 0) alerts.push("Assurance expirée");
    else if (d < 30) alerts.push(`Assurance expire dans ${d}j`);
  }
  if (v.technical_control_expiry) {
    const d = differenceInDays(new Date(v.technical_control_expiry), today);
    if (d < 0) alerts.push("CT expiré");
    else if (d < 30) alerts.push(`CT expire dans ${d}j`);
  }
  if (v.next_maintenance) {
    const d = differenceInDays(new Date(v.next_maintenance), today);
    if (d < 0) alerts.push("Maintenance en retard");
    else if (d < 14) alerts.push(`Maintenance dans ${d}j`);
  }
  return alerts;
}

const emptyForm = {
  name: "", type: "grue", registration: "", brand: "", model: "",
  capacity_tons: "", reach_meters: "", height_meters: "", daily_rate: "",
  insurance_expiry: "", technical_control_expiry: "", next_maintenance: "",
  status: "disponible", notes: "",
};

const FleetPage = () => {
  const { current, dbCompanies } = useCompany();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];
  const firstCompanyId = current === "global" ? dbCompanies[0]?.id : current;

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["fleet-vehicles", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_vehicles")
        .select("*")
        .in("company_id", companyIds)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingVehicle) {
        const { error } = await supabase.from("fleet_vehicles").update(payload).eq("id", editingVehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fleet_vehicles").insert({ ...payload, company_id: firstCompanyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingVehicle ? "Engin mis à jour" : "Engin ajouté");
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      setDialogOpen(false);
      setEditingVehicle(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fleet_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Engin supprimé");
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      setDeletingVehicle(null);
    },
  });

  const handleEdit = (v: any) => {
    setEditingVehicle(v);
    setForm({
      name: v.name, type: v.type, registration: v.registration || "", brand: v.brand || "",
      model: v.model || "", capacity_tons: v.capacity_tons?.toString() || "",
      reach_meters: v.reach_meters?.toString() || "", height_meters: v.height_meters?.toString() || "",
      daily_rate: v.daily_rate?.toString() || "",
      insurance_expiry: v.insurance_expiry || "", technical_control_expiry: v.technical_control_expiry || "",
      next_maintenance: v.next_maintenance || "", status: v.status, notes: v.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    const payload: any = {
      name: form.name.trim(), type: form.type, status: form.status,
      registration: form.registration || null, brand: form.brand || null, model: form.model || null,
      notes: form.notes || null,
      capacity_tons: form.capacity_tons ? parseFloat(form.capacity_tons) : null,
      reach_meters: form.reach_meters ? parseFloat(form.reach_meters) : null,
      height_meters: form.height_meters ? parseFloat(form.height_meters) : null,
      daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null,
      insurance_expiry: form.insurance_expiry || null,
      technical_control_expiry: form.technical_control_expiry || null,
      next_maintenance: form.next_maintenance || null,
    };
    saveMutation.mutate(payload);
  };

  const filtered = vehicles.filter((v: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.type?.toLowerCase().includes(q) || v.registration?.toLowerCase().includes(q);
  });

  // Count alerts
  const totalAlerts = vehicles.reduce((sum: number, v: any) => sum + getAlerts(v).length, 0);

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Flotte & Engins</h1>
          {!isMobile && (
            <p className="text-muted-foreground mt-1">
              {vehicles.length} engins{totalAlerts > 0 && ` — ${totalAlerts} alerte${totalAlerts > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingVehicle(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button size={isMobile ? "icon" : "sm"} className={isMobile ? "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg" : ""}>
              <Plus className="h-4 w-4" />{!isMobile && <span className="ml-1">Ajouter</span>}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVehicle ? "Modifier l'engin" : "Nouvel engin"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nom *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Grue Liebherr 200T" className="h-9" /></div>
                <div><Label className="text-xs">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Immatriculation</Label><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Marque</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Modèle</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="h-9" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Capacité (T)</Label><Input type="number" value={form.capacity_tons} onChange={(e) => setForm({ ...form, capacity_tons: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Portée (m)</Label><Input type="number" value={form.reach_meters} onChange={(e) => setForm({ ...form, reach_meters: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Hauteur (m)</Label><Input type="number" value={form.height_meters} onChange={(e) => setForm({ ...form, height_meters: e.target.value })} className="h-9" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Tarif journalier (€)</Label><Input type="number" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Assurance</Label><Input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Contrôle technique</Label><Input type="date" value={form.technical_control_expiry} onChange={(e) => setForm({ ...form, technical_control_expiry: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">Maintenance</Label><Input type="date" value={form.next_maintenance} onChange={(e) => setForm({ ...form, next_maintenance: e.target.value })} className="h-9" /></div>
              </div>
              <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" /></div>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un engin..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Aucun engin enregistré</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`grid gap-3 ${isMobile ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {filtered.map((v: any) => {
            const Icon = typeIcons[v.type] || Truck;
            const alerts = getAlerts(v);
            return (
              <div key={v.id} className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      <p className="text-[11px] text-muted-foreground">{typeLabels[v.type] || v.type}{v.registration ? ` — ${v.registration}` : ""}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${statusStyles[v.status] || ""}`}>
                    {statusLabels[v.status] || v.status}
                  </span>
                </div>

                {/* Specs */}
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  {v.capacity_tons && <span>{v.capacity_tons}T</span>}
                  {v.reach_meters && <span>{v.reach_meters}m portée</span>}
                  {v.height_meters && <span>{v.height_meters}m haut</span>}
                  {v.daily_rate && <span className="font-medium text-foreground">{v.daily_rate}€/j</span>}
                </div>

                {/* Alerts */}
                {alerts.length > 0 && (
                  <div className="space-y-1">
                    {alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-warning">
                        <AlertTriangle className="h-3 w-3" />{a}
                      </div>
                    ))}
                  </div>
                )}

                {/* Dates */}
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  {v.insurance_expiry && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Ass. {format(new Date(v.insurance_expiry), "dd/MM/yy")}</span>}
                  {v.technical_control_expiry && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />CT {format(new Date(v.technical_control_expiry), "dd/MM/yy")}</span>}
                </div>

                {/* Actions */}
                <div className="flex gap-1 pt-1 border-t">
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => handleEdit(v)}>
                    <Pencil className="h-3 w-3 mr-1" />Modifier
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeletingVehicle(v)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      <DeleteConfirmDialog
        open={!!deletingVehicle}
        onOpenChange={(v) => !v && setDeletingVehicle(null)}
        onConfirm={() => deletingVehicle && deleteMutation.mutate(deletingVehicle.id)}
        title="Supprimer cet engin ?"
        description={`"${deletingVehicle?.name}" sera définitivement supprimé.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default FleetPage;
