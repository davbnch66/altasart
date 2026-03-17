import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bridge-secret",
};

/**
 * Email Bridge Accounts Endpoint
 * 
 * GET ?action=list — Returns active email accounts for the bridge to poll.
 * Auth: X-Bridge-Secret
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bridgeSecret = req.headers.get("X-Bridge-Secret") || new URL(req.url).searchParams.get("bridge_secret");
    const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
    if (!expectedSecret || bridgeSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "list") {
      const { data: accounts, error } = await supabase
        .from("email_accounts")
        .select("id, company_id, email_address, provider, imap_host, imap_port, imap_security, imap_username, imap_password_encrypted, smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted, status, last_sync_at, sync_enabled, auto_link_clients")
        .in("status", ["active", "disconnected"])
        .eq("sync_enabled", true);

      if (error) throw error;

      return new Response(JSON.stringify({ accounts: accounts || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-bridge-accounts error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
