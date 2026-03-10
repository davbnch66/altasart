import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Users, Upload, Rocket, ChevronRight, ChevronLeft,
  Check, MapPin, Phone, Mail, FileText, Sparkles,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const STEPS = [
  { key: "welcome", icon: Rocket, label: "Bienvenue" },
  { key: "company", icon: Building2, label: "Société" },
  { key: "client", icon: Users, label: "Premier client" },
  { key: "import", icon: Upload, label: "Import" },
  { key: "tour", icon: Sparkles, label: "C'est parti !" },
];

export function OnboardingWizard() {
  const { user } = useAuth();
  const { dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  // Company form
  const [companyData, setCompanyData] = useState<Record<string, any>>({});
  const [selectedCompanyIdx, setSelectedCompanyIdx] = useState(0);

  // Client form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  // Check onboarding status
  const { data: profile, isLoading } = useQuery({
    queryKey: ["onboarding-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!isLoading && profile && !profile.onboarding_completed) {
      setOpen(true);
    }
  }, [isLoading, profile]);

  // Init company data from existing companies
  useEffect(() => {
    if (dbCompanies.length > 0 && Object.keys(companyData).length === 0) {
      const initial: Record<string, any> = {};
      dbCompanies.forEach((c, i) => {
        initial[c.id] = { name: c.name, address: "", phone: "", email: "", siret: "" };
      });
      setCompanyData(initial);
    }
  }, [dbCompanies]);

  const selectedCompany = dbCompanies[selectedCompanyIdx];

  const saveCompanyMutation = useMutation({
    mutationFn: async () => {
      for (const [id, data] of Object.entries(companyData)) {
        const updates: any = {};
        if ((data as any).address) updates.address = (data as any).address;
        if ((data as any).phone) updates.phone = (data as any).phone;
        if ((data as any).email) updates.email = (data as any).email;
        if ((data as any).siret) updates.siret = (data as any).siret;
        if (Object.keys(updates).length > 0) {
          await supabase.from("companies").update(updates).eq("id", id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Informations sociétés enregistrées");
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async () => {
      if (!clientName.trim() || !selectedCompany) return;
      const { error } = await supabase.from("clients").insert({
        name: clientName.trim(),
        email: clientEmail.trim() || null,
        phone: clientPhone.trim() || null,
        address: clientAddress.trim() || null,
        company_id: selectedCompany.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client créé !");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-check"] });
      setOpen(false);
      toast.success("Bienvenue ! Votre espace est prêt 🎉");
    },
  });

  const handleNext = async () => {
    if (step === 1) {
      await saveCompanyMutation.mutateAsync();
    }
    if (step === 2 && clientName.trim()) {
      await createClientMutation.mutateAsync();
    }
    if (step === STEPS.length - 1) {
      await completeOnboarding.mutateAsync();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSkip = () => {
    if (step === STEPS.length - 1) {
      completeOnboarding.mutate();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const updateCompanyField = (field: string, value: string) => {
    if (!selectedCompany) return;
    setCompanyData((prev) => ({
      ...prev,
      [selectedCompany.id]: { ...(prev[selectedCompany.id] || {}), [field]: value },
    }));
  };

  const currentCompanyData = selectedCompany ? companyData[selectedCompany.id] || {} : {};

  if (isLoading || !profile || profile.onboarding_completed) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className={`${isMobile ? "w-[95vw] max-w-[95vw] p-4" : "max-w-lg"} gap-0 overflow-hidden [&>button]:hidden`}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="flex gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="min-h-[280px]"
          >
            {/* WELCOME */}
            {step === 0 && (
              <div className="text-center space-y-4 py-6">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Rocket className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Bienvenue sur ALTASART</h2>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Configurons votre espace de travail en quelques étapes.
                  Vous pourrez modifier ces informations à tout moment dans les paramètres.
                </p>
              </div>
            )}

            {/* COMPANY SETUP */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Informations société</h2>
                </div>
                {dbCompanies.length > 1 && (
                  <div className="flex gap-1 flex-wrap">
                    {dbCompanies.map((c, i) => (
                      <Button
                        key={c.id}
                        variant={selectedCompanyIdx === i ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCompanyIdx(i)}
                        className="text-xs"
                      >
                        {c.shortName}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="grid gap-3">
                  <div>
                    <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Nom</Label>
                    <Input value={currentCompanyData.name || selectedCompany?.name || ""} disabled className="bg-muted" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Adresse</Label>
                    <Input
                      value={currentCompanyData.address || ""}
                      onChange={(e) => updateCompanyField("address", e.target.value)}
                      placeholder="1 rue de Paris, 75001 Paris"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Téléphone</Label>
                      <Input
                        value={currentCompanyData.phone || ""}
                        onChange={(e) => updateCompanyField("phone", e.target.value)}
                        placeholder="01 23 45 67 89"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                      <Input
                        value={currentCompanyData.email || ""}
                        onChange={(e) => updateCompanyField("email", e.target.value)}
                        placeholder="contact@societe.fr"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> SIRET</Label>
                    <Input
                      value={currentCompanyData.siret || ""}
                      onChange={(e) => updateCompanyField("siret", e.target.value)}
                      placeholder="123 456 789 00012"
                      maxLength={17}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* FIRST CLIENT */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Créer votre premier client</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ajoutez un client pour commencer à créer des devis et des dossiers. Vous pourrez en ajouter d'autres plus tard.
                </p>
                <div className="grid gap-3">
                  <div>
                    <Label>Nom du client *</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: CEGELEC, Bouygues..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="contact@client.fr"
                        type="email"
                      />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="01 23 45 67 89"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Adresse</Label>
                    <Input
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="Adresse du client"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* IMPORT */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Importer des données</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Vous pourrez importer vos données existantes depuis les paramètres de l'application.
                </p>
                <div className="grid gap-3">
                  {[
                    { label: "Clients", desc: "Import CSV de votre base clients", icon: Users },
                    { label: "Matériel", desc: "Catalogue de matériel (CSV/Excel)", icon: FileText },
                    { label: "Ressources", desc: "Personnel et engins", icon: Building2 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 text-xs" disabled>
                        Bientôt
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 L'import de données sera disponible dans Paramètres → Données.
                </p>
              </div>
            )}

            {/* TOUR / FINISH */}
            {step === 4 && (
              <div className="space-y-4 py-4">
                <div className="text-center space-y-3">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Votre espace est prêt !</h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Voici les modules principaux à explorer :
                  </p>
                </div>
                <div className="grid gap-2">
                  {[
                    { icon: "📋", label: "Visites", desc: "Planifiez vos visites techniques sur site" },
                    { icon: "📄", label: "Devis", desc: "Créez et envoyez des devis professionnels" },
                    { icon: "📁", label: "Dossiers", desc: "Suivez vos chantiers de A à Z" },
                    { icon: "📅", label: "Planning", desc: "Gérez la planification des équipes et engins" },
                    { icon: "💰", label: "Finance", desc: "Facturation, règlements et export FEC" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center gap-3 rounded-lg border p-2.5 bg-muted/20">
                      <span className="text-lg">{m.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t">
          <div>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Retour
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && step < STEPS.length - 1 && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-xs text-muted-foreground">
                Passer
              </Button>
            )}
            <Button onClick={handleNext} size="sm" className="gap-1.5">
              {step === STEPS.length - 1 ? (
                <>
                  <Check className="h-4 w-4" /> Commencer
                </>
              ) : (
                <>
                  Suivant <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
