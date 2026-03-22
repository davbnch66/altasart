import { useState, useEffect, useCallback } from "react";
import { Bell, Check, ExternalLink, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const typeIcons: Record<string, string> = {
  new_lead: "🆕",
  materiel_detected: "📦",
  visite_requested: "📋",
  client_response: "💬",
  date_to_validate: "📅",
  spam_false_positive: "⚠️",
  info: "ℹ️",
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }, [queryClient, user?.id]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Impossible de supprimer");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const clearAll = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      toast.error("Impossible de tout supprimer");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    toast.success("Notifications effacées");
  };

  const handleClick = useCallback(async (notif: any) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) {
      const targetPath = notif.link.split("?")[0];
      const currentPath = location.pathname;
      
      if (currentPath === targetPath || currentPath.startsWith(targetPath + "/")) {
        // Already on the same route — navigate away briefly then back to force re-render
        navigate("/", { replace: true });
        // Use setTimeout to let React Router process the first navigation
        setTimeout(() => navigate(notif.link, { replace: true }), 0);
      } else {
        navigate(notif.link);
      }
      setOpen(false);
    }
  }, [navigate, location.pathname, markAsRead]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 rounded hover:bg-sidebar-accent transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4 text-sidebar-muted" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-0.5">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 p-0 z-50 bg-popover border shadow-lg max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Tout lire
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Effacer
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif: any) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 group ${
                    notif.type === "spam_false_positive"
                      ? "bg-orange-500/10 border-l-4 border-orange-500"
                      : !notif.read ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <span className="text-base mt-0.5 shrink-0">
                    {typeIcons[notif.type] || "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5">
                      <p className={`text-sm line-clamp-2 ${!notif.read ? "font-semibold" : "font-medium"}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <div className="h-1.5 w-1.5 rounded-full bg-info mt-1.5 shrink-0" />
                      )}
                    </div>
                    {notif.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteNotification(notif.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all shrink-0 mt-0.5"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
