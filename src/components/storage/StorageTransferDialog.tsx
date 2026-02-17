import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface StorageUnit {
  id: string;
  name: string;
  status: string;
  client_id?: string;
  clients?: { name: string } | null;
  monthly_rate?: number;
  start_date?: string;
  end_date?: string;
}

interface StorageTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceUnit: StorageUnit;
  availableUnits: StorageUnit[];
  onTransfer: (sourceId: string, targetId: string) => void;
  isPending?: boolean;
}

export const StorageTransferDialog = ({
  open,
  onOpenChange,
  sourceUnit,
  availableUnits,
  onTransfer,
  isPending,
}: StorageTransferDialogProps) => {
  const [targetId, setTargetId] = useState<string>("");

  const freeUnits = useMemo(
    () => availableUnits.filter((u) => u.status === "libre" && u.id !== sourceUnit.id),
    [availableUnits, sourceUnit.id]
  );

  const handleTransfer = () => {
    if (!targetId) return;
    onTransfer(sourceUnit.id, targetId);
    setTargetId("");
  };

  const clientName = (sourceUnit.clients as any)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transférer le contenu du box</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Depuis</p>
              <p className="font-bold text-lg">{sourceUnit.name}</p>
              {clientName && <p className="text-xs text-muted-foreground">{clientName}</p>}
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <Label className="text-xs">Vers (box libre)</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Choisir un box libre" />
                </SelectTrigger>
                <SelectContent>
                  {freeUnits.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">Aucun box libre</div>
                  ) : (
                    freeUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Le client, les dates et le tarif seront transférés vers le nouveau box. L'ancien box sera remis en "Libre".
          </p>

          <Button
            onClick={handleTransfer}
            disabled={!targetId || isPending}
            className="w-full"
          >
            {isPending ? "Transfert en cours..." : "Confirmer le transfert"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
