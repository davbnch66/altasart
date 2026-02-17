import { X, User, Calendar, Package, MapPin, Euro, FileText, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const statusLabels: Record<string, string> = {
  libre: "Libre",
  occupe: "Occupé",
  reserve: "Réservé",
};

const statusStyles: Record<string, string> = {
  libre: "bg-success/10 text-success",
  occupe: "bg-info/10 text-info",
  reserve: "bg-warning/10 text-warning",
};

const fmt = (n: number | null | undefined) =>
  n ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) : "—";

interface StorageUnit {
  id: string;
  name: string;
  status: string;
  location?: string;
  client_id?: string;
  clients?: { name: string } | null;
  monthly_rate?: number;
  start_date?: string;
  end_date?: string;
  size_m2?: number;
  volume_m3?: number;
  notes?: string;
}

interface StorageDetailPanelProps {
  unit: StorageUnit;
  onClose: () => void;
  onEdit: (unit: StorageUnit) => void;
  onDelete?: (unit: StorageUnit) => void;
  onDeleteRow?: (row: string) => void;
  onDeleteAisle?: (aisle: string) => void;
}

export const StorageDetailPanel = ({ unit, onClose, onEdit, onDelete, onDeleteRow, onDeleteAisle }: StorageDetailPanelProps) => {
  const clientName = (unit.clients as any)?.name;
  const hasDbRecord = !!unit.id;

  // Parse name pattern like "A1-N1" to extract aisle and row
  const nameParts = unit.name.match(/^([A-Z])(\d+)-N(\d+)$/);
  const aisleLetter = nameParts?.[1];
  const rowNumber = nameParts?.[2];
  const levelNumber = nameParts?.[3];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4 animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">{unit.name}</h3>
          </div>
          <Badge variant="outline" className={`mt-1 text-[10px] ${statusStyles[unit.status] || ""}`}>
            {statusLabels[unit.status] || unit.status}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Info grid */}
      <div className="grid gap-2.5 text-sm">
        {/* Always show position info */}
        {aisleLetter && rowNumber && levelNumber && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">Allée <strong className="text-foreground">{aisleLetter}</strong></span>
            <span className="text-muted-foreground">Rangée <strong className="text-foreground">{rowNumber}</strong></span>
            <span className="text-muted-foreground">Niveau <strong className="text-foreground">N{levelNumber}</strong></span>
          </div>
        )}

        {clientName && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{clientName}</span>
          </div>
        )}

        {unit.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{unit.location}</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {unit.size_m2 ? <span>{unit.size_m2} m²</span> : null}
          {unit.volume_m3 ? <span>{unit.volume_m3} m³</span> : null}
          {!unit.size_m2 && !unit.volume_m3 && <span>8 m³ (standard)</span>}
        </div>

        {unit.monthly_rate ? (
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{fmt(unit.monthly_rate)}/mois</span>
          </div>
        ) : null}

        {(unit.start_date || unit.end_date) && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              {unit.start_date && <span>Début: {format(new Date(unit.start_date), "dd/MM/yyyy")}</span>}
              {unit.end_date && <span>Fin: {format(new Date(unit.end_date), "dd/MM/yyyy")}</span>}
            </div>
          </div>
        )}

        {unit.notes && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">{unit.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {hasDbRecord ? (
          <>
            <Button size="sm" className="w-full" onClick={() => onEdit(unit)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Modifier ce box
            </Button>
            {onDelete && (
              <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => onDelete(unit)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Supprimer ce box
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Ce box n'est pas encore configuré en base.
          </p>
        )}

        {aisleLetter && onDeleteAisle && (
          <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive text-xs" onClick={() => onDeleteAisle(aisleLetter)}>
            Supprimer toute l'allée {aisleLetter}
          </Button>
        )}

        {aisleLetter && rowNumber && onDeleteRow && (
          <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive text-xs" onClick={() => onDeleteRow(`${aisleLetter}${rowNumber}`)}>
            Supprimer la rangée {aisleLetter}{rowNumber} (tous niveaux)
          </Button>
        )}
      </div>
    </div>
  );
};
