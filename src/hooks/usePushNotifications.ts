import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async () => {
    setError(null);

    if (!("Notification" in window)) {
      setError("Votre navigateur ne supporte pas les notifications");
      toast.error("Votre navigateur ne supporte pas les notifications");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Service Worker non disponible");
      toast.info(
        "Pour activer les notifications, installez l'app : Menu navigateur → Ajouter à l'écran d'accueil",
        { duration: 8000 }
      );
      return;
    }

    try {
      // Récupérer la clé publique VAPID depuis l'Edge Function
      const { data: keyData, error: keyError } = await supabase.functions.invoke("get-vapid-public-key");
      if (keyError || !keyData?.publicKey) {
        setError("Clé VAPID manquante");
        console.error("VAPID key error:", keyError);
        toast.error("Erreur de configuration des notifications");
        return;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "denied") {
        toast.error("Notifications bloquées — autorisez-les dans les paramètres de votre navigateur");
        return;
      }
      if (perm !== "granted") {
        toast.info("Permission refusée");
        return;
      }

      // Attendre le Service Worker avec timeout
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Service Worker timeout")), 10000)
        ),
      ]);

      const subscription = await (registration as ServiceWorkerRegistration).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      const { error: dbError } = await (supabase.from("push_subscriptions") as any).upsert(
        {
          user_id: user!.id,
          endpoint: subscription.endpoint,
          subscription_json: JSON.stringify(subscription),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" }
      );

      if (dbError) throw dbError;

      setSubscribed(true);
      toast.success("🔔 Notifications activées !");
    } catch (err: any) {
      console.error("Push subscription error:", err);
      setError(err.message);

      if (err.message?.includes("timeout")) {
        toast.error("Installez l'app sur votre écran d'accueil et réessayez");
      } else if (err.message?.includes("applicationServerKey")) {
        toast.error("Erreur de clé VAPID — vérifiez la configuration");
      } else {
        toast.error("Impossible d'activer les notifications : " + err.message);
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
      if (Notification.permission === "granted") subscribe();
    }
  }, [user?.id]);

  return { permission, subscribed, error, subscribe };
}
