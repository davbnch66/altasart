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
import { Save, X, ArrowRight } from "lucide-react";

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
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
          <AlertDialogDescription>
            Vous avez des modifications en cours. Que souhaitez-vous faire ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <AlertDialogCancel onClick={onStay} className="gap-2 w-full sm:w-auto">
            <ArrowRight className="h-4 w-4 rotate-180" />
            Rester
          </AlertDialogCancel>
          <Button variant="destructive" onClick={onDiscard} className="gap-2 w-full sm:w-auto">
            <X className="h-4 w-4" />
            Quitter
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-2 w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {saving ? "Enregistrement…" : "Enregistrer & quitter"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
