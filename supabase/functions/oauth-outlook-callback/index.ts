import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_SCOPES = "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access";

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

async function encryptValue(plaintext: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, ALGORITHM, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: 128 }, key, encoded);
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, encryptedArray.length - TAG_LENGTH);
  const tag = encryptedArray.slice(encryptedArray.length - TAG_LENGTH);
  const combined = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  combined.set(iv, 0);
  combined.set(tag, IV_LENGTH);
  combined.set(ciphertext, IV_LENGTH + TAG_LENGTH);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Outlook OAuth Flow
 * 
 * GET ?action=init — Returns the Microsoft OAuth URL
 * GET ?action=callback&code=XXX&state=XXX — Exchanges auth code for tokens
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Microsoft OAuth not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/oauth-outlook-callback?action=callback`;

    if (action === "init") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await anonClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const companyId = body.company_id;
      if (!companyId) {
        return new Response(JSON.stringify({ error: "company_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = btoa(JSON.stringify({ user_id: user.id, company_id: companyId }));

      const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", MICROSOFT_SCOPES);
      authUrl.searchParams.set("response_mode", "query");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      return new Response(JSON.stringify({ auth_url: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(renderCallbackHtml(false, `Microsoft OAuth error: ${error}`), {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      if (!code || !stateParam) {
        return new Response(renderCallbackHtml(false, "Missing code or state"), {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      let state: { user_id: string; company_id: string };
      try {
        state = JSON.parse(atob(stateParam));
      } catch {
        return new Response(renderCallbackHtml(false, "Invalid state"), {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      // Exchange code for tokens
      const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          scope: MICROSOFT_SCOPES,
        }),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        console.error("Microsoft token exchange failed:", text);
        return new Response(renderCallbackHtml(false, "Token exchange failed"), {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      const tokens = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Get user's email from Microsoft Graph
      const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json() as { mail?: string; userPrincipalName?: string };
      const emailAddress = profile.mail || profile.userPrincipalName || "unknown@outlook.com";

      const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
      if (!encryptionKey) {
        return new Response(renderCallbackHtml(false, "Encryption key not configured"), {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      const encAccessToken = await encryptValue(tokens.access_token, encryptionKey);
      const encRefreshToken = tokens.refresh_token
        ? await encryptValue(tokens.refresh_token, encryptionKey)
        : null;

      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const { error: insertErr } = await supabase.from("email_accounts").insert({
        company_id: state.company_id,
        email_address: emailAddress,
        label: `Outlook - ${emailAddress}`,
        provider: "outlook",
        auth_method: "oauth2",
        oauth_access_token_encrypted: encAccessToken,
        oauth_refresh_token_encrypted: encRefreshToken,
        oauth_token_expires_at: expiresAt,
        oauth_client_id: clientId,
        status: "active",
        sync_enabled: true,
        auto_link_clients: true,
        is_default: false,
      });

      if (insertErr) {
        console.error("Insert error:", insertErr);
        return new Response(renderCallbackHtml(false, insertErr.message), {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      return new Response(renderCallbackHtml(true, emailAddress), {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("oauth-outlook-callback error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function renderCallbackHtml(success: boolean, detail: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Connexion Outlook</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
  .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
  .success { color: #16a34a; }
  .error { color: #dc2626; }
  h2 { margin: 0 0 0.5rem; }
  p { color: #666; margin: 0.5rem 0; }
  .close-btn { margin-top: 1rem; padding: 0.5rem 1.5rem; background: #000; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
</style>
</head>
<body>
<div class="card">
  <h2 class="${success ? "success" : "error"}">${success ? "✓ Connexion réussie" : "✗ Erreur"}</h2>
  <p>${success ? `Compte ${detail} connecté avec succès.` : detail}</p>
  <button class="close-btn" onclick="window.close()">
    Fermer
  </button>
</div>
<script>
  const payload = { type: 'oauth-complete', success: ${success}, provider: 'outlook' };
  try { window.opener?.postMessage(payload, '*'); } catch {}
  try {
    const channel = new BroadcastChannel('oauth-complete');
    channel.postMessage(payload);
    channel.close();
  } catch {}
  setTimeout(() => {
    try { window.close(); } catch {}
  }, 150);
</script>
</body>
</html>`;
}
