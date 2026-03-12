import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Save, X, ArrowLeft } from "lucide-react";

interface UnsavedChangesDialogProps {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
  saving?: boolean;
}

export function UnsavedChangesDialog({ open, onStay, onDiscard, onSave, saving }: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm p-4 sm:p-6">
        <AlertDialogHeader className="space-y-1.5">
          <AlertDialogTitle className="text-base">Modifications non enregistrées</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Vous avez des modifications en cours.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 mt-4 sm:flex-row sm:justify-end">
          <AlertDialogCancel onClick={onStay} className="gap-1.5 text-xs h-9 w-full sm:w-auto">
            <ArrowLeft className="h-3.5 w-3.5" />
            Rester
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" size="sm" onClick={onDiscard} className="gap-1.5 text-xs h-9 w-full sm:w-auto">
              <X className="h-3.5 w-3.5" />
              Quitter
            </Button>
          </AlertDialogAction>
          <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5 text-xs h-9 w-full sm:w-auto">
            <Save className="h-3.5 w-3.5" />
            {saving ? "…" : "Enregistrer"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
