import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CompanyId = string;

export interface Company {
  id: CompanyId;
  name: string;
  shortName: string;
  color: string;
}

// Static global entry
const globalCompany: Company = { id: "global", name: "Vue globale", shortName: "Global", color: "primary" };

interface CompanyContextType {
  current: CompanyId;
  setCurrent: (id: CompanyId) => void;
  currentCompany: Company;
  companies: Company[];
  dbCompanies: Company[];
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<CompanyId>("global");
  const [dbCompanies, setDbCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) { setLoading(false); return; }

      // Auto-assign memberships if needed (bypasses RLS via security definer)
      await supabase.rpc("auto_assign_companies_for_new_user", { p_user_id: user.id });

      // Now fetch companies the user is a member of
      const { data: memberships } = await supabase
        .from("company_memberships")
        .select("company_id")
        .eq("profile_id", user.id);

      if (memberships && memberships.length > 0) {
        const companyIds = memberships.map((m) => m.company_id);
        const { data: companiesData } = await supabase
          .from("companies")
          .select("*")
          .in("id", companyIds);

        if (companiesData) {
          setDbCompanies(companiesData.map((c) => ({
            id: c.id,
            name: c.name,
            shortName: c.short_name,
            color: c.color,
          })));
        }
      }
      setLoading(false);
    };

    fetchCompanies();
  }, [user]);

  const companies = [globalCompany, ...dbCompanies];
  const currentCompany = companies.find((c) => c.id === current) || globalCompany;

  return (
    <CompanyContext.Provider value={{ current, setCurrent, currentCompany, companies, dbCompanies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
};

// Helper: static companies for backward compat
export const companies = [
  globalCompany,
  { id: "a0000000-0000-0000-0000-000000000001", name: "ART Levage", shortName: "ART", color: "company-art" },
  { id: "a0000000-0000-0000-0000-000000000002", name: "Altigrues", shortName: "ALT", color: "company-altigrues" },
  { id: "a0000000-0000-0000-0000-000000000003", name: "ASDGM", shortName: "ASDGM", color: "company-asdgm" },
];
