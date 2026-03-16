import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, Upload, Image as ImageIcon, Loader2, GripVertical, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PpspsEditorProps {
  content: any;
  onContentChange: (updated: any) => void;
  customSections: CustomSection[];
  onCustomSectionsChange: (sections: CustomSection[]) => void;
  images: PpspsImage[];
  onImagesChange: (images: PpspsImage[]) => void;
  attachments: PpspsAttachment[];
  onAttachmentsChange: (attachments: PpspsAttachment[]) => void;
  ppspsId: string;
  companyId: string;
}

export interface CustomSection {
  id: string;
  title: string;
  content: string;
  position: "before_risques" | "after_risques" | "end";
}

export interface PpspsImage {
  id: string;
  storagePath: string;
  caption: string;
  section: string;
  url?: string;
}

export interface PpspsAttachment {
  id: string;
  storagePath: string;
  fileName: string;
  size: number;
  url?: string;
}

export function PpspsEditor({
  content, onContentChange,
  customSections, onCustomSectionsChange,
  images, onImagesChange,
  attachments, onAttachmentsChange,
  ppspsId, companyId,
}: PpspsEditorProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const updateField = (path: string, value: any) => {
    const updated = JSON.parse(JSON.stringify(content));
    const parts = path.split(".");
    let obj = updated;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    onContentChange(updated);
  };

  const updateArrayItem = (path: string, index: number, field: string, value: string) => {
    const updated = JSON.parse(JSON.stringify(content));
    const parts = path.split(".");
    let arr = updated;
    for (const p of parts) arr = arr[p];
    if (arr && arr[index]) arr[index][field] = value;
    onContentChange(updated);
  };

  const addArrayItem = (path: string, template: any) => {
    const updated = JSON.parse(JSON.stringify(content));
    const parts = path.split(".");
    let obj = updated;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    const key = parts[parts.length - 1];
    if (!obj[key]) obj[key] = [];
    obj[key].push(template);
    onContentChange(updated);
  };

  const removeArrayItem = (path: string, index: number) => {
    const updated = JSON.parse(JSON.stringify(content));
    const parts = path.split(".");
    let obj = updated;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    const key = parts[parts.length - 1];
    obj[key].splice(index, 1);
    onContentChange(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingImage(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${companyId}/${ppspsId}/images/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("ppsps-files").upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data: urlData } = await supabase.storage.from("ppsps-files").createSignedUrl(path, 3600);
        onImagesChange([...images, {
          id: crypto.randomUUID(),
          storagePath: path,
          caption: file.name.replace(/\.[^.]+$/, ""),
          section: "general",
          url: urlData?.signedUrl,
        }]);
      }
      toast.success("Image(s) ajoutée(s)");
    } catch (err: any) {
      toast.error("Erreur upload : " + err.message);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${companyId}/${ppspsId}/attachments/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("ppsps-files").upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data: urlData } = await supabase.storage.from("ppsps-files").createSignedUrl(path, 3600);
        onAttachmentsChange([...attachments, {
          id: crypto.randomUUID(),
          storagePath: path,
          fileName: file.name,
          size: file.size,
          url: urlData?.signedUrl,
        }]);
      }
      toast.success("Pièce(s) jointe(s) ajoutée(s)");
    } catch (err: any) {
      toast.error("Erreur upload : " + err.message);
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  };

  const removeImage = async (img: PpspsImage) => {
    await supabase.storage.from("ppsps-files").remove([img.storagePath]);
    onImagesChange(images.filter((i) => i.id !== img.id));
  };

  const removeAttachment = async (att: PpspsAttachment) => {
    await supabase.storage.from("ppsps-files").remove([att.storagePath]);
    onAttachmentsChange(attachments.filter((a) => a.id !== att.id));
  };

  const addCustomSection = () => {
    onCustomSectionsChange([...customSections, {
      id: crypto.randomUUID(),
      title: "Nouvelle section",
      content: "",
      position: "end",
    }]);
  };

  const removeCustomSection = (id: string) => {
    onCustomSectionsChange(customSections.filter((s) => s.id !== id));
  };

  const updateCustomSection = (id: string, field: keyof CustomSection, value: string) => {
    onCustomSectionsChange(customSections.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const rg = content.renseignements_generaux || {};
  const secours = content.organisation_secours || {};

  return (
    <div className="space-y-4 p-4 text-sm">
      <Accordion type="multiple" defaultValue={["rg", "secours", "description"]} className="space-y-2">
        {/* I. Renseignements Généraux */}
        <AccordionItem value="rg" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">I. Renseignements Généraux</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <FieldRow label="Adresse du chantier" value={rg.adresse_chantier} onChange={(v) => updateField("renseignements_generaux.adresse_chantier", v)} />
            <FieldRow label="Donneur d'ordre" value={rg.donneur_ordre} onChange={(v) => updateField("renseignements_generaux.donneur_ordre", v)} />
            <FieldRow label="Responsable au siège" value={rg.responsable_siege} onChange={(v) => updateField("renseignements_generaux.responsable_siege", v)} />
            <FieldRow label="Responsable chantier" value={rg.responsable_chantier} onChange={(v) => updateField("renseignements_generaux.responsable_chantier", v)} />
            <FieldRow label="Chargé d'exécution" value={rg.charge_execution} onChange={(v) => updateField("renseignements_generaux.charge_execution", v)} />
          </AccordionContent>
        </AccordionItem>

        {/* Intervenants */}
        <AccordionItem value="intervenants" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">Intervenants</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {(content.intervenants || []).map((item: any, i: number) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input className="h-8 text-xs" value={item.poste || ""} onChange={(e) => updateArrayItem("intervenants", i, "poste", e.target.value)} placeholder="Poste" />
                  <Input className="h-8 text-xs" value={item.nom_adresse || ""} onChange={(e) => updateArrayItem("intervenants", i, "nom_adresse", e.target.value)} placeholder="Nom / Adresse" />
                  <Input className="h-8 text-xs" value={item.contact || ""} onChange={(e) => updateArrayItem("intervenants", i, "contact", e.target.value)} placeholder="Contact" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeArrayItem("intervenants", i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => addArrayItem("intervenants", { poste: "", nom_adresse: "", contact: "" })}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter un intervenant
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Organisation secours */}
        <AccordionItem value="secours" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">II. Organisation des secours</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <FieldArea label="Premiers secours" value={secours.premiers_secours} onChange={(v) => updateField("organisation_secours.premiers_secours", v)} />
            <FieldArea label="Consignes en cas d'accidents" value={secours.consignes_accidents} onChange={(v) => updateField("organisation_secours.consignes_accidents", v)} />
            <FieldArea label="Droit d'alerte et de retrait" value={secours.droit_retrait} onChange={(v) => updateField("organisation_secours.droit_retrait", v)} />
            <Separator />
            <Label className="text-xs font-semibold">Numéros d'urgence</Label>
            {(secours.numeros_urgence || []).map((n: any, i: number) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input className="h-8 text-xs" value={n.denomination || ""} onChange={(e) => { const u = { ...content }; u.organisation_secours.numeros_urgence[i].denomination = e.target.value; onContentChange({ ...u }); }} placeholder="Dénomination" />
                  <Input className="h-8 text-xs" value={n.adresse || ""} onChange={(e) => { const u = { ...content }; u.organisation_secours.numeros_urgence[i].adresse = e.target.value; onContentChange({ ...u }); }} placeholder="Adresse" />
                  <Input className="h-8 text-xs" value={n.telephone || ""} onChange={(e) => { const u = { ...content }; u.organisation_secours.numeros_urgence[i].telephone = e.target.value; onContentChange({ ...u }); }} placeholder="Téléphone" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => { const u = JSON.parse(JSON.stringify(content)); u.organisation_secours.numeros_urgence.splice(i, 1); onContentChange(u); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => { const u = JSON.parse(JSON.stringify(content)); if (!u.organisation_secours) u.organisation_secours = {}; if (!u.organisation_secours.numeros_urgence) u.organisation_secours.numeros_urgence = []; u.organisation_secours.numeros_urgence.push({ denomination: "", adresse: "", telephone: "" }); onContentChange(u); }}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter un numéro
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Mesures spécifiques */}
        <AccordionItem value="mesures" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">Mesures spécifiques</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {(content.mesures_specifiques || []).map((m: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input className="h-8 text-xs flex-1" value={m} onChange={(e) => { const u = JSON.parse(JSON.stringify(content)); u.mesures_specifiques[i] = e.target.value; onContentChange(u); }} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const u = JSON.parse(JSON.stringify(content)); u.mesures_specifiques.splice(i, 1); onContentChange(u); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => addArrayItem("mesures_specifiques", "")}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter une mesure
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Description opération */}
        <AccordionItem value="description" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">III. Description de l'opération</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <FieldArea label="Description" value={content.description_operation} onChange={(v) => updateField("description_operation", v)} rows={6} />
            <FieldArea label="Méthodologie de manutention" value={content.methodologie} onChange={(v) => updateField("methodologie", v)} rows={4} />
            <FieldArea label="Moyens humains" value={content.moyens_humains} onChange={(v) => updateField("moyens_humains", v)} rows={3} />
          </AccordionContent>
        </AccordionItem>

        {/* Mode opératoire */}
        <AccordionItem value="mode_op" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">Mode opératoire</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {(content.mode_operatoire || []).map((phase: any, i: number) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <Input className="h-8 text-xs font-semibold flex-1" value={phase.phase || ""} onChange={(e) => updateArrayItem("mode_operatoire", i, "phase", e.target.value)} placeholder="Phase" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArrayItem("mode_operatoire", i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea className="text-xs min-h-[60px]" value={(phase.etapes || []).join("\n")} onChange={(e) => {
                  const u = JSON.parse(JSON.stringify(content));
                  u.mode_operatoire[i].etapes = e.target.value.split("\n").filter((l: string) => l.trim());
                  onContentChange(u);
                }} placeholder="Une étape par ligne" />
              </Card>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => addArrayItem("mode_operatoire", { phase: "Nouvelle phase", etapes: [] })}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter une phase
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Habilitations */}
        <AccordionItem value="habilitations" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">Habilitations et autorisations</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {(content.habilitations || []).map((h: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input className="h-8 text-xs flex-1" value={h} onChange={(e) => { const u = JSON.parse(JSON.stringify(content)); u.habilitations[i] = e.target.value; onContentChange(u); }} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const u = JSON.parse(JSON.stringify(content)); u.habilitations.splice(i, 1); onContentChange(u); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => addArrayItem("habilitations", "")}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Analyse des risques */}
        <AccordionItem value="risques" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">IV. Analyse des risques</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {(content.analyse_risques || []).map((r: any, i: number) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={() => removeArrayItem("analyse_risques", i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Situation dangereuse</Label><Input className="h-8 text-xs" value={r.situation_dangereuse || ""} onChange={(e) => updateArrayItem("analyse_risques", i, "situation_dangereuse", e.target.value)} /></div>
                  <div><Label className="text-[10px]">Risques</Label><Input className="h-8 text-xs" value={r.risques || ""} onChange={(e) => updateArrayItem("analyse_risques", i, "risques", e.target.value)} /></div>
                  <div><Label className="text-[10px]">Mesures de prévention</Label><Input className="h-8 text-xs" value={r.mesures_prevention || ""} onChange={(e) => updateArrayItem("analyse_risques", i, "mesures_prevention", e.target.value)} /></div>
                  <div><Label className="text-[10px]">Moyens de protection</Label><Input className="h-8 text-xs" value={r.moyens_protection || ""} onChange={(e) => updateArrayItem("analyse_risques", i, "moyens_protection", e.target.value)} /></div>
                </div>
              </Card>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => addArrayItem("analyse_risques", { situation_dangereuse: "", risques: "", mesures_prevention: "", moyens_protection: "" })}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter un risque
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Planning */}
        <AccordionItem value="planning" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">Planning prévisionnel</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <FieldRow label="Horaire de travail" value={content.planning?.horaire_travail} onChange={(v) => updateField("planning.horaire_travail", v)} />
            <FieldRow label="Durée estimée" value={content.planning?.duree_estimee} onChange={(v) => updateField("planning.duree_estimee", v)} />
            <FieldRow label="Date de début" value={content.planning?.date_debut} onChange={(v) => updateField("planning.date_debut", v)} />
            <FieldRow label="Date de fin" value={content.planning?.date_fin} onChange={(v) => updateField("planning.date_fin", v)} />
          </AccordionContent>
        </AccordionItem>

        {/* Moyens matériels */}
        <AccordionItem value="materiels" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">Moyens matériels</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {(content.moyens_materiels || []).map((m: any, i: number) => (
              <Card key={i} className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Matériel</Label><Input className="h-8 text-xs" value={m.materiel || ""} onChange={(e) => updateArrayItem("moyens_materiels", i, "materiel", e.target.value)} /></div>
                  <div><Label className="text-[10px]">Vérification</Label><Input className="h-8 text-xs" value={m.soumis_verification || ""} onChange={(e) => updateArrayItem("moyens_materiels", i, "soumis_verification", e.target.value)} /></div>
                  <div><Label className="text-[10px]">Risques</Label><Input className="h-8 text-xs" value={m.risques || ""} onChange={(e) => updateArrayItem("moyens_materiels", i, "risques", e.target.value)} /></div>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive mt-1" onClick={() => removeArrayItem("moyens_materiels", i)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                </Button>
              </Card>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => addArrayItem("moyens_materiels", { materiel: "", soumis_verification: "", date_controle: "", date_fin: "", risques: "" })}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter un matériel
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Prérequis client */}
        <AccordionItem value="prerequis" className="border rounded-lg px-4">
          <AccordionTrigger className="text-xs font-bold text-primary">Avant notre intervention</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {(content.prerequis_client || []).map((p: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input className="h-8 text-xs flex-1" value={p} onChange={(e) => { const u = JSON.parse(JSON.stringify(content)); u.prerequis_client[i] = e.target.value; onContentChange(u); }} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const u = JSON.parse(JSON.stringify(content)); u.prerequis_client.splice(i, 1); onContentChange(u); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => addArrayItem("prerequis_client", "")}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator />

      {/* Sections personnalisées */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-primary">Sections personnalisées</h3>
          <Button variant="outline" size="sm" className="text-xs" onClick={addCustomSection}>
            <Plus className="h-3 w-3 mr-1" /> Ajouter une section
          </Button>
        </div>
        {customSections.map((section) => (
          <Card key={section.id} className="p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Input className="h-8 text-xs font-semibold flex-1" value={section.title} onChange={(e) => updateCustomSection(section.id, "title", e.target.value)} placeholder="Titre de la section" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCustomSection(section.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Textarea className="text-xs min-h-[80px]" value={section.content} onChange={(e) => updateCustomSection(section.id, "content", e.target.value)} placeholder="Contenu de la section…" />
          </Card>
        ))}
      </div>

      <Separator />

      {/* Images intégrées */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-primary">Images intégrées au document</h3>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
            {uploadingImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImageIcon className="h-3 w-3 mr-1" />}
            Ajouter une image
          </Button>
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
        </div>
        {images.length === 0 && <p className="text-xs text-muted-foreground">Aucune image ajoutée. Les images apparaîtront en annexe du PDF.</p>}
        <div className="grid grid-cols-2 gap-2">
          {images.map((img) => (
            <Card key={img.id} className="p-2 space-y-1">
              {img.url && <img src={img.url} alt={img.caption} className="w-full h-24 object-cover rounded" />}
              <Input className="h-7 text-xs" value={img.caption} onChange={(e) => onImagesChange(images.map((i) => i.id === img.id ? { ...i, caption: e.target.value } : i))} placeholder="Légende" />
              <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive w-full" onClick={() => removeImage(img)}>
                <Trash2 className="h-3 w-3 mr-1" /> Supprimer
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Pièces jointes email */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-primary">Pièces jointes (email)</h3>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => attachmentInputRef.current?.click()} disabled={uploadingAttachment}>
            {uploadingAttachment ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
            Ajouter un fichier
          </Button>
          <input ref={attachmentInputRef} type="file" multiple className="hidden" onChange={handleAttachmentUpload} />
        </div>
        {attachments.length === 0 && <p className="text-xs text-muted-foreground">Aucune pièce jointe. Ces fichiers seront joints à l'email en plus du PDF.</p>}
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-2 text-xs border rounded-md p-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{att.fileName}</span>
            <span className="text-muted-foreground shrink-0">{(att.size / 1024).toFixed(0)} Ko</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeAttachment(att)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldRow({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground min-w-[130px] shrink-0">{label}</Label>
      <Input className="h-8 text-xs flex-1" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldArea({ label, value, onChange, rows = 3 }: { label: string; value?: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea className="text-xs mt-1" value={value || ""} onChange={(e) => onChange(e.target.value)} rows={rows} />
    </div>
  );
}
