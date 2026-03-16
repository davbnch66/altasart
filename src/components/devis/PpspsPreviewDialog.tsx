import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, RefreshCw, Loader2, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { generatePpspsPdf } from "@/lib/generatePpspsPdf";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  content: any;
  onContentChange: (updated: any) => void;
  devis: any;
  onRegenerate: () => void;
  regenerating: boolean;
  version: number;
}

export const PpspsPreviewDialog = ({ open, onOpenChange, content, devis, onRegenerate, regenerating, version }: Props) => {
  const isMobile = useIsMobile();

  if (!content) return null;

  const rg = content.renseignements_generaux || {};
  const secours = content.organisation_secours || {};

  const handleDownloadPdf = async () => {
    try {
      await generatePpspsPdf(content, devis);
      toast.success("PDF téléchargé");
    } catch (e: any) {
      toast.error("Erreur PDF : " + (e.message || ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isMobile ? "max-w-[95vw] max-h-[90vh]" : "max-w-4xl max-h-[85vh]"} flex flex-col p-0`}>
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            PPSPS — {devis.code || "Devis"}
            <span className="text-xs text-muted-foreground ml-2">v{version}</span>
          </DialogTitle>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regénérer
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <div className="space-y-6 text-sm">
            {/* I. Renseignements Généraux */}
            <Section title="I. Renseignements Généraux">
              <InfoRow label="Adresse du chantier" value={rg.adresse_chantier} />
              <InfoRow label="Donneur d'ordre" value={rg.donneur_ordre} />
              <InfoRow label="Responsable au siège" value={rg.responsable_siege || "Mr. IASSA Amar"} />
              <InfoRow label="Responsable chantier" value={rg.responsable_chantier || "À DÉFINIR"} />
              <InfoRow label="Chargé d'exécution" value={rg.charge_execution || "À DÉFINIR"} />
            </Section>

            {/* Intervenants */}
            {content.intervenants?.length > 0 && (
              <Section title="Intervenants">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-muted"><th className="p-2 text-left border">Poste</th><th className="p-2 text-left border">Nom / Adresse</th><th className="p-2 text-left border">Contact</th></tr></thead>
                  <tbody>
                    {content.intervenants.map((i: any, idx: number) => (
                      <tr key={idx} className="border-b"><td className="p-2 border font-medium">{i.poste}</td><td className="p-2 border">{i.nom_adresse || "—"}</td><td className="p-2 border">{i.contact || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Autorités compétentes */}
            {content.autorites_competentes?.length > 0 && (
              <Section title="Autorités compétentes">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-muted"><th className="p-2 text-left border">Poste</th><th className="p-2 text-left border">Adresse</th><th className="p-2 text-left border">Contact</th></tr></thead>
                  <tbody>
                    {content.autorites_competentes.map((a: any, idx: number) => (
                      <tr key={idx} className="border-b"><td className="p-2 border font-medium">{a.poste}</td><td className="p-2 border">{a.adresse || "—"}</td><td className="p-2 border">{a.contact || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Organisation secours */}
            <Section title="II. Organisation des secours">
              {secours.premiers_secours && <SubSection title="Premiers secours" text={secours.premiers_secours} />}
              {secours.consignes_accidents && <SubSection title="Consignes en cas d'accidents" text={secours.consignes_accidents} />}
              {secours.droit_retrait && <SubSection title="Droit d'alerte et de retrait" text={secours.droit_retrait} />}
              {secours.numeros_urgence?.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold text-xs mb-1">Numéros d'urgence</p>
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="bg-muted"><th className="p-2 text-left border">Dénomination</th><th className="p-2 text-left border">Adresse</th><th className="p-2 text-left border">Téléphone</th></tr></thead>
                    <tbody>
                      {secours.numeros_urgence.map((n: any, idx: number) => (
                        <tr key={idx} className="border-b"><td className="p-2 border font-medium">{n.denomination}</td><td className="p-2 border">{n.adresse || "—"}</td><td className="p-2 border">{n.telephone}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Visite médicale */}
            {content.visite_medicale && <Section title="Visite médicale"><p className="whitespace-pre-wrap">{content.visite_medicale}</p></Section>}

            {/* Mesures spécifiques */}
            {content.mesures_specifiques?.length > 0 && (
              <Section title="Mesures spécifiques">
                <ul className="list-disc pl-5 space-y-1">
                  {content.mesures_specifiques.map((m: string, i: number) => <li key={i}>{m}</li>)}
                </ul>
              </Section>
            )}

            {/* Horaires */}
            {content.horaires?.jours?.length > 0 && (
              <Section title="Horaires du chantier">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-muted"><th className="p-2 text-left border">Jour</th><th className="p-2 text-left border">Horaires</th></tr></thead>
                  <tbody>
                    {content.horaires.jours.map((j: any, idx: number) => (
                      <tr key={idx} className="border-b"><td className="p-2 border font-medium">{j.jour}</td><td className="p-2 border">{j.horaire}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Habilitations */}
            {content.habilitations?.length > 0 && (
              <Section title="Habilitations et autorisations">
                <ul className="list-disc pl-5 space-y-1">
                  {content.habilitations.map((h: string, i: number) => <li key={i}>{h}</li>)}
                </ul>
              </Section>
            )}

            {/* Description opération */}
            {content.description_operation && (
              <Section title="III. Description de l'opération">
                <p className="whitespace-pre-wrap">{content.description_operation}</p>
              </Section>
            )}

            {/* Mode opératoire */}
            {content.mode_operatoire?.length > 0 && (
              <Section title="Mode opératoire">
                {content.mode_operatoire.map((phase: any, i: number) => (
                  <div key={i} className="mb-3">
                    <p className="font-semibold text-xs text-primary">{phase.phase}</p>
                    <ul className="list-disc pl-5 space-y-0.5 mt-1">
                      {phase.etapes.map((e: string, j: number) => <li key={j}>{e}</li>)}
                    </ul>
                  </div>
                ))}
              </Section>
            )}

            {/* Méthodologie */}
            {content.methodologie && <Section title="Méthodologie de manutention"><p className="whitespace-pre-wrap">{content.methodologie}</p></Section>}

            {/* Planning */}
            {content.planning && (
              <Section title="Planning prévisionnel">
                <InfoRow label="Horaire de travail" value={content.planning.horaire_travail} />
                <InfoRow label="Durée estimée" value={content.planning.duree_estimee} />
                <InfoRow label="Date de début" value={content.planning.date_debut} />
                <InfoRow label="Date de fin" value={content.planning.date_fin} />
              </Section>
            )}

            {/* Moyens humains */}
            {content.moyens_humains && <Section title="Moyens humains"><p className="whitespace-pre-wrap">{content.moyens_humains}</p></Section>}

            {/* Moyens matériels */}
            {content.moyens_materiels?.length > 0 && (
              <Section title="Moyens matériels">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-muted"><th className="p-2 text-left border">Matériel</th><th className="p-2 text-left border">Vérification</th><th className="p-2 text-left border">Date contrôle</th><th className="p-2 text-left border">Date fin</th><th className="p-2 text-left border">Risques</th></tr></thead>
                  <tbody>
                    {content.moyens_materiels.map((m: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 border font-medium">{m.materiel}</td>
                        <td className="p-2 border">{m.soumis_verification || "—"}</td>
                        <td className="p-2 border">{m.date_controle || "—"}</td>
                        <td className="p-2 border">{m.date_fin || "—"}</td>
                        <td className="p-2 border">{m.risques || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Prérequis client */}
            {content.prerequis_client?.length > 0 && (
              <Section title="Avant notre intervention">
                <ul className="list-disc pl-5 space-y-1">
                  {content.prerequis_client.map((p: string, i: number) => <li key={i}>{p}</li>)}
                </ul>
              </Section>
            )}

            {/* Analyse des risques */}
            {content.analyse_risques?.length > 0 && (
              <Section title="IV. Analyse des risques">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left border">Situation dangereuse</th>
                      <th className="p-2 text-left border">Risques</th>
                      <th className="p-2 text-left border">Mesures de prévention</th>
                      <th className="p-2 text-left border">Moyens de protection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.analyse_risques.map((r: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 border font-medium">{r.situation_dangereuse}</td>
                        <td className="p-2 border">{r.risques}</td>
                        <td className="p-2 border">{r.mesures_prevention}</td>
                        <td className="p-2 border">{r.moyens_protection || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="font-bold text-sm text-primary mb-2">{title}</h3>
    <Separator className="mb-3" />
    {children}
  </div>
);

const SubSection = ({ title, text }: { title: string; text: string }) => (
  <div className="mb-2">
    <p className="font-semibold text-xs mb-0.5">{title}</p>
    <p className="whitespace-pre-wrap text-muted-foreground">{text}</p>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value?: string }) => (
  <div className="flex gap-2 py-0.5">
    <span className="text-muted-foreground min-w-[140px]">{label} :</span>
    <span className="font-medium">{value || "À DÉFINIR"}</span>
  </div>
);
