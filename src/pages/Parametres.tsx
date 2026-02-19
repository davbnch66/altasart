import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, Mail, User, Save, Loader2, LogOut, Edit2, Check, X, UserPlus, Trash2, Shield, Info } from "lucide-react";
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
      const { error } = await supabase
        .from("companies")
        .update({
          name: form.name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          siret: form.siret.trim() || null,
        })
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Société mise à jour");
      queryClient.invalidateQueries({ queryKey: ["companies-details"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la sauvegarde"),
  });

  const field = (label: string, key: keyof typeof form, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {editing ? (
        <Input
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="text-sm"
          placeholder={placeholder}
        />
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

// ─── Invite Member Card ───────────────────────────────────────────────────────
function InviteMemberCard({ companyIds, adminCompanyIds }: { companyIds: string[]; adminCompanyIds: string[] }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(adminCompanyIds[0] || "");
  const [role, setRole] = useState<string>("readonly");
  const [loading, setLoading] = useState(false);

  const { data: adminCompanies = [] } = useQuery({
    queryKey: ["admin-companies", adminCompanyIds],
    queryFn: async () => {
      if (adminCompanyIds.length === 0) return [];
      const { data } = await supabase.from("companies").select("id, name").in("id", adminCompanyIds);
      return data || [];
    },
    enabled: adminCompanyIds.length > 0,
  });

  const invite = async () => {
    if (!email.trim() || !selectedCompany) return;
    setLoading(true);
    try {
      // Find profile by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        toast.error("Aucun compte trouvé avec cet email. L'utilisateur doit d'abord créer son compte.");
        return;
      }

      const { error } = await supabase.from("company_memberships").insert({
        profile_id: profile.id,
        company_id: selectedCompany,
        role: role as any,
      });
      if (error) {
        if (error.code === "23505") toast.error("Ce membre est déjà dans cette société.");
        else throw error;
        return;
      }

      toast.success(`${email} ajouté avec le rôle ${roleLabels[role]}`);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  if (adminCompanyIds.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Inviter un membre</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm" placeholder="prenom@exemple.fr" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Société</Label>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="text-sm h-9">
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {adminCompanies.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rôle</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={invite} disabled={loading || !email.trim()} className="text-xs gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        Ajouter le membre
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

  // Admin company IDs (for this user)
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

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_memberships")
        .select("*, profiles(full_name, email, avatar_url), companies(id, short_name, name)")
        .in("company_id", companyIds);
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

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

  const updateRole = async (membershipId: string, companyId: string, newRole: string) => {
    const { error } = await supabase.from("company_memberships").update({ role: newRole as any }).eq("id", membershipId);
    if (error) toast.error(error.message);
    else { toast.success("Rôle mis à jour"); queryClient.invalidateQueries({ queryKey: ["team-members"] }); }
  };

  const removeMember = async (membershipId: string, profileId: string) => {
    if (profileId === user?.id) { toast.error("Vous ne pouvez pas vous retirer vous-même."); return; }
    const { error } = await supabase.from("company_memberships").delete().eq("id", membershipId);
    if (error) toast.error(error.message);
    else { toast.success("Membre retiré"); queryClient.invalidateQueries({ queryKey: ["team-members"] }); }
  };

  return (
    <div className={`max-w-4xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Paramètres</h1>
        {!isMobile && <p className="text-muted-foreground mt-1">Configuration de votre compte et de l'application</p>}
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className={`${isMobile ? "w-full" : ""}`}>
          <TabsTrigger value="profile" className="text-xs gap-1.5"><User className="h-3.5 w-3.5" /> Profil</TabsTrigger>
          <TabsTrigger value="companies" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" /> Sociétés</TabsTrigger>
          <TabsTrigger value="team" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" /> Équipe</TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1.5"><Mail className="h-3.5 w-3.5" /> Emails</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1.5"><Shield className="h-3.5 w-3.5" /> Rôles</TabsTrigger>
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
                    <Badge variant="secondary" className="text-xs">{roleLabels[m.role] || m.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {companyDetails.map((company: any) => {
              const isAdmin = adminCompanyIds.includes(company.id);
              return <CompanyEditCard key={company.id} company={company} isAdmin={isAdmin} />;
            })}
            {!adminCompanyIds.length && (
              <p className="text-sm text-muted-foreground text-center py-6">Seuls les admins peuvent modifier les informations des sociétés.</p>
            )}
          </motion.div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <InviteMemberCard companyIds={companyIds} adminCompanyIds={adminCompanyIds} />

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Membres de l'équipe</h2>
              <div className="space-y-2">
                {teamMembers.map((member: any) => {
                  const memberProfile = member.profiles as any;
                  const isMe = member.profile_id === user?.id;
                  const isAdminOfThisCompany = adminCompanyIds.includes((member.companies as any)?.id);
                  return (
                    <div key={member.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                        {(memberProfile?.full_name || memberProfile?.email || "?").substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{memberProfile?.full_name || "Sans nom"}</p>
                          {isMe && <Badge variant="outline" className="text-[10px]">Vous</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{memberProfile?.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">{(member.companies as any)?.short_name}</Badge>
                        {isAdminOfThisCompany && !isMe ? (
                          <Select value={member.role} onValueChange={(v) => updateRole(member.id, (member.companies as any)?.id, v)}>
                            <SelectTrigger className="h-6 text-[10px] w-28 px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROLES.map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">{roleLabels[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{roleLabels[member.role] || member.role}</Badge>
                        )}
                        {isAdminOfThisCompany && !isMe && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => removeMember(member.id, member.profile_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {teamMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucun membre trouvé</p>
                )}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="emails">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmailTemplatesTab />
          </motion.div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="rounded-xl border bg-card p-5 space-y-1">
              <h2 className="text-sm font-semibold">Rôles disponibles</h2>
              <p className="text-xs text-muted-foreground">Chaque membre se voit attribuer un rôle par société. Les accès sont filtrés automatiquement.</p>
            </div>
            {ALL_ROLES.map((r) => (
              <div key={r} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1">
                  <span className="text-sm font-semibold">{ROLE_LABELS[r]}</span>
                  <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Parametres;

