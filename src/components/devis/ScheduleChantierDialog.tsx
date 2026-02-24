import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Warehouse } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { MaterielListDisplay } from "@/components/MaterielListDisplay";

const DEPOT_ADDRESS = { address: "12 rue Jean Monnet", postal_code: "95190", city: "Goussainville" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devis: any;
  dossier: any;
}

export const ScheduleChantierDialog = ({ open, onOpenChange, devis, dossier }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");

  const [loadingAddress, setLoadingAddress] = useState("");
  const [loadingPostalCode, setLoadingPostalCode] = useState("");
  const [loadingCity, setLoadingCity] = useState("");
  const [loadingFloor, setLoadingFloor] = useState("");
  const [loadingElevator, setLoadingElevator] = useState(false);

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryFloor, setDeliveryFloor] = useState("");
  const [deliveryElevator, setDeliveryElevator] = useState(false);

  // volume/weight kept for DB insert but auto-calculated from materiel list
  const [volume, setVolume] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  // Pre-fill from dossier (fallback to client address if dossier has none)
  useEffect(() => {
    if (open && dossier) {
      const client = devis.clients as any;
      const hasLoadingAddr = !!dossier.loading_address;
      const hasDeliveryAddr = !!dossier.delivery_address;
      const clientAddr = client?.address || "";
      const clientPC = client?.postal_code || "";
      const clientCity = client?.city || "";

      setLoadingAddress(hasLoadingAddr ? dossier.loading_address : clientAddr);
      setLoadingPostalCode(hasLoadingAddr ? (dossier.loading_postal_code || "") : clientPC);
      setLoadingCity(hasLoadingAddr ? (dossier.loading_city || "") : clientCity);
      setLoadingFloor(dossier.loading_floor || "");
      setLoadingElevator(dossier.loading_elevator || false);
      setDeliveryAddress(hasDeliveryAddr ? dossier.delivery_address : clientAddr);
      setDeliveryPostalCode(hasDeliveryAddr ? (dossier.delivery_postal_code || "") : clientPC);
      setDeliveryCity(hasDeliveryAddr ? (dossier.delivery_city || "") : clientCity);
      setDeliveryFloor(dossier.delivery_floor || "");
      setDeliveryElevator(dossier.delivery_elevator || false);
      setVolume(dossier.volume && dossier.volume > 0 ? String(dossier.volume) : "");
      setWeight(dossier.weight && dossier.weight > 0 ? String(dossier.weight) : "");
      setNotes("");
      setStartDate(undefined);
      setEndDate(undefined);
      setStartTime("08:00");
      setEndTime("17:00");
    }
  }, [open, dossier, devis]);

  const fillDepot = (prefix: "loading" | "delivery") => {
    if (prefix === "loading") {
      setLoadingAddress(DEPOT_ADDRESS.address);
      setLoadingPostalCode(DEPOT_ADDRESS.postal_code);
      setLoadingCity(DEPOT_ADDRESS.city);
    } else {
      setDeliveryAddress(DEPOT_ADDRESS.address);
      setDeliveryPostalCode(DEPOT_ADDRESS.postal_code);
      setDeliveryCity(DEPOT_ADDRESS.city);
    }
  };

  const handleSave = async () => {
    if (!startDate) {
      toast.error("Sélectionnez une date de début");
      return;
    }
    setSaving(true);
    try {
      const sDateStr = format(startDate, "yyyy-MM-dd");
      const eDateStr = endDate ? format(endDate, "yyyy-MM-dd") : sDateStr;

      // 1. Create operation
      const { data: ops } = await supabase
        .from("operations")
        .select("operation_number")
        .eq("dossier_id", dossier.id)
        .order("operation_number", { ascending: false })
        .limit(1);
      const nextNum = ((ops?.[0] as any)?.operation_number || 0) + 1;

      const { error: opError } = await (supabase.from("operations") as any).insert({
        dossier_id: dossier.id,
        company_id: devis.company_id,
        operation_number: nextNum,
        sort_order: nextNum,
        type: "B.T.",
        loading_date: sDateStr,
        loading_time_start: startTime,
        loading_time_end: endTime,
        loading_address: loadingAddress || null,
        loading_postal_code: loadingPostalCode || null,
        loading_city: loadingCity || null,
        loading_floor: loadingFloor || null,
        loading_elevator: loadingElevator,
        delivery_date: eDateStr,
        delivery_time_start: startTime,
        delivery_time_end: endTime,
        delivery_address: deliveryAddress || null,
        delivery_postal_code: deliveryPostalCode || null,
        delivery_city: deliveryCity || null,
        delivery_floor: deliveryFloor || null,
        delivery_elevator: deliveryElevator,
        volume: volume ? Number(volume) : 0,
        weight: weight ? Number(weight) : 0,
        notes: notes || null,
      });
      if (opError) throw opError;

      // 2. Create planning event
      const startISO = `${sDateStr}T${startTime}:00`;
      const endISO = `${eDateStr}T${endTime}:00`;

      const { error: evError } = await supabase.from("planning_events").insert({
        title: `${dossier.code || dossier.title} – ${devis.objet}`,
        event_type: "intervention",
        start_time: startISO,
        end_time: endISO,
        company_id: devis.company_id,
        dossier_id: dossier.id,
        client_id: devis.client_id,
        loading_address: loadingAddress || null,
        loading_postal_code: loadingPostalCode || null,
        loading_city: loadingCity || null,
        loading_floor: loadingFloor || null,
        loading_elevator: loadingElevator,
        delivery_address: deliveryAddress || null,
        delivery_postal_code: deliveryPostalCode || null,
        delivery_city: deliveryCity || null,
        delivery_floor: deliveryFloor || null,
        delivery_elevator: deliveryElevator,
        volume: volume ? Number(volume) : null,
        weight: weight ? Number(weight) : null,
        description: notes || null,
        created_by: user?.id || null,
        color: "#3b82f6",
        priority: "normale",
      } as any);
      if (evError) throw evError;

      // 3. Update dossier stage to planifie if currently accepte
      if (dossier.stage === "accepte") {
        await supabase.from("dossiers").update({ stage: "planifie" }).eq("id", dossier.id);
      }

      toast.success("Chantier programmé (opération + planning)");
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations-count"] });
      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      queryClient.invalidateQueries({ queryKey: ["devis-detail"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || "Impossible de programmer"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", isMobile ? "max-w-full" : "max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="text-base">Programmer le chantier</DialogTitle>
          <p className="text-xs text-muted-foreground">{devis.code} – {devis.objet}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dates */}
          <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <div>
              <Label className="text-xs">Date de début *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-xs h-9 mt-1">
                    <CalendarIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    {startDate ? format(startDate, "dd MMM yyyy", { locale: fr }) : "Choisir…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Date de fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-xs h-9 mt-1">
                    <CalendarIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    {endDate ? format(endDate, "dd MMM yyyy", { locale: fr }) : "Même jour"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Heure début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Heure fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          {/* Adresses */}
          <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            {/* Chargement */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Chargement</h4>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => fillDepot("loading")}>
                  <Warehouse className="h-3 w-3" /> Dépôt
                </Button>
              </div>
              <AddressAutocomplete value={loadingAddress} onChange={setLoadingAddress} placeholder="Adresse de chargement" />
              <div className="grid grid-cols-3 gap-2">
                <Input value={loadingPostalCode} onChange={(e) => setLoadingPostalCode(e.target.value)} placeholder="CP" className="h-7 text-xs" />
                <Input value={loadingCity} onChange={(e) => setLoadingCity(e.target.value)} placeholder="Ville" className="h-7 text-xs col-span-2" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={loadingFloor} onChange={(e) => setLoadingFloor(e.target.value)} placeholder="Étage" className="h-7 text-xs" />
                <div className="flex items-center gap-1.5">
                  <Checkbox id="load-elev" checked={loadingElevator} onCheckedChange={(v) => setLoadingElevator(!!v)} />
                  <label htmlFor="load-elev" className="text-[10px]">Ascenseur</label>
                </div>
              </div>
            </div>

            {/* Livraison */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Livraison</h4>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => fillDepot("delivery")}>
                  <Warehouse className="h-3 w-3" /> Dépôt
                </Button>
              </div>
              <AddressAutocomplete value={deliveryAddress} onChange={setDeliveryAddress} placeholder="Adresse de livraison" />
              <div className="grid grid-cols-3 gap-2">
                <Input value={deliveryPostalCode} onChange={(e) => setDeliveryPostalCode(e.target.value)} placeholder="CP" className="h-7 text-xs" />
                <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder="Ville" className="h-7 text-xs col-span-2" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={deliveryFloor} onChange={(e) => setDeliveryFloor(e.target.value)} placeholder="Étage" className="h-7 text-xs" />
                <div className="flex items-center gap-1.5">
                  <Checkbox id="del-elev" checked={deliveryElevator} onCheckedChange={(v) => setDeliveryElevator(!!v)} />
                  <label htmlFor="del-elev" className="text-[10px]">Ascenseur</label>
                </div>
              </div>
            </div>
          </div>

          {/* Liste matériel (depuis la visite) */}
          <MaterielListDisplay visiteId={devis.visite_id} dossierId={dossier?.id} />

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes / Consignes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px] text-xs mt-1 resize-none" placeholder="Consignes particulières…" />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Programmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
