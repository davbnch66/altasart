import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Truck, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const RH_ROLES = ["Chef d'équipe", "Manutentionnaire", "Grutier", "Chauffeur", "Monteur", "Électricien"];
const VEHICLE_TYPES = [
  { value: "utilitaire", label: "🚐 Utilitaire" },
  { value: "camion", label: "🚛 Camion" },
  { value: "semi", label: "🚚 Semi" },
  { value: "grue_mobile", label: "🏗 Grue mobile" },
  { value: "nacelle", label: "🔧 Nacelle" },
  { value: "chariot", label: "📦 Chariot" },
  { value: "palan", label: "⛓ Palan" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  visiteId: string;
  companyId: string;
}

export const MobileMoyensSheet = ({ open, onClose, visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"rh" | "vehicules">("rh");

  const { data: rh = [] } = useQuery({
    queryKey: ["visite-rh", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visiteId).order("sort_order");
      return data || [];
    },
    enabled: open,
  });

  const { data: vehicules = [] } = useQuery({
    queryKey: ["visite-vehicules", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_vehicules").select("*").eq("visite_id", visiteId).order("sort_order");
      return data || [];
    },
    enabled: open,
  });

  const addRH = useMutation({
    mutationFn: async (role: string) => {
      await supabase.from("visite_ressources_humaines").insert({
        visite_id: visiteId, company_id: companyId, role, quantity: 1, sort_order: rh.length,
      });
    },
    onSuccess: () => {
      toast.success("Ajouté ✓");
      queryClient.invalidateQueries({ queryKey: ["visite-rh", visiteId] });
    },
  });

  const deleteRH = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("visite_ressources_humaines").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visite-rh", visiteId] });
    },
  });

  const addVehicle = useMutation({
    mutationFn: async (type: string) => {
      await supabase.from("visite_vehicules").insert([{
        visite_id: visiteId, company_id: companyId, type: type as any, quantity: 1, sort_order: vehicules.length,
      }]);
    },
    onSuccess: () => {
      toast.success("Ajouté ✓");
      queryClient.invalidateQueries({ queryKey: ["visite-vehicules", visiteId] });
    },
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("visite_vehicules").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visite-vehicules", visiteId] });
    },
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">🚛 Moyens & Logistique</SheetTitle>
        </SheetHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 bg-muted rounded-xl p-1">
          <button
            onClick={() => setTab("rh")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "rh" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> Personnel ({rh.length})
          </button>
          <button
            onClick={() => setTab("vehicules")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "vehicules" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Truck className="h-4 w-4" /> Véhicules ({vehicules.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-3">
          {tab === "rh" ? (
            <div className="space-y-2">
              {/* Quick add RH */}
              <div className="flex flex-wrap gap-2 mb-3">
                {RH_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => addRH.mutate(role)}
                    className="px-3 py-2 rounded-xl text-sm bg-card border border-border/50 active:scale-95 transition-transform"
                  >
                    <Plus className="h-3 w-3 inline mr-1" />{role}
                  </button>
                ))}
              </div>
              {/* Current RH */}
              {rh.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50">
                  <div>
                    <p className="font-medium text-sm">{item.role}</p>
                    <p className="text-xs text-muted-foreground">× {item.quantity}</p>
                  </div>
                  <button onClick={() => deleteRH.mutate(item.id)} className="p-2 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {rh.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">Aucun personnel défini</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Quick add vehicle */}
              <div className="flex flex-wrap gap-2 mb-3">
                {VEHICLE_TYPES.map((vt) => (
                  <button
                    key={vt.value}
                    onClick={() => addVehicle.mutate(vt.value)}
                    className="px-3 py-2 rounded-xl text-sm bg-card border border-border/50 active:scale-95 transition-transform"
                  >
                    {vt.label}
                  </button>
                ))}
              </div>
              {/* Current vehicles */}
              {vehicules.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50">
                  <div>
                    <p className="font-medium text-sm">{VEHICLE_TYPES.find((v) => v.value === item.type)?.label || item.type}</p>
                    <p className="text-xs text-muted-foreground">× {item.quantity}{item.label ? ` — ${item.label}` : ""}</p>
                  </div>
                  <button onClick={() => deleteVehicle.mutate(item.id)} className="p-2 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {vehicules.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">Aucun véhicule défini</p>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
