import { motion } from "framer-motion";
import { Search, FileText, Pencil, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown, X, ChevronRight, Euro, Plus, Loader2, Send, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { EditDevisDialog } from "@/components/forms/EditDevisDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProgressiveList } from "@/hooks/useProgressiveList";

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const statusStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  refuse: "bg-destructive/10 text-destructive",
  expire: "bg-warning/10 text-warning",
};

const iconColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-info/15 text-info",
  accepte: "bg-success/15 text-success",
  refuse: "bg-destructive/15 text-destructive",
  expire: "bg-warning/15 text-warning",
};

const companyColors: Record<string, string> = {
  "company-art": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "company-altigrues": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "company-asdgm": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy");
  } catch {
    return "—";
  }
};

const formatDateShort = (dateStr: string | null) => {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "d MMM", { locale: fr });
  } catch {
    return "";
  }
};

type SortField = "code" | "client" | "company" | "date" | "amount" | "status";
type SortDir = "asc" | "desc";

const Devis = () => {
  const { current } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingDevis, setEditingDevis] = useState<any>(null);
  const [deletingDevis, setDeletingDevis] = useState<any>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("devis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis supprimé");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-devis"] });
      setDeletingDevis(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const { data: devis = [], isLoading } = useQuery({
    queryKey: ["devis", current],
    queryFn: async () => {
      let query = supabase
        .from("devis")
        .select("*, clients(name), companies(short_name, color)")
        .order("created_at", { ascending: false });

      if (current !== "global") {
        query = query.eq("company_id", current);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch signature data to show signature status
  const devisIds = useMemo(() => devis.map((d: any) => d.id), [devis]);
  const { data: signatures = [] } = useQuery({
    queryKey: ["devis-signatures-list", devisIds],
    queryFn: async () => {
      if (devisIds.length === 0) return [];
      const { data } = await supabase
        .from("devis_signatures")
        .select("devis_id, status")
        .in("devis_id", devisIds);
      return data || [];
    },
    enabled: devisIds.length > 0,
  });

  const signatureMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sig of signatures) {
      map.set(sig.devis_id, sig.status);
    }
    return map;
  }, [signatures]);

  const availableCompanies = useMemo(() => {
    const map = new Map<string, { short_name: string; color: string }>();
    for (const d of devis) {
      const comp = d.companies as any;
      if (comp?.short_name && !map.has(comp.short_name)) {
        map.set(comp.short_name, { short_name: comp.short_name, color: comp.color || "" });
      }
    }
    return Array.from(map.values());
  }, [devis]);

  const filtered = useMemo(() => {
    let result = devis;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.objet.toLowerCase().includes(q) ||
          d.code?.toLowerCase().includes(q) ||
          (d.clients as any)?.name?.toLowerCase().includes(q) ||
          (d.companies as any)?.short_name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter((d) => d.status === statusFilter);
    }

    if (companyFilter) {
      result = result.filter((d) => (d.companies as any)?.short_name === companyFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "code": cmp = (a.code || "").localeCompare(b.code || ""); break;
        case "client": cmp = ((a.clients as any)?.name || "").localeCompare((b.clients as any)?.name || ""); break;
        case "company": cmp = ((a.companies as any)?.short_name || "").localeCompare((b.companies as any)?.short_name || ""); break;
        case "date": cmp = (a.created_at || "").localeCompare(b.created_at || ""); break;
        case "amount": cmp = (a.amount || 0) - (b.amount || 0); break;
        case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [devis, search, statusFilter, companyFilter, sortField, sortDir]);

  const counts: Record<string, number> = { all: devis.length };
  for (const s of ["brouillon", "envoye", "accepte", "refuse", "expire"]) {
    counts[s] = devis.filter((d) => d.status === s).length;
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "date" || field === "amount" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className={`max-w-7xl mx-auto animate-fade-in ${isMobile ? "p-2 pb-20 space-y-3" : "p-6 lg:p-8 space-y-5"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} devis · {formatAmount(filtered.reduce((s, d) => s + (d.amount || 0), 0))} total
          </p>
        </div>
        <CreateDevisDialog
          trigger={isMobile ? (
            <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          ) : undefined}
        />
      </motion.div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par code, client, objet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-card"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {[
            { key: "all", label: "Tous" },
            { key: "brouillon", label: "Brouillon" },
            { key: "envoye", label: "Envoyé" },
            { key: "accepte", label: "Accepté" },
            { key: "refuse", label: "Refusé" },
            { key: "expire", label: "Expiré" },
          ].map(({ key, label }) => {
            const count = key === "all" ? devis.length : counts[key] || 0;
            if (count === 0 && key !== "all") return null;
            return (
              <button key={key} onClick={() => setStatusFilter(key === "all" ? null : statusFilter === key ? null : key)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  (key === "all" && !statusFilter) || statusFilter === key
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                {label}
                <span className="text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Company filter chips */}
      {current === "global" && availableCompanies.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center mr-1">Société :</span>
          {availableCompanies.map((c) => (
            <button
              key={c.short_name}
              onClick={() => setCompanyFilter(companyFilter === c.short_name ? null : c.short_name)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                companyFilter === c.short_name
                  ? companyColors[c.color] || "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              } ${companyFilter === c.short_name ? "ring-2 ring-primary/30" : ""}`}
            >
              {c.short_name}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className={`w-full rounded-xl ${isMobile ? "h-24" : "h-14"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
            <FileText className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">Aucun devis trouvé</p>
        </div>
      ) : (
        <DevisList
          filtered={filtered}
          isMobile={isMobile}
          navigate={navigate}
          current={current}
          statusLabels={statusLabels}
          statusStyles={statusStyles}
          iconColors={iconColors}
          companyColors={companyColors}
          formatAmount={formatAmount}
          formatDate={formatDate}
          toggleSort={toggleSort}
          SortIcon={SortIcon}
          setEditingDevis={setEditingDevis}
          setDeletingDevis={setDeletingDevis}
          signatureMap={signatureMap}
        />
      )}

      {editingDevis && (
        <EditDevisDialog devis={editingDevis} open={!!editingDevis} onOpenChange={(v) => !v && setEditingDevis(null)} />
      )}
      <DeleteConfirmDialog
        open={!!deletingDevis}
        onOpenChange={(v) => !v && setDeletingDevis(null)}
        onConfirm={() => deletingDevis && deleteMutation.mutate(deletingDevis.id)}
        title="Supprimer ce devis ?"
        description={`Le devis "${deletingDevis?.objet}" sera définitivement supprimé.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

const DevisList = ({ filtered, isMobile, navigate, current, statusLabels, statusStyles, iconColors, companyColors, formatAmount, formatDate, toggleSort, SortIcon, setEditingDevis, setDeletingDevis, signatureMap }: any) => {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(filtered);

  return isMobile ? (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-2">
      {visibleItems.map((d: any) => {
        const sigStatus = signatureMap.get(d.id);
        return (
          <div
            key={d.id}
            onClick={() => navigate(`/devis/${d.id}`)}
            className="card-interactive p-4 space-y-2.5 cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{d.objet}</p>
                <p className="text-xs text-muted-foreground truncate">{(d.clients as any)?.name}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyles[d.status] || "bg-muted text-muted-foreground"}`}>
                {statusLabels[d.status] || d.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{d.code || "—"}</span>
              <span className="text-base font-black tabular-nums">{formatAmount(d.amount || 0)}</span>
            </div>
            {sigStatus === "pending" && d.status !== "accepte" && (
              <div className="flex items-center gap-1 text-[10px] text-info">
                <Send className="h-3 w-3" /> Lien de signature envoyé
              </div>
            )}
            {d.status === "accepte" && (
              <div className="flex items-center gap-1 text-[10px] text-success font-semibold">
                <Check className="h-3 w-3" /> Devis accepté et signé
              </div>
            )}
          </div>
        );
      })}
      <div ref={sentinelRef} className="flex items-center justify-center py-3">
        {hasMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement…
          </div>
        )}
      </div>
    </motion.div>
  ) : (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="card-elevated overflow-hidden">
      <table className="w-full table-premium">
        <thead>
          <tr className="border-b">
            <th className="cursor-pointer select-none" onClick={() => toggleSort("code")}>
              <span className="flex items-center">N° <SortIcon field="code" /></span>
            </th>
            {current === "global" && (
              <th className="cursor-pointer select-none" onClick={() => toggleSort("company")}>
                <span className="flex items-center">Société <SortIcon field="company" /></span>
              </th>
            )}
            <th className="cursor-pointer select-none" onClick={() => toggleSort("client")}>
              <span className="flex items-center">Client <SortIcon field="client" /></span>
            </th>
            <th className="hidden lg:table-cell">Objet</th>
            <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("date")}>
              <span className="flex items-center">Date <SortIcon field="date" /></span>
            </th>
            <th className="!text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>
              <span className="flex items-center justify-end">Montant <SortIcon field="amount" /></span>
            </th>
            <th className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
              <span className="flex items-center">Statut <SortIcon field="status" /></span>
            </th>
            <th className="hidden lg:table-cell">Signature</th>
            <th></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {visibleItems.map((d: any) => {
            const comp = d.companies as any;
            const sigStatus = signatureMap.get(d.id);
            return (
              <tr key={d.id} className="hover:bg-primary/[0.02] transition-colors cursor-pointer" onClick={() => navigate(`/devis/${d.id}`)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconColors[d.status] || "bg-muted text-muted-foreground"}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-xs">{d.code || d.id.slice(0, 8)}</span>
                  </div>
                </td>
                {current === "global" && (
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${companyColors[comp?.color] || "bg-muted text-muted-foreground"}`}>
                      {comp?.short_name || "—"}
                    </span>
                  </td>
                )}
                <td className="px-5 py-3">
                  <span className="font-medium">{(d.clients as any)?.name || "—"}</span>
                </td>
                <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{d.objet}</td>
                <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{formatDate(d.created_at)}</td>
                <td className="px-5 py-3 text-right font-black tabular-nums">{formatAmount(d.amount)}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[d.status] || ""}`}>
                    {statusLabels[d.status] || d.status}
                  </span>
                </td>
                <td className="px-5 py-3 hidden lg:table-cell">
                  {d.status === "accepte" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold">
                      <Check className="h-3 w-3" /> Signé
                    </span>
                  ) : sigStatus === "pending" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-info/10 text-info px-2 py-0.5 text-[10px] font-semibold">
                      <Send className="h-3 w-3" /> Lien envoyé
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover:!opacity-100" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => generateDevisPdf(d.id).catch(() => toast.error("Erreur PDF"))} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Télécharger PDF">
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => setEditingDevis(d)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Modifier">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => setDeletingDevis(d)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div ref={sentinelRef} className="flex items-center justify-center py-3">
        {hasMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement…
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Devis;
