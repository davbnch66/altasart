import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PpspsPreviewDialog } from "./PpspsPreviewDialog";
import { CustomSection, PpspsImage, PpspsAttachment } from "./PpspsEditor";

interface Props {
  devis: any;
  isMobile?: boolean;
}

export const GeneratePpspsButton = ({ devis, isMobile }: Props) => {
  const [loading, setLoading] = useState(false);
  const [ppspsContent, setPpspsContent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingPpsps, setExistingPpsps] = useState<any>(null);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [images, setImages] = useState<PpspsImage[]>([]);
  const [attachments, setAttachments] = useState<PpspsAttachment[]>([]);

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
      setCustomSections((data as any).custom_sections || []);
      setImages((data as any).images || []);
      setAttachments((data as any).attachments || []);
      setDialogOpen(true);
      return true;
    }
    return false;
  };

  const handleClick = async () => {
    const exists = await loadExisting();
    if (exists) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ppsps", {
        body: { devis_id: devis.id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.content) {
        setPpspsContent(data.content);
        setCustomSections([]);
        setImages([]);
        setAttachments([]);
        setDialogOpen(true);

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

  const handleContentChange = async (updated: any) => {
    setPpspsContent(updated);
    if (existingPpsps) {
      const { error } = await supabase.from("ppsps").update({ content: updated, updated_at: new Date().toISOString() }).eq("id", existingPpsps.id);
      if (error) {
        console.error("Save error:", error);
        throw error;
      }
      setExistingPpsps({ ...existingPpsps, content: updated });
    }
  };

  const handleCustomSectionsChange = async (sections: CustomSection[]) => {
    setCustomSections(sections);
    if (existingPpsps) {
      await supabase.from("ppsps").update({ custom_sections: sections as any }).eq("id", existingPpsps.id);
    }
  };

  const handleImagesChange = async (imgs: PpspsImage[]) => {
    setImages(imgs);
    if (existingPpsps) {
      await supabase.from("ppsps").update({ images: imgs as any }).eq("id", existingPpsps.id);
    }
  };

  const handleAttachmentsChange = async (atts: PpspsAttachment[]) => {
    setAttachments(atts);
    if (existingPpsps) {
      await supabase.from("ppsps").update({ attachments: atts as any }).eq("id", existingPpsps.id);
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
        onContentChange={handleContentChange}
        devis={devis}
        onRegenerate={handleRegenerate}
        regenerating={loading}
        version={existingPpsps?.version || 1}
        ppspsId={existingPpsps?.id}
        customSections={customSections}
        onCustomSectionsChange={handleCustomSectionsChange}
        images={images}
        onImagesChange={handleImagesChange}
        attachments={attachments}
        onAttachmentsChange={handleAttachmentsChange}
      />
    </>
  );
};
