import { useState, useEffect, useCallback } from "react";
import { Palette, Sun, Moon, Monitor, Type, Square, Loader2, Save, RotateCcw, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

// ─── HSL helpers ──────────────────────────────────────────────────────────────
function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function parseHslString(hsl: string): [number, number, number] {
  const parts = hsl.replace(/%/g, "").split(/\s+/).map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function hslStr(h: number, s: number, l: number) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ─── Sidebar theme maps ──────────────────────────────────────────────────────
const COMPANY_SIDEBAR_COLORS: Record<string, Record<string, string>> = {
  "company-art": {
    "--sidebar-background": "24 40% 12%",
    "--sidebar-foreground": "220 20% 80%",
    "--sidebar-accent": "24 35% 18%",
    "--sidebar-accent-foreground": "210 40% 98%",
    "--sidebar-border": "24 30% 20%",
    "--sidebar-muted": "220 15% 50%",
    "--sidebar-primary": "210 40% 98%",
    "--sidebar-primary-foreground": "222 47% 11%",
  },
  "company-altigrues": {
    "--sidebar-background": "205 45% 12%",
    "--sidebar-foreground": "220 20% 80%",
    "--sidebar-accent": "205 35% 18%",
    "--sidebar-accent-foreground": "210 40% 98%",
    "--sidebar-border": "205 30% 20%",
    "--sidebar-muted": "220 15% 50%",
    "--sidebar-primary": "210 40% 98%",
    "--sidebar-primary-foreground": "222 47% 11%",
  },
  "company-asdgm": {
    "--sidebar-background": "152 35% 12%",
    "--sidebar-foreground": "220 20% 80%",
    "--sidebar-accent": "152 28% 18%",
    "--sidebar-accent-foreground": "210 40% 98%",
    "--sidebar-border": "152 25% 20%",
    "--sidebar-muted": "220 15% 50%",
    "--sidebar-primary": "210 40% 98%",
    "--sidebar-primary-foreground": "222 47% 11%",
  },
};

const DARK_SIDEBAR = {
  "--sidebar-background": "222 47% 11%",
  "--sidebar-foreground": "220 20% 80%",
  "--sidebar-accent": "222 40% 18%",
  "--sidebar-accent-foreground": "210 40% 98%",
  "--sidebar-border": "222 30% 20%",
  "--sidebar-muted": "220 15% 50%",
  "--sidebar-primary": "210 40% 98%",
  "--sidebar-primary-foreground": "222 47% 11%",
};

const LIGHT_SIDEBAR = {
  "--sidebar-background": "220 20% 97%",
  "--sidebar-foreground": "222 47% 11%",
  "--sidebar-accent": "220 14% 90%",
  "--sidebar-accent-foreground": "222 47% 11%",
  "--sidebar-border": "220 13% 91%",
  "--sidebar-muted": "220 9% 46%",
  "--sidebar-primary": "222 47% 11%",
  "--sidebar-primary-foreground": "210 40% 98%",
};

const SIDEBAR_KEYS = Object.keys(DARK_SIDEBAR);

// ─── Presets ──────────────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  { name: "Bleu marine", hsl: "222 60% 28%" },
  { name: "Orange", hsl: "24 95% 53%" },
  { name: "Bleu ciel", hsl: "205 85% 50%" },
  { name: "Vert", hsl: "152 69% 40%" },
  { name: "Violet", hsl: "262 52% 47%" },
  { name: "Rouge", hsl: "0 72% 51%" },
  { name: "Rose", hsl: "330 80% 55%" },
  { name: "Indigo", hsl: "240 60% 50%" },
];

const RADIUS_OPTIONS = [
  { value: "0", label: "Aucun" },
  { value: "0.25rem", label: "Léger" },
  { value: "0.5rem", label: "Normal" },
  { value: "0.75rem", label: "Arrondi" },
  { value: "1rem", label: "Très arrondi" },
];

const FONT_SIZE_OPTIONS = [
  { value: "compact", label: "Compact", scale: "0.875" },
  { value: "normal", label: "Normal", scale: "1" },
  { value: "large", label: "Grand", scale: "1.125" },
];

const DEFAULT_COMPANY_COLORS: Record<string, string> = {
  "company-art": "24 95% 53%",
  "company-altigrues": "205 85% 50%",
  "company-asdgm": "152 69% 40%",
};

interface ThemeSettings {
  darkMode: boolean;
  borderRadius: string;
  fontSize: string;
  companyColors: Record<string, string>;
  sidebarStyle: string;
}

const DEFAULT_SETTINGS: ThemeSettings = {
  darkMode: false,
  borderRadius: "0.5rem",
  fontSize: "normal",
  companyColors: {},
  sidebarStyle: "default",
};

// ─── Color Swatch Button ─────────────────────────────────────────────────────
function ColorSwatch({ hsl, active, onClick, label }: { hsl: string; active: boolean; onClick: () => void; label: string }) {
  const [h, s, l] = parseHslString(hsl);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 ${active ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background" : "border-transparent"}`}
      style={{ backgroundColor: hslStr(h, s, l) }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function AppearanceSettingsTab() {
  const { user } = useAuth();
  const { dbCompanies, currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Fetch saved settings
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["user-theme-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_theme_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        darkMode: savedSettings.dark_mode,
        borderRadius: savedSettings.border_radius,
        fontSize: savedSettings.font_size,
        companyColors: (savedSettings.company_colors as Record<string, string>) || {},
        sidebarStyle: savedSettings.sidebar_style,
      });
      setDirty(false);
    }
  }, [savedSettings]);

  const updateSetting = useCallback(<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  // ─── Apply sidebar CSS vars based on style ────────────────────────────────
  const applySidebarVars = useCallback((style: string, companyColor: string) => {
    const root = document.documentElement;
    let vars: Record<string, string>;

    if (style === "light") {
      vars = LIGHT_SIDEBAR;
    } else if (style === "dark") {
      vars = DARK_SIDEBAR;
    } else {
      // "default" = company-colored
      vars = COMPANY_SIDEBAR_COLORS[companyColor] || DARK_SIDEBAR;
    }

    SIDEBAR_KEYS.forEach((key) => {
      root.style.setProperty(key, vars[key] || "");
    });
  }, []);

  // ─── Live preview: apply all settings to DOM ──────────────────────────────
  useEffect(() => {
    const root = document.documentElement;

    // Dark mode
    if (settings.darkMode) root.classList.add("dark");
    else root.classList.remove("dark");

    // Border radius
    root.style.setProperty("--radius", settings.borderRadius);

    // Font size
    const scale = FONT_SIZE_OPTIONS.find((f) => f.value === settings.fontSize)?.scale || "1";
    root.style.fontSize = `${parseFloat(scale) * 16}px`;

    // Primary color from company colors
    const colorKey = currentCompany.color;
    const customColor = settings.companyColors[colorKey] || settings.companyColors["primary"];
    if (customColor) {
      root.style.setProperty("--primary", customColor);
      root.style.setProperty("--ring", customColor);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    }

    // Sidebar style
    applySidebarVars(settings.sidebarStyle, colorKey);

    return () => {
      root.style.fontSize = "";
    };
  }, [settings, currentCompany.color, applySidebarVars]);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const saveSettings = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        dark_mode: settings.darkMode,
        border_radius: settings.borderRadius,
        font_size: settings.fontSize,
        company_colors: settings.companyColors,
        sidebar_style: settings.sidebarStyle,
      };

      const { error } = await supabase
        .from("user_theme_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      toast.success("Préférences d'apparence sauvegardées");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["user-theme-settings"] });
      return true;
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, settings, queryClient]);

  // ─── Unsaved changes guard ────────────────────────────────────────────────
  const { isBlocked, proceed, reset, saveAndProceed } = useUnsavedChangesGuard(dirty, saveSettings);

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setDirty(true);
    document.documentElement.classList.remove("dark");
    document.documentElement.style.setProperty("--radius", "0.5rem");
    document.documentElement.style.fontSize = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Compute preview sidebar color
  const previewSidebarBg = (() => {
    let bgHsl: string;
    if (settings.sidebarStyle === "light") bgHsl = LIGHT_SIDEBAR["--sidebar-background"];
    else if (settings.sidebarStyle === "dark") bgHsl = DARK_SIDEBAR["--sidebar-background"];
    else bgHsl = (COMPANY_SIDEBAR_COLORS[currentCompany.color] || DARK_SIDEBAR)["--sidebar-background"];
    const [h, s, l] = parseHslString(bgHsl);
    return hslStr(h, s, l);
  })();

  const previewSidebarFg = (() => {
    let fgHsl: string;
    if (settings.sidebarStyle === "light") fgHsl = LIGHT_SIDEBAR["--sidebar-foreground"];
    else if (settings.sidebarStyle === "dark") fgHsl = DARK_SIDEBAR["--sidebar-foreground"];
    else fgHsl = (COMPANY_SIDEBAR_COLORS[currentCompany.color] || DARK_SIDEBAR)["--sidebar-foreground"];
    const [h, s, l] = parseHslString(fgHsl);
    return hslStr(h, s, l);
  })();

  const previewSidebarAccent = (() => {
    let val: string;
    if (settings.sidebarStyle === "light") val = LIGHT_SIDEBAR["--sidebar-accent"];
    else if (settings.sidebarStyle === "dark") val = DARK_SIDEBAR["--sidebar-accent"];
    else val = (COMPANY_SIDEBAR_COLORS[currentCompany.color] || DARK_SIDEBAR)["--sidebar-accent"];
    const [h, s, l] = parseHslString(val);
    return hslStr(h, s, l);
  })();

  return (
    <div className="space-y-6">
      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        open={isBlocked}
        onStay={reset}
        onDiscard={proceed}
        onSave={saveAndProceed}
        saving={saving}
      />

      {/* Header with save/reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Apparence & Design</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={resetToDefaults}>
            <RotateCcw className="h-3 w-3" /> Réinitialiser
          </Button>
          <Button size="sm" className="text-xs gap-1.5" onClick={saveSettings} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Dark mode */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          {settings.darkMode ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          <h3 className="text-sm font-semibold">Mode d'affichage</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
            <button
              onClick={() => updateSetting("darkMode", false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!settings.darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Sun className="h-3 w-3" /> Clair
            </button>
            <button
              onClick={() => updateSetting("darkMode", true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${settings.darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Moon className="h-3 w-3" /> Sombre
            </button>
          </div>
        </div>
      </div>

      {/* Company Colors */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Couleurs par société</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Personnalisez la couleur principale de chaque société. Elle s'applique automatiquement à toute l'interface lorsque vous changez de contexte.
        </p>

        {dbCompanies.map((company) => {
          const colorKey = company.color;
          const currentHsl = settings.companyColors[colorKey] || DEFAULT_COMPANY_COLORS[colorKey] || "222 60% 28%";
          const [h, s, l] = parseHslString(currentHsl);
          const hexColor = hslToHex(h, s, l);

          return (
            <div key={company.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: hslStr(h, s, l) }} />
                <span className="text-sm font-medium">{company.name}</span>
                <Badge variant="outline" className="text-[10px]">{company.shortName}</Badge>
              </div>

              {/* Preset swatches */}
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <ColorSwatch
                    key={preset.hsl}
                    hsl={preset.hsl}
                    label={preset.name}
                    active={currentHsl === preset.hsl}
                    onClick={() => {
                      updateSetting("companyColors", { ...settings.companyColors, [colorKey]: preset.hsl });
                    }}
                  />
                ))}
              </div>

              {/* Custom color picker */}
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground shrink-0">Couleur personnalisée</Label>
                <input
                  type="color"
                  value={hexColor}
                  onChange={(e) => {
                    const [h2, s2, l2] = hexToHsl(e.target.value);
                    updateSetting("companyColors", { ...settings.companyColors, [colorKey]: `${h2} ${s2}% ${l2}%` });
                  }}
                  className="h-8 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <span className="text-[10px] text-muted-foreground font-mono">{hexColor}</span>
              </div>
            </div>
          );
        })}

        {/* Global / default color */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            {(() => {
              const [gh, gs, gl] = parseHslString(settings.companyColors["primary"] || "222 60% 28%");
              return <div className="h-4 w-4 rounded-full" style={{ backgroundColor: hslStr(gh, gs, gl) }} />;
            })()}
            <span className="text-sm font-medium">Vue globale</span>
            <Badge variant="outline" className="text-[10px]">Par défaut</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => {
              const curGlobal = settings.companyColors["primary"] || "222 60% 28%";
              return (
                <ColorSwatch
                  key={preset.hsl}
                  hsl={preset.hsl}
                  label={preset.name}
                  active={curGlobal === preset.hsl}
                  onClick={() => {
                    updateSetting("companyColors", { ...settings.companyColors, primary: preset.hsl });
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground shrink-0">Couleur personnalisée</Label>
            {(() => {
              const gHsl = settings.companyColors["primary"] || "222 60% 28%";
              const [gh, gs, gl] = parseHslString(gHsl);
              const gHex = hslToHex(gh, gs, gl);
              return (
                <>
                  <input
                    type="color"
                    value={gHex}
                    onChange={(e) => {
                      const [h2, s2, l2] = hexToHsl(e.target.value);
                      updateSetting("companyColors", { ...settings.companyColors, primary: `${h2} ${s2}% ${l2}%` });
                    }}
                    className="h-8 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
                  />
                  <span className="text-[10px] text-muted-foreground font-mono">{gHex}</span>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Border Radius */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Square className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Coins arrondis</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateSetting("borderRadius", opt.value)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border transition-all ${settings.borderRadius === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
              style={{ borderRadius: opt.value || "0" }}
            >
              <div className="h-4 w-4 border-2 border-current" style={{ borderRadius: opt.value || "0" }} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Taille du texte</h3>
        </div>
        <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5 w-fit">
          {FONT_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateSetting("fontSize", opt.value)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${settings.fontSize === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {settings.fontSize === "compact" ? "Interface dense, idéale pour les écrans larges." :
           settings.fontSize === "large" ? "Texte agrandi pour une meilleure lisibilité." :
           "Taille standard recommandée."}
        </p>
      </div>

      {/* Sidebar Style */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Style de la sidebar</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { value: "default", label: "Colorée", desc: "La sidebar prend la teinte de la société" },
            { value: "dark", label: "Sombre fixe", desc: "Sidebar toujours sombre quelle que soit la société" },
            { value: "light", label: "Claire", desc: "Sidebar avec fond clair" },
          ].map((style) => (
            <button
              key={style.value}
              onClick={() => updateSetting("sidebarStyle", style.value)}
              className={`flex-1 min-w-[140px] rounded-lg border p-3 text-left transition-all ${settings.sidebarStyle === style.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}
            >
              <span className="text-xs font-medium">{style.label}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview Box */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Aperçu</h3>
        
        {/* Mini app preview */}
        <div className="rounded-lg border overflow-hidden" style={{ height: 160 }}>
          <div className="flex h-full">
            {/* Sidebar preview */}
            <div
              className="w-[180px] shrink-0 flex flex-col p-3 gap-1.5"
              style={{ backgroundColor: previewSidebarBg, color: previewSidebarFg }}
            >
              <div className="text-[10px] font-bold mb-1 opacity-80">MENU</div>
              {["Tableau de bord", "Clients", "Devis", "Planning"].map((item, i) => (
                <div
                  key={item}
                  className="text-[10px] px-2 py-1 rounded"
                  style={i === 0 ? { backgroundColor: previewSidebarAccent } : undefined}
                >
                  {item}
                </div>
              ))}
            </div>
            {/* Content preview */}
            <div className="flex-1 p-3 space-y-3" style={{ backgroundColor: settings.darkMode ? "hsl(222, 47%, 6%)" : "hsl(220, 20%, 97%)" }}>
              <div className="flex gap-2 items-center">
                <Button size="sm" className="h-6 text-[10px] px-2">Principal</Button>
                <Button variant="secondary" size="sm" className="h-6 text-[10px] px-2">Secondaire</Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2">Contour</Button>
                <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2">Suppr.</Button>
              </div>
              <div className="flex gap-2 items-center">
                <Badge className="text-[9px]">Badge</Badge>
                <Badge variant="outline" className="text-[9px]">Outline</Badge>
              </div>
              <div className="flex gap-2 items-center">
                <div className="h-6 w-6 rounded bg-primary" />
                <div className="h-6 w-6 rounded bg-secondary" />
                <div className="h-6 w-6 rounded bg-muted" />
                <div className="h-6 w-6 rounded bg-accent" />
                <div className="h-6 w-6 rounded bg-destructive" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
