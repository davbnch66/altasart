import { motion } from "framer-motion";
import { Search, Plus, Filter, MoreHorizontal, Phone, Mail, Building2 } from "lucide-react";
import { useCompany, type CompanyId } from "@/contexts/CompanyContext";
import { useNavigate } from "react-router-dom";

const companyDot: Record<CompanyId, string> = {
  global: "bg-primary",
  art: "bg-company-art",
  altigrues: "bg-company-altigrues",
  asdgm: "bg-company-asdgm",
};

const mockClients = [
  { id: 1, code: "6090", name: "SBC CLIM", contact: "M. Khelil", email: "sbc.clim@gmail.com", phone: "07.63.45.03.24", cp: "91450", city: "SOISY SUR SEINE", company: "art" as CompanyId, status: "Actif", dossiers: 3, ref: "" },
  { id: 2, code: "6089", name: "POINT P AUBERVILLIERS", contact: "Service logistique", email: "aubervilliers@pointp.fr", phone: "01.53.56.25.80", cp: "93300", city: "AUBERVILLIERS", company: "altigrues" as CompanyId, status: "Actif", dossiers: 5, ref: "" },
  { id: 3, code: "6088", name: "POINT P - ST DENIS GRAND STADE", contact: "Responsable site", email: "stdenisstade@pointp.fr", phone: "01 48 13 90 80", cp: "93200", city: "SAINT DENIS", company: "art" as CompanyId, status: "Actif", dossiers: 1, ref: "" },
  { id: 4, code: "6087", name: "MICHEL BENAYOUN", contact: "Michel Benayoun", email: "", phone: "06.33.86.24.45", cp: "75019", city: "PARIS 19", company: "art" as CompanyId, status: "Actif", dossiers: 2, ref: "" },
  { id: 5, code: "6086", name: "LA ROCHEFOUCAUD", contact: "M. Leblond", email: "oleblond@laroche.org", phone: "06.12.58.45.87", cp: "75007", city: "PARIS", company: "altigrues" as CompanyId, status: "Actif", dossiers: 4, ref: "" },
  { id: 6, code: "6085", name: "DY TEX", contact: "Direction", email: "dytex@hotmail.fr", phone: "06.20.07.09.80", cp: "75002", city: "PARIS", company: "art" as CompanyId, status: "Nouveau lead", dossiers: 0, ref: "" },
  { id: 7, code: "6084", name: "T.D.I", contact: "C. Hamid", email: "c.hamid@tdindustrie.fr", phone: "06.75.84.43.37", cp: "95190", city: "GOUSSAINVILLE", company: "asdgm" as CompanyId, status: "Actif", dossiers: 1, ref: "5 142" },
  { id: 8, code: "6083", name: "PARTENAIRES FC", contact: "Sarah Loretti", email: "sarah.loretti@partenairesfc.com", phone: "06 17 85 08 81", cp: "78730", city: "ST ARNOULT EN YVEL.", company: "art" as CompanyId, status: "Relance", dossiers: 2, ref: "6 069" },
];

const statusStyles: Record<string, string> = {
  "Actif": "bg-success/10 text-success",
  "Nouveau lead": "bg-info/10 text-info",
  "Relance": "bg-warning/10 text-warning",
};

const Clients = () => {
  const { current } = useCompany();
  const navigate = useNavigate();
  const clients = current === "global" ? mockClients : mockClients.filter((c) => c.company === current);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients / Agents</h1>
          <p className="text-muted-foreground mt-1">{clients.length} clients</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouveau client
        </button>
      </motion.div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par code, nom ou autre..."
            className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtres
        </button>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-4 py-3 w-16">Code</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Nom</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell w-16">CP</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Ville</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">Email</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Téléphone</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Société</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client) => (
              <tr
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold">{client.code}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{client.name}</p>
                  <p className="text-xs text-muted-foreground lg:hidden">{client.city}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{client.cp}</td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{client.city}</td>
                <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell text-xs">{client.email || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{client.phone}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${companyDot[client.company]}`} />
                    <span className="text-xs text-muted-foreground">{client.company === "art" ? "ART" : client.company === "altigrues" ? "Altigrues" : "ASDGM"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[client.status] || ""}`}>
                    {client.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-muted transition-colors">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Clients;
