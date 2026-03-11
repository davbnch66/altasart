import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

export interface EntrepriseResult {
  nom_complet: string;
  siren: string;
  activite_principale: string | null;
  siege: {
    siret: string;
    adresse: string | null;
    code_postal: string | null;
    commune: string | null;
  };
  nombre_etablissements: number;
  matching_etablissements?: Array<{
    siret: string;
    adresse: string | null;
    code_postal: string | null;
    commune: string | null;
  }>;
}

export function useSiretLookup() {
  const [siretLoading, setSiretLoading] = useState(false);
  const [nameResults, setNameResults] = useState<EntrepriseResult[]>([]);
  const [nameLoading, setNameLoading] = useState(false);
  const [showNameResults, setShowNameResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fillFromEntreprise = useCallback(
    (etab: EntrepriseResult, setValue: (field: string, value: any) => void, siretValue?: string) => {
      const siege = etab.siege || {} as any;
      const matchingEtab = siretValue
        ? etab.matching_etablissements?.find((e) => e.siret === siretValue) || siege
        : siege;

      if (etab.nom_complet) setValue("name", etab.nom_complet);
      if (etab.activite_principale) setValue("ape_naf", etab.activite_principale);
      setValue("siret", matchingEtab?.siret || siege.siret || "");

      // TVA
      const siren = etab.siren;
      if (siren) {
        const tvaKey = (12 + 3 * (parseInt(siren) % 97)) % 97;
        setValue("tva_intra", `FR${String(tvaKey).padStart(2, "0")}${siren}`);
      }

      const addr = matchingEtab || siege;
      if (addr.adresse) setValue("address", addr.adresse);
      if (addr.code_postal) setValue("postal_code", addr.code_postal);
      if (addr.commune) setValue("city", addr.commune);
      setValue("country", "France");

      setShowNameResults(false);
      toast.success(`Données pré-remplies pour ${etab.nom_complet}`);
    },
    []
  );

  const lookupSiret = useCallback(
    async (siretRaw: string, setValue: (field: string, value: any) => void) => {
      const siret = siretRaw.replace(/\s/g, "");
      if (siret.length !== 14) {
        toast.error("Le SIRET doit contenir 14 chiffres");
        return;
      }
      setSiretLoading(true);
      try {
        const res = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&mtm_campaign=lovable`
        );
        if (!res.ok) throw new Error("API indisponible");
        const data = await res.json();
        const etab = data.results?.[0];
        if (!etab) {
          toast.error("Aucune entreprise trouvée pour ce SIRET");
          return;
        }
        fillFromEntreprise(etab, setValue, siret);
      } catch (e: any) {
        toast.error(e.message || "Erreur lors de la recherche SIRET");
      } finally {
        setSiretLoading(false);
      }
    },
    [fillFromEntreprise]
  );

  const searchByName = useCallback((name: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setNameResults([]);
      setShowNameResults(false);
      return;
    }
    setNameLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(trimmed)}&per_page=8&mtm_campaign=lovable`
        );
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setNameResults(data.results || []);
        setShowNameResults((data.results || []).length > 0);
      } catch {
        setNameResults([]);
        setShowNameResults(false);
      } finally {
        setNameLoading(false);
      }
    }, 400);
  }, []);

  return {
    siretLoading,
    lookupSiret,
    nameResults,
    nameLoading,
    showNameResults,
    setShowNameResults,
    searchByName,
    fillFromEntreprise,
  };
}
