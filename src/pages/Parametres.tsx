import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, Mail, User, Save, Loader2, LogOut } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { EmailTemplatesTab } from "@/components/settings/EmailTemplatesTab";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  readonly: "Lecture seule",
};

const Parametres = () => {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Load profile
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
      }
      return data;
    },
    enabled: !!user,
  });

  // Load memberships
  const { data: memberships = [] } = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("company_memberships")
        .select("*, companies(name, short_name, color)")
        .eq("profile_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Load company details
  const { data: companyDetails = [] } = useQuery({
    queryKey: ["companies-details"],
    queryFn: async () => {
      const ids = dbCompanies.map((c) => c.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("companies")
        .select("*")
        .in("id", ids);
      return data || [];
    },
    enabled: dbCompanies.length > 0,
  });

  // Load team members
  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_memberships")
        .select("*, profiles(full_name, email, avatar_url), companies(short_name)")
        .in("company_id", companyIds);
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profil mis à jour");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className={`max-w-4xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Paramètres</h1>
        {!isMobile && <p className="text-muted-foreground mt-1">Configuration de votre compte et de l'application</p>}
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className={`${isMobile ? "w-full" : ""}`}>
          <TabsTrigger value="profile" className="text-xs gap-1.5">
            <User className="h-3.5 w-3.5" /> Profil
          </TabsTrigger>
          <TabsTrigger value="companies" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Sociétés
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" /> Équipe
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Emails
          </TabsTrigger>
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

          {/* Memberships */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card p-5 space-y-3 mt-4">
            <h2 className="text-sm font-semibold">Mes sociétés</h2>
            <div className="space-y-2">
              {memberships.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="text-sm font-medium">{(m.companies as any)?.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{roleLabels[m.role] || m.role}</Badge>
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {companyDetails.map((company: any) => (
              <div key={company.id} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <h2 className="text-sm font-semibold">{company.name}</h2>
                  <Badge variant="outline" className="text-xs">{company.short_name}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Adresse</p>
                    <p className="font-medium">{company.address || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{company.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{company.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SIRET</p>
                    <p className="font-medium">{company.siret || "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Membres de l'équipe</h2>
            <div className="space-y-2">
              {teamMembers.map((member: any) => {
                const profile = member.profiles as any;
                const isMe = member.profile_id === user?.id;
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                      {(profile?.full_name || profile?.email || "?").substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{profile?.full_name || "Sans nom"}</p>
                        {isMe && <Badge variant="outline" className="text-[10px]">Vous</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        {(member.companies as any)?.short_name}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {roleLabels[member.role] || member.role}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun membre trouvé</p>
              )}
            </div>
          </motion.div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="emails">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmailTemplatesTab />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Parametres;
