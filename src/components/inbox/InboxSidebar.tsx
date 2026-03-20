import { useState } from "react";
import {
  Inbox, Send, FileEdit, Trash2, Archive, Star, Plus, ChevronDown, ChevronRight,
  FolderPlus, X, AlertTriangle, Mail, ShieldAlert
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MailFolder = "inbox" | "sent" | "drafts" | "trash" | "archive" | "starred" | string;

export interface EmailAccount {
  id: string;
  label: string;
  email_address: string;
  provider: string;
  status: string;
}

export interface EmailLabel {
  id: string;
  company_id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
}

interface InboxSidebarProps {
  currentFolder: MailFolder;
  onFolderChange: (folder: MailFolder) => void;
  selectedAccountIds: string[];
  onAccountToggle: (accountId: string) => void;
  onCompose: () => void;
  unreadCounts: Record<string, number>;
  accounts: EmailAccount[];
  isMobile?: boolean;
  onDropEmails?: (targetFolder: string, targetLabelId?: string) => void;
}

const favoriteFolders: { key: MailFolder; label: string; icon: React.ElementType }[] = [
  { key: "inbox", label: "Toutes les boîtes", icon: Inbox },
  { key: "sent", label: "Tous les envoyés", icon: Send },
  { key: "starred", label: "Marqués", icon: Star },
  { key: "drafts", label: "Tous les brouillons", icon: FileEdit },
  { key: "spam", label: "Tous les indésirables", icon: ShieldAlert },
  { key: "archive", label: "Toutes les archives", icon: Archive },
  { key: "trash", label: "Toutes les corbeilles", icon: Trash2 },
];

const accountFolders: { key: string; label: string; icon: React.ElementType }[] = [
  { key: "inbox", label: "Boîte de réception", icon: Inbox },
  { key: "drafts", label: "Brouillons", icon: FileEdit },
  { key: "sent", label: "Envoyés", icon: Send },
  { key: "spam", label: "Indésirables", icon: ShieldAlert },
  { key: "archive", label: "Archives", icon: Archive },
  { key: "trash", label: "Corbeille", icon: Trash2 },
];

const providerColors: Record<string, string> = {
  gmail: "text-red-500",
  outlook: "text-blue-500",
  imap_smtp: "text-muted-foreground",
};

const providerLabels: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  imap_smtp: "IMAP",
};

const LABEL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

