import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wrench, CheckCircle2, AlertTriangle, XCircle, Gauge } from "lucide-react";

interface LiftingCalculatorProps {
  chargeKg: number | null;
  heightM: number | null;
  reachM: number | null;
  onChangeCharge: (v: number | null) => void;
  onChangeHeight: (v: number | null) => void;
  onChangeReach: (v: number | null) => void;
  onComplexityChange?: (score: number) => void;
}

interface CraneMatch {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  capacityTons: number | null;
  heightMeters: number | null;
  reachMeters: number | null;
  loadRate: number; // % of capacity used
  status: string;
}

export function LiftingCalculator({
  chargeKg, heightM, reachM,
  onChangeCharge, onChangeHeight, onChangeReach,
  onComplexityChange,
}: LiftingCalculatorProps) {
  const { current, dbCompanies } = useCompany();
  const companyIds = current === "global" ? dbCompanies.map(c => c.id) : [current];

  // Fetch all cranes from resource_equipment joined with resources
  const { data: cranes = [] } = useQuery({
    queryKey: ["crane-fleet", companyIds],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("resource_companies")
        .select("resource_id, resources(id, name, type, status)")
        .in("company_id", companyIds);

      const grueIds = (links || [])
        .filter((l: any) => l.resources?.type === "grue")
        .map((l: any) => l.resources.id);

      if (grueIds.length === 0) return [];

      const { data: equipment } = await supabase
        .from("resource_equipment")
        .select("*")
        .in("resource_id", grueIds);

      return (links || [])
        .filter((l: any) => l.resources?.type === "grue")
        .map((l: any) => {
          const eq = (equipment || []).find((e: any) => e.resource_id === l.resources.id);
          return {
            id: l.resources.id,
            name: l.resources.name,
            status: l.resources.status,
            brand: eq?.brand || null,
            model: eq?.model || null,
            capacityTons: eq?.capacity_tons || null,
            heightMeters: eq?.height_meters || null,
            reachMeters: eq?.reach_meters || null,
          };
        });
    },
    enabled: companyIds.length > 0,
  });

  // Match cranes
  const matches: CraneMatch[] = useMemo(() => {
    if (!chargeKg || chargeKg <= 0) return [];
    const chargeTons = chargeKg / 1000;

    return cranes
      .filter((c: any) => {
        if (!c.capacityTons || c.capacityTons <= 0) return false;
        if (c.capacityTons < chargeTons) return false;
        if (heightM && c.heightMeters && c.heightMeters < heightM) return false;
        if (reachM && c.reachMeters && c.reachMeters < reachM) return false;
        return true;
      })
      .map((c: any) => ({
        ...c,
        loadRate: Math.round((chargeTons / c.capacityTons) * 100),
      }))
      .sort((a: CraneMatch, b: CraneMatch) => a.loadRate - b.loadRate);
  }, [cranes, chargeKg, heightM, reachM]);

  // Complexity score calculation
  const complexityScore = useMemo(() => {
    let score = 1;
    if (!chargeKg) return 0;

    // Weight factor
    if (chargeKg > 5000) score += 3;
    else if (chargeKg > 2000) score += 2;
    else if (chargeKg > 500) score += 1;

    // Height factor
    if (heightM) {
      if (heightM > 30) score += 3;
      else if (heightM > 15) score += 2;
      else if (heightM > 8) score += 1;
    }

    // Reach factor
    if (reachM) {
      if (reachM > 20) score += 2;
      else if (reachM > 10) score += 1;
    }

    // Few cranes available = more complex
    if (chargeKg > 0 && matches.length === 0) score += 2;
    else if (matches.length === 1) score += 1;

    return Math.min(10, score);
  }, [chargeKg, heightM, reachM, matches.length]);

  useEffect(() => {
    if (complexityScore > 0) onComplexityChange?.(complexityScore);
  }, [complexityScore, onComplexityChange]);

  const getLoadColor = (rate: number) => {
    if (rate < 50) return "text-success";
    if (rate < 80) return "text-warning";
    return "text-destructive";
  };

  const getLoadIcon = (rate: number) => {
    if (rate < 50) return CheckCircle2;
    if (rate < 80) return AlertTriangle;
    return XCircle;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Charge (kg)</Label>
          <Input
            type="number"
            value={chargeKg ?? ""}
            onChange={e => onChangeCharge(e.target.value ? Number(e.target.value) : null)}
            placeholder="350"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Hauteur (m)</Label>
          <Input
            type="number"
            value={heightM ?? ""}
            onChange={e => onChangeHeight(e.target.value ? Number(e.target.value) : null)}
            placeholder="25"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Déport (m)</Label>
          <Input
            type="number"
            value={reachM ?? ""}
            onChange={e => onChangeReach(e.target.value ? Number(e.target.value) : null)}
            placeholder="8"
          />
        </div>
      </div>

      {/* Complexity score */}
      {complexityScore > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Score complexité :</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`h-3 w-2 rounded-sm ${
                  i < complexityScore
                    ? complexityScore <= 3 ? "bg-success" : complexityScore <= 6 ? "bg-warning" : "bg-destructive"
                    : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <span className={`text-xs font-bold ${complexityScore <= 3 ? "text-success" : complexityScore <= 6 ? "text-warning" : "text-destructive"}`}>
            {complexityScore}/10
          </span>
        </div>
      )}

      {/* Crane matches */}
      {chargeKg && chargeKg > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-primary" />
            Grues compatibles ({matches.length}/{cranes.length})
          </p>
          {matches.length === 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Aucune grue du parc ne correspond aux critères. Envisagez une location externe.
            </div>
          ) : (
            <div className="space-y-1.5">
              {matches.map(crane => {
                const Icon = getLoadIcon(crane.loadRate);
                return (
                  <div key={crane.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5 text-xs">
                    <div className="rounded bg-muted p-1.5">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{crane.name}</p>
                      <p className="text-muted-foreground">
                        {crane.brand && `${crane.brand} `}{crane.model || ""}
                        {" · "}{crane.capacityTons}T · {crane.heightMeters}m · {crane.reachMeters}m
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Icon className={`h-3.5 w-3.5 ${getLoadColor(crane.loadRate)}`} />
                      <span className={`font-bold ${getLoadColor(crane.loadRate)}`}>{crane.loadRate}%</span>
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-semibold ${crane.status === "disponible" ? "text-success" : "text-warning"}`}>
                        {crane.status === "disponible" ? "Dispo" : crane.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
