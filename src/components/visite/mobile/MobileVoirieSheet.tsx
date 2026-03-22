import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Loader2, Map, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const VOIRIE_TYPES = [
  { key: "arrete_stationnement", label: "Arrêté de stationnement" },
  { key: "plan_voirie", label: "Plan voirie (1/200ème)" },
  { key: "emprise", label: "Emprise sur chaussée" },
  { key: "autorisation_grue", label: "Autorisation grue" },
  { key: "autre", label: "Autre" },
];

const VOIRIE_STATUSES = [
  { key: "a_faire", label: "À faire", cls: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
  { key: "demandee", label: "Demandée", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  { key: "en_attente", label: "En attente", cls: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  { key: "obtenue", label: "Obtenue", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  { key: "refusee", label: "Refusée", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  visiteId: string;
  needsVoirie: boolean;
  voirieType: string | null;
  voirieStatus: string;
  voirieNotes: string | null;
  onSaved: (data: { needs_voirie: boolean; voirie_type: string | null; voirie_status: string; voirie_notes: string | null }) => void;
  visiteAddress?: string | null;
  visiteCity?: string | null;
  companyId?: string;
  visiteCode?: string | null;
  clientName?: string | null;
}

export const MobileVoirieSheet = ({
  open, onClose, visiteId, needsVoirie, voirieType, voirieStatus, voirieNotes,
  onSaved, visiteAddress, visiteCity, companyId, visiteCode, clientName,
}: Props) => {
  const navigate = useNavigate();
  const [needs, setNeeds] = useState(needsVoirie);
  const [type, setType] = useState(voirieType || "");
  const [status, setStatus] = useState(voirieStatus || "a_faire");
  const [notes, setNotes] = useState(voirieNotes || "");
  const [dvdAddress, setDvdAddress] = useState(visiteAddress || "");
  const [saving, setSaving] = useState(false);
  const [sendingDvd, setSendingDvd] = useState(false);

  useEffect(() => {
    if (open) {
      setNeeds(needsVoirie);
      setType(voirieType || "");
      setStatus(voirieStatus || "a_faire");
      setNotes(voirieNotes || "");
      setDvdAddress(visiteAddress || "");
    }
  }, [open, needsVoirie, voirieType, voirieStatus, voirieNotes, visiteAddress]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        needs_voirie: needs,
        voirie_type: type || null,
        voirie_status: status,
        voirie_notes: notes || null,
      };
      if (status === "demandee") updateData.voirie_requested_at = new Date().toISOString();
      if (status === "obtenue") updateData.voirie_obtained_at = new Date().toISOString();

      const { error } = await supabase.from("visites").update(updateData).eq("id", visiteId);
      if (error) throw error;
      toast.success("Voirie enregistrée ✓");
      onSaved({ needs_voirie: needs, voirie_type: type || null, voirie_status: status, voirie_notes: notes || null });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  // Bug 3 fix: Match exactly the desktop payload from VisiteDetail.tsx
  const handleSendDvdEmail = async () => {
    if (!companyId) return;
    setSendingDvd(true);
    try {
      const addr = dvdAddress || "";
      const code = visiteCode || visiteId.slice(0, 8);
      const client = clientName || "notre client";

      const subject = `Demande de plan au 1/200ème – Emprise voirie – ${addr}`;
      const body = `Madame, Monsieur,\n\nDans le cadre d'une intervention de levage et manutention lourde prévue pour le compte de ${client}, nous avons l'honneur de solliciter auprès de vos services :\n\n1. La communication d'un plan au 1/200ème de la voirie située à l'adresse suivante :\n   ${addr}\n\n2. Les informations relatives aux conditions d'occupation temporaire de la voie publique (emprise voirie) nécessaires à la mise en place de nos engins de levage.\n\nCette demande s'inscrit dans le cadre de la visite technique référence ${code}.\n\nNous vous serions reconnaissants de bien vouloir nous transmettre ces éléments dans les meilleurs délais afin de nous permettre d'établir notre plan d'installation et de constituer le dossier de demande d'autorisation.\n\nNous restons à votre entière disposition pour tout renseignement complémentaire.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`;

      const { error } = await supabase.functions.invoke("send-visite-email", {
        body: {
          to: "dvd-pvp.dvd@paris.fr",
          subject,
          body,
          visiteId,
          companyId,
          clientName: client,
        },
      });
      if (error) throw error;
      toast.success("Demande de plan voirie envoyée à la DVD Paris ✓");
      setStatus("demandee");
    } catch (err: any) {
      toast.error(err.message || "Erreur envoi");
    } finally {
      setSendingDvd(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">🚧 Démarches voirie</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-3">
          {/* Needs voirie checkbox */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={needs} onCheckedChange={(v) => setNeeds(!!v)} />
            <span className="text-sm font-medium">Démarches voirie nécessaires</span>
          </label>

          {needs && (
            <>
              {/* Type selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Type de démarche</p>
                <div className="flex flex-wrap gap-2">
                  {VOIRIE_TYPES.map((vt) => (
                    <button
                      key={vt.key}
                      onClick={() => setType(type === vt.key ? "" : vt.key)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        type === vt.key
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {vt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Statut</p>
                <div className="flex flex-wrap gap-2">
                  {VOIRIE_STATUSES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStatus(s.key)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        status === s.key ? s.cls + " shadow-md" : "bg-card text-muted-foreground border-border/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Notes voirie</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Remarques, références de demande..."
                  className="min-h-[80px] rounded-xl"
                />
              </div>

              {/* DVD plan request section */}
              {type === "plan_voirie" && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    Demande de plan voirie — Paris
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Envoyer un email formel à la DVD de Paris pour demander un plan au 1/200ème et une autorisation d'emprise voirie.
                  </p>

                  {/* Bug 4: Editable address field */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Adresse concernée</p>
                    <Input
                      value={dvdAddress}
                      onChange={(e) => setDvdAddress(e.target.value)}
                      placeholder="Adresse du chantier..."
                      className="text-sm rounded-lg"
                    />
                    {visiteAddress && dvdAddress !== visiteAddress && (
                      <button
                        onClick={() => setDvdAddress(visiteAddress)}
                        className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Utiliser l'adresse du chantier
                      </button>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full gap-2 border-blue-500/30 text-blue-700 dark:text-blue-400"
                    onClick={handleSendDvdEmail}
                    disabled={sendingDvd || !companyId || !dvdAddress.trim()}
                  >
                    {sendingDvd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Envoyer la demande à la DVD Paris
                  </Button>
                </div>
              )}

              {/* Plan voirie editor button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  onClose();
                  navigate(`/voirie?visite_id=${visiteId}`);
                }}
              >
                <Map className="h-4 w-4" />
                Ouvrir l'éditeur de plan voirie
              </Button>
            </>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-[52px] rounded-2xl text-base gap-2"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
