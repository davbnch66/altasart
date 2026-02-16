import { Badge } from "@/components/ui/badge";
import { Bot, Building2, User, Phone, MapPin, Calendar, AlertTriangle, Package } from "lucide-react";

interface AiAnalysis {
  societe?: string;
  contact?: string;
  email?: string;
  telephone?: string;
  adresse_chantier?: string;
  type_demande?: string[];
  materiel?: { designation: string; quantity?: number; dimensions?: string; weight?: number }[];
  date_souhaitee?: string;
  urgence?: boolean;
  resume?: string;
}

export const InboxAiSummary = ({ analysis }: { analysis: AiAnalysis | null }) => {
  if (!analysis) return null;

  const typeLabels: Record<string, string> = {
    devis: "Demande de devis",
    visite: "Demande de visite",
    information: "Demande d'information",
    relance: "Relance",
    confirmation: "Confirmation",
    autre: "Autre",
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Bot className="h-4 w-4 text-primary" />
        Analyse IA
      </div>

      {analysis.resume && (
        <p className="text-sm text-muted-foreground">{analysis.resume}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {analysis.type_demande?.map((t) => (
          <Badge key={t} variant="secondary" className="text-xs">
            {typeLabels[t] || t}
          </Badge>
        ))}
        {analysis.urgence && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" /> Urgent
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {analysis.societe && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{analysis.societe}</span>
          </div>
        )}
        {analysis.contact && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{analysis.contact}</span>
          </div>
        )}
        {analysis.telephone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{analysis.telephone}</span>
          </div>
        )}
        {analysis.adresse_chantier && (
          <div className="flex items-center gap-1.5 col-span-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{analysis.adresse_chantier}</span>
          </div>
        )}
        {analysis.date_souhaitee && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{analysis.date_souhaitee}</span>
          </div>
        )}
      </div>

      {analysis.materiel && analysis.materiel.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            Matériel détecté ({analysis.materiel.length})
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {analysis.materiel.slice(0, 5).map((m, i) => (
              <p key={i}>• {m.designation}{m.quantity && m.quantity > 1 ? ` (×${m.quantity})` : ""}</p>
            ))}
            {analysis.materiel.length > 5 && <p className="italic">+{analysis.materiel.length - 5} autres</p>}
          </div>
        </div>
      )}
    </div>
  );
};
