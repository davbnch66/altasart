import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Camera, Package, MapPin, Users, Truck, ShieldAlert, CheckCircle2, AlertTriangle, Download, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  visiteId: string;
  companyId: string;
  visite: any;
  onExportPdf: () => void;
  exporting: boolean;
}

export const MobileVisiteSummary = ({ open, onClose, visiteId, companyId, visite, onExportPdf, exporting }: Props) => {
  const { data: pieces = [] } = useQuery({
    queryKey: ["visite-pieces", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_pieces").select("*").eq("visite_id", visiteId);
      return data || [];
    },
    enabled: open,
  });

  const { data: materiel = [] } = useQuery({
    queryKey: ["visite-materiel", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_materiel").select("*").eq("visite_id", visiteId);
      return data || [];
    },
    enabled: open,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["visite-photos", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_photos").select("*").eq("visite_id", visiteId);
      return data || [];
    },
    enabled: open,
  });

  const { data: rh = [] } = useQuery({
    queryKey: ["visite-rh", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visiteId);
      return data || [];
    },
    enabled: open,
  });

  const { data: vehicules = [] } = useQuery({
    queryKey: ["visite-vehicules", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_vehicules").select("*").eq("visite_id", visiteId);
      return data || [];
    },
    enabled: open,
  });

  const { data: contraintes } = useQuery({
    queryKey: ["visite-contraintes", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_contraintes").select("*").eq("visite_id", visiteId).maybeSingle();
      return data;
    },
    enabled: open,
  });

  const totalWeight = materiel.reduce((s: number, m: any) => s + (m.weight || 0) * (m.quantity || 1), 0);
  const totalQty = materiel.reduce((s: number, m: any) => s + (m.quantity || 1), 0);
  const totalRH = rh.reduce((s: number, r: any) => s + (r.quantity || 1), 0);

  const issues: string[] = [];
  if (photos.length === 0) issues.push("Aucune photo prise");
  if (materiel.length === 0) issues.push("Aucun matériel inventorié");
  if (rh.length === 0 && materiel.length > 0) issues.push("Aucun personnel défini");
  if (vehicules.length === 0 && materiel.length > 0) issues.push("Aucun véhicule défini");
  if (!contraintes) issues.push("Contraintes d'accès non renseignées");
  if (pieces.length === 0) issues.push("Aucune pièce/zone définie");

  const client = visite?.clients as any;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-lg">📋 Synthèse de visite</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Client & site */}
          <div className="rounded-2xl bg-card border p-4">
            <p className="font-semibold">{client?.name || "Client"}</p>
            <p className="text-sm text-muted-foreground">{visite?.address || client?.address || "—"}</p>
            {visite?.scheduled_date && (
              <p className="text-xs text-muted-foreground mt-1">
                📅 {new Date(visite.scheduled_date).toLocaleDateString("fr-FR")}
                {visite.scheduled_time ? ` à ${visite.scheduled_time.slice(0, 5)}` : ""}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={Camera} label="Photos" value={photos.length} color="bg-blue-500" />
            <StatCard icon={MapPin} label="Zones" value={pieces.length} color="bg-emerald-500" />
            <StatCard icon={Package} label="Matériel" value={`${totalQty}`} color="bg-amber-500" />
            <StatCard icon={Users} label="Personnel" value={totalRH} color="bg-purple-500" />
            <StatCard icon={Truck} label="Véhicules" value={vehicules.length} color="bg-indigo-500" />
            <StatCard icon={ShieldAlert} label="Poids total" value={totalWeight > 0 ? `${totalWeight}kg` : "—"} color="bg-red-500" />
          </div>

          {/* Materiel list */}
          {materiel.length > 0 && (
            <div className="rounded-2xl bg-card border p-4">
              <p className="font-semibold text-sm mb-2 flex items-center gap-2"><Package className="h-4 w-4 text-amber-500" /> Matériel ({totalQty})</p>
              <div className="space-y-1">
                {materiel.map((m: any) => (
                  <p key={m.id} className="text-sm flex justify-between">
                    <span>{m.designation}</span>
                    <span className="text-muted-foreground">× {m.quantity}{m.weight ? ` (${m.weight}kg)` : ""}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Contraintes */}
          {contraintes && (
            <div className="rounded-2xl bg-card border p-4">
              <p className="font-semibold text-sm mb-2 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-500" /> Contraintes</p>
              <div className="text-sm space-y-1 text-muted-foreground">
                {(contraintes as any).door_width && <p>Portes: {(contraintes as any).door_width}</p>}
                {(contraintes as any).stairs && <p>Escaliers: {(contraintes as any).stairs}</p>}
                {(contraintes as any).freight_elevator && <p>✓ Monte-charge</p>}
                {(contraintes as any).obstacles && <p>Obstacles: {(contraintes as any).obstacles}</p>}
              </div>
            </div>
          )}

          {/* Issues */}
          {issues.length > 0 && (
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
              <p className="font-semibold text-sm mb-2 flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" /> Points manquants
              </p>
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {issues.length === 0 && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600">Visite complète — tous les éléments sont renseignés</p>
            </div>
          )}

          {/* Export */}
          <Button onClick={onExportPdf} disabled={exporting} className="w-full h-14 text-base rounded-2xl gap-2">
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Générer le rapport PDF
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
  <div className="rounded-xl bg-card border p-3 flex flex-col items-center gap-1">
    <div className={`${color} rounded-lg p-1.5 text-white`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
    <span className="text-lg font-bold">{value}</span>
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);
