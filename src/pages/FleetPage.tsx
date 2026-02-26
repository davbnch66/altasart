import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Truck, Wrench, Search, AlertTriangle, ShieldCheck, Calendar, Package, Camera, Plus } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResourceDetailSheet } from "@/components/ressources/ResourceDetailSheet";
import { CreateResourceDialog } from "@/components/ressources/CreateResourceDialog";
import { differenceInDays, format } from "date-fns";

const typeLabels: Record<string, string> = {
  grue: "Grue", vehicule: "Véhicule", equipement: "Équipement",
};

const statusLabels: Record<string, string> = {
  disponible: "Disponible", en_mission: "En mission", maintenance: "Maintenance",
  hors_service: "Hors service", occupe: "Occupé", absent: "Absent",
};

const statusStyles: Record<string, string> = {
  disponible: "bg-success/10 text-success border-success/20",
  en_mission: "bg-info/10 text-info border-info/20",
  occupe: "bg-warning/10 text-warning border-warning/20",
  maintenance: "bg-warning/10 text-warning border-warning/20",
  hors_service: "bg-destructive/10 text-destructive border-destructive/20",
  absent: "bg-muted text-muted-foreground",
};

const typeIcons: Record<string, typeof Truck> = {
  grue: Wrench, vehicule: Truck, equipement: Package,
};

function getAlerts(eq: any): string[] {
  if (!eq) return [];
  const alerts: string[] = [];
  const today = new Date();
  const check = (date: string | null, label: string) => {
    if (!date) return;
    const d = differenceInDays(new Date(date), today);
    if (d < 0) alerts.push(`${label} expirée`);
    else if (d < 30) alerts.push(`${label} dans ${d}j`);
  };
  check(eq.insurance_expiry, "Assurance");
  check(eq.technical_control_expiry, "CT");
  check(eq.vgp_expiry, "VGP");
  check(eq.next_maintenance_date, "Maintenance");
  return alerts;
}

