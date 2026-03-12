import { useState, useEffect, useCallback } from "react";
import { Palette, Sun, Moon, Monitor, Type, Square, Loader2, Save, RotateCcw, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

// ─── Default company colors from the system ──────────────────────────────────
const DEFAULT_COMPANY_COLORS: Record<string, string> = {
  "company-art": "24 95% 53%",
  "company-altigrues": "205 85% 50%",
  "company-asdgm": "152 69% 40%",
};

interface ThemeSettings {
  darkMode: boolean;
  borderRadius: string;
  fontSize: string;
  companyColors: Record<string, string>; // company color key -> HSL string
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
      style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function AppearanceSettingsTab() {
  const { user } = useAuth();
  const { dbCompanies } = useCompany();
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
    }
  }, [savedSettings]);

  const updateSetting = useCallback(<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  // Live preview: apply changes immediately
  useEffect(() => {
    const root = document.documentElement;

    // Dark mode
    if (settings.darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Border radius
    root.style.setProperty("--radius", settings.borderRadius);

    // Font size
    const scale = FONT_SIZE_OPTIONS.find((f) => f.value === settings.fontSize)?.scale || "1";
    root.style.fontSize = `${parseFloat(scale) * 16}px`;

    return () => {
      root.style.fontSize = "";
    };
  }, [settings.darkMode, settings.borderRadius, settings.fontSize]);

  const saveSettings = async () => {
    if (!user) return;
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
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="space-y-6">
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
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }} />
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
            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: `hsl(${parseHslString(settings.companyColors["primary"] || "222 60% 28%").join(", ").replace(/,/g, (_, i) => i ? "%" : "").replace(",", ", ").replace(",", "%, ")})` }} />
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
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Aperçu</h3>
        <div className="flex gap-3 items-center flex-wrap">
          <Button size="sm">Bouton principal</Button>
          <Button variant="secondary" size="sm">Secondaire</Button>
          <Button variant="outline" size="sm">Contour</Button>
          <Button variant="destructive" size="sm">Supprimer</Button>
          <Badge>Badge</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <div className="flex gap-3 items-center">
          <div className="h-10 w-10 rounded-lg bg-primary" />
          <div className="h-10 w-10 rounded-lg bg-secondary" />
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="h-10 w-10 rounded-lg bg-accent" />
          <div className="h-10 w-10 rounded-lg bg-destructive" />
        </div>
      </div>
    </div>
  );
}
