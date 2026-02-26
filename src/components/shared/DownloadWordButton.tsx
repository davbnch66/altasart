import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { downloadDocx, getDefaultTemplate, type DocumentType } from "@/lib/docxTemplateEngine";
import { toast } from "sonner";

interface DownloadWordButtonProps {
  companyId: string;
  documentType: DocumentType;
  documentId: string;
  fileName: string;
  variant?: "outline" | "secondary" | "ghost";
  size?: "sm" | "default";
  className?: string;
  label?: string;
}

export function DownloadWordButton({
  companyId,
  documentType,
  documentId,
  fileName,
  variant = "outline",
  size = "sm",
  className,
  label = "Word",
}: DownloadWordButtonProps) {
  const [loading, setLoading] = useState(false);
  const [hasTemplate, setHasTemplate] = useState<boolean | null>(null);

  // Lazy check if template exists
  const handleClick = async () => {
    setLoading(true);
    try {
      const template = await getDefaultTemplate(companyId, documentType);
      if (!template) {
        toast.error("Aucun modèle Word configuré pour ce type de document. Ajoutez-en un dans Paramètres → Documents.");
        setHasTemplate(false);
        return;
      }
      setHasTemplate(true);

      await downloadDocx(template.storage_path, documentType, documentId, fileName);
      toast.success("Document Word téléchargé");
    } catch (err: any) {
      console.error("Word generation error:", err);
      toast.error(err?.message || "Erreur lors de la génération Word");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={loading} className={className}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
      {label}
    </Button>
  );
}
