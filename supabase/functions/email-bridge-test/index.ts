import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bridge-secret",
};

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function decryptValue(encrypted: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, ALGORITHM, false, ["decrypt"]);
  const raw = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = raw.slice(0, IV_LENGTH);
  const tag = raw.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.slice(IV_LENGTH + TAG_LENGTH);
  const combined = new Uint8Array(ciphertext.length + TAG_LENGTH);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: 128 }, key, combined);
  return new TextDecoder().decode(decrypted);
}

async function refreshGoogleToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function refreshMicrosoftToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function testOAuthAccount(account: any, encryptionKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!account.oauth_refresh_token_encrypted) {
      return { success: false, error: "Pas de refresh token disponible" };
    }

    const refreshToken = await decryptValue(account.oauth_refresh_token_encrypted, encryptionKey);
    
    let clientSecret: string;
    if (account.provider === "gmail") {
      clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
      const clientId = account.oauth_client_id || Deno.env.get("GOOGLE_CLIENT_ID")!;
      const accessToken = await refreshGoogleToken(refreshToken, clientId, clientSecret);
      
      // Test Gmail API access
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Gmail API test failed: ${res.status}`);
      const profile = await res.json();
      return { success: true };
    } else if (account.provider === "outlook") {
      clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;
      const clientId = account.oauth_client_id || Deno.env.get("MICROSOFT_CLIENT_ID")!;
      const accessToken = await refreshMicrosoftToken(refreshToken, clientId, clientSecret);
      
      // Test Microsoft Graph access
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Microsoft Graph test failed: ${res.status}`);
      return { success: true };
    }
    
    return { success: false, error: "Provider OAuth non supporté" };
  } catch (e: any) {
    return { success: false, error: e.message || "Test failed" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");

  try {
    // ── Bridge polls for test requests (IMAP/SMTP only) ──
    if (req.method === "GET" && action === "poll") {
      const bridgeSecret = req.headers.get("X-Bridge-Secret") || url.searchParams.get("bridge_secret");
      const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
      if (!expectedSecret || bridgeSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: accounts } = await supabase
        .from("email_accounts")
        .select("id, smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted, imap_host, imap_port, imap_security, imap_username, imap_password_encrypted, email_address")
        .eq("status", "testing")
        .eq("auth_method", "password");

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

      // Fetch account with service role to get all fields
      const { data: account } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("id", account_id)
        .single();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user has access via company membership
      const { data: membership } = await anonClient
        .from("company_memberships")
        .select("id")
        .eq("company_id", account.company_id)
        .eq("profile_id", user.id)
        .single();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For OAuth accounts, test directly here (no need for external bridge)
      if (account.auth_method === "oauth2" && encryptionKey) {
        const result = await testOAuthAccount(account, encryptionKey);
        
        await supabase
          .from("email_accounts")
          .update({
            status: result.success ? "active" : "error",
            last_error: result.success ? null : result.error?.slice(0, 1000),
          })
          .eq("id", account_id);

        return new Response(JSON.stringify({ 
          success: result.success, 
          error: result.error,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For IMAP/SMTP accounts, queue for bridge testing
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
