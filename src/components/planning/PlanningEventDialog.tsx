import { useState, useEffect } from "react";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface PlanningEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any; // existing event for edit mode
  defaultDate?: Date;
  defaultResourceId?: string;
}

export const PlanningEventDialog = ({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultResourceId,
}: PlanningEventDialogProps) => {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const companyId = current === "global" ? dbCompanies[0]?.id : current;

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [resourceId, setResourceId] = useState<string>("__none__");
  const [dossierId, setDossierId] = useState<string>("__none__");
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId || "");

  // Fetch resources
  const { data: resources = [] } = useQuery({
    queryKey: ["planning-resources-dialog", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("resource_companies")
        .select("resource_id, resources(id, name, type)")
        .in("company_id", companyIds);
      const seen = new Set<string>();
      return (data || [])
        .map((rc: any) => rc.resources)
        .filter((r: any) => r && !seen.has(r.id) && seen.add(r.id));
    },
    enabled: open && companyIds.length > 0,
  });

  // Fetch dossiers
  const { data: dossiers = [] } = useQuery({
    queryKey: ["planning-dossiers-dialog", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("dossiers")
        .select("id, title, code, clients(name)")
        .in("company_id", companyIds)
        .not("stage", "in", '("termine","paye")')
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: open && companyIds.length > 0,
  });

  // Populate fields when editing
  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setDescription(event.description || "");
      setDate(format(new Date(event.start_time), "yyyy-MM-dd"));
      setStartTime(format(new Date(event.start_time), "HH:mm"));
      setEndTime(format(new Date(event.end_time), "HH:mm"));
      setResourceId(event.resource_id || "__none__");
      setDossierId(event.dossier_id || "__none__");
      setSelectedCompanyId(event.company_id || companyId || "");
    } else {
      setTitle("");
      setDescription("");
      setDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setStartTime("08:00");
      setEndTime("17:00");
      setResourceId(defaultResourceId || "__none__");
      setDossierId("__none__");
      setSelectedCompanyId(companyId || "");
    }
  }, [event, defaultDate, defaultResourceId, companyId, open]);

  const handleSave = async () => {
    if (!title.trim() || !date) {
      toast.error("Titre et date requis");
      return;
    }
    if (!selectedCompanyId) {
      toast.error("Sélectionnez une société");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        start_time: `${date}T${startTime}:00`,
        end_time: `${date}T${endTime}:00`,
        resource_id: resourceId === "__none__" ? null : resourceId,
        dossier_id: dossierId === "__none__" ? null : dossierId,
        company_id: selectedCompanyId,
        created_by: user?.id || null,
      };

      if (event) {
        const { error } = await supabase
          .from("planning_events")
          .update(payload)
          .eq("id", event.id);
        if (error) throw error;
        toast.success("Événement modifié");
      } else {
        const { error } = await supabase
          .from("planning_events")
          .insert(payload);
        if (error) throw error;
        toast.success("Événement créé");
      }

      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("planning_events")
        .delete()
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Événement supprimé");
      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {event ? "Modifier l'événement" : "Nouvel événement"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Déménagement Dupont" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {current === "global" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Société</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {dbCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Ressource</Label>
            <Select value={resourceId} onValueChange={setResourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Non assigné" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Non assigné</SelectItem>
                {resources.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Dossier lié</Label>
            <Select value={dossierId} onValueChange={setDossierId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun</SelectItem>
                {dossiers.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.code ? `${d.code} — ` : ""}{d.title} ({(d.clients as any)?.name || "—"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, détails…"
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {event && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving} className="mr-auto">
              Supprimer
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !date}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {event ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
