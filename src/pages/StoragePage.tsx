import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Warehouse, Plus, Search, Pencil, Trash2, User, Calendar, LayoutGrid, Box, Grid2x2, Settings2 } from "lucide-react";
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
import { StorageDetailPanel } from "@/components/storage/StorageDetailPanel";
import { StorageBulkManager } from "@/components/storage/StorageBulkManager";
import { format } from "date-fns";

const Storage3DViewer = lazy(() =>
  import("@/components/storage/Storage3DViewer").then((m) => ({ default: m.Storage3DViewer }))
);
const Storage2DViewer = lazy(() =>
  import("@/components/storage/Storage2DViewer").then((m) => ({ default: m.Storage2DViewer }))
);

const statusLabels: Record<string, string> = { libre: "Libre", occupe: "Occupé", reserve: "Réservé" };
const statusStyles: Record<string, string> = {
  libre: "bg-success/10 text-success", occupe: "bg-info/10 text-info", reserve: "bg-warning/10 text-warning",
};

const fmt = (n: number | null) => n ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) : "—";

const AISLES_LETTERS = Array.from({ length: 20 }, (_, i) => String.fromCharCode(65 + i));
const ROWS_NUMBERS = ["1", "2", "3", "4", "5"];
const LEVELS = ["1", "2", "3"];

const emptyForm = {
  aisle: "", row: "", level: "",
  size_m2: "", volume_m3: "", location: "", status: "libre",
  client_id: "", start_date: "", end_date: "", monthly_rate: "", notes: "",
};

