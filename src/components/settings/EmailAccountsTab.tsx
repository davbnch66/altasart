import { useState } from "react";
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
import { Plus, Trash2, TestTube, Loader2, Mail, Server, Lock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
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

const PROVIDERS = [
  { value: "generic", label: "IMAP/SMTP manuel" },
  { value: "gandi", label: "Gandi" },
  { value: "gmail", label: "Gmail / Google Workspace" },
  { value: "outlook", label: "Outlook / Microsoft 365" },
  { value: "ovh", label: "OVH" },
  { value: "zoho", label: "Zoho" },
  { value: "ionos", label: "IONOS" },
  { value: "yahoo", label: "Yahoo" },
];

const PROVIDER_PRESETS: Record<string, { smtp_host: string; smtp_port: number; smtp_security: string; imap_host: string; imap_port: number; imap_security: string }> = {
  gandi: { smtp_host: "mail.gandi.net", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "mail.gandi.net", imap_port: 993, imap_security: "SSL" },
  gmail: { smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "imap.gmail.com", imap_port: 993, imap_security: "SSL" },
  outlook: { smtp_host: "smtp.office365.com", smtp_port: 587, smtp_security: "STARTTLS", imap_host: "outlook.office365.com", imap_port: 993, imap_security: "SSL" },
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

export function EmailAccountsTab() {
  const isMobile = useIsMobile();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const companyId = current === "global" ? dbCompanies[0]?.id : current;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

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

  const setField = (key: keyof FormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  const applyPreset = (provider: string) => {
    setField("provider", provider);
    const preset = PROVIDER_PRESETS[provider];
    if (preset) {
      setForm(f => ({
        ...f,
        provider,
        smtp_host: preset.smtp_host,
        smtp_port: preset.smtp_port,
        smtp_security: preset.smtp_security,
        imap_host: preset.imap_host,
        imap_port: preset.imap_port,
        imap_security: preset.imap_security,
      }));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Aucune société sélectionnée");
      if (!form.email_address.trim()) throw new Error("L'adresse email est requise");

      // Use the encrypt-email-password edge function to encrypt & save
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

      // Passwords sent in clear to the edge function (HTTPS), which encrypts them server-side
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
    } catch (e: any) {
      toast.error("Impossible de tester la connexion. Le service bridge doit être configuré.");
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
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
    setShowForm(true);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Connexions email</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connectez vos boîtes mail pour envoyer et recevoir des emails depuis le SaaS
          </p>
        </div>
        {!showForm && (
          <Button size="sm" className="text-xs gap-1.5" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </Button>
        )}
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border bg-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{editingId ? "Modifier le compte" : "Nouvelle connexion email"}</h3>
                <Button variant="ghost" size="sm" className="text-xs" onClick={resetForm}>Annuler</Button>
              </div>

              {/* Provider selection */}
              <div className="space-y-1.5">
                <Label className="text-xs">Fournisseur</Label>
                <Select value={form.provider} onValueChange={applyPreset}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => (
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

      {/* Account list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center space-y-2">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium">Aucun compte email connecté</p>
          <p className="text-xs text-muted-foreground">
            Ajoutez votre première boîte mail pour envoyer et recevoir des emails depuis l'application
          </p>
          <Button size="sm" className="text-xs gap-1.5 mt-2" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Connecter une boîte mail
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(account => {
            const isExpanded = expandedId === account.id;
            const providerLabel = PROVIDERS.find(p => p.value === account.provider)?.label || account.provider;

            return (
              <div key={account.id} className="rounded-xl border bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : account.id)}
                  className="flex items-center gap-3 p-4 w-full text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{account.label}</p>
                      {account.is_default && <Badge variant="secondary" className="text-[10px]">Par défaut</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{account.email_address} · {providerLabel}</p>
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

                        {account.last_error && (
                          <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                            {account.last_error}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
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
                          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => startEdit(account)}>
                            Modifier
                          </Button>
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
          La synchronisation IMAP et l'envoi SMTP sont gérés par un service externe (Email Bridge) déployé sur votre infrastructure.
          Ce service se connecte aux boîtes mail configurées ici et synchronise les messages avec l'application.
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>API Bridge :</strong> Le bridge communique via les endpoints <code className="bg-muted px-1 rounded">/email-bridge-sync</code> et <code className="bg-muted px-1 rounded">/email-bridge-send</code>.
        </p>
      </div>
    </div>
  );
}
