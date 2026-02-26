import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, HardHat, Truck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const RESOURCE_TYPES = [
  { value: "employe", label: "Employé" },
  { value: "grue", label: "Grue" },
  { value: "vehicule", label: "Véhicule" },
  { value: "equipement", label: "Équipement" },
  { value: "equipe", label: "Équipe" },
] as const;

const CONTRACT_TYPES = ["CDI", "CDD", "Intérimaire", "Sous-traitant", "Apprenti", "Stage"];

const CACES_OPTIONS = ["R482 (engins de chantier)", "R483 (grues mobiles)", "R484 (ponts roulants)", "R485 (chariots)", "R486 (PEMP)", "R487 (grues à tour)", "R489 (chariots élévateurs)", "R490 (grues auxiliaires)"];

const HABILITATION_ELEC = ["B0", "B1", "B1V", "B2", "B2V", "BR", "BC", "BE", "H0", "H1", "H1V", "H2", "H2V", "HC", "HE"];

const SKILLS_SUGGESTIONS = ["Manutention", "Levage", "Conduite PL", "Conduite SPL", "Montage grue", "Électricité", "Soudure", "Peinture", "Mécanique", "Plomberie"];

const PERMITS_SUGGESTIONS = ["Permis B", "Permis C", "Permis CE", "Permis D", "FIMO", "FCO", "ADR"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  allCompanies?: { id: string; shortName: string }[];
  defaultType?: string;
}

