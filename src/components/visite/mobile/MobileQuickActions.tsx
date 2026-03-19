import { Camera, Package, MapPin, ShieldAlert, Truck, StickyNote, FileText, Image } from "lucide-react";

interface Props {
  onAction: (action: string) => void;
  counts: {
    photos: number;
    pieces: number;
    materiel: number;
    rh: number;
    vehicules: number;
  };
}

const actions = [
  { key: "photo", icon: Camera, label: "Photos", color: "bg-blue-500", emoji: "📸" },
  { key: "gallery", icon: Image, label: "Galerie", color: "bg-indigo-500", emoji: "🖼" },
  { key: "materiel", icon: Package, label: "Matériel", color: "bg-amber-500", emoji: "📦" },
  { key: "piece", icon: MapPin, label: "Pièce / Zone", color: "bg-emerald-500", emoji: "🏗" },
  { key: "contraintes", icon: ShieldAlert, label: "Accès", color: "bg-red-500", emoji: "🚧" },
  { key: "moyens", icon: Truck, label: "Moyens", color: "bg-purple-500", emoji: "🚛" },
  { key: "notes", icon: StickyNote, label: "Notes", color: "bg-orange-500", emoji: "📝" },
  { key: "summary", icon: FileText, label: "Synthèse", color: "bg-teal-500", emoji: "📋" },
];

export const MobileQuickActions = ({ onAction, counts }: Props) => {
  const getBadge = (key: string) => {
    switch (key) {
      case "photo": return counts.photos > 0 ? counts.photos : null;
      case "piece": return counts.pieces > 0 ? counts.pieces : null;
      case "materiel": return counts.materiel > 0 ? counts.materiel : null;
      case "moyens": return (counts.rh + counts.vehicules) > 0 ? counts.rh + counts.vehicules : null;
      default: return null;
    }
  };

  return (
    <div className="grid grid-cols-4 gap-3 px-1">
      {actions.map((a) => {
        const badge = getBadge(a.key);
        return (
          <button
            key={a.key}
            onClick={() => onAction(a.key)}
            className="relative flex flex-col items-center gap-2 rounded-2xl bg-card border border-border/50 p-4 active:scale-95 transition-transform shadow-sm"
          >
            <div className={`${a.color} rounded-xl p-3 text-white`}>
              <a.icon className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-foreground">{a.label}</span>
            {badge !== null && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
