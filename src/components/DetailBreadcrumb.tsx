import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  path?: string;
  state?: Record<string, any>;
}

interface DetailBreadcrumbProps {
  items: BreadcrumbItem[];
}

export const DetailBreadcrumb: React.FC<DetailBreadcrumbProps> = ({ items }) => {
  const navigate = useNavigate();

  if (items.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-[11px] text-muted-foreground overflow-x-auto scrollbar-none">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
          {item.path && i < items.length - 1 ? (
            <button
              onClick={() => navigate(item.path!, { state: item.state })}
              className="hover:text-primary transition-colors truncate max-w-[120px] shrink-0"
            >
              {item.label}
            </button>
          ) : (
            <span className={`truncate max-w-[160px] shrink-0 ${i === items.length - 1 ? "text-foreground font-medium" : ""}`}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
