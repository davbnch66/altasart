import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Users, Mail, User, Save, Loader2, LogOut, Edit2, Check, X, UserPlus, Trash2, Shield, ChevronDown, ChevronUp, FileText, Upload, Paintbrush, Server, Bell, Download, FolderOpen, Euro, Truck, ClipboardCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmailTemplatesTab } from "@/components/settings/EmailTemplatesTab";
import { EmailAccountsTab } from "@/components/settings/EmailAccountsTab";
import { DocumentTemplatesTab } from "@/components/settings/DocumentTemplatesTab";
import { ImportDataTab } from "@/components/settings/ImportDataTab";
import { AppearanceSettingsTab } from "@/components/settings/AppearanceSettingsTab";
import { NotificationSettingsTab } from "@/components/settings/NotificationSettingsTab";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type AppRole } from "@/hooks/useMyRole";

const roleLabels = ROLE_LABELS;
const ALL_ROLES: AppRole[] = ["admin", "manager", "commercial", "exploitation", "comptable", "terrain", "readonly"];

// ─── Tab config ───────────────────────────────────────────────────────────────
const tabs = [
  { value: "profile", label: "Mon profil", icon: User },
  { value: "companies", label: "Sociétés", icon: Building2 },
  { value: "team", label: "Équipe", icon: Users },
  { value: "emails", label: "Comptes email", icon: Mail },
  { value: "templates-email", label: "Templates email", icon: FileText },
  { value: "templates-docs", label: "Templates docs", icon: FileText },
  { value: "appearance", label: "Apparence", icon: Paintbrush },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "import", label: "Import", icon: Upload },
  { value: "export", label: "Export & RGPD", icon: Download },
];

