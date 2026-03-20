import { useState, useEffect } from "react";
import { Bell, Mail, Users, CalendarDays, FileCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Prefs {
  new_email: boolean;
  email_action_suggested: boolean;
  new_client: boolean;
  visite_reminder: boolean;
  devis_signed: boolean;
  popup_new_email: boolean;
  popup_email_action: boolean;
  popup_new_client: boolean;
  popup_visite_reminder: boolean;
  popup_devis_signed: boolean;
}

const defaultPrefs: Prefs = {
  new_email: true,
  email_action_suggested: true,
  new_client: true,
  visite_reminder: true,
  devis_signed: true,
  popup_new_email: true,
  popup_email_action: false,
  popup_new_client: true,
  popup_visite_reminder: false,
  popup_devis_signed: true,
};

const SETTINGS = [
  { key: "new_email", popupKey: "popup_new_email", label: "Nouvel email reçu", desc: "Notification à la réception d'un email", icon: Mail },
  { key: "email_action_suggested", popupKey: "popup_email_action", label: "Action IA suggérée", desc: "Quand l'IA suggère une action sur un email", icon: Bell },
  { key: "new_client", popupKey: "popup_new_client", label: "Nouveau client", desc: "Création automatique d'un client", icon: Users },
  { key: "visite_reminder", popupKey: "popup_visite_reminder", label: "Rappel de visite", desc: "Visite technique à venir", icon: CalendarDays },
  { key: "devis_signed", popupKey: "popup_devis_signed", label: "Devis signé", desc: "Quand un client signe un devis", icon: FileCheck },
] as const;

export const NotificationSettingsTab = () => {
  const { user } = useAuth();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  const companyId = current === "global" ? dbCompanies[0]?.id : current;

  const { data: savedPrefs, isLoading } = useQuery({
    queryKey: ["notification-preferences", user?.id, companyId],
    queryFn: async () => {
      if (!user || !companyId) return null;
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!companyId,
  });

  useEffect(() => {
    if (savedPrefs) {
      setPrefs({
        new_email: savedPrefs.new_email,
        email_action_suggested: savedPrefs.email_action_suggested,
        new_client: savedPrefs.new_client,
        visite_reminder: savedPrefs.visite_reminder,
        devis_signed: savedPrefs.devis_signed,
        popup_new_email: savedPrefs.popup_new_email,
        popup_email_action: savedPrefs.popup_email_action,
        popup_new_client: savedPrefs.popup_new_client,
        popup_visite_reminder: savedPrefs.popup_visite_reminder,
        popup_devis_signed: savedPrefs.popup_devis_signed,
      });
    }
  }, [savedPrefs]);

  const save = async (newPrefs: Prefs) => {
    if (!user || !companyId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        company_id: companyId,
        ...newPrefs,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "user_id,company_id" });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    } catch (e: any) {
      toast.error("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof Prefs) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    save(newPrefs);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Préférences de notifications</h2>
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        </div>
        <p className="text-xs text-muted-foreground">
          Choisissez quelles notifications recevoir et lesquelles afficher en pop-up en temps réel.
        </p>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {SETTINGS.map(({ key, popupKey, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center gap-4 px-5 py-4">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex flex-col items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Notif</Label>
                <Switch
                  checked={prefs[key as keyof Prefs]}
                  onCheckedChange={() => toggle(key as keyof Prefs)}
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Pop-up</Label>
                <Switch
                  checked={prefs[popupKey as keyof Prefs]}
                  onCheckedChange={() => toggle(popupKey as keyof Prefs)}
                  disabled={!prefs[key as keyof Prefs]}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Les pop-ups apparaissent en haut à droite pendant 8 secondes avec des boutons d'action rapide.
      </p>
    </div>
  );
};
