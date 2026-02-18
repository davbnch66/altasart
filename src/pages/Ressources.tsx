import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { motion } from "framer-motion";
import { Users, Truck, HardHat, Wrench, Package, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tables } from "@/integrations/supabase/types";

type Resource = Tables<"resources">;

const TYPE_LABELS: Record<string, string> = {
  employe: "Employé",
  grue: "Grue",
  vehicule: "Véhicule",
  equipement: "Équipement",
  equipe: "Équipe",
};

const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  occupe: "Occupé",
  maintenance: "Maintenance",
  absent: "Absent",
};

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-success/10 text-success border-success/20",
  occupe: "bg-warning/10 text-warning border-warning/20",
  maintenance: "bg-destructive/10 text-destructive border-destructive/20",
  absent: "bg-muted text-muted-foreground border-border",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  employe: HardHat,
  grue: Wrench,
  vehicule: Truck,
  equipement: Package,
  equipe: Users,
};

export default function Ressources() {
  const isMobile = useIsMobile();
  const { companies, current } = useCompany();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "employe" | "grue" | "vehicule" | "equipement" | "equipe">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "disponible">("all");

  // Determine which company IDs to query (exclude the "global" virtual entry)
  const dbCompanies = companies.filter((c) => c.id !== "global");
  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const { data: resourceLinks = [], isLoading } = useQuery({
    queryKey: ["resources", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("resource_companies")
        .select("resource_id, company_id, resources(*)")
        .in("company_id", companyIds);
      if (error) throw error;
      return data;
    },
    enabled: companyIds.length > 0,
  });

  // Deduplicate resources (a resource can belong to multiple companies)
  const resourceMap = new Map<string, Resource & { companyIds: string[] }>();
  for (const link of resourceLinks) {
    if (!link.resources) continue;
    const res = link.resources as Resource;
    if (resourceMap.has(res.id)) {
      resourceMap.get(res.id)!.companyIds.push(link.company_id);
    } else {
      resourceMap.set(res.id, { ...res, companyIds: [link.company_id] });
    }
  }
  const allResources = Array.from(resourceMap.values());

  const filtered = allResources.filter((r) => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = activeTab === "all" || r.type === activeTab;
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getCompanyName = (id: string) => companies.find((c) => c.id === id)?.shortName ?? id;

  const counts = {
    all: allResources.length,
    employe: allResources.filter((r) => r.type === "employe").length,
    grue: allResources.filter((r) => r.type === "grue").length,
    vehicule: allResources.filter((r) => r.type === "vehicule").length,
    equipement: allResources.filter((r) => r.type === "equipement").length,
    equipe: allResources.filter((r) => r.type === "equipe").length,
  };

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Ressources</h1>
          {!isMobile && <p className="text-muted-foreground mt-1">Personnel et équipements partagés entre les sociétés</p>}
        </div>
        <Button size={isMobile ? "sm" : "default"}>
          <Plus className="h-4 w-4 mr-1" />
          {!isMobile && "Ajouter"}
        </Button>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une ressource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            Tous
          </Button>
          <Button
            variant={statusFilter === "disponible" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("disponible")}
          >
            Disponibles seulement
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all">
            Tous <span className="ml-1 text-xs opacity-60">({counts.all})</span>
          </TabsTrigger>
          <TabsTrigger value="employe">
            <HardHat className="h-3.5 w-3.5 mr-1" />
            {!isMobile && "Personnel"} <span className="ml-1 text-xs opacity-60">({counts.employe})</span>
          </TabsTrigger>
          <TabsTrigger value="grue">
            <Wrench className="h-3.5 w-3.5 mr-1" />
            {!isMobile && "Grues"} <span className="ml-1 text-xs opacity-60">({counts.grue})</span>
          </TabsTrigger>
          <TabsTrigger value="vehicule">
            <Truck className="h-3.5 w-3.5 mr-1" />
            {!isMobile && "Véhicules"} <span className="ml-1 text-xs opacity-60">({counts.vehicule})</span>
          </TabsTrigger>
          <TabsTrigger value="equipement">
            <Package className="h-3.5 w-3.5 mr-1" />
            {!isMobile && "Équipements"} <span className="ml-1 text-xs opacity-60">({counts.equipement})</span>
          </TabsTrigger>
          <TabsTrigger value="equipe">
            <Users className="h-3.5 w-3.5 mr-1" />
            {!isMobile && "Équipes"} <span className="ml-1 text-xs opacity-60">({counts.equipe})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl border bg-card animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">Aucune ressource trouvée</p>
              <p className="text-sm mt-1">
                {allResources.length === 0
                  ? "Ajoutez des ressources pour commencer"
                  : "Modifiez vos filtres pour voir plus de résultats"}
              </p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`grid gap-3 ${isMobile ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}
            >
              {filtered.map((res) => {
                const Icon = TYPE_ICONS[res.type] ?? Users;
                return (
                  <div
                    key={res.id}
                    className={`rounded-xl border bg-card hover:shadow-sm transition-shadow cursor-pointer ${isMobile ? "p-3" : "p-5"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${isMobile ? "h-8 w-8" : "h-10 w-10"}`}>
                          <Icon className={`text-muted-foreground ${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
                        </div>
                        <div>
                          <p className={`font-semibold leading-tight ${isMobile ? "text-sm" : ""}`}>{res.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[res.type] ?? res.type}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 whitespace-nowrap ${STATUS_COLORS[res.status] ?? ""}`}
                      >
                        {STATUS_LABELS[res.status] ?? res.status}
                      </Badge>
                    </div>

                    {/* Skills / permits */}
                    {(res.skills && res.skills.length > 0) || (res.permits && res.permits.length > 0) ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(res.skills ?? []).map((s) => (
                          <span key={s} className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]">{s}</span>
                        ))}
                        {(res.permits ?? []).map((p) => (
                          <span key={p} className="rounded bg-accent text-accent-foreground px-1.5 py-0.5 text-[10px]">{p}</span>
                        ))}
                      </div>
                    ) : null}

                    {/* Companies */}
                    {res.companyIds.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {res.companyIds.map((cid) => (
                          <span key={cid} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {getCompanyName(cid)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
