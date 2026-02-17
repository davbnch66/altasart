import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";

const LEVELS = 3;

const statusColors: Record<string, string> = {
  libre: "bg-emerald-400/20 border-emerald-400/40 hover:bg-emerald-400/30",
  occupe: "bg-blue-400/80 border-blue-400 hover:bg-blue-400/90",
  reserve: "bg-yellow-400/60 border-yellow-400 hover:bg-yellow-400/70",
};

const statusDots: Record<string, string> = {
  libre: "bg-emerald-400",
  occupe: "bg-blue-400",
  reserve: "bg-yellow-400",
};

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

interface Storage2DViewerProps {
  units: StorageUnit[];
  selectedId: string | null;
  onSelectUnit: (unit: StorageUnit | null) => void;
}

export const Storage2DViewer = ({ units, selectedId, onSelectUnit }: Storage2DViewerProps) => {
  const [currentLevel, setCurrentLevel] = useState(1);

  // Derive aisles and rows dynamically from existing units
  const { aisles, rows } = useMemo(() => {
    const aisleSet = new Set<string>();
    const rowSet = new Set<string>();
    units.forEach((u) => {
      const match = u.name.match(/^([A-Z])(\d+)-N(\d+)$/);
      if (match) {
        aisleSet.add(match[1]);
        rowSet.add(match[2]);
      }
    });
    return {
      aisles: [...aisleSet].sort(),
      rows: [...rowSet].sort((a, b) => Number(a) - Number(b)),
    };
  }, [units]);

  const unitLookup = useMemo(() => {
    const lookup: Record<string, StorageUnit> = {};
    units.forEach((u) => { lookup[u.name] = u; });
    return lookup;
  }, [units]);

  const grid = useMemo(() => {
    const cells: { name: string; row: string; aisle: string; unit: StorageUnit | null }[] = [];
    for (const aisle of aisles) {
      for (const row of rows) {
        const name = `${aisle}${row}-N${currentLevel}`;
        const unit = unitLookup[name] || null;
        // Only show if this unit exists in DB
        if (unit) {
          cells.push({ name, row, aisle, unit });
        }
      }
    }
    return cells;
  }, [unitLookup, currentLevel, aisles, rows]);

  const levelStats = useMemo(() => {
    const levelUnits = units.filter((u) => u.name.endsWith(`-N${currentLevel}`));
    const occupe = levelUnits.filter((u) => u.status === "occupe").length;
    const reserve = levelUnits.filter((u) => u.status === "reserve").length;
    const libre = levelUnits.filter((u) => u.status === "libre").length;
    return { total: levelUnits.length, occupe, reserve, libre };
  }, [units, currentLevel]);

  if (units.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <p className="text-sm">Aucun box configuré. Utilisez "Gérer en masse" ou "Ajouter un box" pour créer des emplacements.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden relative">
      {/* Header with level navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Plan 2D — Niveau {currentLevel}</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentLevel <= 1}
              onClick={() => setCurrentLevel((l) => l - 1)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <div className="flex gap-0.5">
              {Array.from({ length: LEVELS }, (_, i) => i + 1).map((lvl) => (
                <Button
                  key={lvl}
                  variant={currentLevel === lvl ? "default" : "outline"}
                  size="sm"
                  className="h-7 w-7 text-xs p-0"
                  onClick={() => setCurrentLevel(lvl)}
                >
                  N{lvl}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentLevel >= LEVELS}
              onClick={() => setCurrentLevel((l) => l + 1)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>{levelStats.occupe} occupé{levelStats.occupe > 1 ? "s" : ""}</span>
          <span>{levelStats.reserve} réservé{levelStats.reserve > 1 ? "s" : ""}</span>
          <span>{levelStats.libre} libre{levelStats.libre > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Row labels */}
          <div className="flex gap-1 mb-1 pl-10">
            {rows.map((r) => (
              <div key={r} className="flex-1 text-center text-[10px] text-muted-foreground font-medium">
                Rang {r}
              </div>
            ))}
          </div>

          {/* Aisles */}
          <div className="flex flex-col gap-1">
            {aisles.map((aisle) => (
              <div key={aisle} className="flex items-center gap-1">
                <div className="w-9 text-right text-[10px] text-muted-foreground font-mono shrink-0">
                  {aisle}
                </div>
                {rows.map((row) => {
                  const name = `${aisle}${row}-N${currentLevel}`;
                  const unit = unitLookup[name];
                  if (!unit) {
                    // Empty slot — position exists for other levels but not this one
                    return <div key={name} className="flex-1 h-8" />;
                  }
                  const status = unit.status || "libre";
                  const isSelected = selectedId === unit.id;

                  return (
                    <button
                      key={name}
                      className={`flex-1 h-8 rounded border text-[9px] font-mono transition-all relative
                        ${isSelected ? "ring-2 ring-orange-500 bg-orange-500/20 border-orange-500" : statusColors[status] || "bg-muted border-border"}
                      `}
                      onClick={() => onSelectUnit(unit)}
                      title={`${name} — ${status}${unit.clients ? ` — ${(unit.clients as any).name}` : ""}`}
                    >
                      <span className="opacity-70">{name}</span>
                      {unit.clients && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-card" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/20 text-[11px]">
        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-sm ${statusDots.libre} opacity-40`} /><span>Libre</span></div>
        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-sm ${statusDots.occupe}`} /><span>Occupé</span></div>
        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-sm ${statusDots.reserve}`} /><span>Réservé</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-500/40 border border-orange-500" /><span>Sélectionné</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span>Client assigné</span></div>
      </div>
    </div>
  );
};