export const InboxSidebar = ({
  currentFolder,
  onFolderChange,
  selectedAccountIds,
  onAccountToggle,
  onCompose,
  unreadCounts,
  accounts,
  isMobile = false,
  onDropEmails,
}: InboxSidebarProps) => {
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>(() => {
    // Initialize all accounts as expanded by default
    const init: Record<string, boolean> = {};
    accounts.forEach((a) => { init[a.id] = true; });
    return init;
  });

  // Keep new accounts expanded when accounts list changes
  const prevAccountIdsRef = useRef<string[]>(accounts.map(a => a.id));
  useEffect(() => {
    const currentIds = accounts.map(a => a.id);
    const newIds = currentIds.filter(id => !prevAccountIdsRef.current.includes(id));
    if (newIds.length > 0) {
      setExpandedAccounts(prev => {
        const next = { ...prev };
        newIds.forEach(id => { next[id] = true; });
        return next;
      });
    }
    prevAccountIdsRef.current = currentIds;
  }, [accounts]);
  const [labelsExpanded, setLabelsExpanded] = useState(true);
  const [createLabelOpen, setCreateLabelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");
  const [isCreating, setIsCreating] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];
  const primaryCompanyId = current === "global" ? dbCompanies[0]?.id : current;

  const { data: labels = [] } = useQuery<EmailLabel[]>({
    queryKey: ["email-labels", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_labels")
        .select("*")
        .in("company_id", companyIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as EmailLabel[];
    },
    enabled: companyIds.length > 0,
  });

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const handleAccountFolderClick = (accountId: string, folderKey: string) => {
    // Select only this account and change folder
    // Clear other selections, select this one
    const isAlreadyOnlySelected = selectedAccountIds.length === 1 && selectedAccountIds[0] === accountId;
    if (!isAlreadyOnlySelected) {
      // Deselect all, then select this one
      selectedAccountIds.forEach((id) => {
        if (id !== accountId) onAccountToggle(id);
      });
      if (!selectedAccountIds.includes(accountId)) {
        onAccountToggle(accountId);
      }
    }
    onFolderChange(folderKey);
  };

  const handleFavoriteClick = (folderKey: MailFolder) => {
    // Show all accounts (deselect specific filters)
    selectedAccountIds.forEach((id) => onAccountToggle(id));
    onFolderChange(folderKey);
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim() || !primaryCompanyId) return;
    setIsCreating(true);
    try {
      const { error } = await supabase.from("email_labels").insert({
        company_id: primaryCompanyId,
        name: newLabelName.trim(),
        color: newLabelColor,
        sort_order: labels.length,
      });
      if (error) throw error;
      toast.success(`Dossier "${newLabelName.trim()}" créé`);
      setNewLabelName("");
      setCreateLabelOpen(false);
      queryClient.invalidateQueries({ queryKey: ["email-labels"] });
    } catch (e: any) {
      toast.error(e.message?.includes("unique") ? "Ce nom existe déjà" : "Erreur lors de la création");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLabel = async (labelId: string, labelName: string) => {
    if (!confirm(`Supprimer le dossier "${labelName}" ? Les emails ne seront pas supprimés.`)) return;
    const { error } = await supabase.from("email_labels").delete().eq("id", labelId);
    if (error) { toast.error("Erreur"); return; }
    toast.success(`Dossier "${labelName}" supprimé`);
    queryClient.invalidateQueries({ queryKey: ["email-labels"] });
    if (currentFolder === `label:${labelId}`) onFolderChange("inbox");
  };

  const isAllAccounts = selectedAccountIds.length === 0;

  // Get display name for account
  const getAccountDisplayName = (account: EmailAccount) => {
    if (account.label && account.label !== account.email_address) return account.label;
    // Try to extract a short name
    const parts = account.email_address.split("@");
    return parts[0];
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

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 text-sm">
        {/* ── Favoris ── */}
        <button
          onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
        >
          {favoritesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Favoris
        </button>

        {favoritesExpanded && (
          <div className="space-y-0.5">
            {favoriteFolders.map(({ key, label, icon: Icon }) => {
              const count = key === "inbox"
                ? Object.entries(unreadCounts).reduce((sum, [k, v]) => k === "inbox" ? sum + v : sum, 0)
                : (unreadCounts[key] || 0);
              const isActive = isAllAccounts && currentFolder === key;
              const isDropTarget = key === "inbox" || key === "archive" || key === "trash" || key === "spam";
              const isDragOver = dragOverTarget === `fav:${key}`;
              return (
                <button
                  key={key}
                  onClick={() => handleFavoriteClick(key)}
                  onDragOver={isDropTarget ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTarget(`fav:${key}`); } : undefined}
                  onDragLeave={isDropTarget ? () => setDragOverTarget(null) : undefined}
                  onDrop={isDropTarget ? (e) => { e.preventDefault(); setDragOverTarget(null); onDropEmails?.(key); } : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isDragOver && "ring-2 ring-primary bg-primary/10"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left truncate text-[13px]">{label}</span>
                  {count > 0 && (
                    <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Show sub-accounts under "Toutes les boîtes" when expanded */}
            {isAllAccounts && currentFolder === "inbox" && accounts.length > 1 && (
              <div className="ml-5 space-y-0.5 border-l border-border/50 pl-2">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      if (!selectedAccountIds.includes(account.id)) onAccountToggle(account.id);
                      selectedAccountIds.filter(id => id !== account.id).forEach(id => onAccountToggle(id));
                      onFolderChange("inbox");
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{getAccountDisplayName(account)}</span>
                    {account.status !== "active" && (
                      <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Comptes individuels ── */}
        {accounts.length > 0 && (
          <div className="pt-3 space-y-0.5">
            {accounts.map((account) => {
              const isExpanded = expandedAccounts[account.id] ?? false;
              const isAccountSelected = selectedAccountIds.length === 1 && selectedAccountIds[0] === account.id;
              const providerColor = providerColors[account.provider] || "text-muted-foreground";

              return (
                <div key={account.id}>
                  <button
                    onClick={() => toggleAccount(account.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
                      isAccountSelected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <span className={cn("text-[11px] font-semibold uppercase tracking-wider truncate", providerColor)}>
                      {account.label || getAccountDisplayName(account)}
                    </span>
                    {account.status !== "active" && (
                      <AlertTriangle className="h-3 w-3 text-warning shrink-0 ml-auto" />
                    )}
                    {(unreadCounts[`account:${account.id}`] || 0) > 0 && (
                      <span className="text-[11px] text-muted-foreground font-medium tabular-nums ml-auto">
                        {unreadCounts[`account:${account.id}`]}
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ml-3 space-y-0.5 border-l border-border/50 pl-2">
                      {accountFolders.map(({ key, label, icon: Icon }) => {
                        const isActive = isAccountSelected && currentFolder === key;
                        const isDragOver = dragOverTarget === `${account.id}:${key}`;
                        const isDropTarget = key === "inbox" || key === "archive" || key === "trash" || key === "spam";
                        const folderCount = unreadCounts[`account:${account.id}:${key}`] || 0;
                        return (
                          <button
                            key={key}
                            onClick={() => handleAccountFolderClick(account.id, key)}
                            onDragOver={isDropTarget ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTarget(`${account.id}:${key}`); } : undefined}
                            onDragLeave={isDropTarget ? () => setDragOverTarget(null) : undefined}
                            onDrop={isDropTarget ? (e) => { e.preventDefault(); setDragOverTarget(null); onDropEmails?.(key); } : undefined}
                            className={cn(
                              "flex w-full items-center gap-2 rounded px-2 py-1 text-[12px] transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              isDragOver && "ring-2 ring-primary bg-primary/10"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="flex-1 text-left truncate">{label}</span>
                            {folderCount > 0 && (
                              <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                                {folderCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Dossiers personnalisés ── */}
        <div className="pt-3">
          <button
            onClick={() => setLabelsExpanded(!labelsExpanded)}
            className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {labelsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Dossiers
            <button
              onClick={(e) => { e.stopPropagation(); setCreateLabelOpen(true); }}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </button>
          {labelsExpanded && (
            <div className="mt-1 space-y-0.5">
              {labels.length === 0 && (
                <p className="px-3 py-1 text-[10px] text-muted-foreground/60 italic">
                  Aucun dossier personnalisé
                </p>
              )}
              {labels.map((label) => {
                const isActive = currentFolder === `label:${label.id}`;
                const isDragOver = dragOverTarget === `label:${label.id}`;
                return (
                  <div
                    key={label.id}
                    className="group relative"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTarget(`label:${label.id}`); }}
                    onDragLeave={() => setDragOverTarget(null)}
                    onDrop={(e) => { e.preventDefault(); setDragOverTarget(null); onDropEmails?.(undefined as any, label.id); }}
                  >
                    <button
                      onClick={() => onFolderChange(`label:${label.id}`)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        isDragOver && "ring-2 ring-primary bg-primary/10"
                      )}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="flex-1 text-left truncate">{label.name}</span>
                      {(unreadCounts[`label:${label.id}`] || 0) > 0 && (
                        <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                          {unreadCounts[`label:${label.id}`]}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteLabel(label.id, label.name)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Create label dialog */}
      <Dialog open={createLabelOpen} onOpenChange={setCreateLabelOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base">Nouveau dossier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nom</Label>
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Ex: Clients VIP, À traiter…"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
              />
            </div>
            <div>
              <Label className="text-xs">Couleur</Label>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    className={cn(
                      "h-6 w-6 rounded-md transition-all",
                      newLabelColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateLabelOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleCreateLabel} disabled={isCreating || !newLabelName.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
