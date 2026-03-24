import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

import { AlertTriangle, Lightbulb, Camera, Truck, Users, Package, CheckCircle2 } from "lucide-react";

interface Props {
  visiteId: string;
  companyId: string;
}

interface Alert {
  type: "warning" | "suggestion" | "info";
  icon: React.ReactNode;
  title: string;
  details: string;
  tab?: string;
}

const HEAVY_THRESHOLD = 200; // kg — suggest crane/equipment
const VERY_HEAVY_THRESHOLD = 500; // kg — strongly suggest crane

export const VisiteSmartAlerts = ({ visiteId, companyId }: Props) => {
  const { data: pieces = [] } = useQuery({
    queryKey: ["visite-pieces", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_pieces").select("*").eq("visite_id", visiteId);
      if (error) throw error;
      return data;
    },
  });

  const { data: materiel = [] } = useQuery({
    queryKey: ["visite-materiel", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_materiel").select("*").eq("visite_id", visiteId);
      if (error) throw error;
      return data;
    },
  });

  const { data: affectations = [] } = useQuery({
    queryKey: ["visite-affectations", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_materiel_affectations").select("*").eq("company_id", companyId);
      if (error) throw error;
      return (data || []).filter((a: any) => materiel.some((m: any) => m.id === a.materiel_id));
    },
    enabled: materiel.length > 0,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["visite-photos", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_photos").select("*").eq("visite_id", visiteId);
      if (error) throw error;
      return data;
    },
  });

  const { data: rh = [] } = useQuery({
    queryKey: ["visite-rh", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visiteId);
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicules = [] } = useQuery({
    queryKey: ["visite-vehicules", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_vehicules").select("*").eq("visite_id", visiteId);
      if (error) throw error;
      return data;
    },
  });

  const { data: contraintes } = useQuery({
    queryKey: ["visite-contraintes", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_contraintes").select("*").eq("visite_id", visiteId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Build alerts
  const alerts: Alert[] = [];

  // 1. HEAVY MATERIEL → suggest equipment
  const heavyItems = materiel.filter((m: any) => m.weight && m.weight >= HEAVY_THRESHOLD);
  const veryHeavyItems = materiel.filter((m: any) => m.weight && m.weight >= VERY_HEAVY_THRESHOLD);
  const totalWeight = materiel.reduce((s: number, m: any) => s + (m.weight || 0) * (m.quantity || 1), 0);

  if (veryHeavyItems.length > 0) {
    const names = veryHeavyItems.map((m: any) => `${m.designation} (${m.weight}kg)`).join(", ");
    const hasHeavyEquipment = vehicules.some((v: any) => ["grue_mobile", "bras_de_grue", "palan", "chariot"].includes(v.type));
    if (!hasHeavyEquipment) {
      alerts.push({
        type: "suggestion",
        icon: <Truck className="h-4 w-4" />,
        title: "Engin de levage recommandé",
        details: `${names} — Poids > ${VERY_HEAVY_THRESHOLD}kg. Prévoyez une grue mobile, un bras de grue ou un palan.`,
        tab: "vehicules",
      });
    }
  } else if (heavyItems.length > 0) {
    const hasEquipment = vehicules.some((v: any) => ["chariot", "palan", "nacelle", "grue_mobile", "bras_de_grue"].includes(v.type));
    if (!hasEquipment) {
      alerts.push({
        type: "suggestion",
        icon: <Truck className="h-4 w-4" />,
        title: "Matériel lourd détecté",
        details: `${heavyItems.length} objet(s) > ${HEAVY_THRESHOLD}kg (total: ${totalWeight}kg). Envisagez un chariot ou palan.`,
        tab: "vehicules",
      });
    }
  }

  // 2. STAIRS + HEAVY → workforce alert
  const hasStairs = contraintes && (contraintes as any).stairs && (contraintes as any).stairs.trim() !== "";
  const noElevator = contraintes && !(contraintes as any).freight_elevator;

  if (hasStairs && noElevator && heavyItems.length > 0) {
    const totalRH = rh.reduce((s: number, r: any) => s + r.quantity, 0);
    const suggestedPeople = Math.max(4, Math.ceil(totalWeight / 100));
    if (totalRH < suggestedPeople) {
      alerts.push({
        type: "warning",
        icon: <Users className="h-4 w-4" />,
        title: "Main-d'œuvre insuffisante",
        details: `Escaliers + charge lourde (${totalWeight}kg) sans monte-charge. ${totalRH} personne(s) prévue(s), minimum recommandé : ${suggestedPeople}.`,
        tab: "rh",
      });
    } else {
      alerts.push({
        type: "info",
        icon: <Users className="h-4 w-4" />,
        title: "Escaliers + charge lourde",
        details: `Attention aux escaliers avec ${totalWeight}kg de matériel. ${totalRH} personne(s) prévue(s).`,
        tab: "rh",
      });
    }
  }

  // 3. UNASSIGNED MATERIAL
  if (materiel.length > 0 && pieces.length > 0) {
    const assignedQty = (mid: string) =>
      affectations.filter((a: any) => a.materiel_id === mid).reduce((s: number, a: any) => s + a.quantity, 0);
    const unassigned = materiel.filter((m: any) => assignedQty(m.id) < m.quantity);
    if (unassigned.length > 0) {
      alerts.push({
        type: "warning",
        icon: <Package className="h-4 w-4" />,
        title: `${unassigned.length} matériel(s) non affecté(s)`,
        details: unassigned.map((m: any) => `${m.designation} (${assignedQty(m.id)}/${m.quantity})`).join(", "),
        tab: "affectation",
      });
    }
  }

  // 4. PIECES WITHOUT PHOTOS
  if (pieces.length > 0) {
    const piecesWithoutPhoto = pieces.filter(
      (p: any) => !photos.some((ph: any) => ph.piece_id === p.id)
    );
    if (piecesWithoutPhoto.length > 0) {
      alerts.push({
        type: "info",
        icon: <Camera className="h-4 w-4" />,
        title: `${piecesWithoutPhoto.length} pièce(s) sans photo`,
        details: piecesWithoutPhoto.map((p: any) => p.name).join(", "),
        tab: "pieces",
      });
    }
  }

  // 5. NO RH defined but materiel exists
  if (materiel.length > 0 && rh.length === 0) {
    alerts.push({
      type: "suggestion",
      icon: <Users className="h-4 w-4" />,
      title: "Aucune ressource humaine définie",
      details: `${materiel.length} matériel(s) listés mais aucun personnel prévu. Ajoutez les besoins en main-d'œuvre.`,
      tab: "rh",
    });
  }

  // 6. NO VEHICLE but materiel exists
  if (materiel.length > 0 && vehicules.length === 0) {
    alerts.push({
      type: "suggestion",
      icon: <Truck className="h-4 w-4" />,
      title: "Aucun véhicule/engin défini",
      details: "Matériel listé mais aucun moyen de transport prévu.",
      tab: "vehicules",
    });
  }

  if (alerts.length === 0) {
    return (
      <Card className="p-3 border-success/30 bg-success/5">
        <div className="flex items-center gap-2 text-success text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Tout est en ordre — aucune alerte
        </div>
      </Card>
    );
  }

  const typeStyles = {
    warning: "border-destructive/30 bg-destructive/5",
    suggestion: "border-warning/30 bg-warning/5",
    info: "border-info/30 bg-info/5",
  };

  const typeIconColors = {
    warning: "text-destructive",
    suggestion: "text-warning",
    info: "text-info",
  };

  const typeBadge = {
    warning: "destructive" as const,
    suggestion: "outline" as const,
    info: "secondary" as const,
  };

  const typeLabel = {
    warning: "Alerte",
    suggestion: "Suggestion",
    info: "Info",
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <Card key={i} className={`p-3 ${typeStyles[alert.type]}`}>
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 ${typeIconColors[alert.type]}`}>{alert.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                  alert.type === "warning" ? "border border-transparent bg-destructive text-destructive-foreground" :
                  alert.type === "suggestion" ? "border text-foreground" :
                  "border border-transparent bg-secondary text-secondary-foreground"
                }`}>
                  {typeLabel[alert.type]}
                </span>
                <span className="text-sm font-semibold">{alert.title}</span>
                {alert.tab && (
                  <span className="text-[10px] text-muted-foreground">→ onglet {alert.tab}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{alert.details}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