// ─── Company Edit Card ────────────────────────────────────────────────────────
function CompanyEditCard({ company, isAdmin }: { company: any; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: company.name || "",
    address: company.address || "",
    phone: company.phone || "",
    email: company.email || "",
    siret: company.siret || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update({
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        siret: form.siret.trim() || null,
      }).eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Société mise à jour");
      queryClient.invalidateQueries({ queryKey: ["companies-details"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const field = (label: string, key: keyof typeof form, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {editing ? (
        <Input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="text-sm" placeholder={placeholder} />
      ) : (
        <p className="text-sm font-medium py-2 px-3 rounded-md bg-muted/40">{form[key] || "—"}</p>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold">{company.name}</h2>
          <Badge variant="outline" className="text-xs">{company.short_name}</Badge>
        </div>
        {isAdmin && !editing && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
            <Edit2 className="h-3 w-3" /> Modifier
          </Button>
        )}
        {editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { setEditing(false); setForm({ name: company.name, address: company.address || "", phone: company.phone || "", email: company.email || "", siret: company.siret || "" }); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-7 w-7 p-0" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Nom", "name")}
        {field("SIRET", "siret", "12345678900000")}
        {field("Adresse", "address", "1 rue de la Paix, 75001 Paris")}
        {field("Téléphone", "phone", "01 23 45 67 89")}
        {field("Email", "email", "contact@société.fr")}
      </div>
    </div>
  );
}

// ─── Create User Card (admin only) ───────────────────────────────────────────
function CreateUserCard({ adminCompanyIds }: { adminCompanyIds: string[] }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(adminCompanyIds[0] || "");
  const [allCompanies, setAllCompanies] = useState(false);
  const [role, setRole] = useState<string>("readonly");
  const [loading, setLoading] = useState(false);
  const [useEmail, setUseEmail] = useState(true);

  const { data: adminCompanies = [] } = useQuery({
    queryKey: ["admin-companies", adminCompanyIds],
    queryFn: async () => {
      if (adminCompanyIds.length === 0) return [];
      const { data } = await supabase.from("companies").select("id, name").in("id", adminCompanyIds);
      return data || [];
    },
    enabled: adminCompanyIds.length > 0,
  });

  const createAccount = async () => {
    const hasIdentifier = useEmail ? email.trim().length > 0 : username.trim().length > 0;
    if (!hasIdentifier || !password || (!allCompanies && !selectedCompany)) { toast.error("Veuillez remplir tous les champs obligatoires."); return; }
    if (password.length < 8) { toast.error("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setLoading(true);
    try {
      const targetCompanyIds = allCompanies ? adminCompanyIds : [selectedCompany];
      
      for (const companyId of targetCompanyIds) {
        const body: any = { password, company_id: companyId, role, full_name: fullName.trim() };
        if (useEmail) {
          body.email = email.trim().toLowerCase();
        } else {
          body.username = username.trim();
        }

        const { data, error } = await supabase.functions.invoke("create-user", { body });

        if (error) {
          let msg = "Erreur lors de la création du compte";
          const jsonMatch = error.message?.match(/\{.*\}/s);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed?.error) msg = parsed.error;
            } catch {}
          } else if (error.message) {
            msg = error.message;
          }
          toast.error(msg);
          return;
        }

        if (data?.error) { toast.error(data.error); return; }
      }

      const label = useEmail ? email : username;
      const companyLabel = allCompanies ? `toutes les sociétés (${targetCompanyIds.length})` : adminCompanies.find((c: any) => c.id === selectedCompany)?.name;
      toast.success(`Compte créé pour ${label} sur ${companyLabel}`);
      setEmail(""); setUsername(""); setFullName(""); setPassword("");
      await new Promise((r) => setTimeout(r, 500));
      await queryClient.invalidateQueries({ queryKey: ["team-members-all"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création du compte");
    } finally {
      setLoading(false);
    }
  };

  if (adminCompanyIds.length === 0) return null;

  const hasIdentifier = useEmail ? email.trim().length > 0 : username.trim().length > 0;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Créer un compte utilisateur</h2>
        <span className="ml-auto text-[10px] text-muted-foreground border rounded-full px-2 py-0.5">Admin uniquement</span>
      </div>

      <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5 w-fit">
        <button
          onClick={() => setUseEmail(true)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${useEmail ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Avec email
        </button>
        <button
          onClick={() => setUseEmail(false)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!useEmail ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Avec pseudo
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {useEmail ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm" placeholder="prenom@exemple.fr" type="email" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs">Pseudo <span className="text-destructive">*</span></Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="text-sm" placeholder="jean.dupont" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Nom complet</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="text-sm" placeholder="Jean Dupont" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mot de passe provisoire <span className="text-destructive">*</span></Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} className="text-sm" placeholder="Min. 8 caractères" type="password" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Société <span className="text-destructive">*</span></Label>
          <div className="space-y-2">
            {adminCompanyIds.length > 1 && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={allCompanies}
                  onChange={(e) => setAllCompanies(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="font-medium">Toutes les sociétés ({adminCompanyIds.length})</span>
              </label>
            )}
            {!allCompanies && (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {adminCompanies.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rôle</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={createAccount} disabled={loading || !hasIdentifier || !password} className="text-xs gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        Créer le compte
      </Button>
    </div>
  );
}

// ─── Export & RGPD Tab ────────────────────────────────────────────────────────
function ExportDataTab({ companyIds }: { companyIds: string[] }) {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportToCSV = (data: any[], filename: string, columns: string[]) => {
    const header = columns.join(",");
    const rows = data.map(row =>
      columns.map(col => {
        const val = col.split(".").reduce((o: any, k: string) => o?.[k], row) ?? "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") || str.includes("\n") ? `"${str}"` : str;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exports = [
    {
      key: "clients",
      label: "Clients",
      description: "Nom, email, téléphone, adresse, statut, société",
      icon: Users,
      color: "text-info",
      fn: async () => {
        const { data } = await supabase.from("clients")
          .select("name, email, phone, mobile, address, city, postal_code, status, code, companies(short_name)")
          .in("company_id", companyIds);
        exportToCSV(data || [], "clients", ["name", "email", "phone", "mobile", "address", "city", "postal_code", "status", "code", "companies.short_name"]);
      },
    },
    {
      key: "dossiers",
      label: "Dossiers",
      description: "Titre, code, statut, montant, client, société",
      icon: FolderOpen,
      color: "text-warning",
      fn: async () => {
        const { data } = await supabase.from("dossiers")
          .select("code, title, stage, amount, address, created_at, updated_at, clients(name), companies(short_name)")
          .in("company_id", companyIds);
        exportToCSV(data || [], "dossiers", ["code", "title", "stage", "amount", "address", "created_at", "clients.name", "companies.short_name"]);
      },
    },
    {
      key: "devis",
      label: "Devis",
      description: "Code, objet, montant, statut, client, date",
      icon: FileText,
      color: "text-primary",
      fn: async () => {
        const { data } = await supabase.from("devis")
          .select("code, objet, amount, status, created_at, valid_until, clients(name), companies(short_name)")
          .in("company_id", companyIds);
        exportToCSV(data || [], "devis", ["code", "objet", "amount", "status", "created_at", "valid_until", "clients.name", "companies.short_name"]);
      },
    },
    {
      key: "factures",
      label: "Factures",
      description: "Code, montant, réglé, solde, statut, échéance",
      icon: Euro,
      color: "text-success",
      fn: async () => {
        const { data } = await supabase.from("factures")
          .select("code, amount, paid_amount, status, created_at, due_date, clients(name), companies(short_name)")
          .in("company_id", companyIds);
        exportToCSV(data || [], "factures", ["code", "amount", "paid_amount", "status", "created_at", "due_date", "clients.name", "companies.short_name"]);
      },
    },
    {
      key: "operations",
      label: "Opérations / BT",
      description: "Numéro BT, client, villes, dates, volume",
      icon: Truck,
      color: "text-orange-500",
      fn: async () => {
        const { data } = await supabase.from("operations")
          .select("lv_bt_number, operation_number, loading_date, delivery_date, loading_city, delivery_city, volume, dossiers(clients(name), code)")
          .in("company_id", companyIds);
        exportToCSV(data || [], "operations", ["lv_bt_number", "operation_number", "loading_date", "delivery_date", "loading_city", "delivery_city", "volume"]);
      },
    },
    {
      key: "visites",
      label: "Visites techniques",
      description: "Titre, client, date, statut, adresse",
      icon: ClipboardCheck,
      color: "text-purple-500",
      fn: async () => {
        const { data } = await supabase.from("visites")
          .select("title, status, scheduled_date, address, clients(name), companies(short_name)")
          .in("company_id", companyIds);
        exportToCSV(data || [], "visites", ["title", "status", "scheduled_date", "address", "clients.name", "companies.short_name"]);
      },
    },
  ];

  const handleExport = async (exp: typeof exports[0]) => {
    setExporting(exp.key);
    try {
      await exp.fn();
      toast.success(`${exp.label} exportés en CSV`);
    } catch (e: any) {
      toast.error("Erreur lors de l'export : " + e.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="card-elevated p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold">Export des données</h2>
          <p className="text-xs text-muted-foreground mt-1">Téléchargez vos données au format CSV, compatible Excel et Google Sheets</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {exports.map(exp => (
            <div key={exp.key} className="card-elevated p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0`}>
                <exp.icon className={`h-5 w-5 ${exp.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{exp.label}</p>
                <p className="text-xs text-muted-foreground truncate">{exp.description}</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs h-8"
                onClick={() => handleExport(exp)}
                disabled={exporting === exp.key}>
                {exporting === exp.key
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                CSV
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full gap-2 border-dashed" onClick={async () => {
          setExporting("all");
          try {
            for (const exp of exports) { await exp.fn(); await new Promise(r => setTimeout(r, 300)); }
            toast.success("Toutes les données exportées !");
          } catch (e: any) { toast.error(e.message); }
          finally { setExporting(null); }
        }} disabled={exporting === "all"}>
          {exporting === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exporter toutes les données
        </Button>
      </div>

      {/* RGPD */}
      <div className="card-elevated p-5 space-y-4 border-destructive/20">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Conformité RGPD
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Vos données sont hébergées sur une infrastructure sécurisée. En tant que responsable de traitement, vous pouvez exporter ou supprimer les données de vos clients sur demande.
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Vos droits et obligations :</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Droit d'accès : exportez les données d'un client via la section ci-dessus</li>
            <li>Droit à l'effacement : supprimez un client et ses données depuis sa fiche</li>
            <li>Droit à la portabilité : format CSV compatible avec tous les logiciels</li>
            <li>Conservation : les données sont conservées jusqu'à suppression manuelle</li>
          </ul>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-destructive">Zone dangereuse</p>
          <p className="text-xs text-muted-foreground">Ces actions sont irréversibles. Exportez vos données avant de procéder.</p>
          <Button variant="destructive" size="sm" className="text-xs gap-1.5" onClick={() => toast.info("Contactez le support pour supprimer votre compte")}>
            <Trash2 className="h-3.5 w-3.5" /> Demander la suppression du compte
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const Parametres = () => {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("profile");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) { setFullName(data.full_name || ""); setPhone(data.phone || ""); }
      return data;
    },
    enabled: !!user,
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("company_memberships").select("*, companies(name, short_name, color)").eq("profile_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const adminCompanyIds = memberships.filter((m: any) => m.role === "admin").map((m: any) => m.company_id);

  const { data: companyDetails = [] } = useQuery({
    queryKey: ["companies-details"],
    queryFn: async () => {
      const ids = dbCompanies.map((c) => c.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("companies").select("*").in("id", ids);
      return data || [];
    },
    enabled: dbCompanies.length > 0,
  });

  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  const { data: allTeamMembers = [] } = useQuery({
    queryKey: ["team-members-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_memberships")
        .select("*, profiles!company_memberships_profile_id_fkey(full_name, email, avatar_url), companies(id, short_name, name)");
      if (error) console.error("team-members error:", error);
      return data || [];
    },
  });

  const groupedMembers = (() => {
    const filtered = current === "global"
      ? allTeamMembers
      : allTeamMembers.filter((m: any) => m.company_id === current);
    const map = new Map<string, { profile: any; profileId: string; memberships: any[] }>();
    filtered.forEach((m: any) => {
      const pid = m.profile_id;
      if (!map.has(pid)) {
        map.set(pid, { profile: m.profiles, profileId: pid, memberships: [] });
      }
      map.get(pid)!.memberships.push(m);
    });
    return Array.from(map.values());
  })();

  const [editingMember, setEditingMember] = useState<string | null>(null);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profil mis à jour");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSavingProfile(false);
    }
  };

  const updateRole = async (membershipId: string, newRole: string) => {
    const { error } = await supabase.from("company_memberships").update({ role: newRole as any }).eq("id", membershipId);
    if (error) toast.error(error.message);
    else { toast.success("Rôle mis à jour"); queryClient.invalidateQueries({ queryKey: ["team-members-all"] }); }
  };

  const removeMember = async (membershipId: string, profileId: string) => {
    if (profileId === user?.id) { toast.error("Vous ne pouvez pas vous retirer vous-même."); return; }
    const { error } = await supabase.from("company_memberships").delete().eq("id", membershipId);
    if (error) toast.error(error.message);
    else { toast.success("Membre retiré"); queryClient.invalidateQueries({ queryKey: ["team-members-all"] }); }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "profile":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-5">
              <h2 className="text-sm font-semibold">Mon profil</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input value={user?.email || ""} disabled className="text-sm bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom complet</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="text-sm" placeholder="Jean Dupont" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Téléphone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-sm" placeholder="06 12 34 56 78" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={signOut}>
                  <LogOut className="h-3.5 w-3.5 mr-1" /> Se déconnecter
                </Button>
                <Button size="sm" onClick={saveProfile} disabled={savingProfile} className="text-xs">
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Enregistrer
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Mes sociétés</h2>
              <div className="space-y-2">
                {memberships.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <span className="text-sm font-medium">{(m.companies as any)?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.role === "admin" && <Shield className="h-3.5 w-3.5 text-primary" />}
                      <Badge variant="secondary" className="text-xs">{roleLabels[m.role as AppRole] || m.role}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );

      case "companies":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {companyDetails.map((company: any) => (
              <CompanyEditCard key={company.id} company={company} isAdmin={adminCompanyIds.includes(company.id)} />
            ))}
            {!adminCompanyIds.length && (
              <p className="text-sm text-muted-foreground text-center py-6">Seuls les admins peuvent modifier les informations des sociétés.</p>
            )}
          </motion.div>
        );

      case "team":
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <CreateUserCard adminCompanyIds={adminCompanyIds} />

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Membres de l'équipe</h2>
              <div className="space-y-2">
                {groupedMembers.map((group) => {
                  const prof = group.profile as any;
                  const isMe = group.profileId === user?.id;
                  const isExpanded = editingMember === group.profileId;
                  const canEditAny = group.memberships.some((m: any) => adminCompanyIds.includes(m.company_id)) && !isMe;

                  return (
                    <div key={group.profileId} className="rounded-lg border overflow-hidden">
                      <button
                        onClick={() => setEditingMember(isExpanded ? null : group.profileId)}
                        className="flex items-center gap-3 p-3 w-full text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                          {(prof?.full_name || prof?.email || "?").substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{prof?.full_name || "Sans nom"}</p>
                            {isMe && <Badge variant="outline" className="text-[10px]">Vous</Badge>}
                          </div>
                          {prof?.email && <p className="text-xs text-muted-foreground truncate">{prof.email}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {group.memberships.map((m: any) => (
                            <span key={m.id} className="inline-flex items-center gap-1">
                              <Badge variant="secondary" className="text-[10px]">{(m.companies as any)?.short_name}</Badge>
                              <Badge variant="outline" className="text-[10px]">{roleLabels[m.role as AppRole] || m.role}</Badge>
                            </span>
                          ))}
                        </div>
                        {canEditAny && (
                          isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t bg-muted/30 p-3 space-y-2">
                              {group.memberships.map((m: any) => {
                                const companyName = (m.companies as any)?.name || (m.companies as any)?.short_name;
                                const isAdminOfThis = adminCompanyIds.includes(m.company_id);
                                return (
                                  <div key={m.id} className="flex items-center gap-3 rounded-md bg-card border p-2.5">
                                    <span className="text-xs font-medium min-w-[80px]">{companyName}</span>
                                    {isAdminOfThis && !isMe ? (
                                      <>
                                        <Select value={m.role} onValueChange={(v) => updateRole(m.id, v)}>
                                          <SelectTrigger className="h-7 text-xs flex-1 max-w-[160px]"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {ALL_ROLES.map((r) => (
                                              <SelectItem key={r} value={r} className="text-xs">{roleLabels[r]}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                          onClick={(e) => { e.stopPropagation(); removeMember(m.id, m.profile_id); }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px]">{roleLabels[m.role as AppRole] || m.role}</Badge>
                                    )}
                                  </div>
                                );
                              })}
                              {canEditAny && (() => {
                                const memberCompanyIds = group.memberships.map((m: any) => m.company_id);
                                const missingCompanyIds = adminCompanyIds.filter((id: string) => !memberCompanyIds.includes(id));
                                if (missingCompanyIds.length === 0) return null;
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs gap-1.5 w-full mt-1"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const highestRole = group.memberships.reduce((best: string, m: any) => {
                                        const priority: Record<string, number> = { admin: 7, manager: 6, commercial: 5, exploitation: 4, comptable: 3, terrain: 2, readonly: 1 };
                                        return (priority[m.role] || 0) > (priority[best] || 0) ? m.role : best;
                                      }, "readonly");
                                      try {
                                        for (const companyId of missingCompanyIds) {
                                          const { error } = await supabase.from("company_memberships").insert({
                                            profile_id: group.profileId,
                                            company_id: companyId,
                                            role: highestRole as any,
                                            invited_by: user?.id,
                                          });
                                          if (error) throw error;
                                        }
                                        toast.success(`Membre ajouté à ${missingCompanyIds.length} société(s) en tant que ${roleLabels[highestRole as AppRole]}`);
                                        queryClient.invalidateQueries({ queryKey: ["team-members-all"] });
                                      } catch (err: any) {
                                        toast.error(err.message || "Erreur");
                                      }
                                    }}
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Affecter aux {missingCompanyIds.length} société(s) manquante(s)
                                  </Button>
                                );
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {groupedMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucun membre trouvé</p>
                )}
              </div>
            </div>
          </motion.div>
        );

      case "emails":
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><EmailAccountsTab /></motion.div>;

      case "templates-email":
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><EmailTemplatesTab /></motion.div>;

      case "templates-docs":
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><DocumentTemplatesTab /></motion.div>;

      case "appearance":
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AppearanceSettingsTab /></motion.div>;

      case "notifications":
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><NotificationSettingsTab /></motion.div>;

      case "import":
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ImportDataTab /></motion.div>;

      case "export":
        return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ExportDataTab companyIds={companyIds} /></motion.div>;

      default:
        return null;
    }
  };

  return (
    <div className={`max-w-6xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8"}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gérez votre compte, vos sociétés et vos préférences</p>
      </div>

      {!isMobile ? (
        <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
          {/* Vertical nav */}
          <div className="card-elevated p-2 space-y-0.5 sticky top-6">
            {tabs.map(tab => (
              <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <tab.icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="min-w-0">
            {renderTab()}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-2 mb-4">
            {tabs.map(tab => (
              <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
          </div>
          {renderTab()}
        </div>
      )}
    </div>
  );
};

export default Parametres;
