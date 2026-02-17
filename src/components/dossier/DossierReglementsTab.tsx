import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreditCard } from "lucide-react";

interface Props {
  dossierId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export const DossierReglementsTab = ({ dossierId }: Props) => {
  const isMobile = useIsMobile();

  const { data: factures = [] } = useQuery({
    queryKey: ["dossier-factures-ids", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase.from("factures").select("id, code").eq("dossier_id", dossierId);
      if (error) throw error;
      return data || [];
    },
  });

  const factureIds = factures.map((f) => f.id);
  const factureMap = Object.fromEntries(factures.map((f) => [f.id, f.code || "—"]));

  const { data: reglements = [] } = useQuery({
    queryKey: ["dossier-reglements", dossierId, factureIds],
    queryFn: async () => {
      if (factureIds.length === 0) return [];
      const { data, error } = await supabase
        .from("reglements")
        .select("*")
        .in("facture_id", factureIds)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: factureIds.length > 0,
  });

  const totalRegle = reglements.reduce((s, r) => s + Number(r.amount), 0);

  if (reglements.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
        <CreditCard className="h-10 w-10 mb-2 opacity-30" />
        <p className="text-sm">Aucun règlement sur ce dossier</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"} text-center`}>
        <p className="text-[10px] text-muted-foreground">Total réglé</p>
        <p className={`font-bold text-success ${isMobile ? "text-sm" : "text-lg"}`}>{fmt(totalRegle)}</p>
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {reglements.map((r) => (
          <div key={r.id} className={`flex items-center gap-3 ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`}>
            <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{r.code || r.reference || "Règlement"}</p>
              <p className="text-[11px] text-muted-foreground">
                {fmtDate(r.payment_date)} · Facture {factureMap[r.facture_id] || "—"} {r.bank ? `· ${r.bank}` : ""}
              </p>
            </div>
            <span className={`font-semibold shrink-0 ${isMobile ? "text-xs" : "text-sm"}`}>{fmt(Number(r.amount))}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
