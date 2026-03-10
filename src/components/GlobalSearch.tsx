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
  Wrench, DollarSign, Truck, Warehouse,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "client" | "dossier" | "devis" | "visite" | "resource" | "facture" | "vehicle" | "storage";
  label: string;
  sub?: string;
  path: string;
}

const TYPE_META: Record<string, { icon: typeof Users; group: string }> = {
  client: { icon: Users, group: "Clients" },
  dossier: { icon: FolderOpen, group: "Dossiers" },
  devis: { icon: FileText, group: "Devis" },
  visite: { icon: ClipboardCheck, group: "Visites" },
  resource: { icon: Wrench, group: "Ressources" },
  facture: { icon: DollarSign, group: "Factures" },
  vehicle: { icon: Truck, group: "Flotte" },
  storage: { icon: Warehouse, group: "Stockage" },
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

      const [clients, dossiers, devis, visites, resources, factures, vehicles, storage] = await Promise.all([
        // Clients: name, city, address, phone, mobile, email, contact_name
        supabase.from("clients")
          .select("id, name, city, address, phone, mobile, email")
          .in("company_id", companyIds)
          .or(`name.ilike.${pattern},city.ilike.${pattern},address.ilike.${pattern},phone.ilike.${pattern},mobile.ilike.${pattern},email.ilike.${pattern},contact_name.ilike.${pattern}`)
          .limit(6),

        // Dossiers: title, code, address, loading/delivery addresses
        supabase.from("dossiers")
          .select("id, code, title, address, clients(name)")
          .in("company_id", companyIds)
          .or(`title.ilike.${pattern},code.ilike.${pattern},address.ilike.${pattern},loading_address.ilike.${pattern},delivery_address.ilike.${pattern},loading_city.ilike.${pattern},delivery_city.ilike.${pattern}`)
          .limit(6),

        // Devis: code, objet
        supabase.from("devis")
          .select("id, code, objet, clients(name)")
          .in("company_id", companyIds)
          .or(`objet.ilike.${pattern},code.ilike.${pattern}`)
          .limit(5),

        // Visites: title
        supabase.from("visites")
          .select("id, title, clients(name)")
          .in("company_id", companyIds)
          .ilike("title", pattern)
          .limit(5),

        // Resources: name, notes
        supabase.from("resources")
          .select("id, name, type, notes")
          .or(`name.ilike.${pattern},notes.ilike.${pattern}`)
          .limit(5),

        // Factures: code, notes
        supabase.from("factures")
          .select("id, code, amount, status, clients(name)")
          .in("company_id", companyIds)
          .or(`code.ilike.${pattern}`)
          .limit(5),

        // Fleet vehicles: name, registration, brand, model
        supabase.from("fleet_vehicles")
          .select("id, name, registration, type")
          .in("company_id", companyIds)
          .or(`name.ilike.${pattern},registration.ilike.${pattern},brand.ilike.${pattern},model.ilike.${pattern}`)
          .limit(5),

        // Storage units: name, location
        supabase.from("storage_units")
          .select("id, name, location, status")
          .in("company_id", companyIds)
          .or(`name.ilike.${pattern},location.ilike.${pattern}`)
          .limit(5),
      ]);

      const items: SearchResult[] = [];

      (clients.data ?? []).forEach((c) => {
        const sub = [c.city, c.phone, c.email].filter(Boolean).join(" · ");
        items.push({ id: c.id, type: "client", label: c.name, sub: sub || undefined, path: `/clients/${c.id}` });
      });

      (dossiers.data ?? []).forEach((d) => {
        const sub = [(d.clients as any)?.name, d.address].filter(Boolean).join(" · ");
        items.push({ id: d.id, type: "dossier", label: `${d.code || ""} ${d.title}`.trim(), sub: sub || undefined, path: `/dossiers/${d.id}` });
      });

      (devis.data ?? []).forEach((d) =>
        items.push({ id: d.id, type: "devis", label: `${d.code || ""} ${d.objet}`.trim(), sub: (d.clients as any)?.name, path: `/devis/${d.id}` })
      );

      (visites.data ?? []).forEach((v) =>
        items.push({ id: v.id, type: "visite", label: v.title, sub: (v.clients as any)?.name, path: `/visites/${v.id}` })
      );

      (resources.data ?? []).forEach((r) =>
        items.push({ id: r.id, type: "resource", label: r.name, sub: r.type === "employe" ? "Personnel" : "Équipement", path: `/ressources` })
      );

      (factures.data ?? []).forEach((f) =>
        items.push({ id: f.id, type: "facture", label: f.code || `Facture ${f.amount}€`, sub: (f.clients as any)?.name, path: `/finance` })
      );

      (vehicles.data ?? []).forEach((v) =>
        items.push({ id: v.id, type: "vehicle", label: v.name, sub: [v.registration, v.type].filter(Boolean).join(" · "), path: `/flotte` })
      );

      (storage.data ?? []).forEach((s) =>
        items.push({ id: s.id, type: "storage", label: s.name, sub: [s.location, s.status].filter(Boolean).join(" · "), path: `/stockage` })
      );

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

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Rechercher partout : nom, adresse, téléphone, immat…"
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
                        key={`${item.type}-${item.id}`}
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
