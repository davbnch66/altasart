import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PpspsPreviewDialog } from "./PpspsPreviewDialog";

interface Props {
  devis: any;
  isMobile?: boolean;
}

export const GeneratePpspsButton = ({ devis, isMobile }: Props) => {
  const [loading, setLoading] = useState(false);
  const [ppspsContent, setPpspsContent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingPpsps, setExistingPpsps] = useState<any>(null);

  const loadExisting = async () => {
    const { data } = await supabase
      .from("ppsps")
      .select("*")
      .eq("devis_id", devis.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setExistingPpsps(data);
      setPpspsContent(data.content);
      setDialogOpen(true);
      return true;
    }
    return false;
  };

  const handleClick = async () => {
    // First check if a PPSPS already exists
    const exists = await loadExisting();
    if (exists) return;

    // Generate new
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ppsps", {
        body: { devis_id: devis.id },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.content) {
        setPpspsContent(data.content);
        setDialogOpen(true);

        // Save to DB
        const { data: { user } } = await supabase.auth.getUser();
        const { data: saved, error: saveErr } = await supabase
          .from("ppsps")
          .insert({
            devis_id: devis.id,
            dossier_id: devis.dossier_id,
            company_id: devis.company_id,
            content: data.content,
            created_by: user?.id,
          })
          .select()
          .single();
        if (saveErr) console.error("Save error:", saveErr);
        else setExistingPpsps(saved);

        toast.success("PPSPS généré avec succès");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur de génération");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ppsps", {
        body: { devis_id: devis.id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.content) {
        setPpspsContent(data.content);
        // Update existing or insert new version
        if (existingPpsps) {
          await supabase.from("ppsps").update({
            content: data.content,
            version: (existingPpsps.version || 1) + 1,
            generated_at: new Date().toISOString(),
          }).eq("id", existingPpsps.id);
          setExistingPpsps({ ...existingPpsps, content: data.content, version: (existingPpsps.version || 1) + 1 });
        }
        toast.success("PPSPS regénéré");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size={isMobile ? "icon" : "sm"}
        onClick={handleClick}
        disabled={loading}
        title="PPSPS"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {!isMobile && <span className="ml-1">PPSPS</span>}
      </Button>

      <PpspsPreviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        content={ppspsContent}
        onContentChange={async (updated) => {
          setPpspsContent(updated);
          if (existingPpsps) {
            await supabase.from("ppsps").update({ content: updated }).eq("id", existingPpsps.id);
          }
        }}
        devis={devis}
        onRegenerate={handleRegenerate}
        regenerating={loading}
        version={existingPpsps?.version || 1}
      />
    </>
  );
};
