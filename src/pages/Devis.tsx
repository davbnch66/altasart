import { motion } from "framer-motion";
import { Search, FileText, Pencil, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown, X, ChevronRight, Euro, Plus } from "lucide-react";
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

  const hasActiveFilters = statusFilter || companyFilter;

  return (
    <div className={`max-w-7xl mx-auto animate-fade-in ${isMobile ? "p-2 pb-20 space-y-2" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`page-title ${isMobile ? "!text-base" : ""}`}>Devis / Cotations</h1>
          {!isMobile && <p className="page-subtitle">{filtered.length} devis{filtered.length !== devis.length ? ` sur ${devis.length}` : ""}</p>}
        </div>
        <CreateDevisDialog
          trigger={isMobile ? (
            <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          ) : undefined}
        />
      </motion.div>

      {/* Status filter chips */}
      <div className={`flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none`}>
        {([
          { key: "all", label: "Tous" },
          { key: "brouillon", label: "Brouillons" },
          { key: "envoye", label: "Envoyés" },
          { key: "accepte", label: "Acceptés" },
          { key: "refuse", label: "Refusés" },
          { key: "expire", label: "Expirés" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key === "all" ? null : statusFilter === key ? null : key)}
            className={`filter-chip ${
              isMobile ? "px-2.5 py-1 text-[11px]" : ""
            } ${
              (key === "all" && !statusFilter) || statusFilter === key
                ? "filter-chip-active"
                : "filter-chip-inactive"
            }`}
          >
            {label} ({counts[key] || 0})
          </button>
        ))}
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

      {/* Active filters */}
      {hasActiveFilters && !isMobile && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtres actifs :</span>
          {statusFilter && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setStatusFilter(null)}>
              {statusLabels[statusFilter]} <X className="h-3 w-3" />
            </Badge>
          )}
          {companyFilter && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setCompanyFilter(null)}>
              {companyFilter} <X className="h-3 w-3" />
            </Badge>
          )}
          <button onClick={() => { setStatusFilter(null); setCompanyFilter(null); }} className="text-xs text-muted-foreground hover:text-foreground underline">
            Tout effacer
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground ${isMobile ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
        <Input
          placeholder={isMobile ? "Rechercher..." : "Rechercher par code, client, objet..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={isMobile ? "pl-8 h-8 text-xs" : "pl-9 h-9"}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className={`w-full rounded-xl ${isMobile ? "h-20" : "h-14"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Aucun devis trouvé</div>
      ) : isMobile ? (
        /* Mobile cards */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-1.5">
          {filtered.map((d) => {
            const comp = d.companies as any;
            return (
              <div
                key={d.id}
                onClick={() => navigate(`/devis/${d.id}`)}
                className="rounded-lg border bg-card px-2.5 py-2 active:bg-muted/50 transition-colors cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="font-medium text-xs truncate">{d.objet}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground overflow-hidden">
                      <span className="truncate">{(d.clients as any)?.name || "—"}</span>
                      {d.code && <span className="font-mono shrink-0">{d.code}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-auto">
                    <span className="text-xs font-semibold whitespace-nowrap">{formatAmount(d.amount)}</span>
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none whitespace-nowrap ${statusStyles[d.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[d.status] || d.status}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              </div>
            );
          })}
        </motion.div>
      ) : (
        /* Desktop table */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort("code")}>
                  <span className="flex items-center">N° <SortIcon field="code" /></span>
                </th>
                {current === "global" && (
                  <th className="text-left font-medium text-muted-foreground px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort("company")}>
                    <span className="flex items-center">Société <SortIcon field="company" /></span>
                  </th>
                )}
                <th className="text-left font-medium text-muted-foreground px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort("client")}>
                  <span className="flex items-center">Client <SortIcon field="client" /></span>
                </th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">Objet</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("date")}>
                  <span className="flex items-center">Date <SortIcon field="date" /></span>
                </th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Validité</th>
                <th className="text-right font-medium text-muted-foreground px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                  <span className="flex items-center justify-end">Montant <SortIcon field="amount" /></span>
                </th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  <span className="flex items-center">Statut <SortIcon field="status" /></span>
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((d) => {
                const comp = d.companies as any;
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/devis/${d.id}`)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <FileText className="h-4 w-4 text-muted-foreground" />
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
                    <td className="px-5 py-3"><span className="font-medium">{(d.clients as any)?.name || "—"}</span></td>
                    <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{d.objet}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{formatDate(d.created_at)}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{formatDate(d.valid_until)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatAmount(d.amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[d.status] || ""}`}>
                        {statusLabels[d.status] || d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => generateDevisPdf(d.id).catch(() => toast.error("Erreur PDF"))} className="p-1 rounded hover:bg-primary/10" title="Télécharger PDF">
                          <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </button>
                        <button onClick={() => setEditingDevis(d)} className="p-1 rounded hover:bg-muted" title="Modifier">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeletingDevis(d)} className="p-1 rounded hover:bg-muted" title="Supprimer">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
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

export default Devis;
