import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  notes: string;
  instructions: string;
  comment: string;
  onSave: (data: { notes: string; instructions: string; comment: string }) => void;
  saving: boolean;
}

export const MobileNotesSheet = ({ open, onClose, notes, instructions, comment, onSave, saving }: Props) => {
  const [localNotes, setLocalNotes] = useState(notes);
  const [localInstructions, setLocalInstructions] = useState(instructions);
  const [localComment, setLocalComment] = useState(comment);

  useEffect(() => {
    if (open) {
      setLocalNotes(notes);
      setLocalInstructions(instructions);
      setLocalComment(comment);
    }
  }, [open, notes, instructions, comment]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">📝 Notes & Instructions</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-2">
          <div>
            <p className="text-sm font-medium mb-1">Mémo devis</p>
            <Textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              rows={4}
              placeholder="Description pour le devis..."
              className="text-base rounded-xl"
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Instructions opérationnelles</p>
            <Textarea
              value={localInstructions}
              onChange={(e) => setLocalInstructions(e.target.value)}
              rows={4}
              placeholder="Instructions pour l'équipe..."
              className="text-base rounded-xl"
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Commentaire</p>
            <Textarea
              value={localComment}
              onChange={(e) => setLocalComment(e.target.value)}
              rows={3}
              placeholder="Observations..."
              className="text-base rounded-xl"
            />
          </div>

          <Button
            onClick={() => {
              onSave({ notes: localNotes, instructions: localInstructions, comment: localComment });
              onClose();
            }}
            disabled={saving}
            className="w-full h-14 text-base rounded-2xl gap-2"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