export function CreateResourceDialog({ open, onOpenChange, companyId, allCompanies, defaultType }: Props) {
  const queryClient = useQueryClient();

  // -- Base resource fields --
  const [name, setName] = useState("");
  const [type, setType] = useState(defaultType ?? "employe");
  const [notes, setNotes] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [permits, setPermits] = useState<string[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([companyId]);

  // -- Personnel fields --
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contractType, setContractType] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [address, setAddress] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [caces, setCaces] = useState<string[]>([]);
  const [habElec, setHabElec] = useState<string[]>([]);
  const [sst, setSst] = useState(false);
  const [aipr, setAipr] = useState(false);

  // -- Equipment fields --
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [registration, setRegistration] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [yearManufacture, setYearManufacture] = useState("");
  const [capacityTons, setCapacityTons] = useState("");
  const [reachMeters, setReachMeters] = useState("");
  const [heightMeters, setHeightMeters] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [technicalControlExpiry, setTechnicalControlExpiry] = useState("");
  const [vgpExpiry, setVgpExpiry] = useState("");
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");

  const isPersonnel = type === "employe";
  const isEquipment = ["grue", "vehicule", "equipement"].includes(type);

  const resetForm = () => {
    setName(""); setNotes(""); setSkills([]); setPermits([]);
    setSelectedCompanyIds([companyId]); setType(defaultType ?? "employe");
    setJobTitle(""); setPhone(""); setEmail(""); setContractType("");
    setHireDate(""); setAddress(""); setEmployeeId("");
    setEmergencyContact(""); setEmergencyPhone("");
    setCaces([]); setHabElec([]); setSst(false); setAipr(false);
    setBrand(""); setModel(""); setRegistration(""); setSerialNumber("");
    setYearManufacture(""); setCapacityTons(""); setReachMeters("");
    setHeightMeters(""); setDailyRate(""); setInsuranceExpiry("");
    setTechnicalControlExpiry(""); setVgpExpiry(""); setNextMaintenanceDate("");
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nom requis");
      if (selectedCompanyIds.length === 0) throw new Error("Sélectionnez au moins une société");

      const resourceId = crypto.randomUUID();

      // 1. Create resource
      const { error } = await supabase.from("resources").insert({
        id: resourceId,
        name: name.trim(),
        type: type as any,
        notes: notes.trim() || null,
        skills: skills.length > 0 ? skills : null,
        permits: permits.length > 0 ? permits : null,
      });
      if (error) throw error;

      // 2. Link to companies
      const links = selectedCompanyIds.map((cid) => ({ resource_id: resourceId, company_id: cid }));
      const { error: linkError } = await supabase.from("resource_companies").insert(links);
      if (linkError) throw linkError;

      // 3. Create personnel record if employee
      if (isPersonnel) {
        const personnelData: any = { resource_id: resourceId };
        if (jobTitle.trim()) personnelData.job_title = jobTitle.trim();
        if (phone.trim()) personnelData.phone = phone.trim();
        if (email.trim()) personnelData.email = email.trim();
        if (contractType) personnelData.contract_type = contractType;
        if (hireDate) personnelData.hire_date = hireDate;
        if (address.trim()) personnelData.address = address.trim();
        if (employeeId.trim()) personnelData.employee_id = employeeId.trim();
        if (emergencyContact.trim()) personnelData.emergency_contact = emergencyContact.trim();
        if (emergencyPhone.trim()) personnelData.emergency_phone = emergencyPhone.trim();
        if (caces.length > 0) personnelData.caces = caces;
        if (habElec.length > 0) personnelData.habilitations_elec = habElec;
        personnelData.sst = sst;
        personnelData.aipr = aipr;

        const { error: pErr } = await supabase.from("resource_personnel").insert(personnelData);
        if (pErr) console.warn("Personnel insert error:", pErr);
      }

      // 4. Create equipment record if equipment type
      if (isEquipment) {
        const eqData: any = { resource_id: resourceId };
        if (brand.trim()) eqData.brand = brand.trim();
        if (model.trim()) eqData.model = model.trim();
        if (registration.trim()) eqData.registration = registration.trim();
        if (serialNumber.trim()) eqData.serial_number = serialNumber.trim();
        if (yearManufacture) eqData.year_manufacture = Number(yearManufacture);
        if (capacityTons) eqData.capacity_tons = Number(capacityTons);
        if (reachMeters) eqData.reach_meters = Number(reachMeters);
        if (heightMeters) eqData.height_meters = Number(heightMeters);
        if (dailyRate) eqData.daily_rate = Number(dailyRate);
        if (insuranceExpiry) eqData.insurance_expiry = insuranceExpiry;
        if (technicalControlExpiry) eqData.technical_control_expiry = technicalControlExpiry;
        if (vgpExpiry) eqData.vgp_expiry = vgpExpiry;
        if (nextMaintenanceDate) eqData.next_maintenance_date = nextMaintenanceDate;

        const { error: eErr } = await supabase.from("resource_equipment").insert(eqData);
        if (eErr) console.warn("Equipment insert error:", eErr);
      }

      return { id: resourceId };
    },
    onSuccess: () => {
      toast.success("Ressource créée avec succès");
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-resources"] });
      queryClient.invalidateQueries({ queryKey: ["resource-equipment-all"] });
      queryClient.invalidateQueries({ queryKey: ["resource-personnel-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleArrayItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const toggleCompany = (cid: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Nouvelle ressource</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] px-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full flex mb-4">
              <TabsTrigger value="general" className="flex-1">Général</TabsTrigger>
              {isPersonnel && <TabsTrigger value="personnel" className="flex-1">Personnel</TabsTrigger>}
              {isEquipment && <TabsTrigger value="equipment" className="flex-1">Équipement</TabsTrigger>}
              <TabsTrigger value="competences" className="flex-1">Compétences</TabsTrigger>
            </TabsList>

            {/* ===== GENERAL TAB ===== */}
            <TabsContent value="general" className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label>Nom *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Jean Dupont, Grue MK73..." autoFocus />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label>Type *</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes optionnelles..." rows={2} />
              </div>

              {/* Company selection */}
              {allCompanies && allCompanies.length > 1 && (
                <div>
                  <Label>Sociétés</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {allCompanies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCompany(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          selectedCompanyIds.includes(c.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {c.shortName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ===== PERSONNEL TAB ===== */}
            {isPersonnel && (
              <TabsContent value="personnel" className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Poste / Fonction</Label>
                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Chef d'équipe..." />
                  </div>
                  <div>
                    <Label>N° employé</Label>
                    <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-001" />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 ..." />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@..." />
                  </div>
                  <div>
                    <Label>Type de contrat</Label>
                    <Select value={contractType} onValueChange={setContractType}>
                      <SelectTrigger><SelectValue placeholder="-- Choisir --" /></SelectTrigger>
                      <SelectContent>
                        {CONTRACT_TYPES.map((ct) => (
                          <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date d'embauche</Label>
                    <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Adresse</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse complète" />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Contact d'urgence</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nom</Label>
                      <Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Nom du contact" />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="06 ..." />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Habilitations & Certifications</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>CACES</Label>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {CACES_OPTIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleArrayItem(caces, setCaces, c)}
                            className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                              caces.includes(c)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Habilitations électriques</Label>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {HABILITATION_ELEC.map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => toggleArrayItem(habElec, setHabElec, h)}
                            className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                              habElec.includes(h)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Checkbox id="sst" checked={sst} onCheckedChange={(v) => setSst(!!v)} />
                        <Label htmlFor="sst" className="cursor-pointer text-sm">SST</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="aipr" checked={aipr} onCheckedChange={(v) => setAipr(!!v)} />
                        <Label htmlFor="aipr" className="cursor-pointer text-sm">AIPR</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ===== EQUIPMENT TAB ===== */}
            {isEquipment && (
              <TabsContent value="equipment" className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Marque</Label>
                    <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Liebherr, Potain..." />
                  </div>
                  <div>
                    <Label>Modèle</Label>
                    <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="MK73, K1000..." />
                  </div>
                  <div>
                    <Label>Immatriculation</Label>
                    <Input value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="AB-123-CD" />
                  </div>
                  <div>
                    <Label>N° série</Label>
                    <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="" />
                  </div>
                  <div>
                    <Label>Année de fabrication</Label>
                    <Input type="number" value={yearManufacture} onChange={(e) => setYearManufacture(e.target.value)} placeholder="2020" />
                  </div>
                  <div>
                    <Label>Tarif journalier (€)</Label>
                    <Input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="0" />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Caractéristiques techniques</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Capacité (T)</Label>
                      <Input type="number" step="0.1" value={capacityTons} onChange={(e) => setCapacityTons(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>Portée (m)</Label>
                      <Input type="number" step="0.1" value={reachMeters} onChange={(e) => setReachMeters(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>Hauteur (m)</Label>
                      <Input type="number" step="0.1" value={heightMeters} onChange={(e) => setHeightMeters(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Échéances</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Assurance</Label>
                      <Input type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} />
                    </div>
                    <div>
                      <Label>Contrôle technique</Label>
                      <Input type="date" value={technicalControlExpiry} onChange={(e) => setTechnicalControlExpiry(e.target.value)} />
                    </div>
                    <div>
                      <Label>VGP</Label>
                      <Input type="date" value={vgpExpiry} onChange={(e) => setVgpExpiry(e.target.value)} />
                    </div>
                    <div>
                      <Label>Prochain entretien</Label>
                      <Input type="date" value={nextMaintenanceDate} onChange={(e) => setNextMaintenanceDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ===== COMPETENCES TAB ===== */}
            <TabsContent value="competences" className="space-y-4 pb-4">
              <div>
                <Label>Compétences</Label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {SKILLS_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleArrayItem(skills, setSkills, s)}
                      className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                        skills.includes(s)
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {skills.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {skills.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] gap-1">
                        {s}
                        <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => toggleArrayItem(skills, setSkills, s)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Permis</Label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {PERMITS_SUGGESTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleArrayItem(permits, setPermits, p)}
                      className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                        permits.includes(p)
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {permits.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {permits.map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] gap-1">
                        {p}
                        <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => toggleArrayItem(permits, setPermits, p)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <div className="px-6 pb-6 pt-2 border-t">
          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim() || selectedCompanyIds.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            {create.isPending ? "Création..." : "Créer la ressource"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
