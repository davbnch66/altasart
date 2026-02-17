import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileStack, Check } from "lucide-react";

interface Props {
  onApply: (lines: Array<{ description: string; quantity: number; unit_price: number }>) => void;
}

const categoryLabels: Record<string, string> = {
  manutention: "Manutention lourde",
  grue: "Location de grue",
  garde_meuble: "Garde-meuble",
  transfert: "Transfert",
  levage: "Levage",
};

export const DevisApplyTemplateDialog = ({ onApply }: Props) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  const { data: templates = [] } = useQuery({
    queryKey: ["devis-templates", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis_templates")
        .select("*")
        .in("company_id", companyIds)
        .order("category", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open && companyIds.length > 0,
  });

  const handleApply = (template: any) => {
    const lines = (template.lines as any[]) || [];
    onApply(lines.map((l) => ({
      description: l.description || "",
      quantity: l.quantity || 1,
      unit_price: l.unit_price || 0,
    })));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileStack className="h-3.5 w-3.5" /> Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Appliquer un template de devis</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucun template. Créez-en via Paramètres → Templates devis.
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {templates.map((t: any) => (
              <button
                key={t.id}
                onClick={() => handleApply(t)}
                className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {categoryLabels[t.category] || t.category} — {((t.lines as any[]) || []).length} ligne(s)
                    </p>
                  </div>
                  <Check className="h-4 w-4 text-muted-foreground/30" />
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
