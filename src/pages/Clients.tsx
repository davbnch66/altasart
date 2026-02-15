import { motion } from "framer-motion";
import { Search, Plus, Filter, MoreHorizontal, Phone, Mail, Building2 } from "lucide-react";
import { useCompany, type CompanyId } from "@/contexts/CompanyContext";

const companyDot: Record<CompanyId, string> = {
  global: "bg-primary",
  art: "bg-company-art",
  altigrues: "bg-company-altigrues",
  asdgm: "bg-company-asdgm",
};

const mockClients = [
  { id: 1, name: "LVMH Paris", contact: "Jean Moreau", email: "j.moreau@lvmh.com", phone: "01 42 55 12 34", company: "art" as CompanyId, status: "Actif", dossiers: 3 },
  { id: 2, name: "Bouygues Construction", contact: "Sophie Martin", email: "s.martin@bouygues.com", phone: "01 38 22 44 88", company: "altigrues" as CompanyId, status: "Actif", dossiers: 5 },
  { id: 3, name: "M. Dupont Pierre", contact: "Pierre Dupont", email: "p.dupont@gmail.com", phone: "06 12 34 56 78", company: "asdgm" as CompanyId, status: "Nouveau lead", dossiers: 1 },
  { id: 4, name: "Vinci Immobilier", contact: "Marc Lefevre", email: "m.lefevre@vinci.com", phone: "01 55 33 22 11", company: "art" as CompanyId, status: "Actif", dossiers: 8 },
  { id: 5, name: "Eiffage TP", contact: "Claire Bernard", email: "c.bernard@eiffage.com", phone: "01 44 77 55 33", company: "altigrues" as CompanyId, status: "Relance", dossiers: 2 },
];

const statusStyles: Record<string, string> = {
  "Actif": "bg-success/10 text-success",
  "Nouveau lead": "bg-info/10 text-info",
  "Relance": "bg-warning/10 text-warning",
};

const Clients = () => {
  const { current } = useCompany();
  const clients = current === "global" ? mockClients : mockClients.filter((c) => c.company === current);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
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
            placeholder="Rechercher un client..."
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
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Client</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">Contact</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Société</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Statut</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Dossiers</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-xs font-semibold">
                      {client.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.contact}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${companyDot[client.company]}`} />
                    <span className="text-muted-foreground">{client.company === "art" ? "ART" : client.company === "altigrues" ? "Altigrues" : "ASDGM"}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[client.status] || ""}`}>
                    {client.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{client.dossiers}</td>
                <td className="px-5 py-3.5">
                  <button className="p-1 rounded hover:bg-muted transition-colors">
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
