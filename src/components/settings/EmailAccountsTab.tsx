import { useState, useEffect, useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, TestTube, Loader2, Mail, Server, Lock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

type EmailAccount = {
  id: string;
  company_id: string;
  label: string;
  email_address: string;
  provider: string;
  auth_method: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: string | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_security: string | null;
  imap_username: string | null;
  imap_password_encrypted: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  is_default: boolean;
  auto_link_clients: boolean;
  sync_enabled: boolean;
  created_at: string;
};

type ConnectionMode = "choose" | "gmail" | "outlook" | "manual";

const MANUAL_PROVIDERS = [
  { value: "generic", label: "IMAP/SMTP manuel" },
  { value: "gandi", label: "Gandi" },
  { value: "ovh", label: "OVH" },
  { value: "zoho", label: "Zoho" },
  { value: "ionos", label: "IONOS" },
  { value: "yahoo", label: "Yahoo" },
];

const ALL_PROVIDERS = [
  ...MANUAL_PROVIDERS,
  { value: "gmail", label: "Gmail / Google Workspace" },
  { value: "outlook", label: "Outlook / Microsoft 365" },
];

const PROVIDER_PRESETS: Record<string, { smtp_host: string; smtp_port: number; smtp_security: string; imap_host: string; imap_port: number; imap_security: string }> = {
  gandi: { smtp_host: "mail.gandi.net", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "mail.gandi.net", imap_port: 993, imap_security: "SSL" },
  ovh: { smtp_host: "ssl0.ovh.net", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "ssl0.ovh.net", imap_port: 993, imap_security: "SSL" },
  zoho: { smtp_host: "smtp.zoho.eu", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "imap.zoho.eu", imap_port: 993, imap_security: "SSL" },
  ionos: { smtp_host: "smtp.ionos.fr", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "imap.ionos.fr", imap_port: 993, imap_security: "SSL" },
  yahoo: { smtp_host: "smtp.mail.yahoo.com", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "imap.mail.yahoo.com", imap_port: 993, imap_security: "SSL" },
};

const SECURITY_OPTIONS = ["SSL", "STARTTLS", "NONE"];

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Connecté", color: "text-green-600", icon: CheckCircle2 },
  error: { label: "Erreur", color: "text-destructive", icon: XCircle },
  disconnected: { label: "Déconnecté", color: "text-muted-foreground", icon: AlertCircle },
  testing: { label: "Test…", color: "text-amber-500", icon: Loader2 },
};

type FormData = {
  label: string;
  email_address: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_security: string;
  smtp_username: string;
  smtp_password: string;
  imap_host: string;
  imap_port: number;
  imap_security: string;
  imap_username: string;
  imap_password: string;
  is_default: boolean;
  auto_link_clients: boolean;
  sync_enabled: boolean;
};

const emptyForm: FormData = {
  label: "",
  email_address: "",
  provider: "generic",
  smtp_host: "",
  smtp_port: 587,
  smtp_security: "STARTTLS",
  smtp_username: "",
  smtp_password: "",
  imap_host: "",
  imap_port: 993,
  imap_security: "SSL",
  imap_username: "",
  imap_password: "",
  is_default: false,
  auto_link_clients: true,
  sync_enabled: true,
};

// ─── Google / Microsoft brand icons (inline SVG) ───
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 23 23" className="h-5 w-5" fill="none">
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
);