const StoragePage = () => {
  const { current, dbCompanies } = useCompany();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [deletingUnit, setDeletingUnit] = useState<any>(null);
  const [bulkDeleteInfo, setBulkDeleteInfo] = useState<{ label: string; pattern: string } | null>(null);
  const [bulkManagerOpen, setBulkManagerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState<"list" | "3d" | "2d">("3d");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [detailUnit, setDetailUnit] = useState<any>(null);

  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];
  const firstCompanyId = current === "global" ? dbCompanies[0]?.id : current;

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["storage-units", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storage_units")
        .select("*, clients(name)")
        .in("company_id", companyIds)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").in("company_id", companyIds).order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingUnit) {
        const { error } = await supabase.from("storage_units").update(payload).eq("id", editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("storage_units").insert({ ...payload, company_id: firstCompanyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingUnit ? "Box mis à jour" : "Box ajouté");
      queryClient.invalidateQueries({ queryKey: ["storage-units"] });
      setDialogOpen(false);
      setEditingUnit(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("storage_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Box supprimé");
      queryClient.invalidateQueries({ queryKey: ["storage-units"] });
      setDeletingUnit(null);
      setDetailUnit(null);
      setSelectedUnitId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (namePattern: string) => {
      const { error } = await supabase
        .from("storage_units")
        .delete()
        .in("company_id", companyIds)
        .like("name", namePattern);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Boxes supprimés");
      queryClient.invalidateQueries({ queryKey: ["storage-units"] });
      setDetailUnit(null);
      setSelectedUnitId(null);
      setBulkDeleteInfo(null);
    },
    onError: () => { toast.error("Erreur lors de la suppression"); setBulkDeleteInfo(null); },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (names: string[]) => {
      const rows = names.map((name) => ({
        name,
        company_id: firstCompanyId,
        status: "libre",
        volume_m3: 8,
      }));
      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from("storage_units").insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Boxes créés avec succès");
      queryClient.invalidateQueries({ queryKey: ["storage-units"] });
      setBulkManagerOpen(false);
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const bulkMultiDeleteMutation = useMutation({
    mutationFn: async (patterns: string[]) => {
      for (const pattern of patterns) {
        const { error } = await supabase
          .from("storage_units")
          .delete()
          .in("company_id", companyIds)
          .like("name", pattern);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Boxes supprimés avec succès");
      queryClient.invalidateQueries({ queryKey: ["storage-units"] });
      setDetailUnit(null);
      setSelectedUnitId(null);
      setBulkManagerOpen(false);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const handleDeleteUnit = (unit: any) => {
    setDeletingUnit(unit);
  };

  const handleDeleteAisle = (aisle: string) => {
    setBulkDeleteInfo({ label: `toute l'allée ${aisle}`, pattern: `${aisle}%-N%` });
  };

  const handleDeleteRow = (rowPrefix: string) => {
    setBulkDeleteInfo({ label: `la rangée ${rowPrefix} (tous niveaux)`, pattern: `${rowPrefix}-N%` });
  };

  const handleEdit = (u: any) => {
    setEditingUnit(u);
    const nameParts = u.name.match(/^([A-Z])(\d+)-N(\d+)$/);
    setForm({
      aisle: nameParts?.[1] || "", row: nameParts?.[2] || "", level: nameParts?.[3] || "",
      size_m2: u.size_m2?.toString() || "", volume_m3: u.volume_m3?.toString() || "",
      location: u.location || "", status: u.status, client_id: u.client_id || "",
      start_date: u.start_date || "", end_date: u.end_date || "",
      monthly_rate: u.monthly_rate?.toString() || "", notes: u.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.aisle || !form.row || !form.level) return toast.error("Emplacement requis (allée, rangée, niveau)");
    const boxName = `${form.aisle}${form.row}-N${form.level}`;
    // Check for duplicate (skip if editing the same box)
    const duplicate = units.find((u: any) => u.name === boxName && u.id !== editingUnit?.id);
    if (duplicate) return toast.error(`L'emplacement ${boxName} est déjà occupé par un box existant`);
    const payload: any = {
      name: boxName, status: form.status,
      size_m2: form.size_m2 ? parseFloat(form.size_m2) : null,
      volume_m3: form.volume_m3 ? parseFloat(form.volume_m3) : null,
      location: form.location || null, client_id: form.client_id || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      monthly_rate: form.monthly_rate ? parseFloat(form.monthly_rate) : null,
      notes: form.notes || null,
    };
    saveMutation.mutate(payload);
  };

  const handleSelectUnit3D = (unit: any) => {
    setSelectedUnitId(unit?.id || unit?.name || null);
    setDetailUnit(unit);
  };

  const filtered = units.filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.location?.toLowerCase().includes(q) || (u.clients as any)?.name?.toLowerCase().includes(q);
  });

  const stats = {
    total: units.length,
    libre: units.filter((u: any) => u.status === "libre").length,
    occupe: units.filter((u: any) => u.status === "occupe").length,
    reserve: units.filter((u: any) => u.status === "reserve").length,
    revenuMensuel: units.filter((u: any) => u.status === "occupe" && u.monthly_rate).reduce((s: number, u: any) => s + Number(u.monthly_rate), 0),
  };

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Garde-meuble</h1>
          {!isMobile && <p className="text-muted-foreground mt-1">Gestion des espaces de stockage</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          {!isMobile && (
            <div className="flex rounded-lg border bg-muted p-0.5">
              <Button
                variant={viewMode === "3d" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("3d")}
              >
                <Box className="h-3.5 w-3.5" />
                3D
              </Button>
              <Button
                variant={viewMode === "2d" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("2d")}
              >
                <Grid2x2 className="h-3.5 w-3.5" />
                2D
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("list")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Liste
              </Button>
            </div>
          )}

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setBulkManagerOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            {!isMobile && "Gérer en masse"}
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingUnit(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size={isMobile ? "icon" : "sm"} className={isMobile ? "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg" : ""}>
                <Plus className="h-4 w-4" />{!isMobile && <span className="ml-1">Ajouter un box</span>}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingUnit ? "Modifier le box" : "Nouveau box"}</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                {/* Location picker */}
                <div className="grid grid-cols-4 gap-3">
                  <div><Label className="text-xs">Allée *</Label>
                    <Select value={form.aisle} onValueChange={(v) => setForm({ ...form, aisle: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{AISLES_LETTERS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Rangée *</Label>
                    <Select value={form.row} onValueChange={(v) => setForm({ ...form, row: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{ROWS_NUMBERS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Niveau *</Label>
                    <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{LEVELS.map((n) => <SelectItem key={n} value={n}>N{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Statut</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {form.aisle && form.row && form.level && (
                  <p className="text-xs text-muted-foreground">Box : <strong>{form.aisle}{form.row}-N{form.level}</strong></p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Surface (m²)</Label><Input type="number" value={form.size_m2} onChange={(e) => setForm({ ...form, size_m2: e.target.value })} className="h-9" /></div>
                  <div><Label className="text-xs">Volume (m³)</Label><Input type="number" value={form.volume_m3} onChange={(e) => setForm({ ...form, volume_m3: e.target.value })} className="h-9" /></div>
                  <div><Label className="text-xs">Tarif/mois (€)</Label><Input type="number" value={form.monthly_rate} onChange={(e) => setForm({ ...form, monthly_rate: e.target.value })} className="h-9" /></div>
                </div>
                <div><Label className="text-xs">Emplacement</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Entrepôt Sud, Allée 3" className="h-9" /></div>
                <div><Label className="text-xs">Client</Label>
                  <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Début</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-9" /></div>
                  <div><Label className="text-xs">Fin prévue</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="h-9" /></div>
                </div>
                <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" /></div>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Stats */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-5"}`}>
        {[
          { label: "Total boxes", value: "300", sub: `${units.length} configuré${units.length > 1 ? "s" : ""}` },
          { label: "Libres", value: 300 - stats.occupe - stats.reserve, sub: `${((300 - stats.occupe - stats.reserve) / 3).toFixed(0)}% dispo` },
          { label: "Occupés", value: stats.occupe, sub: `${((stats.occupe / 300) * 100).toFixed(1)}% occupation` },
          { label: "Réservés", value: stats.reserve },
          { label: "Revenu mensuel", value: fmt(stats.revenuMensuel) },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className={`font-bold mt-0.5 ${isMobile ? "text-sm" : "text-lg"}`}>{s.value}</p>
            {s.sub && <p className="text-[10px] text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* 3D View */}
      {viewMode === "3d" && !isMobile && (
        <div className="flex gap-4">
          <div className="flex-1">
            <Suspense fallback={<Skeleton className="w-full h-[600px] rounded-xl" />}>
              <Storage3DViewer units={units} selectedId={selectedUnitId} onSelectUnit={handleSelectUnit3D} />
            </Suspense>
          </div>
          {detailUnit && (
            <div className="w-80 shrink-0">
              <StorageDetailPanel
                unit={detailUnit}
                onClose={() => { setDetailUnit(null); setSelectedUnitId(null); }}
                onEdit={handleEdit}
                onDelete={handleDeleteUnit}
                onDeleteAisle={handleDeleteAisle}
                onDeleteRow={handleDeleteRow}
              />
            </div>
          )}
        </div>
      )}

      {/* 2D View */}
      {viewMode === "2d" && !isMobile && (
        <div className="flex gap-4">
          <div className="flex-1">
            <Suspense fallback={<Skeleton className="w-full h-[400px] rounded-xl" />}>
              <Storage2DViewer units={units} selectedId={selectedUnitId} onSelectUnit={handleSelectUnit3D} />
            </Suspense>
          </div>
          {detailUnit && (
            <div className="w-80 shrink-0">
              <StorageDetailPanel
                unit={detailUnit}
                onClose={() => { setDetailUnit(null); setSelectedUnitId(null); }}
                onEdit={handleEdit}
                onDelete={handleDeleteUnit}
                onDeleteAisle={handleDeleteAisle}
                onDeleteRow={handleDeleteRow}
              />
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {(viewMode === "list" || isMobile) && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un box..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Aucun espace de stockage</div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`grid gap-3 ${isMobile ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
              {filtered.map((u: any) => (
                <div key={u.id} className="rounded-xl border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Warehouse className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-[11px] text-muted-foreground">{u.location || "—"}{u.size_m2 ? ` • ${u.size_m2} m²` : ""}{u.volume_m3 ? ` • ${u.volume_m3} m³` : ""}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${statusStyles[u.status] || ""}`}>
                      {statusLabels[u.status] || u.status}
                    </span>
                  </div>

                  {(u.clients as any)?.name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />{(u.clients as any).name}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {u.monthly_rate && <span className="font-medium text-foreground">{fmt(u.monthly_rate)}/mois</span>}
                    {u.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Depuis {format(new Date(u.start_date), "dd/MM/yy")}</span>}
                  </div>

                  <div className="flex gap-1 pt-1 border-t">
                    <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => handleEdit(u)}>
                      <Pencil className="h-3 w-3 mr-1" />Modifier
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeletingUnit(u)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </>
      )}

      <DeleteConfirmDialog
        open={!!deletingUnit}
        onOpenChange={(v) => !v && setDeletingUnit(null)}
        onConfirm={() => deletingUnit && deleteMutation.mutate(deletingUnit.id)}
        title="Supprimer ce box ?"
        description={`"${deletingUnit?.name}" sera définitivement supprimé.`}
        isPending={deleteMutation.isPending}
      />

      <DeleteConfirmDialog
        open={!!bulkDeleteInfo}
        onOpenChange={(v) => !v && setBulkDeleteInfo(null)}
        onConfirm={() => bulkDeleteInfo && bulkDeleteMutation.mutate(bulkDeleteInfo.pattern)}
        title="Supprimer en masse ?"
        description={`Tous les boxes de ${bulkDeleteInfo?.label} seront définitivement supprimés.`}
        isPending={bulkDeleteMutation.isPending}
      />

      <StorageBulkManager
        open={bulkManagerOpen}
        onOpenChange={setBulkManagerOpen}
        units={units}
        onBulkAdd={(names) => bulkAddMutation.mutate(names)}
        onBulkDelete={(patterns) => bulkMultiDeleteMutation.mutate(patterns)}
        isAdding={bulkAddMutation.isPending}
        isDeleting={bulkMultiDeleteMutation.isPending}
      />
    </div>
  );
};

export default StoragePage;
