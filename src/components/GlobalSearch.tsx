import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import {
  Users, FolderOpen, FileText, ClipboardCheck, Search,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "client" | "dossier" | "devis" | "visite";
  label: string;
  sub?: string;
  path: string;
}

const TYPE_META: Record<string, { icon: typeof Users; group: string }> = {
  client: { icon: Users, group: "Clients" },
  dossier: { icon: FolderOpen, group: "Dossiers" },
  devis: { icon: FileText, group: "Devis" },
  visite: { icon: ClipboardCheck, group: "Visites" },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { current, dbCompanies } = useCompany();

  const companyIds = useMemo(
    () => (current === "global" ? dbCompanies.map((c) => c.id) : [current]),
    [current, dbCompanies]
  );

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2 || companyIds.length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const pattern = `%${q}%`;
      const [clients, dossiers, devis, visites] = await Promise.all([
        supabase.from("clients").select("id, name, city").in("company_id", companyIds).ilike("name", pattern).limit(5),
        supabase.from("dossiers").select("id, code, title, clients(name)").in("company_id", companyIds).or(`title.ilike.${pattern},code.ilike.${pattern}`).limit(5),
        supabase.from("devis").select("id, code, objet, clients(name)").in("company_id", companyIds).or(`objet.ilike.${pattern},code.ilike.${pattern}`).limit(5),
        supabase.from("visites").select("id, title, clients(name)").in("company_id", companyIds).ilike("title", pattern).limit(5),
      ]);

      const items: SearchResult[] = [];
      (clients.data ?? []).forEach((c) => items.push({ id: c.id, type: "client", label: c.name, sub: c.city || undefined, path: `/clients/${c.id}` }));
      (dossiers.data ?? []).forEach((d) => items.push({ id: d.id, type: "dossier", label: `${d.code || ""} ${d.title}`.trim(), sub: (d.clients as any)?.name, path: `/dossiers/${d.id}` }));
      (devis.data ?? []).forEach((d) => items.push({ id: d.id, type: "devis", label: `${d.code || ""} ${d.objet}`.trim(), sub: (d.clients as any)?.name, path: `/devis/${d.id}` }));
      (visites.data ?? []).forEach((v) => items.push({ id: v.id, type: "visite", label: v.title, sub: (v.clients as any)?.name, path: `/visites/${v.id}` }));
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [companyIds]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const group = TYPE_META[r.type]?.group || "Autre";
    if (!acc[group]) acc[group] = [];
    acc[group].push(r);
    return acc;
  }, {});

  return (
    <>
      {/* Trigger button for sidebar */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-sidebar-border bg-sidebar-accent px-1.5 text-[10px] font-mono text-sidebar-muted">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher clients, dossiers, devis, visites…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length < 2 ? (
            <CommandEmpty>Tapez au moins 2 caractères…</CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Recherche en cours…</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>Aucun résultat pour « {query} »</CommandEmpty>
          ) : (
            Object.entries(grouped).map(([group, items], gi) => (
              <div key={group}>
                {gi > 0 && <CommandSeparator />}
                <CommandGroup heading={group}>
                  {items.map((item) => {
                    const Icon = TYPE_META[item.type]?.icon || Search;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${item.type}-${item.id}`}
                        onSelect={() => handleSelect(item.path)}
                        className="flex items-center gap-3"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.label}</p>
                          {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </div>
            ))
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
