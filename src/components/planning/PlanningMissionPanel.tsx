import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import type { AISuggestion } from "./PlanningAIAssistant";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Zap, Truck, User } from "lucide-react";

interface PlanningMissionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultResourceId?: string;
  onOpenFullDialog?: () => void;
  preFill?: AISuggestion | null;
}

export const PlanningMissionPanel = ({
  open, onOpenChange, defaultDate, defaultResourceId, onOpenFullDialog, preFill,
}: PlanningMissionPanelProps) => {
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const companyIds = current === "global" ? dbCompanies.map(c => c.id) : [current];

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    dossier_id: "",
    loading_date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    delivery_date: "",
    loading_city: "",
    delivery_city: "",
    resource_ids: defaultResourceId ? [defaultResourceId] : [] as string[],
    notes: "",
  });

  // Reset form when panel opens
  useEffect(() => {
    if (open) {
      setForm({
        client_id: "",
        dossier_id: "",
        loading_date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        delivery_date: "",
        loading_city: "",
        delivery_city: "",
        resource_ids: defaultResourceId ? [defaultResourceId] : [],
        notes: "",
      });
    }
  }, [open, defaultDate, defaultResourceId]);

  const { data: clients = [] } = useQuery({
    queryKey: ["panel-clients", companyIds],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").in("company_id", companyIds).order("name");
      return data || [];
    },
    enabled: open && companyIds.length > 0,
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ["panel-dossiers", form.client_id],
    queryFn: async () => {
      if (!form.client_id) return [];
      const { data } = await supabase.from("dossiers").select("id, title, code, address").eq("client_id", form.client_id).order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!form.client_id,
  });

  useEffect(() => {
    if (!form.dossier_id) return;
    const dossier = dossiers.find((d: any) => d.id === form.dossier_id);
    if (dossier?.address) {
      setForm(prev => ({ ...prev, loading_city: dossier.address }));
    }
  }, [form.dossier_id, dossiers]);

  const { data: resources = [] } = useQuery({
    queryKey: ["panel-resources", companyIds],
    queryFn: async () => {
      const { data } = await supabase.from("resource_companies").select("resource_id, resources(id, name, type)").in("company_id", companyIds);
      const seen = new Set();
      return (data || []).map((rc: any) => rc.resources).filter((r: any) => r && !seen.has(r.id) && seen.add(r.id));
    },
    enabled: open && companyIds.length > 0,
  });

  const handleSave = async () => {
    if (!form.loading_date) { toast.error("Date de chargement requise"); return; }
    setSaving(true);
    try {
      const companyId = current === "global" ? dbCompanies[0]?.id : current;
      if (!companyId) throw new Error("Aucune entreprise sélectionnée");

      const { data: op, error } = await supabase.from("operations").insert({
        company_id: companyId,
        dossier_id: form.dossier_id || null,
        loading_date: form.loading_date,
        delivery_date: form.delivery_date || form.loading_date,
        loading_city: form.loading_city || null,
        delivery_city: form.delivery_city || null,
        notes: form.notes || null,
        status: "planifie",
      }).select("id").single();
      if (error) throw error;

      if (form.resource_ids.length > 0 && op) {
        await supabase.from("operation_resources").insert(
          form.resource_ids.map(rid => ({ operation_id: op.id, resource_id: rid }))
        );
      }

      toast.success("Mission créée !");
      queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      queryClient.invalidateQueries({ queryKey: ["planning-op-resources"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleResource = (rid: string) => {
    setForm(prev => ({
      ...prev,
      resource_ids: prev.resource_ids.includes(rid)
        ? prev.resource_ids.filter(r => r !== rid)
        : [...prev.resource_ids, rid]
    }));
  };

  const vehicules = resources.filter((r: any) => r.type === "vehicule" || r.type === "grue");
  const personnel = resources.filter((r: any) => r.type === "employe" || r.type === "equipe");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:w-[520px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg font-black">
            <Zap className="h-5 w-5 text-green-600" />
            Nouvelle mission
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Client */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Client</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm(prev => ({ ...prev, client_id: v, dossier_id: "" }))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Sélectionner un client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dossier */}
          {form.client_id && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Dossier lié</Label>
              <Select value={form.dossier_id} onValueChange={(v) => setForm(prev => ({ ...prev, dossier_id: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Sélectionner un dossier..." />
                </SelectTrigger>
                <SelectContent>
                  {dossiers.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date début *</Label>
              <Input type="date" value={form.loading_date} onChange={(e) => setForm(prev => ({ ...prev, loading_date: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date fin</Label>
              <Input type="date" value={form.delivery_date} onChange={(e) => setForm(prev => ({ ...prev, delivery_date: e.target.value }))} className="h-9 text-sm" min={form.loading_date} />
            </div>
          </div>

          {/* Villes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ville chargement</Label>
              <Input value={form.loading_city} onChange={(e) => setForm(prev => ({ ...prev, loading_city: e.target.value }))} placeholder="Paris..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ville livraison</Label>
              <Input value={form.delivery_city} onChange={(e) => setForm(prev => ({ ...prev, delivery_city: e.target.value }))} placeholder="Lyon..." className="h-9 text-sm" />
            </div>
          </div>

          {/* Ressources */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Ressources assignées</Label>
            {vehicules.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1"><Truck className="h-3 w-3" /> Véhicules</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {vehicules.map((r: any) => (
                    <button key={r.id} type="button" onClick={() => toggleResource(r.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors text-left ${form.resource_ids.includes(r.id) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50 text-foreground"}`}>
                      <Truck className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {personnel.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1"><User className="h-3 w-3" /> Personnel</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {personnel.map((r: any) => (
                    <button key={r.id} type="button" onClick={() => toggleResource(r.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors text-left ${form.resource_ids.includes(r.id) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted/50 text-foreground"}`}>
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <textarea value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Instructions particulières..." rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {/* Lien vers dialog complet */}
          {onOpenFullDialog && (
            <p className="text-xs text-muted-foreground text-center">
              Besoin de plus d'options ?{" "}
              <button className="text-primary underline" onClick={() => { onOpenChange(false); onOpenFullDialog(); }}>
                Ouvrir le formulaire complet
              </button>
            </p>
          )}
        </div>

        <div className="border-t px-6 py-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Créer la mission
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
