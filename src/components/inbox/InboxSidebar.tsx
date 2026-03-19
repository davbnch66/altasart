import { useState, useEffect } from "react";
import {
  Inbox, Send, FileEdit, Trash2, Archive, Star, Plus, ChevronDown, ChevronRight,
  FolderPlus, X, Palette
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

const systemFolders: { key: MailFolder; label: string; icon: React.ElementType }[] = [
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
  const [accountsExpanded, setAccountsExpanded] = useState(true);
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

  const allSelected = selectedAccountIds.length === 0;

  const handleSelectAll = () => {
    if (!allSelected) {
      selectedAccountIds.forEach((id) => onAccountToggle(id));
    }
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
        {/* System folders */}
        {systemFolders.map(({ key, label, icon: Icon }) => {
          const count = unreadCounts[key] || 0;
          const isActive = currentFolder === key;
          const isDropTarget = key === "inbox" || key === "archive" || key === "trash";
          const isDragOver = dragOverTarget === key;
          return (
            <button
              key={key}
              onClick={() => onFolderChange(key)}
              onDragOver={isDropTarget ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTarget(key); } : undefined}
              onDragLeave={isDropTarget ? () => setDragOverTarget(null) : undefined}
              onDrop={isDropTarget ? (e) => { e.preventDefault(); setDragOverTarget(null); onDropEmails?.(key); } : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isDragOver && "ring-2 ring-primary bg-primary/10"
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

        {/* Custom labels/folders */}
        <div className="pt-2">
          <button
            onClick={() => setLabelsExpanded(!labelsExpanded)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
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
                        "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
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
                      <span className="flex-1 text-left truncate text-xs">{label.name}</span>
                      {(unreadCounts[`label:${label.id}`] || 0) > 0 && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          {unreadCounts[`label:${label.id}`]}
                        </Badge>
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

      {/* Account filter */}
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
