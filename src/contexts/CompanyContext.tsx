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
  const [userTheme, setUserTheme] = useState<Record<string, string>>({});
  const [sidebarStyle, setSidebarStyle] = useState("default");
  const { user } = useAuth();

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) { setLoading(false); return; }

      // Auto-assign memberships if needed (bypasses RLS via security definer)
      await supabase.rpc("auto_assign_companies_for_new_user", { p_user_id: user.id });

      // Fetch companies + theme settings in parallel
      const [membershipsRes, themeRes] = await Promise.all([
        supabase.from("company_memberships").select("company_id").eq("profile_id", user.id),
        supabase.from("user_theme_settings").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      // Apply saved theme settings
      if (themeRes.data) {
        const ts = themeRes.data;
        setUserTheme((ts.company_colors as Record<string, string>) || {});
        setSidebarStyle(ts.sidebar_style || "default");

        // Apply dark mode
        if (ts.dark_mode) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");

        // Apply border radius
        if (ts.border_radius) document.documentElement.style.setProperty("--radius", ts.border_radius);

        // Apply font size
        const fontScales: Record<string, string> = { compact: "14px", normal: "16px", large: "18px" };
        document.documentElement.style.fontSize = fontScales[ts.font_size] || "16px";
      }

      if (membershipsRes.data && membershipsRes.data.length > 0) {
        const companyIds = membershipsRes.data.map((m) => m.company_id);
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
    // Build theme: start with defaults, then apply user overrides
    const colorKey = currentCompany.color;
    const baseTheme = companyThemeOverrides[colorKey] || companyThemeOverrides["primary"];
    const defaultTheme = companyThemeOverrides["primary"];
    const root = document.documentElement;

    // Check if user has a custom color for this company
    const userColor = userTheme[colorKey] || userTheme["primary"];

    // Build the final theme
    const theme = { ...baseTheme };
    if (userColor) {
      theme["--primary"] = userColor;
      theme["--ring"] = userColor;
    }

    // Handle sidebar style override
    if (sidebarStyle === "dark") {
      // Always use default dark sidebar
      delete theme["--sidebar-background"];
      delete theme["--sidebar-accent"];
      delete theme["--sidebar-border"];
    } else if (sidebarStyle === "light") {
      theme["--sidebar-background"] = "220 20% 97%";
      theme["--sidebar-foreground"] = "222 47% 11%";
      theme["--sidebar-accent"] = "220 14% 90%";
      theme["--sidebar-accent-foreground"] = "222 47% 11%";
      theme["--sidebar-border"] = "220 13% 91%";
      theme["--sidebar-muted"] = "220 9% 46%";
      theme["--sidebar-primary"] = "222 47% 11%";
      theme["--sidebar-primary-foreground"] = "210 40% 98%";
    }
    // "default" keeps the per-company sidebar colors

    // Apply all overrides
    const allKeys = new Set([...Object.keys(theme), ...Object.keys(defaultTheme)]);
    allKeys.forEach((key) => {
      if (theme[key]) {
        root.style.setProperty(key, theme[key]);
      } else {
        root.style.removeProperty(key);
      }
    });

    return () => {
      allKeys.forEach((key) => root.style.removeProperty(key));
    };
  }, [currentCompany.color, userTheme, sidebarStyle]);

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
