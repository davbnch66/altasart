import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 16;
const TAG_LENGTH = 16; // AES-GCM tag is 128 bits

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

  // encrypted includes ciphertext + tag (last 16 bytes)
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, encryptedArray.length - TAG_LENGTH);
  const tag = encryptedArray.slice(encryptedArray.length - TAG_LENGTH);

  // Format: base64(iv + tag + ciphertext) — compatible with Node.js bridge
  const combined = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  combined.set(iv, 0);
  combined.set(tag, IV_LENGTH);
  combined.set(ciphertext, IV_LENGTH + TAG_LENGTH);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Encrypt Email Passwords
 * 
 * POST: Encrypts passwords for an email account before saving.
 * Called by the frontend when creating/updating email accounts.
 * Auth: Standard JWT.
 * 
 * Body: {
 *   account_id?: string,  // For update
 *   smtp_password?: string,
 *   imap_password?: string,
 *   ...other fields passed through
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
    const { account_id, smtp_password, imap_password, ...fields } = body;

    const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
    if (!encryptionKey || encryptionKey.length !== 64) {
      return new Response(JSON.stringify({ error: "Encryption key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt passwords
    const payload: any = { ...fields };
    if (smtp_password) {
      payload.smtp_password_encrypted = await encryptValue(smtp_password, encryptionKey);
    }
    if (imap_password) {
      payload.imap_password_encrypted = await encryptValue(imap_password, encryptionKey);
    }

    // Use the user's client (respects RLS)
    if (account_id) {
      // Update
      const { error } = await anonClient
        .from("email_accounts")
        .update(payload)
        .eq("id", account_id);
      if (error) throw error;
    } else {
      // Insert
      const { error } = await anonClient
        .from("email_accounts")
        .insert(payload);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("encrypt-email-password error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
