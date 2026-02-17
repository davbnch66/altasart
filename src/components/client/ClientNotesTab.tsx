import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { StickyNote, Phone, Calendar, Trash2, Send } from "lucide-react";

interface Props {
  clientId: string;
  companyId: string;
  dossiers?: { id: string; title: string; code: string | null }[];
}

const typeIcons: Record<string, React.ElementType> = {
  note: StickyNote,
  appel: Phone,
  rdv: Calendar,
};
const typeLabels: Record<string, string> = {
  note: "Note",
  appel: "Appel",
  rdv: "Rendez-vous",
};

export const ClientNotesTab = ({ clientId, companyId, dossiers = [] }: Props) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [dossierId, setDossierId] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["client-notes", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_notes")
        .select("*, profiles:author_id(full_name, email), dossiers:dossier_id(code, title)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!content.trim() || !user) return;
      const { error } = await supabase.from("client_notes").insert({
        client_id: clientId,
        company_id: companyId,
        author_id: user.id,
        content: content.trim(),
        note_type: noteType,
        dossier_id: dossierId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note ajoutée");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["client-notes", clientId] });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note supprimée");
      queryClient.invalidateQueries({ queryKey: ["client-notes", clientId] });
    },
  });

  const formatDT = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {/* Input form */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"} space-y-3`}>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(typeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setNoteType(key)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                noteType === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {(() => { const Icon = typeIcons[key]; return <Icon className="h-3 w-3" />; })()}
              {label}
            </button>
          ))}
        </div>
        {dossiers.length > 0 && (
          <select
            value={dossierId}
            onChange={(e) => setDossierId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Général (aucun dossier)</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>{d.code || d.title}</option>
            ))}
          </select>
        )}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Écrire une note, compte rendu d'appel..."
          rows={3}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!content.trim() || createMutation.isPending}>
            <Send className="h-3.5 w-3.5 mr-1" />
            {createMutation.isPending ? "Envoi..." : "Ajouter"}
          </Button>
        </div>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Aucune note pour ce client</div>
      ) : (
        <div className="space-y-2">
          {notes.map((note: any) => {
            const Icon = typeIcons[note.note_type] || StickyNote;
            const author = note.profiles as any;
            const dossier = note.dossiers as any;
            return (
              <div key={note.id} className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-xs truncate">{author?.full_name || author?.email || "—"}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDT(note.created_at)}</span>
                      </div>
                      <button onClick={() => deleteMutation.mutate(note.id)} className="p-1 rounded hover:bg-muted shrink-0">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                    {dossier && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium mt-1">
                        📂 {dossier.code || dossier.title}
                      </span>
                    )}
                    <p className="text-sm whitespace-pre-wrap mt-1">{note.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
