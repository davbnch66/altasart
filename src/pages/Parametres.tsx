import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Users, Mail, User, Save, Loader2, LogOut, Edit2, Check, X, UserPlus, Trash2, Shield, ChevronDown, ChevronUp, FileText, Upload, Paintbrush, Server } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmailTemplatesTab } from "@/components/settings/EmailTemplatesTab";
import { EmailAccountsTab } from "@/components/settings/EmailAccountsTab";
import { DocumentTemplatesTab } from "@/components/settings/DocumentTemplatesTab";
import { ImportDataTab } from "@/components/settings/ImportDataTab";
import { AppearanceSettingsTab } from "@/components/settings/AppearanceSettingsTab";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type AppRole } from "@/hooks/useMyRole";

const roleLabels = ROLE_LABELS;
const ALL_ROLES: AppRole[] = ["admin", "manager", "commercial", "exploitation", "comptable", "terrain", "readonly"];

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

      {/* Toggle email vs pseudo */}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const Parametres = () => {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

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

  // Fetch ALL memberships (RLS handles security filtering automatically)
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

  // Group memberships by profile_id into one entry per person
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

  return (
    <div className={`max-w-4xl mx-auto animate-fade-in ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Paramètres</h1>
        {!isMobile && <p className="text-muted-foreground mt-1">Configuration de votre compte et de l'application</p>}
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className={`${isMobile ? "w-full flex-wrap h-auto gap-1" : ""}`}>
          <TabsTrigger value="profile" className="text-xs gap-1.5"><User className="h-3.5 w-3.5" /> Profil</TabsTrigger>
          <TabsTrigger value="companies" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" /> Sociétés</TabsTrigger>
          <TabsTrigger value="team" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" /> Équipe</TabsTrigger>
          <TabsTrigger value="email-accounts" className="text-xs gap-1.5"><Server className="h-3.5 w-3.5" /> Connexions</TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1.5"><Mail className="h-3.5 w-3.5" /> Modèles</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" /> Documents</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1.5"><Shield className="h-3.5 w-3.5" /> Rôles</TabsTrigger>
          <TabsTrigger value="import" className="text-xs gap-1.5"><Upload className="h-3.5 w-3.5" /> Import</TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs gap-1.5"><Paintbrush className="h-3.5 w-3.5" /> Apparence</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-card p-5 space-y-5">
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
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card p-5 space-y-3 mt-4">
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
          </motion.div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {companyDetails.map((company: any) => (
              <CompanyEditCard key={company.id} company={company} isAdmin={adminCompanyIds.includes(company.id)} />
            ))}
            {!adminCompanyIds.length && (
              <p className="text-sm text-muted-foreground text-center py-6">Seuls les admins peuvent modifier les informations des sociétés.</p>
            )}
          </motion.div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
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
                      {/* Summary row */}
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

                      {/* Expanded edit panel */}
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
                              {/* Add to missing companies button */}
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
        </TabsContent>

        {/* Email Accounts Tab */}
        <TabsContent value="email-accounts">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmailAccountsTab />
          </motion.div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="emails">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmailTemplatesTab />
          </motion.div>
        </TabsContent>

        {/* Document Templates Tab */}
        <TabsContent value="documents">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <DocumentTemplatesTab />
          </motion.div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="rounded-xl border bg-card p-5 space-y-1">
              <h2 className="text-sm font-semibold">Rôles disponibles</h2>
              <p className="text-xs text-muted-foreground">Chaque membre se voit attribuer un rôle par société. Les accès sont filtrés automatiquement selon ce rôle.</p>
            </div>
            {ALL_ROLES.map((r) => (
              <div key={r} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <span className="text-sm font-semibold">{ROLE_LABELS[r]}</span>
                  <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ImportDataTab />
          </motion.div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AppearanceSettingsTab />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Parametres;
