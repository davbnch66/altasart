import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";

export type AppRole = "admin" | "manager" | "commercial" | "exploitation" | "terrain" | "comptable" | "readonly";

/**
 * Returns the highest-privilege role of the current user across selected companies.
 * Priority: admin > manager > commercial > exploitation > comptable > terrain > readonly
 */
const ROLE_PRIORITY: Record<AppRole, number> = {
  admin: 7,
  manager: 6,
  commercial: 5,
  exploitation: 4,
  comptable: 3,
  terrain: 2,
  readonly: 1,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  commercial: "Commercial",
  exploitation: "Exploitation",
  comptable: "Comptable",
  terrain: "Terrain",
  readonly: "Lecture seule",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Accès complet : gestion des sociétés, membres, et toutes les fonctionnalités",
  manager: "Accès complet sauf gestion des utilisateurs",
  commercial: "Clients, Devis, Pipeline, Dossiers, Visites, Planning, Inbox",
  exploitation: "Dossiers, Visites, Planning, Terrain, Ressources, Flotte, Stockage",
  comptable: "Finance, Factures, Dossiers (lecture), Rentabilité",
  terrain: "Espace Terrain uniquement (BT du jour, visites, planning)",
  readonly: "Lecture seule sur l'ensemble de l'application",
};

/** Navigation items accessible per role */
export const ROLE_ALLOWED_ROUTES: Record<AppRole, string[]> = {
  admin: ["/", "/clients", "/pipeline", "/planning", "/dossiers", "/devis", "/visites", "/terrain", "/voirie", "/inbox", "/finance", "/rentabilite", "/flotte", "/stockage", "/ressources", "/fournisseurs", "/parametres"],
  manager: ["/", "/clients", "/pipeline", "/planning", "/dossiers", "/devis", "/visites", "/terrain", "/voirie", "/inbox", "/finance", "/rentabilite", "/flotte", "/stockage", "/ressources", "/fournisseurs", "/parametres"],
  commercial: ["/", "/clients", "/pipeline", "/planning", "/dossiers", "/devis", "/visites", "/voirie", "/inbox", "/parametres"],
  exploitation: ["/", "/planning", "/dossiers", "/visites", "/terrain", "/voirie", "/flotte", "/stockage", "/ressources", "/fournisseurs", "/parametres"],
  comptable: ["/", "/dossiers", "/finance", "/rentabilite", "/parametres"],
  terrain: ["/terrain"],
  readonly: ["/", "/clients", "/pipeline", "/planning", "/dossiers", "/devis", "/visites", "/voirie", "/inbox", "/finance", "/rentabilite", "/flotte", "/stockage", "/ressources", "/parametres"],
};

export function useMyRole(): { role: AppRole; loading: boolean; allRoles: AppRole[] } {
  const { user } = useAuth();
  const { current, dbCompanies } = useCompany();

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const { data, isLoading } = useQuery({
    queryKey: ["my-role", user?.id, companyIds],
    queryFn: async () => {
      if (!user || companyIds.length === 0) return [];
      const { data } = await supabase
        .from("company_memberships")
        .select("role")
        .eq("profile_id", user.id)
        .in("company_id", companyIds);
      return (data || []).map((m) => m.role as AppRole);
    },
    enabled: !!user && companyIds.length > 0,
    staleTime: 60_000,
  });

  const allRoles = data || [];
  const highestRole = allRoles.reduce<AppRole>((best, r) => {
    return (ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[best] ?? 0) ? r : best;
  }, "readonly");

  if (allRoles.length === 0 && user) {
    console.warn("Aucun rôle trouvé pour l'utilisateur", user.id, "— rôle readonly appliqué par défaut");
  }

  return { role: highestRole, loading: isLoading, allRoles };
}

/** Returns true if the given role can access the given route prefix */
export function canAccessRoute(role: AppRole, pathname: string): boolean {
  const allowed = ROLE_ALLOWED_ROUTES[role] ?? [];
  // exact match for "/"
  if (pathname === "/") return allowed.includes("/");
  return allowed.some((r) => r !== "/" && pathname.startsWith(r));
}
