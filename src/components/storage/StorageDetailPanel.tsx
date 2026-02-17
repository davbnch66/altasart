import { X, User, Calendar, Package, MapPin, Euro, FileText, Trash2, Pencil, ArrowRightLeft, Clock, AlertTriangle, Receipt, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, differenceInMonths } from "date-fns";

const statusLabels: Record<string, string> = {
  libre: "Libre",
  occupe: "Occupé",
  reserve: "Réservé",
  impaye: "Impayé",
};

const statusStyles: Record<string, string> = {
  libre: "bg-success/10 text-success",
  occupe: "bg-info/10 text-info",
  reserve: "bg-warning/10 text-warning",
  impaye: "bg-destructive/10 text-destructive",
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
  onTransfer?: (unit: StorageUnit) => void;
}

const getDurationBadge = (startDate?: string) => {
  if (!startDate) return null;
  const months = differenceInMonths(new Date(), new Date(startDate));
  if (months < 1) return { label: "< 1 mois", color: "bg-blue-100 text-blue-700" };
  if (months < 6) return { label: `${months} mois`, color: "bg-blue-100 text-blue-700" };
  if (months < 12) return { label: `${months} mois`, color: "bg-amber-100 text-amber-700" };
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return { label: `${years} an${years > 1 ? "s" : ""}${rem > 0 ? ` ${rem}m` : ""}`, color: "bg-purple-100 text-purple-700" };
};

const getExpiryAlert = (endDate?: string) => {
  if (!endDate) return null;
  const days = differenceInDays(new Date(endDate), new Date());
  if (days < 0) return { label: "Expiré", color: "text-destructive", urgent: true };
  if (days <= 7) return { label: `Expire dans ${days}j`, color: "text-destructive", urgent: true };
  if (days <= 30) return { label: `Expire dans ${days}j`, color: "text-warning", urgent: false };
  return null;
};

export const StorageDetailPanel = ({ unit, onClose, onEdit, onDelete, onDeleteRow, onDeleteAisle, onTransfer }: StorageDetailPanelProps) => {
  const clientName = (unit.clients as any)?.name;
  const hasDbRecord = !!unit.id;
  const nameParts = unit.name.match(/^([A-Z])(\d+)-N(\d+)$/);
  const aisleLetter = nameParts?.[1];
  const rowNumber = nameParts?.[2];
  const levelNumber = nameParts?.[3];

  const duration = (unit.status === "occupe" || unit.status === "impaye") ? getDurationBadge(unit.start_date) : null;
  const expiryAlert = getExpiryAlert(unit.end_date);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4 animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">{unit.name}</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className={`text-[10px] ${statusStyles[unit.status] || ""}`}>
              {statusLabels[unit.status] || unit.status}
            </Badge>
            {duration && (
              <Badge variant="outline" className={`text-[10px] ${duration.color}`}>
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                {duration.label}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Expiry alert */}
      {expiryAlert && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${expiryAlert.urgent ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-warning/10 border-warning/30 text-warning"}`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {expiryAlert.label}
        </div>
      )}

      {/* Info grid */}
      <div className="grid gap-2.5 text-sm">
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

            {/* Transfer - only for occupied/reserved/impaye */}
            {(unit.status === "occupe" || unit.status === "reserve" || unit.status === "impaye") && onTransfer && (
              <Button size="sm" variant="outline" className="w-full" onClick={() => onTransfer(unit)}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                Transférer vers un autre box
              </Button>
            )}

            {/* Quick actions */}
            {unit.status === "impaye" && (
              <Button size="sm" variant="outline" className="w-full text-warning hover:text-warning text-xs">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Envoyer une relance
              </Button>
            )}

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
          <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive text-xs" onClick={() => onDeleteAisle(aisleLetter)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Supprimer toute l'allée {aisleLetter}
          </Button>
        )}

        {aisleLetter && rowNumber && onDeleteRow && (
          <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive text-xs" onClick={() => onDeleteRow(`${aisleLetter}${rowNumber}`)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Supprimer la rangée {aisleLetter}{rowNumber} (tous niveaux)
          </Button>
        )}
      </div>
    </div>
  );
};
