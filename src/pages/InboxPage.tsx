import { motion } from "framer-motion";
import { Mail, MessageSquare, Phone, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const mockMessages = [
  { id: 1, from: "Jean Moreau — LVMH", subject: "Demande de devis levage", preview: "Bonjour, nous aurions besoin d'un devis pour le levage de...", time: "10:32", channel: "email", unread: true },
  { id: 2, from: "Sophie Martin — Bouygues", subject: "Confirmation planning grue", preview: "Suite à notre échange, je confirme la réservation pour le...", time: "09:15", channel: "email", unread: true },
  { id: 3, from: "+33 6 12 34 56 78", subject: "WhatsApp — Pierre Dupont", preview: "Bonjour, est-ce que le garde-meuble est disponible à partir de...", time: "Hier", channel: "whatsapp", unread: false },
  { id: 4, from: "Marc Lefevre — Vinci", subject: "Re: Facturation dossier #2024-089", preview: "Merci pour la facture. Le paiement sera effectué sous 30...", time: "Hier", channel: "email", unread: false },
  { id: 5, from: "+33 1 44 77 55 33", subject: "Appel manqué — Claire Bernard", preview: "Tentative d'appel à 14:32", time: "11 fév", channel: "phone", unread: false },
];

const channelIcon: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
};

const InboxPage = () => {
  const isMobile = useIsMobile();

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Inbox</h1>
        {!isMobile && <p className="text-muted-foreground mt-1">Communication centralisée</p>}
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" placeholder="Rechercher..." className={`w-full rounded-lg border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isMobile ? "py-2 text-xs" : "py-2.5"}`} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card divide-y">
        {mockMessages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 hover:bg-muted/30 transition-colors cursor-pointer ${msg.unread ? "bg-primary/[0.02]" : ""} ${isMobile ? "px-3 py-3" : "px-5 py-4"}`}>
            <div className="mt-0.5 text-muted-foreground">{channelIcon[msg.channel]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={`truncate ${msg.unread ? "font-semibold" : "font-medium"} ${isMobile ? "text-xs" : "text-sm"}`}>{msg.from}</p>
                {msg.unread && <div className="h-1.5 w-1.5 rounded-full bg-info flex-shrink-0" />}
              </div>
              <p className={`text-foreground truncate ${isMobile ? "text-xs" : "text-sm"}`}>{msg.subject}</p>
              {!isMobile && <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.preview}</p>}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{msg.time}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default InboxPage;