const FleetPage = () => {
  const { companies, current, dbCompanies } = useCompany();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "grue" | "vehicule" | "equipement">("all");

  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  // Fetch resources of type grue/vehicule/equipement via resource_companies
  const { data: resourceLinks = [], isLoading } = useQuery({
    queryKey: ["fleet-resources", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("resource_companies")
        .select("resource_id, company_id, resources(*)")
        .in("company_id", companyIds);
      if (error) throw error;
      return (data || []).filter((l) => {
        const r = l.resources as any;
        return r && ["grue", "vehicule", "equipement"].includes(r.type);
      });
    },
    enabled: companyIds.length > 0,
  });

  // Fetch equipment details
  const { data: equipmentMap = {} } = useQuery({
    queryKey: ["fleet-equipment-map", companyIds],
    queryFn: async () => {
      const { data } = await supabase.from("resource_equipment").select("*");
      if (!data) return {};
      return Object.fromEntries(data.map((e) => [e.resource_id, e]));
    },
    enabled: companyIds.length > 0,
  });

  // Fetch first photo per resource
  const { data: photoMap = {} } = useQuery({
    queryKey: ["fleet-photos-map", companyIds],
    queryFn: async () => {
      const { data } = await supabase.from("resource_documents").select("resource_id, storage_path").eq("document_type", "photo").order("created_at", { ascending: true });
      if (!data) return {};
      const map: Record<string, string> = {};
      for (const d of data) { if (!map[d.resource_id]) map[d.resource_id] = d.storage_path; }
      return map;
    },
    enabled: companyIds.length > 0,
  });


  // Deduplicate resources
  const resourceMap = new Map<string, any>();
  for (const link of resourceLinks) {
    if (!link.resources) continue;
    const res = link.resources as any;
    if (resourceMap.has(res.id)) {
      resourceMap.get(res.id).companyIds.push(link.company_id);
    } else {
      resourceMap.set(res.id, { ...res, companyIds: [link.company_id] });
    }
  }
  const allResources = Array.from(resourceMap.values());

  const filtered = allResources.filter((r) => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.type?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || r.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getCompanyName = (id: string) => companies.find((c) => c.id === id)?.shortName ?? id;

  const counts = {
    all: allResources.length,
    grue: allResources.filter((r) => r.type === "grue").length,
    vehicule: allResources.filter((r) => r.type === "vehicule").length,
    equipement: allResources.filter((r) => r.type === "equipement").length,
  };

  const totalAlerts = allResources.reduce(
    (sum, r) => sum + getAlerts((equipmentMap as any)[r.id]).length, 0
  );

  const typeFilters = [
    { key: "all", label: "Tous", count: counts.all },
    { key: "grue", label: "Grues", count: counts.grue },
    { key: "vehicule", label: "Véhicules", count: counts.vehicule },
    { key: "equipement", label: "Équipements", count: counts.equipement },
  ] as const;

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Flotte & Engins</h1>
          {!isMobile && (
            <p className="text-muted-foreground mt-1">
              {allResources.length} engin{allResources.length !== 1 ? "s" : ""}
              {totalAlerts > 0 && ` — ${totalAlerts} alerte${totalAlerts > 1 ? "s" : ""}`}
              {" — Cliquez pour gérer"}
            </p>
          )}
        </div>
        <Button size={isMobile ? "sm" : "default"} onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {!isMobile && "Ajouter"}
        </Button>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                typeFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {f.label} <span className="opacity-60">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {allResources.length === 0 ? "Aucun engin — ajoutez-les depuis la page Ressources" : "Aucun résultat"}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`grid gap-3 ${isMobile ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}
        >
          {filtered.map((r) => {
            const Icon = typeIcons[r.type] ?? Truck;
            const eq = (equipmentMap as any)[r.id];
            const alerts = getAlerts(eq);
            const photoPath = (photoMap as any)[r.id];
            return (
              <div
                key={r.id}
                onClick={() => setSelectedResource(r)}
                className="rounded-xl border bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
              >
                {/* Photo banner or placeholder */}
                {photoPath ? (
                  <FleetPhotoThumb storagePath={photoPath} name={r.name} />
                ) : (
                  <div className="h-28 bg-muted/50 flex items-center justify-center border-b">
                    <Icon className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {typeLabels[r.type] ?? r.type}
                        {eq?.registration ? ` — ${eq.registration}` : ""}
                        {eq?.brand ? ` · ${eq.brand}` : ""}
                        {eq?.model ? ` ${eq.model}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {alerts.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 whitespace-nowrap ${statusStyles[r.status] ?? ""}`}>
                        {statusLabels[r.status] ?? r.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Specs */}
                  {eq && (eq.capacity_tons || eq.reach_meters || eq.height_meters || eq.daily_rate) && (
                    <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
                      {eq.capacity_tons && <span>{eq.capacity_tons}T</span>}
                      {eq.reach_meters && <span>{eq.reach_meters}m portée</span>}
                      {eq.height_meters && <span>{eq.height_meters}m</span>}
                      {eq.daily_rate && <span className="font-medium text-foreground">{eq.daily_rate}€/j</span>}
                    </div>
                  )}

                  {/* Alerts */}
                  {alerts.length > 0 && (
                    <div className="space-y-0.5">
                      {alerts.slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] text-warning">
                          <AlertTriangle className="h-2.5 w-2.5" />{a}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key dates */}
                  {eq && (eq.insurance_expiry || eq.technical_control_expiry || eq.vgp_expiry) && (
                    <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
                      {eq.insurance_expiry && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Ass. {format(new Date(eq.insurance_expiry), "dd/MM/yy")}</span>}
                      {eq.technical_control_expiry && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />CT {format(new Date(eq.technical_control_expiry), "dd/MM/yy")}</span>}
                      {eq.vgp_expiry && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />VGP {format(new Date(eq.vgp_expiry), "dd/MM/yy")}</span>}
                    </div>
                  )}

                  {/* Companies */}
                  {r.companyIds?.length > 0 && (
                    <div className="flex gap-1 flex-wrap pt-1 border-t">
                      {r.companyIds.map((cid: string) => (
                        <span key={cid} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{getCompanyName(cid)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {selectedResource && (
        <ResourceDetailSheet
          resource={selectedResource}
          open={!!selectedResource}
          onClose={() => setSelectedResource(null)}
          companies={companies}
        />
      )}

      <CreateResourceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        companyId={companyIds[0] ?? ""}
        defaultType="grue"
        allCompanies={dbCompanies.map((c: any) => ({ id: c.id, shortName: c.short_name || c.name }))}
      />
    </div>
  );
};

// Photo thumbnail fetched via Supabase Storage (signed blob)
function FleetPhotoThumb({ storagePath, name }: { storagePath: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string;
    supabase.storage.from("resource-documents").download(storagePath).then(({ data }) => {
      if (data) { objectUrl = URL.createObjectURL(data); setUrl(objectUrl); }
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [storagePath]);

  return (
    <div className="h-36 w-full overflow-hidden border-b bg-muted/50 flex items-center justify-center">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ) : (
        <Camera className="h-8 w-8 text-muted-foreground/30" />
      )}
    </div>
  );
}

export default FleetPage;

