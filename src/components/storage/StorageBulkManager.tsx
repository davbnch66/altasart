import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";

const AISLES = Array.from({ length: 20 }, (_, i) => String.fromCharCode(65 + i));
const ROWS = ["1", "2", "3", "4", "5"];
const LEVELS = ["1", "2", "3"];

interface StorageBulkManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: any[];
  onBulkAdd: (names: string[]) => void;
  onBulkDelete: (patterns: string[]) => void;
  isAdding?: boolean;
  isDeleting?: boolean;
}

export const StorageBulkManager = ({
  open, onOpenChange, units, onBulkAdd, onBulkDelete, isAdding, isDeleting,
}: StorageBulkManagerProps) => {
  const [selectedAisles, setSelectedAisles] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<string>("add");

  const existingNames = useMemo(() => new Set(units.map((u: any) => u.name)), [units]);

  const toggleAisle = (a: string) => {
    setSelectedAisles((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a); else next.add(a);
      return next;
    });
  };

  const toggleRow = (r: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  };

  // Compute what will be added
  const namesToAdd = useMemo(() => {
    const names: string[] = [];
    const aisles = selectedAisles.size > 0 ? [...selectedAisles] : AISLES;
    const rows = selectedRows.size > 0 ? [...selectedRows] : ROWS;
    for (const a of aisles) {
      for (const r of rows) {
        for (const l of LEVELS) {
          const name = `${a}${r}-N${l}`;
          if (!existingNames.has(name)) names.push(name);
        }
      }
    }
    return names;
  }, [selectedAisles, selectedRows, existingNames]);

  // Count what will be deleted
  const countToDelete = useMemo(() => {
    if (selectedAisles.size === 0 && selectedRows.size === 0) return 0;
    return units.filter((u: any) => {
      const match = u.name.match(/^([A-Z])(\d+)-N(\d+)$/);
      if (!match) return false;
      const [, a, r] = match;
      const aisleMatch = selectedAisles.size === 0 || selectedAisles.has(a);
      const rowMatch = selectedRows.size === 0 || selectedRows.has(r);
      return aisleMatch && rowMatch;
    }).length;
  }, [selectedAisles, selectedRows, units]);

  const deletePatterns = useMemo(() => {
    const patterns: string[] = [];
    if (selectedAisles.size > 0 && selectedRows.size > 0) {
      // Specific intersections
      for (const a of selectedAisles) {
        for (const r of selectedRows) {
          patterns.push(`${a}${r}-N%`);
        }
      }
    } else if (selectedAisles.size > 0) {
      for (const a of selectedAisles) {
        patterns.push(`${a}%-N%`);
      }
    } else if (selectedRows.size > 0) {
      for (const r of selectedRows) {
        // All aisles for this row
        for (const a of AISLES) {
          patterns.push(`${a}${r}-N%`);
        }
      }
    }
    return patterns;
  }, [selectedAisles, selectedRows]);

  const handleAdd = () => {
    if (namesToAdd.length === 0) return;
    onBulkAdd(namesToAdd);
  };

  const handleDelete = () => {
    setConfirmDelete(true);
  };

  const executeDelete = () => {
    onBulkDelete(deletePatterns);
    // Dialog will close via isDeleting becoming false after mutation completes
  };

  const reset = () => {
    setSelectedAisles(new Set());
    setSelectedRows(new Set());
  };

  // Count existing per aisle/row
  const aisleCount = useMemo(() => {
    const counts: Record<string, number> = {};
    units.forEach((u: any) => {
      const m = u.name.match(/^([A-Z])/);
      if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
    });
    return counts;
  }, [units]);

  const rowCount = useMemo(() => {
    const counts: Record<string, number> = {};
    units.forEach((u: any) => {
      const m = u.name.match(/^[A-Z](\d+)/);
      if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
    });
    return counts;
  }, [units]);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion en masse</DialogTitle>
            <DialogDescription>Ajoutez ou supprimez des boxes par allée et rangée.</DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="add" className="flex-1 gap-1"><Plus className="h-3.5 w-3.5" />Ajouter</TabsTrigger>
              <TabsTrigger value="delete" className="flex-1 gap-1"><Trash2 className="h-3.5 w-3.5" />Supprimer</TabsTrigger>
            </TabsList>

            <div className="space-y-4 mt-4">
              {/* Aisle selection */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Allées (sélectionnez une ou plusieurs)</p>
                <div className="flex flex-wrap gap-1.5">
                  {AISLES.map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleAisle(a)}
                      className={`h-8 w-10 rounded-md border text-xs font-medium transition-colors ${
                        selectedAisles.has(a)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted border-border"
                      }`}
                    >
                      <div>{a}</div>
                      {tab === "delete" && aisleCount[a] && (
                        <div className="text-[9px] opacity-70">{aisleCount[a]}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row selection */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Rangées (sélectionnez une ou plusieurs)</p>
                <div className="flex flex-wrap gap-1.5">
                  {ROWS.map((r) => (
                    <button
                      key={r}
                      onClick={() => toggleRow(r)}
                      className={`h-8 w-12 rounded-md border text-xs font-medium transition-colors ${
                        selectedRows.has(r)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted border-border"
                      }`}
                    >
                      <div>R{r}</div>
                      {tab === "delete" && rowCount[r] && (
                        <div className="text-[9px] opacity-70">{rowCount[r]}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick select all */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedAisles(new Set(AISLES))}>
                  Toutes les allées
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedRows(new Set(ROWS))}>
                  Toutes les rangées
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={reset}>
                  Réinitialiser
                </Button>
              </div>

              <TabsContent value="add" className="mt-0 space-y-3">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm">
                    <strong>{namesToAdd.length}</strong> box{namesToAdd.length > 1 ? "es" : ""} {namesToAdd.length > 1 ? "seront créés" : "sera créé"}
                    {selectedAisles.size === 0 && selectedRows.size === 0 && " (toutes allées × toutes rangées × 3 niveaux)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedAisles.size > 0 && `Allées: ${[...selectedAisles].sort().join(", ")} `}
                    {selectedRows.size > 0 && `Rangées: ${[...selectedRows].sort().join(", ")} `}
                    — 3 niveaux chacun
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleAdd}
                  disabled={namesToAdd.length === 0 || isAdding}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {isAdding ? "Création en cours..." : `Créer ${namesToAdd.length} box${namesToAdd.length > 1 ? "es" : ""}`}
                </Button>
              </TabsContent>

              <TabsContent value="delete" className="mt-0 space-y-3">
                {(selectedAisles.size === 0 && selectedRows.size === 0) ? (
                  <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                    Sélectionnez au moins une allée ou une rangée à supprimer.
                  </div>
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="text-sm font-medium">
                        <strong>{countToDelete}</strong> box{countToDelete > 1 ? "es seront supprimés" : " sera supprimé"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedAisles.size > 0 && `Allées: ${[...selectedAisles].sort().join(", ")} `}
                      {selectedRows.size > 0 && `Rangées: ${[...selectedRows].sort().join(", ")} `}
                      — tous niveaux
                    </p>
                  </div>
                )}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={countToDelete === 0 || isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  {isDeleting ? "Suppression..." : `Supprimer ${countToDelete} box${countToDelete > 1 ? "es" : ""}`}
                </Button>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={executeDelete}
        title="Confirmer la suppression en masse"
        description={`${countToDelete} box${countToDelete > 1 ? "es seront définitivement supprimés" : " sera définitivement supprimé"}. Cette action est irréversible.`}
        isPending={isDeleting || false}
      />
    </>
  );
};
