import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Auto-detect action: POST = init, GET with code/error = callback
    const action = url.searchParams.get("action") 
      || (req.method === "POST" ? "init" : "callback");

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/oauth-gmail-callback`;

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
      const returnUrl = body.return_url || null;
      if (!companyId) {
        return new Response(JSON.stringify({ error: "company_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = btoa(JSON.stringify({ user_id: user.id, company_id: companyId, return_url: returnUrl }));

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", GOOGLE_SCOPES);
      authUrl.searchParams.set("access_type", "offline");
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

      let state: { user_id: string; company_id: string; return_url?: string };
      try {
        state = JSON.parse(atob(stateParam || ""));
      } catch {
        state = { user_id: "", company_id: "", return_url: undefined };
      }

      const respondOAuthResult = (success: boolean, detail: string, errorStatus = 400) => {
        const base = state.return_url;

        if (base?.startsWith("http")) {
          const redirectUrl = new URL(base);
          redirectUrl.searchParams.set("oauth_result", success ? "success" : "error");
          redirectUrl.searchParams.set("oauth_provider", "gmail");
          if (!success) {
            redirectUrl.searchParams.set("oauth_detail", detail);
          }
          return Response.redirect(redirectUrl.toString(), 302);
        }

        return new Response(JSON.stringify({
          success,
          provider: "gmail",
          detail,
        }), {
          status: success ? 200 : errorStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      };

      if (error) {
        return respondOAuthResult(false, `Google OAuth error: ${error}`);
      }

      if (!code || !stateParam) {
        return respondOAuthResult(false, "Missing code or state");
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        console.error("Google token exchange failed:", text);
        return respondOAuthResult(false, "Token exchange failed", tokenRes.status);
      }

      const tokens = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json() as { emailAddress?: string };
      const emailAddress = profile.emailAddress || "unknown@gmail.com";

      const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
      if (!encryptionKey) {
        return respondOAuthResult(false, "Encryption key not configured", 500);
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
        label: `Gmail - ${emailAddress}`,
        provider: "gmail",
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
        return respondOAuthResult(false, insertErr.message, 500);
      }

      return respondOAuthResult(true, emailAddress);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("oauth-gmail-callback error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
