import { useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, User, FileText, Receipt, CreditCard,
  FolderOpen, ClipboardCheck, MessageSquare, Plus, Download, Eye
} from "lucide-react";
import { type CompanyId } from "@/contexts/CompanyContext";

// Mock data — single client
const mockClientData = {
  "1": {
    id: 1, code: "CLI-1001", name: "LVMH Paris", contact: "Jean Moreau", email: "j.moreau@lvmh.com",
    phone: "01 42 55 12 34", mobile: "06 12 34 56 78", company: "art" as CompanyId,
    address: "22 Avenue Montaigne", cp: "75008", city: "Paris",
    addressFacturation: "22 Avenue Montaigne, 75008 Paris",
    modeReglement: "30 jours date de facture", conseiller: "David HAOUZI",
    status: "Actif", totalFacture: "45 600,00", totalRegle: "41 400,00", solde: "4 200,00",
    factures: [
      { id: "FAC-2026-042", date: "12/02/2026", dossier: "DOS-14216", montant: "4 200,00 €", regle: "0,00 €", solde: "4 200,00 €", status: "Envoyée" },
      { id: "FAC-2026-028", date: "28/01/2026", dossier: "DOS-14180", montant: "12 800,00 €", regle: "12 800,00 €", solde: "0,00 €", status: "Payée" },
      { id: "FAC-2025-198", date: "15/12/2025", dossier: "DOS-14102", montant: "28 600,00 €", regle: "28 600,00 €", solde: "0,00 €", status: "Payée" },
    ],
    devis: [
      { id: "DEV-2026-156", date: "10/02/2026", objet: "Levage piano Steinway", montant: "4 200,00 €", status: "Accepté" },
      { id: "DEV-2026-089", date: "05/01/2026", objet: "Manutention œuvres d'art", montant: "12 800,00 €", status: "Accepté" },
      { id: "DEV-2026-162", date: "14/02/2026", objet: "Déménagement coffre-fort", montant: "6 500,00 €", status: "En attente" },
    ],
    reglements: [
      { id: "REG-7428", date: "16/02/2026", encaissement: "16/02/2026", montant: "12 800,00 €", banque: "BNPFAC", ref: "FAC-2026-028" },
      { id: "REG-7310", date: "20/12/2025", encaissement: "22/12/2025", montant: "28 600,00 €", banque: "BNPFAC", ref: "FAC-2025-198" },
    ],
    dossiers: [
      { id: "DOS-14216", title: "Levage piano Steinway", date: "12/02/2026", status: "En cours", montant: "4 200,00 €" },
      { id: "DOS-14180", title: "Manutention œuvres d'art", date: "28/01/2026", status: "Terminé", montant: "12 800,00 €" },
      { id: "DOS-14102", title: "Transport sculptures", date: "15/12/2025", status: "Facturé", montant: "28 600,00 €" },
    ],
    visites: [
      { id: 1, title: "Visite levage piano", date: "08/02/2026", technicien: "Marc Dubois", photos: 12, status: "Réalisée" },
    ],
  },
};

type TabKey = "infos" | "factures" | "devis" | "reglements" | "dossiers" | "visites";

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "infos", label: "Informations", icon: User },
  { key: "factures", label: "Factures", icon: Receipt },
  { key: "devis", label: "Devis", icon: FileText },
  { key: "reglements", label: "Règlements", icon: CreditCard },
  { key: "dossiers", label: "Dossiers", icon: FolderOpen },
  { key: "visites", label: "Visites", icon: ClipboardCheck },
];

const invoiceStatus: Record<string, string> = {
  "Payée": "bg-success/10 text-success",
  "Envoyée": "bg-info/10 text-info",
  "En retard": "bg-destructive/10 text-destructive",
};

const devisStatus: Record<string, string> = {
  "Accepté": "bg-success/10 text-success",
  "En attente": "bg-warning/10 text-warning",
  "Refusé": "bg-destructive/10 text-destructive",
};

