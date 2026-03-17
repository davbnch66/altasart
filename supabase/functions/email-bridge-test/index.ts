import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bridge-secret",
};

/**
 * Email Bridge Test Endpoint
 * 
 * Called by:
 * - Frontend (POST with JWT): queues a test request for account_id
 * - Bridge (GET ?action=poll with X-Bridge-Secret): fetches pending test requests
 * - Bridge (POST ?action=result with X-Bridge-Secret): reports test results
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Bridge polls for test requests ──
    if (req.method === "GET" && action === "poll") {
      const bridgeSecret = req.headers.get("X-Bridge-Secret") || url.searchParams.get("bridge_secret");
      const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
      if (!expectedSecret || bridgeSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get accounts in "testing" status
      const { data: accounts } = await supabase
        .from("email_accounts")
        .select("id, smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted, imap_host, imap_port, imap_security, imap_username, imap_password_encrypted, email_address")
        .eq("status", "testing");

      return new Response(JSON.stringify({ accounts: accounts || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Bridge reports test result ──
    if (req.method === "POST" && action === "result") {
      const bridgeSecret = req.headers.get("X-Bridge-Secret");
      const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
      if (!expectedSecret || bridgeSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { account_id, smtp_ok, imap_ok, error: testError } = body;

      if (!account_id) {
        return new Response(JSON.stringify({ error: "account_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allOk = smtp_ok && imap_ok;
      await supabase
        .from("email_accounts")
        .update({
          status: allOk ? "active" : "error",
          last_error: allOk ? null : String(testError || "Test failed").slice(0, 1000),
        })
        .eq("id", account_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Frontend requests a test ──
    if (req.method === "POST" && !action) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data: { user }, error: authErr } = await anonClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { account_id } = body;

      // Verify user access
      const { data: account } = await anonClient
        .from("email_accounts")
        .select("id")
        .eq("id", account_id)
        .single();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Set status to testing
      await supabase
        .from("email_accounts")
        .update({ status: "testing", last_error: null })
        .eq("id", account_id);

      return new Response(JSON.stringify({ success: true, message: "Test queued. The bridge will process it shortly." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-bridge-test error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
