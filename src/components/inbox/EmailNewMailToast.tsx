import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Trash2, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const EmailNewMailToast = () => {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const companyId = current === "global" ? dbCompanies[0]?.id : current;

  // Get user notification preferences
  const { data: prefs } = useQuery({
    queryKey: ["notification-preferences", user?.id, companyId],
    queryFn: async () => {
      if (!user || !companyId) return null;
      const { data } = await supabase
        .from("notification_preferences")
        .select("popup_new_email")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!companyId,
  });

  const popupEnabled = prefs?.popup_new_email !== false; // default true

  const handleQuickAction = useCallback(async (emailId: string, action: "archive" | "trash") => {
    try {
      const { error } = await supabase
        .from("inbound_emails")
        .update({ folder: action === "archive" ? "archive" : "trash" })
        .eq("id", emailId);
      if (error) throw error;
      toast.success(action === "archive" ? "Archivé" : "Mis en corbeille");
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      queryClient.invalidateQueries({ queryKey: ["global-unread-counts"] });
    } catch {
      toast.error("Erreur");
    }
  }, [queryClient]);

  useEffect(() => {
    if (companyIds.length === 0 || !user) return;

    const channel = supabase
      .channel("new-email-toast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inbound_emails" },
        (payload) => {
          const email = payload.new as any;
          if (!companyIds.includes(email.company_id)) return;
          if (!initialized.current) {
            knownIds.current.add(email.id);
            return;
          }
          if (knownIds.current.has(email.id)) return;
          knownIds.current.add(email.id);

          if (!popupEnabled) return;

          // Show toast with quick actions
          toast(
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {email.from_name || email.from_email || "Nouvel email"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {email.subject || "(sans objet)"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    navigate(`/inbox?email=${email.id}`);
                    toast.dismiss();
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Mail className="h-3 w-3" /> Ouvrir
                </button>
                <button
                  onClick={() => handleQuickAction(email.id, "archive")}
                  className="flex items-center justify-center gap-1 rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <Archive className="h-3 w-3" /> Archiver
                </button>
                <button
                  onClick={() => handleQuickAction(email.id, "trash")}
                  className="flex items-center justify-center gap-1 rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Suppr.
                </button>
              </div>
            </div>,
            { duration: 8000, position: "top-right" }
          );

          // Also invalidate queries
          queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
          queryClient.invalidateQueries({ queryKey: ["global-unread-counts"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    // Mark as initialized after a short delay to avoid toasting existing emails
    const timer = setTimeout(() => { initialized.current = true; }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timer);
    };
  }, [companyIds, user, popupEnabled, handleQuickAction, navigate, queryClient]);

  return null; // This is a headless component
};
