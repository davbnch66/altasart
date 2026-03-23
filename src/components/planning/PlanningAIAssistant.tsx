import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, Check, Calendar, Truck, User } from "lucide-react";
import { toast } from "sonner";

export interface AISuggestion {
  loading_date: string;
  delivery_date?: string;
  loading_city?: string;
  delivery_city?: string;
  resource_ids: string[];
  dossier_id?: string;
  client_name?: string;
  reason: string;
}

interface PlanningAIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (suggestion: AISuggestion) => void;
}

export const PlanningAIAssistant = ({ open, onOpenChange, onApply }: PlanningAIAssistantProps) => {
  const { current, dbCompanies } = useCompany();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);

  const companyIds = current === "global" ? dbCompanies.map(c => c.id) : [current];

  const { data: resources = [] } = useQuery({
    queryKey: ["ai-resources", companyIds],
    queryFn: async () => {
      const { data } = await supabase.from("resource_companies")
        .select("resource_id, resources(id, name, type, status)")
        .in("company_id", companyIds);
      const seen = new Set<string>();
      return (data || []).map((rc: any) => rc.resources).filter((r: any) => r && !seen.has(r.id) && seen.add(r.id));
    },
    enabled: open,
  });

  const { data: currentOps = [] } = useQuery({
    queryKey: ["ai-current-ops", companyIds],
    queryFn: async () => {
      const today = new Date();
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 14);
      const { data } = await supabase.from("operations")
        .select("*, operation_resources(resource_id)")
        .in("company_id", companyIds)
        .gte("loading_date", today.toISOString().split("T")[0])
        .lte("loading_date", weekEnd.toISOString().split("T")[0]);
      return data || [];
    },
    enabled: open,
  });

  const analyze = async () => {
    if (!prompt.trim()) { toast.error("Décrivez la demande"); return; }
    setLoading(true);
    setSuggestion(null);
    try {
      const resourcesContext = resources.map((r: any) => ({
        id: r.id, name: r.name, type: r.type,
        busy_dates: currentOps
          .filter((op: any) => (op.operation_resources || []).some((or: any) => or.resource_id === r.id))
          .map((op: any) => op.loading_date),
      }));

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase.functions.invoke("ai-plan-mission", {
        body: { prompt: prompt.trim(), resources: resourcesContext, today },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuggestion(data.suggestion);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur IA — " + (err.message || "Réessayez"));
    } finally {
      setLoading(false);
    }
  };

  const getResourceName = (id: string) => (resources.find((r: any) => r.id === id) as any)?.name || id;
  const getResourceType = (id: string) => (resources.find((r: any) => r.id === id) as any)?.type || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Assistant IA — Planification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Décrivez la demande client en langage naturel :</p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Exemples :\n• "Levage de 15 tonnes à Villepinte le 28 mars, besoin d'une grue mobile"\n• "Déménagement industriel EDF La Défense, 2 jours, 3 manutentionnaires"\n• "Location grue opérateur Bouygues semaine prochaine"`}
              rows={4}
              className="text-sm resize-none"
            />
          </div>

          <Button
            onClick={analyze}
            disabled={loading || !prompt.trim()}
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyse en cours..." : "Analyser et proposer"}
          </Button>

          {suggestion && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800 p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Suggestion IA
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="font-medium">{suggestion.loading_date}</span>
                  {suggestion.delivery_date && suggestion.delivery_date !== suggestion.loading_date && (
                    <span className="text-muted-foreground">→ {suggestion.delivery_date}</span>
                  )}
                </div>

                {(suggestion.loading_city || suggestion.delivery_city) && (
                  <div className="text-sm text-muted-foreground">
                    📍 {suggestion.loading_city || "—"} → {suggestion.delivery_city || "—"}
                  </div>
                )}

                {suggestion.resource_ids.length > 0 && (
                  <div className="space-y-1">
                    {suggestion.resource_ids.map(rid => (
                      <div key={rid} className="flex items-center gap-2 text-sm">
                        {getResourceType(rid) === "employe" || getResourceType(rid) === "equipe"
                          ? <User className="h-3.5 w-3.5 text-purple-600" />
                          : <Truck className="h-3.5 w-3.5 text-purple-600" />
                        }
                        <span>{getResourceName(rid)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {suggestion.client_name && (
                  <div className="text-sm text-muted-foreground">
                    👤 {suggestion.client_name}
                  </div>
                )}

                <p className="text-xs text-muted-foreground italic border-t border-purple-200 dark:border-purple-800 pt-2">
                  {suggestion.reason}
                </p>
              </div>

              <Button
                onClick={() => { onApply(suggestion); onOpenChange(false); setSuggestion(null); setPrompt(""); }}
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="h-4 w-4" />
                Utiliser cette suggestion
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
