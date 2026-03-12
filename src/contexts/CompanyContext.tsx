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

// Map company color keys to CSS variable overrides
const companyThemeOverrides: Record<string, Record<string, string>> = {
  "primary": {
    "--primary": "222 60% 28%",
    "--ring": "222 60% 28%",
  },
  "company-art": {
    "--primary": "24 95% 53%",
    "--ring": "24 95% 53%",
    "--sidebar-background": "24 40% 12%",
    "--sidebar-accent": "24 35% 18%",
    "--sidebar-border": "24 30% 20%",
  },
  "company-altigrues": {
    "--primary": "205 85% 50%",
    "--ring": "205 85% 50%",
    "--sidebar-background": "205 45% 12%",
    "--sidebar-accent": "205 35% 18%",
    "--sidebar-border": "205 30% 20%",
  },
  "company-asdgm": {
    "--primary": "152 69% 40%",
    "--ring": "152 69% 40%",
    "--sidebar-background": "152 35% 12%",
    "--sidebar-accent": "152 28% 18%",
    "--sidebar-border": "152 25% 20%",
  },
};

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

  // Apply company theme to CSS custom properties
  useEffect(() => {
    const theme = companyThemeOverrides[currentCompany.color] || companyThemeOverrides["primary"];
    const defaultTheme = companyThemeOverrides["primary"];
    const root = document.documentElement;

    // Apply all overrides from selected theme
    const allKeys = new Set([...Object.keys(theme), ...Object.keys(defaultTheme)]);
    allKeys.forEach((key) => {
      if (theme[key]) {
        root.style.setProperty(key, theme[key]);
      } else {
        // Reset to default if this theme doesn't override it
        root.style.removeProperty(key);
      }
    });

    return () => {
      allKeys.forEach((key) => root.style.removeProperty(key));
    };
  }, [currentCompany.color]);

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