export function EmailAccountsTab() {
  const isMobile = useIsMobile();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const companyId = current === "global" ? dbCompanies[0]?.id : current;

  const [mode, setMode] = useState<ConnectionMode>("choose");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["email-accounts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as EmailAccount[];
    },
    enabled: !!companyId,
  });

  // Handle OAuth redirect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get("oauth_result");
    const oauthProvider = params.get("oauth_provider");
    const detail = params.get("oauth_detail");

    if (!oauthResult) return;

    const payload = {
      type: "email-oauth-complete",
      provider: oauthProvider,
      result: oauthResult,
      detail,
    };

    if (window.opener && window.opener !== window) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("oauth_result");
    cleanUrl.searchParams.delete("oauth_provider");
    cleanUrl.searchParams.delete("oauth_detail");
    window.history.replaceState({}, "", cleanUrl.toString());
    setOauthLoading(null);

    if (oauthResult === "success") {
      toast.success(`Compte ${oauthProvider === "gmail" ? "Gmail" : "Outlook"} connecté !`);
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      setMode("choose");
      return;
    }

    toast.error(detail || "Erreur lors de la connexion OAuth");
  }, [queryClient]);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "email-oauth-complete") return;

      setOauthLoading(null);

      if (event.data.result === "success") {
        toast.success(`Compte ${event.data.provider === "gmail" ? "Gmail" : "Outlook"} connecté !`);
        queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
        setMode("choose");
        return;
      }

      toast.error(event.data.detail || "Erreur lors de la connexion OAuth");
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [queryClient]);

  const setField = (key: keyof FormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  const applyPreset = (provider: string) => {
    setField("provider", provider);
    const preset = PROVIDER_PRESETS[provider];
    if (preset) {
      setForm(f => ({ ...f, provider, ...preset }));
    }
  };

  // ─── OAuth handlers (iframe-safe for preview + redirect-based elsewhere) ───
  const startOAuth = async (provider: "gmail" | "outlook") => {
    if (!companyId) {
      toast.error("Aucune société sélectionnée");
      return;
    }

    setOauthLoading(provider);

    let popupWindow: Window | null = null;

    try {
      const functionName = provider === "gmail" ? "oauth-gmail-callback" : "oauth-outlook-callback";
      const isEmbedded = (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();

      if (isEmbedded) {
        popupWindow = window.open("about:blank", `${provider}-oauth`, "popup=yes,width=560,height=720");
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const initUrl = `https://${projectId}.supabase.co/functions/v1/${functionName}?action=init`;
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Vous devez être connecté");

      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.delete("oauth_result");
      returnUrl.searchParams.delete("oauth_provider");
      returnUrl.searchParams.delete("oauth_detail");

      const res = await fetch(initUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ company_id: companyId, return_url: returnUrl.toString() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur ${res.status}`);
      }

      const result = await res.json();
      if (!result.auth_url) throw new Error("URL d'authentification manquante");

      if (popupWindow) {
        popupWindow.location.href = result.auth_url;
        popupWindow.focus();
        return;
      }

      window.location.href = result.auth_url;
    } catch (err: any) {
      popupWindow?.close();
      setOauthLoading(null);
      toast.error(err.message || "Erreur lors de la connexion OAuth");
    }
  };

  // ─── Manual IMAP/SMTP save ───
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Aucune société sélectionnée");
      if (!form.email_address.trim()) throw new Error("L'adresse email est requise");

      const payload: any = {
        company_id: companyId,
        label: form.label.trim() || form.email_address.trim(),
        email_address: form.email_address.trim().toLowerCase(),
        provider: form.provider,
        auth_method: "password",
        smtp_host: form.smtp_host.trim() || null,
        smtp_port: form.smtp_port || 587,
        smtp_security: form.smtp_security,
        smtp_username: form.smtp_username.trim() || form.email_address.trim(),
        imap_host: form.imap_host.trim() || null,
        imap_port: form.imap_port || 993,
        imap_security: form.imap_security,
        imap_username: form.imap_username.trim() || form.email_address.trim(),
        is_default: form.is_default,
        auto_link_clients: form.auto_link_clients,
        sync_enabled: form.sync_enabled,
        status: "disconnected",
      };

      if (form.smtp_password) payload.smtp_password = form.smtp_password;
      if (form.imap_password) payload.imap_password = form.imap_password;
      if (editingId) payload.account_id = editingId;

      const { data, error } = await supabase.functions.invoke("encrypt-email-password", {
        body: payload,
      });
      if (error) {
        const msg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success(editingId ? "Compte email modifié" : "Compte email ajouté");
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compte email supprimé");
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const testConnection = async (accountId: string) => {
    setTestingId(accountId);
    try {
      const { data, error } = await supabase.functions.invoke("email-bridge-test", {
        body: { account_id: accountId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Connexion réussie !");
        queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      } else {
        toast.error(data?.error || "Échec du test de connexion");
      }
    } catch {
      toast.error("Impossible de tester la connexion. Le service bridge doit être configuré.");
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setMode("choose");
    setShowPasswords(false);
  };

  const startEdit = (account: EmailAccount) => {
    setForm({
      label: account.label,
      email_address: account.email_address,
      provider: account.provider,
      smtp_host: account.smtp_host || "",
      smtp_port: account.smtp_port || 587,
      smtp_security: account.smtp_security || "STARTTLS",
      smtp_username: account.smtp_username || "",
      smtp_password: "",
      imap_host: account.imap_host || "",
      imap_port: account.imap_port || 993,
      imap_security: account.imap_security || "SSL",
      imap_username: account.imap_username || "",
      imap_password: "",
      is_default: account.is_default,
      auto_link_clients: account.auto_link_clients,
      sync_enabled: account.sync_enabled,
    });
    setEditingId(account.id);
    setMode("manual");
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_MAP[status] || STATUS_MAP.disconnected;
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
        <Icon className={`h-3.5 w-3.5 ${status === "testing" ? "animate-spin" : ""}`} />
        {s.label}
      </span>
    );
  };

  const getProviderBadge = (account: EmailAccount) => {
    if (account.auth_method === "oauth2") {
      if (account.provider === "gmail") return <Badge variant="outline" className="text-[10px] gap-1"><GoogleIcon /> Gmail</Badge>;
      if (account.provider === "outlook") return <Badge variant="outline" className="text-[10px] gap-1"><MicrosoftIcon /> Outlook</Badge>;
    }
    const label = ALL_PROVIDERS.find(p => p.value === account.provider)?.label || account.provider;
    return <Badge variant="secondary" className="text-[10px]">{label}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Connexions email</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connectez vos boîtes mail pour envoyer et recevoir des emails
          </p>
        </div>
        {mode === "choose" && (
          <Button size="sm" className="text-xs gap-1.5" onClick={() => setMode("choose")}>
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </Button>
        )}
      </div>

      {/* ═══ Connection Mode Chooser ═══ */}
      <AnimatePresence mode="wait">
        {mode !== "choose" || (accounts.length === 0 && !isLoading) ? null : null}

        {/* Show chooser when mode is "choose" and the button was clicked, or when there are no accounts */}
        {(mode === "choose" && accounts.length === 0 && !isLoading) && (
          <motion.div
            key="empty-chooser"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <ConnectionChooser
              onSelect={setMode}
              onOAuth={startOAuth}
              oauthLoading={oauthLoading}
              isEmpty
            />
          </motion.div>
        )}

        {mode === "gmail" && (
          <motion.div key="gmail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GoogleIcon />
                  <h3 className="text-sm font-semibold">Connecter Gmail / Google Workspace</h3>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={resetForm}>Annuler</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cliquez sur le bouton ci-dessous pour autoriser l'accès à votre compte Gmail via Google OAuth.
                La synchronisation des emails sera automatique.
              </p>
              <Button
                className="gap-2 w-full sm:w-auto"
                onClick={() => startOAuth("gmail")}
                disabled={!!oauthLoading}
              >
                {oauthLoading === "gmail" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Se connecter avec Google
              </Button>
            </div>
          </motion.div>
        )}

        {mode === "outlook" && (
          <motion.div key="outlook" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MicrosoftIcon />
                  <h3 className="text-sm font-semibold">Connecter Outlook / Microsoft 365</h3>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={resetForm}>Annuler</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cliquez sur le bouton ci-dessous pour autoriser l'accès à votre compte Outlook via Microsoft OAuth.
                La synchronisation des emails sera automatique.
              </p>
              <Button
                className="gap-2 w-full sm:w-auto"
                onClick={() => startOAuth("outlook")}
                disabled={!!oauthLoading}
              >
                {oauthLoading === "outlook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicrosoftIcon />}
                Se connecter avec Microsoft
              </Button>
            </div>
          </motion.div>
        )}

        {mode === "manual" && (
          <motion.div key="manual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="rounded-xl border bg-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{editingId ? "Modifier le compte" : "Connexion IMAP / SMTP"}</h3>
                <Button variant="ghost" size="sm" className="text-xs" onClick={resetForm}>Annuler</Button>
              </div>

              {/* Provider selection */}
              <div className="space-y-1.5">
                <Label className="text-xs">Fournisseur</Label>
                <Select value={form.provider} onValueChange={applyPreset}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MANUAL_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Basic info */}
              <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                <div className="space-y-1.5">
                  <Label className="text-xs">Adresse email <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.email_address}
                    onChange={e => {
                      setField("email_address", e.target.value);
                      if (!form.smtp_username) setField("smtp_username", e.target.value);
                      if (!form.imap_username) setField("imap_username", e.target.value);
                    }}
                    placeholder="inbox@entreprise.fr"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Libellé</Label>
                  <Input value={form.label} onChange={e => setField("label", e.target.value)} placeholder="Boîte principale" className="text-sm" />
                </div>
              </div>

              {/* SMTP section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Envoi (SMTP)</h4>
                </div>
                <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Serveur SMTP</Label>
                    <Input value={form.smtp_host} onChange={e => setField("smtp_host", e.target.value)} placeholder="smtp.provider.com" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Port</Label>
                    <Input type="number" value={form.smtp_port} onChange={e => setField("smtp_port", parseInt(e.target.value) || 587)} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sécurité</Label>
                    <Select value={form.smtp_security} onValueChange={v => setField("smtp_security", v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECURITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Identifiant SMTP</Label>
                    <Input value={form.smtp_username} onChange={e => setField("smtp_username", e.target.value)} placeholder="inbox@entreprise.fr" className="text-sm" />
                  </div>
                  <div className="space-y-1.5 relative">
                    <Label className="text-xs">Mot de passe SMTP</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords ? "text" : "password"}
                        value={form.smtp_password}
                        onChange={e => setField("smtp_password", e.target.value)}
                        placeholder={editingId ? "Laisser vide pour ne pas changer" : "••••••••"}
                        className="text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* IMAP section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Réception (IMAP)</h4>
                </div>
                <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Serveur IMAP</Label>
                    <Input value={form.imap_host} onChange={e => setField("imap_host", e.target.value)} placeholder="imap.provider.com" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Port</Label>
                    <Input type="number" value={form.imap_port} onChange={e => setField("imap_port", parseInt(e.target.value) || 993)} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sécurité</Label>
                    <Select value={form.imap_security} onValueChange={v => setField("imap_security", v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECURITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Identifiant IMAP</Label>
                    <Input value={form.imap_username} onChange={e => setField("imap_username", e.target.value)} placeholder="inbox@entreprise.fr" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mot de passe IMAP</Label>
                    <Input
                      type={showPasswords ? "text" : "password"}
                      value={form.imap_password}
                      onChange={e => setField("imap_password", e.target.value)}
                      placeholder={editingId ? "Laisser vide pour ne pas changer" : "••••••••"}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Compte par défaut</p>
                    <p className="text-[10px] text-muted-foreground">Utilisé par défaut pour envoyer les emails</p>
                  </div>
                  <Switch checked={form.is_default} onCheckedChange={v => setField("is_default", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Rattachement automatique</p>
                    <p className="text-[10px] text-muted-foreground">Associer les emails aux fiches clients automatiquement</p>
                  </div>
                  <Switch checked={form.auto_link_clients} onCheckedChange={v => setField("auto_link_clients", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Synchronisation active</p>
                    <p className="text-[10px] text-muted-foreground">Récupérer les emails entrants automatiquement</p>
                  </div>
                  <Switch checked={form.sync_enabled} onCheckedChange={v => setField("sync_enabled", v)} />
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={resetForm}>Annuler</Button>
                <Button size="sm" className="text-xs gap-1.5" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingId ? "Enregistrer" : "Ajouter le compte"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Connection Chooser (when accounts exist and user clicks "Ajouter") ═══ */}
      {mode === "choose" && accounts.length > 0 && (
        <ConnectionChooser
          onSelect={setMode}
          onOAuth={startOAuth}
          oauthLoading={oauthLoading}
        />
      )}

      {/* ═══ Account list ═══ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(account => {
            const isExpanded = expandedId === account.id;
            const isOAuth = account.auth_method === "oauth2";

            return (
              <div key={account.id} className="rounded-xl border bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : account.id)}
                  className="flex items-center gap-3 p-4 w-full text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {account.provider === "gmail" ? <GoogleIcon /> :
                     account.provider === "outlook" ? <MicrosoftIcon /> :
                     <Mail className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{account.label}</p>
                      {account.is_default && <Badge variant="secondary" className="text-[10px]">Par défaut</Badge>}
                      {getProviderBadge(account)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{account.email_address}</p>
                  </div>
                  <StatusBadge status={account.status} />
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t bg-muted/20 p-4 space-y-3">
                        {isOAuth ? (
                          <div className="text-xs space-y-1">
                            <div>
                              <span className="text-muted-foreground">Mode :</span>{" "}
                              <span className="font-medium">OAuth 2.0 — {account.provider === "gmail" ? "Gmail API" : "Microsoft Graph"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Synchro :</span>{" "}
                              <span className="font-medium">{account.sync_enabled ? "Active" : "Désactivée"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Dernière synchro :</span>{" "}
                              <span className="font-medium">
                                {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString("fr-FR") : "Jamais"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className={`grid gap-3 text-xs ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                            <div>
                              <span className="text-muted-foreground">SMTP :</span>{" "}
                              <span className="font-medium">{account.smtp_host}:{account.smtp_port} ({account.smtp_security})</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">IMAP :</span>{" "}
                              <span className="font-medium">{account.imap_host}:{account.imap_port} ({account.imap_security})</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Synchro :</span>{" "}
                              <span className="font-medium">{account.sync_enabled ? "Active" : "Désactivée"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Dernière synchro :</span>{" "}
                              <span className="font-medium">
                                {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString("fr-FR") : "Jamais"}
                              </span>
                            </div>
                          </div>
                        )}

                        {account.last_error && (
                          <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                            {account.last_error}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={() => testConnection(account.id)}
                            disabled={testingId === account.id}
                          >
                            {testingId === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                            Tester
                          </Button>
                          {!isOAuth && (
                            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => startEdit(account)}>
                              Modifier
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1.5 text-destructive hover:bg-destructive/10 ml-auto"
                            onClick={() => {
                              if (confirm("Supprimer ce compte email ?")) deleteMutation.mutate(account.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Bridge info */}
      <div className="rounded-xl border border-dashed bg-muted/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold">Service Email Bridge</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          La synchronisation des emails est gérée par un service externe (Email Bridge) qui supporte 3 modes :
          <strong> Gmail API</strong>, <strong> Microsoft Graph</strong> et <strong> IMAP/SMTP</strong>.
          Le connecteur est sélectionné automatiquement selon le mode de connexion du compte.
        </p>
      </div>
    </div>
  );
}

// ─── Sub-component: Connection Mode Chooser ───
function ConnectionChooser({
  onSelect,
  onOAuth,
  oauthLoading,
  isEmpty,
}: {
  onSelect: (mode: ConnectionMode) => void;
  onOAuth: (provider: "gmail" | "outlook") => void;
  oauthLoading: string | null;
  isEmpty?: boolean;
}) {
  return (
    <div className={`rounded-xl border ${isEmpty ? "border-dashed bg-muted/30" : "bg-card"} p-5 space-y-4`}>
      {isEmpty && (
        <div className="text-center space-y-1 pb-2">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium">Aucun compte email connecté</p>
          <p className="text-xs text-muted-foreground">Choisissez un mode de connexion</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Gmail */}
        <button
          onClick={() => onSelect("gmail")}
          className="rounded-xl border-2 border-transparent hover:border-primary/30 bg-muted/40 hover:bg-muted/60 p-4 text-center transition-all space-y-2 group"
        >
          <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <GoogleIcon />
          </div>
          <p className="text-xs font-semibold">Gmail</p>
          <p className="text-[10px] text-muted-foreground">Google Workspace</p>
          <Badge variant="outline" className="text-[9px]">OAuth</Badge>
        </button>

        {/* Outlook */}
        <button
          onClick={() => onSelect("outlook")}
          className="rounded-xl border-2 border-transparent hover:border-primary/30 bg-muted/40 hover:bg-muted/60 p-4 text-center transition-all space-y-2 group"
        >
          <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <MicrosoftIcon />
          </div>
          <p className="text-xs font-semibold">Outlook</p>
          <p className="text-[10px] text-muted-foreground">Microsoft 365</p>
          <Badge variant="outline" className="text-[9px]">OAuth</Badge>
        </button>

        {/* Manual */}
        <button
          onClick={() => onSelect("manual")}
          className="rounded-xl border-2 border-transparent hover:border-primary/30 bg-muted/40 hover:bg-muted/60 p-4 text-center transition-all space-y-2 group"
        >
          <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <Server className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold">IMAP / SMTP</p>
          <p className="text-[10px] text-muted-foreground">Gandi, OVH, Zoho…</p>
          <Badge variant="outline" className="text-[9px]">Manuel</Badge>
        </button>
      </div>
    </div>
  );
}
