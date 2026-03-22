import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. D'abord on récupère la session existante
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false); // ← loading passe à false UNE SEULE FOIS ici
    });

    // 2. Ensuite on écoute les changements futurs (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // ← PAS de setLoading ici, c'est le fix principal
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, loading, user: session?.user ?? null, signOut };
};