const dossierStatus: Record<string, string> = {
  "En cours": "bg-warning/10 text-warning",
  "Terminé": "bg-success/10 text-success",
  "Facturé": "bg-info/10 text-info",
};

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("infos");

  const client = mockClientData["1"]; // For demo purposes, always show client 1

  if (!client) return <div className="p-8">Client introuvable</div>;

  const soldeColor = parseFloat(client.solde.replace(/[^\d,]/g, "").replace(",", ".")) > 0
    ? "text-destructive" : "text-success";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <button onClick={() => navigate("/clients")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Retour aux clients
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {client.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              <p className="text-muted-foreground text-sm">Code : {client.code} · {client.contact}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
              <Mail className="h-4 w-4" /> Email
            </button>
            <button className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
              <Phone className="h-4 w-4" /> Appeler
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Nouveau devis
            </button>
          </div>
        </div>
      </motion.div>

      {/* Financial summary bar — like Safari GT bottom bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Facturé</p>
          <p className="text-xl font-bold text-foreground">{client.totalFacture} €</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Réglé</p>
          <p className="text-xl font-bold text-info">{client.totalRegle} €</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Solde</p>
          <p className={`text-xl font-bold ${soldeColor}`}>{client.solde} €</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === "infos" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm">Informations client</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3"><Building2 className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="font-medium">{client.name}</p><p className="text-muted-foreground">Code : {client.code}</p></div></div>
                <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p>{client.address}</p><p className="text-muted-foreground">{client.cp} {client.city}</p></div></div>
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{client.email}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{client.phone}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{client.mobile} (mobile)</span></div>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm">Informations de facturation</h3>
              <div className="space-y-3 text-sm">
                <div><p className="text-muted-foreground">Adresse de facturation</p><p className="font-medium">{client.addressFacturation}</p></div>
                <div><p className="text-muted-foreground">Mode de règlement</p><p className="font-medium">{client.modeReglement}</p></div>
                <div><p className="text-muted-foreground">Conseiller</p><p className="font-medium">{client.conseiller}</p></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "factures" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Factures du client</h3>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> Nouvelle facture
              </button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Dossier</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Réglé</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Solde</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody className="divide-y">
                {client.factures.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs">{f.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.dossier}</td>
                    <td className="px-4 py-3 text-right font-semibold">{f.montant}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{f.regle}</td>
                    <td className="px-4 py-3 text-right font-medium">{f.solde}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${invoiceStatus[f.status] || ""}`}>{f.status}</span></td>
                    <td className="px-4 py-3 flex gap-1">
                      <button className="p-1 rounded hover:bg-muted"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button className="p-1 rounded hover:bg-muted"><Download className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "devis" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Devis du client</h3>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> Nouveau devis
              </button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Objet</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody className="divide-y">
                {client.devis.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.date}</td>
                    <td className="px-4 py-3 font-medium">{d.objet}</td>
                    <td className="px-4 py-3 text-right font-semibold">{d.montant}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${devisStatus[d.status] || ""}`}>{d.status}</span></td>
                    <td className="px-4 py-3 flex gap-1">
                      <button className="p-1 rounded hover:bg-muted"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button className="p-1 rounded hover:bg-muted"><Download className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "reglements" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Règlements du client</h3>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> Nouveau règlement
              </button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Encaissement</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Banque</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Référence</th>
              </tr></thead>
              <tbody className="divide-y">
                {client.reglements.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.encaissement}</td>
                    <td className="px-4 py-3 text-right font-semibold">{r.montant}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.banque}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "dossiers" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Dossiers du client</h3>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> Nouveau dossier
              </button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Intitulé</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Statut</th>
              </tr></thead>
              <tbody className="divide-y">
                {client.dossiers.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
                    <td className="px-4 py-3 font-medium">{d.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.date}</td>
                    <td className="px-4 py-3 text-right font-semibold">{d.montant}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${dossierStatus[d.status] || ""}`}>{d.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "visites" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Visites techniques</h3>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> Nouvelle visite
              </button>
            </div>
            <div className="divide-y">
              {client.visites.map((v) => (
                <div key={v.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.date} · {v.technicien} · {v.photos} photos</p>
                  </div>
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-success/10 text-success">{v.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ClientDetail;
