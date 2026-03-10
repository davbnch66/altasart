import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { format, startOfYear, endOfYear } from "date-fns";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * FEC (Fichier des Écritures Comptables) Export
 * Format réglementaire français — Article A47 A-1 du LPF
 * Colonnes obligatoires (pipe-separated for readability, tab-separated in file):
 * JournalCode | JournalLib | EcritureNum | EcritureDate | CompteNum | CompteLib |
 * CompAuxNum | CompAuxLib | PieceRef | PieceDate | EcritureLib | Debit | Credit |
 * EcritureLet | DateLet | ValidDate | Montantdevise | Idevise
 */

const FEC_COLUMNS = [
  "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
  "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
  "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
  "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
];

function fecDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return format(new Date(d), "yyyyMMdd");
  } catch {
    return "";
  }
}

function fecAmount(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

interface FecLine {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string;
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  Debit: string;
  Credit: string;
  EcritureLet: string;
  DateLet: string;
  ValidDate: string;
  Montantdevise: string;
  Idevise: string;
}

export function FecExportTab() {
  const { current, dbCompanies } = useCompany();
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    current !== "global" ? current : dbCompanies[0]?.id || ""
  );
  const [dateFrom, setDateFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfYear(new Date()), "yyyy-MM-dd"));
  const [generating, setGenerating] = useState(false);

  const selectedCompany = dbCompanies.find(c => c.id === selectedCompanyId);

  // Preview stats
  const { data: previewStats, isLoading } = useQuery({
    queryKey: ["fec-preview", selectedCompanyId, dateFrom, dateTo],
    queryFn: async () => {
      const [{ count: factureCount }, { count: reglementCount }] = await Promise.all([
        supabase.from("factures").select("id", { count: "exact", head: true })
          .eq("company_id", selectedCompanyId)
          .gte("created_at", dateFrom)
          .lte("created_at", dateTo + "T23:59:59"),
        supabase.from("reglements").select("id", { count: "exact", head: true })
          .eq("company_id", selectedCompanyId)
          .gte("payment_date", dateFrom)
          .lte("payment_date", dateTo),
      ]);
      return { factureCount: factureCount ?? 0, reglementCount: reglementCount ?? 0 };
    },
    enabled: !!selectedCompanyId,
  });

  const handleExport = async () => {
    if (!selectedCompanyId) {
      toast.error("Sélectionnez une société");
      return;
    }

    setGenerating(true);
    try {
      // Fetch all factures with client info
      const { data: factures, error: fErr } = await supabase
        .from("factures")
        .select("id, code, amount, tva_rate, status, created_at, due_date, notes, clients(name, code, account_number, accounting_collective)")
        .eq("company_id", selectedCompanyId)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at");

      if (fErr) throw fErr;

      // Fetch all reglements
      const { data: reglements, error: rErr } = await supabase
        .from("reglements")
        .select("id, code, amount, payment_date, bank, reference, notes, facture_id, factures(code, clients(name, code, account_number))")
        .eq("company_id", selectedCompanyId)
        .gte("payment_date", dateFrom)
        .lte("payment_date", dateTo)
        .order("payment_date");

      if (rErr) throw rErr;

      const lines: FecLine[] = [];
      let ecritureNum = 1;

      // Generate FEC lines from factures
      for (const f of (factures || [])) {
        const client = f.clients as any;
        const clientCode = client?.code || client?.account_number || "411000";
        const clientName = client?.name || "Client";
        const ht = Number(f.amount);
        const tvaRate = Number(f.tva_rate || 20);
        const tva = ht * (tvaRate / 100);
        const ttc = ht + tva;
        const ref = f.code || `F-${ecritureNum}`;
        const dateStr = fecDate(f.created_at);
        const num = String(ecritureNum).padStart(6, "0");

        // Ligne client (débit TTC)
        lines.push({
          JournalCode: "VE",
          JournalLib: "Journal des ventes",
          EcritureNum: num,
          EcritureDate: dateStr,
          CompteNum: clientCode.startsWith("411") ? clientCode : `411${clientCode}`,
          CompteLib: clientName,
          CompAuxNum: client?.code || "",
          CompAuxLib: clientName,
          PieceRef: ref,
          PieceDate: dateStr,
          EcritureLib: `Facture ${ref} - ${clientName}`,
          Debit: fecAmount(ttc),
          Credit: fecAmount(0),
          EcritureLet: "",
          DateLet: "",
          ValidDate: dateStr,
          Montantdevise: "",
          Idevise: "",
        });

        // Ligne produit (crédit HT)
        lines.push({
          JournalCode: "VE",
          JournalLib: "Journal des ventes",
          EcritureNum: num,
          EcritureDate: dateStr,
          CompteNum: "706000",
          CompteLib: "Prestations de services",
          CompAuxNum: "",
          CompAuxLib: "",
          PieceRef: ref,
          PieceDate: dateStr,
          EcritureLib: `Facture ${ref} - ${clientName}`,
          Debit: fecAmount(0),
          Credit: fecAmount(ht),
          EcritureLet: "",
          DateLet: "",
          ValidDate: dateStr,
          Montantdevise: "",
          Idevise: "",
        });

        // Ligne TVA (crédit TVA)
        if (tva > 0) {
          lines.push({
            JournalCode: "VE",
            JournalLib: "Journal des ventes",
            EcritureNum: num,
            EcritureDate: dateStr,
            CompteNum: tvaRate === 10 ? "445711" : "445712",
            CompteLib: `TVA collectée ${tvaRate}%`,
            CompAuxNum: "",
            CompAuxLib: "",
            PieceRef: ref,
            PieceDate: dateStr,
            EcritureLib: `TVA Facture ${ref}`,
            Debit: fecAmount(0),
            Credit: fecAmount(tva),
            EcritureLet: "",
            DateLet: "",
            ValidDate: dateStr,
            Montantdevise: "",
            Idevise: "",
          });
        }

        ecritureNum++;
      }

      // Generate FEC lines from reglements (journal de banque)
      for (const r of (reglements || [])) {
        const facture = r.factures as any;
        const client = facture?.clients as any;
        const clientCode = client?.code || client?.account_number || "411000";
        const clientName = client?.name || "Client";
        const amount = Number(r.amount);
        const ref = r.code || facture?.code || `REG-${ecritureNum}`;
        const dateStr = fecDate(r.payment_date);
        const num = String(ecritureNum).padStart(6, "0");

        // Ligne banque (débit)
        lines.push({
          JournalCode: "BQ",
          JournalLib: "Journal de banque",
          EcritureNum: num,
          EcritureDate: dateStr,
          CompteNum: "512000",
          CompteLib: r.bank ? `Banque ${r.bank}` : "Banque",
          CompAuxNum: "",
          CompAuxLib: "",
          PieceRef: ref,
          PieceDate: dateStr,
          EcritureLib: `Règlement ${ref} - ${clientName}`,
          Debit: fecAmount(amount),
          Credit: fecAmount(0),
          EcritureLet: "",
          DateLet: "",
          ValidDate: dateStr,
          Montantdevise: "",
          Idevise: "",
        });

        // Ligne client (crédit)
        lines.push({
          JournalCode: "BQ",
          JournalLib: "Journal de banque",
          EcritureNum: num,
          EcritureDate: dateStr,
          CompteNum: clientCode.startsWith("411") ? clientCode : `411${clientCode}`,
          CompteLib: clientName,
          CompAuxNum: client?.code || "",
          CompAuxLib: clientName,
          PieceRef: ref,
          PieceDate: dateStr,
          EcritureLib: `Règlement ${ref} - ${clientName}`,
          Debit: fecAmount(0),
          Credit: fecAmount(amount),
          EcritureLet: "",
          DateLet: "",
          ValidDate: dateStr,
          Montantdevise: "",
          Idevise: "",
        });

        ecritureNum++;
      }

      if (lines.length === 0) {
        toast.error("Aucune écriture à exporter sur cette période");
        return;
      }

      // Build FEC file (tab-separated, UTF-8 with BOM)
      const header = FEC_COLUMNS.join("\t");
      const rows = lines.map(l =>
        FEC_COLUMNS.map(col => (l as any)[col] || "").join("\t")
      );
      const content = "\uFEFF" + [header, ...rows].join("\r\n");

      // Generate filename per FEC convention: SirenFEC{YYYYMMDD}.txt
      const siren = selectedCompany?.siret?.slice(0, 9) || "000000000";
      const endDateStr = format(new Date(dateTo), "yyyyMMdd");
      const fileName = `${siren}FEC${endDateStr}.txt`;

      // Download
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`FEC exporté : ${lines.length} écritures`);
    } catch (err: any) {
      console.error("FEC export error:", err);
      toast.error("Erreur lors de l'export FEC");
    } finally {
      setGenerating(false);
    }
  };

  const totalEntries = (previewStats?.factureCount ?? 0) + (previewStats?.reglementCount ?? 0);

  return (
    <div className={`space-y-6 ${isMobile ? "mt-3" : "mt-4"}`}>
      {/* Info banner */}
      <div className="rounded-lg border bg-muted/30 p-4 flex gap-3 items-start">
        <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Export FEC — Fichier des Écritures Comptables</p>
          <p className="text-xs text-muted-foreground">
            Format réglementaire (Art. A47 A-1 du LPF). Fichier tabulé UTF-8 compatible avec tous les logiciels comptables
            (Sage, Cegid, EBP, QuickBooks, etc.).
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
        <div>
          <Label>Société *</Label>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {dbCompanies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Du</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>Au</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Preview stats */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{previewStats?.factureCount ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Factures</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{previewStats?.reglementCount ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Règlements</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalEntries > 0 ? `~${totalEntries * 3}` : "—"}</p>
            <p className="text-xs text-muted-foreground">Lignes d'écritures estimées</p>
          </div>
        </div>
      </div>

      {/* Warning if no data */}
      {!isLoading && totalEntries === 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">Aucune donnée sur cette période pour cette société.</p>
        </div>
      )}

      {/* Export button */}
      <div className="flex justify-end">
        <Button
          onClick={handleExport}
          disabled={generating || totalEntries === 0 || !selectedCompanyId}
          className="gap-2"
          size={isMobile ? "default" : "lg"}
        >
          <Download className="h-4 w-4" />
          {generating ? "Génération en cours…" : "Télécharger le FEC"}
        </Button>
      </div>

      {/* Format info */}
      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="text-sm font-medium">Colonnes exportées (18 champs obligatoires)</h3>
        <div className="flex flex-wrap gap-1.5">
          {FEC_COLUMNS.map(col => (
            <span key={col} className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
              {col}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Journaux : <strong>VE</strong> (Ventes) pour les factures, <strong>BQ</strong> (Banque) pour les règlements.
          Les comptes clients utilisent le code client ou le compte auxiliaire configuré dans la fiche client.
        </p>
      </div>
    </div>
  );
}
