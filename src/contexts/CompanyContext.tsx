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

const SIDEBAR_BG_KEY = "__sidebar_bg";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseHslString(hsl?: string): [number, number, number] | null {
  if (!hsl) return null;
  const parts = hsl.replace(/%/g, "").split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

function buildSidebarPaletteFromBackground(backgroundHsl: string) {
  const parsed = parseHslString(backgroundHsl);
  if (!parsed) return null;

  const [h, s, l] = parsed;
  const isDark = l < 45;

  return {
    "--sidebar-background": `${h} ${s}% ${l}%`,
    "--sidebar-foreground": isDark ? "210 40% 98%" : "222 47% 11%",
    "--sidebar-accent": `${h} ${clamp(s - 8, 8, 95)}% ${clamp(isDark ? l + 8 : l - 8, 4, 96)}%`,
    "--sidebar-accent-foreground": isDark ? "210 40% 98%" : "222 47% 11%",
    "--sidebar-border": `${h} ${clamp(s - 20, 6, 95)}% ${clamp(isDark ? l + 14 : l - 14, 4, 96)}%`,
    "--sidebar-muted": isDark ? `${h} ${clamp(s - 25, 5, 95)}% ${clamp(l + 24, 20, 90)}%` : "220 9% 46%",
    "--sidebar-primary": isDark ? "210 40% 98%" : "222 47% 11%",
    "--sidebar-primary-foreground": isDark ? "222 47% 11%" : "210 40% 98%",
  };
}

const globalCompany: Company = { id: "global", name: "Vue globale", shortName: "Global", color: "primary" };

const companyThemeOverrides: Record<string, Record<string, string>> = {
  primary: {
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

const fontScales: Record<string, string> = { compact: "14px", normal: "16px", large: "18px" };

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
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        await supabase.rpc("auto_assign_companies_for_new_user", { p_user_id: user.id });

        const [membershipsRes, themeRes] = await Promise.all([
          supabase.from("company_memberships").select("company_id").eq("profile_id", user.id),
          supabase.from("user_theme_settings").select("*").eq("user_id", user.id).maybeSingle(),
        ]);

        if (themeRes.data) {
          const ts = themeRes.data;
          setUserTheme((ts.company_colors as Record<string, string>) || {});
          setSidebarStyle(ts.sidebar_style || "default");

          if (ts.dark_mode) document.documentElement.classList.add("dark");
          else document.documentElement.classList.remove("dark");

          if (ts.border_radius) document.documentElement.style.setProperty("--radius", ts.border_radius);
          document.documentElement.style.fontSize = fontScales[ts.font_size] || "16px";
        }

        if (membershipsRes.data && membershipsRes.data.length > 0) {
          const companyIds = membershipsRes.data.map((m) => m.company_id);
          const { data: companiesData } = await supabase.from("companies").select("*").in("id", companyIds);

          if (companiesData) {
            setDbCompanies(
              companiesData.map((c) => ({
                id: c.id,
                name: c.name,
                shortName: c.short_name,
                color: c.color,
              })),
            );
          }
        }
      } catch (error) {
        console.error("Erreur chargement entreprises:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [user]);

  // Sync in-memory theme immediately after settings save
  useEffect(() => {
    const handler = (
      event: Event,
    ) => {
      const customEvent = event as CustomEvent<{
        companyColors?: Record<string, string>;
        sidebarStyle?: string;
        darkMode?: boolean;
        borderRadius?: string;
        fontSize?: string;
      }>;

      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.companyColors) setUserTheme(detail.companyColors);
      if (detail.sidebarStyle) setSidebarStyle(detail.sidebarStyle);

      if (typeof detail.darkMode === "boolean") {
        if (detail.darkMode) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
      }

      if (detail.borderRadius) document.documentElement.style.setProperty("--radius", detail.borderRadius);
      if (detail.fontSize) document.documentElement.style.fontSize = fontScales[detail.fontSize] || "16px";
    };

    window.addEventListener("theme-settings-updated", handler as EventListener);
    return () => window.removeEventListener("theme-settings-updated", handler as EventListener);
  }, []);

  const companies = [globalCompany, ...dbCompanies];
  const currentCompany = companies.find((c) => c.id === current) || globalCompany;

  useEffect(() => {
    const colorKey = currentCompany.color;
    const baseTheme = companyThemeOverrides[colorKey] || companyThemeOverrides.primary;
    const defaultTheme = companyThemeOverrides.primary;
    const root = document.documentElement;

    const userColor = userTheme[colorKey] || userTheme.primary;

    const theme = { ...baseTheme };
    if (userColor) {
      theme["--primary"] = userColor;
      theme["--ring"] = userColor;
    }

    if (sidebarStyle === "dark") {
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

    // Optional custom sidebar background (from appearance settings)
    const customSidebarBg = userTheme[SIDEBAR_BG_KEY];
    if (customSidebarBg) {
      const customPalette = buildSidebarPaletteFromBackground(customSidebarBg);
      if (customPalette) {
        Object.assign(theme, customPalette);
      }
    }

    const allKeys = new Set([...Object.keys(theme), ...Object.keys(defaultTheme)]);
    allKeys.forEach((key) => {
      if (theme[key]) root.style.setProperty(key, theme[key]);
      else root.style.removeProperty(key);
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



