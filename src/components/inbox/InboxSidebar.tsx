import { useState, useEffect } from "react";
import { Inbox, Send, FileEdit, Trash2, Archive, Star, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MailFolder = "inbox" | "sent" | "drafts" | "trash" | "archive" | "starred";

export interface EmailAccount {
  id: string;
  label: string;
  email_address: string;
  provider: string;
  status: string;
}

interface InboxSidebarProps {
  currentFolder: MailFolder;
  onFolderChange: (folder: MailFolder) => void;
  selectedAccountIds: string[];
  onAccountToggle: (accountId: string) => void;
  onCompose: () => void;
  unreadCounts: Record<MailFolder, number>;
  accounts: EmailAccount[];
  isMobile?: boolean;
}

const folderConfig: { key: MailFolder; label: string; icon: React.ElementType }[] = [
  { key: "inbox", label: "Réception", icon: Inbox },
  { key: "sent", label: "Envoyés", icon: Send },
  { key: "drafts", label: "Brouillons", icon: FileEdit },
  { key: "starred", label: "Suivis", icon: Star },
  { key: "archive", label: "Archives", icon: Archive },
  { key: "trash", label: "Corbeille", icon: Trash2 },
];

const providerColors: Record<string, string> = {
  gmail: "bg-red-500",
  outlook: "bg-blue-500",
  imap_smtp: "bg-muted-foreground",
};

export const InboxSidebar = ({
  currentFolder,
  onFolderChange,
  selectedAccountIds,
  onAccountToggle,
  onCompose,
  unreadCounts,
  accounts,
  isMobile = false,
}: InboxSidebarProps) => {
  const [accountsExpanded, setAccountsExpanded] = useState(true);

  const allSelected = selectedAccountIds.length === 0;

  const handleSelectAll = () => {
    // Clear all selections = show all
    if (!allSelected) {
      // Remove all by toggling each selected one
      selectedAccountIds.forEach((id) => onAccountToggle(id));
    }
  };

  return (
    <div className={cn(
      "flex flex-col border-r bg-card",
      isMobile ? "w-full" : "w-[240px] shrink-0"
    )}>
      <div className="p-3">
        <Button onClick={onCompose} className="w-full gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Nouveau message
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {folderConfig.map(({ key, label, icon: Icon }) => {
          const count = unreadCounts[key] || 0;
          const isActive = currentFolder === key;
          return (
            <button
              key={key}
              onClick={() => onFolderChange(key)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">{label}</span>
              {count > 0 && (
                <Badge
                  variant={key === "inbox" ? "destructive" : "secondary"}
                  className="px-1.5 py-0 text-[10px] min-w-[20px] justify-center"
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {accounts.length > 0 && (
        <div className="border-t px-2 py-2">
          <button
            onClick={() => setAccountsExpanded(!accountsExpanded)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            {accountsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Comptes ({accounts.length})
          </button>
          {accountsExpanded && (
            <div className="mt-1 space-y-0.5">
              {/* All accounts option */}
              <button
                onClick={handleSelectAll}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                  allSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
                <span className="flex-1 text-left">Tous les comptes</span>
                {allSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
              </button>

              {accounts.map((account) => {
                const isSelected = selectedAccountIds.includes(account.id);
                const colorClass = providerColors[account.provider] || "bg-muted-foreground";
                return (
                  <Tooltip key={account.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onAccountToggle(account.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div className={cn("h-2 w-2 rounded-full shrink-0", colorClass)} />
                        <span className="flex-1 text-left truncate">{account.email_address}</span>
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-xs font-medium">{account.label}</p>
                      <p className="text-xs text-muted-foreground">{account.email_address}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
