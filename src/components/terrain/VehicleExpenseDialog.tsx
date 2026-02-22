import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Plus, Sparkles, Loader2, Receipt, Upload, X } from "lucide-react";
import { toast } from "sonner";

const EXPENSE_TYPES = [
  { value: "gasoil", label: "Gasoil" },
  { value: "entretien", label: "Entretien" },
  { value: "reparation", label: "Réparation" },
  { value: "peage", label: "Péage" },
  { value: "lavage", label: "Lavage" },
  { value: "amende", label: "Amende" },
  { value: "autre", label: "Autre" },
];

interface Props {
  resourceId: string;
  companyId: string;
  trigger?: React.ReactNode;
}

export function VehicleExpenseDialog({ resourceId, companyId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    expense_type: "gasoil",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    vendor: "",
    description: "",
    liters: "",
    mileage_km: "",
    reference: "",
    notes: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);

  const resetForm = () => {
    setForm({
      expense_type: "gasoil", amount: "", expense_date: new Date().toISOString().split("T")[0],
      vendor: "", description: "", liters: "", mileage_km: "", reference: "", notes: "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setAiUsed(false);
  };

  const handlePhoto = async (file: File) => {
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Auto-analyze with AI
    setAnalyzing(true);
    try {
      const base64Reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        base64Reader.onload = () => {
          const result = base64Reader.result as string;
          resolve(result.split(",")[1]);
        };
        base64Reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("analyze-expense-photo", {
        body: { imageBase64: base64, mimeType: file.type },
      });

      if (error) throw error;
      if (data?.data) {
        const d = data.data;
        setForm((prev) => ({
          ...prev,
          expense_type: d.expense_type && EXPENSE_TYPES.some((t) => t.value === d.expense_type) ? d.expense_type : prev.expense_type,
          amount: d.amount != null ? String(d.amount) : prev.amount,
          expense_date: d.expense_date || prev.expense_date,
          vendor: d.vendor || prev.vendor,
          description: d.description || prev.description,
          liters: d.liters != null ? String(d.liters) : prev.liters,
          mileage_km: d.mileage_km != null ? String(d.mileage_km) : prev.mileage_km,
          reference: d.reference || prev.reference,
          notes: d.notes || prev.notes,
        }));
        setAiUsed(true);
        toast.success("Photo analysée — vérifiez les données");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur d'analyse IA : " + (e.message || "réessayez"));
    } finally {
      setAnalyzing(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.amount || Number(form.amount) <= 0) throw new Error("Montant requis");

      let photo_url: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${companyId}/${resourceId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("vehicle-expenses").upload(path, photoFile);
        if (upErr) throw upErr;
        photo_url = path;
      }

      const { error } = await supabase.from("vehicle_expenses").insert({
        resource_id: resourceId,
        company_id: companyId,
        expense_type: form.expense_type,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        vendor: form.vendor || null,
        description: form.description || null,
        liters: form.liters ? Number(form.liters) : null,
        mileage_km: form.mileage_km ? Number(form.mileage_km) : null,
        reference: form.reference || null,
        photo_url,
        ai_extracted: aiUsed,
        notes: form.notes || null,
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dépense enregistrée");
      qc.invalidateQueries({ queryKey: ["vehicle-expenses"] });
      qc.invalidateQueries({ queryKey: ["terrain-vehicle-expenses"] });
      qc.invalidateQueries({ queryKey: ["resource-interventions"] });
      resetForm();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5">
            <Receipt className="h-4 w-4" /> Ajouter dépense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Nouvelle dépense véhicule
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo upload */}
          <div className="space-y-2">
            <Label>Photo du ticket / facture</Label>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Ticket" className="w-full max-h-48 object-contain rounded-lg border" />
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 bg-background/80" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                  <X className="h-4 w-4" />
                </Button>
                {analyzing && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <Sparkles className="h-4 w-4" /> Analyse IA...
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => {
                  if (fileRef.current) { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); }
                }}>
                  <Camera className="h-4 w-4" /> Photo
                </Button>
                <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => {
                  if (fileRef.current) { fileRef.current.removeAttribute("capture"); fileRef.current.click(); }
                }}>
                  <Upload className="h-4 w-4" /> Galerie
                </Button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ""; }}
            />
            {aiUsed && (
              <p className="text-xs text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Pré-rempli par l'IA — vérifiez avant de valider
              </p>
            )}
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type *</Label>
              <select
                value={form.expense_type}
                onChange={(e) => setForm((p) => ({ ...p, expense_type: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {EXPENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Montant (€) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))} />
            </div>
            <div>
              <Label>Fournisseur</Label>
              <Input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="Station, garage..." />
            </div>
            {form.expense_type === "gasoil" && (
              <div>
                <Label>Litres</Label>
                <Input type="number" step="0.1" value={form.liters} onChange={(e) => setForm((p) => ({ ...p, liters: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Km compteur</Label>
              <Input type="number" value={form.mileage_km} onChange={(e) => setForm((p) => ({ ...p, mileage_km: e.target.value }))} />
            </div>
            <div>
              <Label>N° facture/ticket</Label>
              <Input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Détails..." />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || analyzing}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
