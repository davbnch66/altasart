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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
          <AlertDialogDescription>
            Vous avez des modifications en cours. Que souhaitez-vous faire ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onStay} className="gap-2">
            <ArrowRight className="h-4 w-4 rotate-180" />
            Rester sur la page
          </AlertDialogCancel>
          <Button variant="destructive" onClick={onDiscard} className="gap-2">
            <X className="h-4 w-4" />
            Quitter sans enregistrer
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Enregistrement…" : "Enregistrer et quitter"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
