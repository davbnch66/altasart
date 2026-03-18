import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.10.1";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bridge-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API = "https://graph.microsoft.com/v1.0/me";
const ALGORITHM = "AES-GCM";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

type Recipient = { email: string; name?: string };
type Attachment = { filename: string; content_base64: string; content_type?: string };

type EmailAccountRow = {
  id: string;
  company_id: string;
  email_address: string;
  label: string;
  provider: string;
  auth_method: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: string | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  oauth_access_token_encrypted: string | null;
  oauth_refresh_token_encrypted: string | null;
  oauth_token_expires_at: string | null;
  oauth_client_id: string | null;
  status: string;
};

type QueuedEmailRow = {
  id: string;
  account_id: string;
  company_id: string;
  client_id: string | null;
  dossier_id: string | null;
  to_recipients: Recipient[];
  cc_recipients: Recipient[] | null;
  bcc_recipients: Recipient[] | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  reply_to_message_id: string | null;
  attachments: Attachment[] | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function toBase64Url(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function chunkString(value: string, size = 76): string {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks.join("\r\n");
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ensureHtml(bodyHtml: string | null | undefined, bodyText: string | null | undefined): string {
  if (bodyHtml?.trim()) return bodyHtml;
  return `<div style="font-family:sans-serif;white-space:pre-wrap;color:#333;font-size:15px;line-height:1.7;">${escapeHtml(bodyText || "").replace(/\n/g, "<br>")}</div>`;
}

async function encryptValue(plaintext: string, keyHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex), ALGORITHM, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: 128 }, key, encoded));
  const ciphertext = encrypted.slice(0, encrypted.length - TAG_LENGTH);
  const tag = encrypted.slice(encrypted.length - TAG_LENGTH);
  const combined = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
  combined.set(iv, 0);
  combined.set(tag, IV_LENGTH);
  combined.set(ciphertext, IV_LENGTH + TAG_LENGTH);
  return bytesToBase64(combined);
}

async function decryptValue(encryptedBase64: string | null, keyHex: string): Promise<string | null> {
  if (!encryptedBase64) return null;

  try {
    const data = base64ToBytes(encryptedBase64);
    const iv = data.slice(0, IV_LENGTH);
    const tag = data.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.slice(IV_LENGTH + TAG_LENGTH);
    const cipherWithTag = new Uint8Array(ciphertext.length + tag.length);
    cipherWithTag.set(ciphertext, 0);
    cipherWithTag.set(tag, ciphertext.length);

    const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex), ALGORITHM, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: 128 }, key, cipherWithTag);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedBase64;
  }
}

async function refreshGoogleToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(`Google token refresh failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

async function refreshMicrosoftToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access",
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(`Microsoft token refresh failed [${res.status}]: ${JSON.stringify(data)}`);
  }

  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

async function getOauthAccessToken(
  supabase: ReturnType<typeof createClient>,
  account: EmailAccountRow,
  encryptionKey: string,
  forceRefresh = false,
): Promise<string> {
  const accessToken = await decryptValue(account.oauth_access_token_encrypted, encryptionKey);
  const refreshToken = await decryptValue(account.oauth_refresh_token_encrypted, encryptionKey);
  const expiresAtMs = account.oauth_token_expires_at ? new Date(account.oauth_token_expires_at).getTime() : 0;
  const isAccessStillValid = !!accessToken && expiresAtMs > Date.now() + 60_000;

  if (!forceRefresh && isAccessStillValid) {
    return accessToken!;
  }

  if (!refreshToken) {
    if (accessToken) return accessToken;
    throw new Error("Aucun jeton OAuth utilisable pour ce compte email");
  }

  let refreshed: { access_token: string; refresh_token?: string; expires_in: number };

  if (account.provider === "gmail") {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Configuration Google OAuth manquante");
    }
    refreshed = await refreshGoogleToken(refreshToken, clientId, clientSecret);
  } else if (account.provider === "outlook") {
    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Configuration Microsoft OAuth manquante");
    }
    refreshed = await refreshMicrosoftToken(refreshToken, clientId, clientSecret);
  } else {
    throw new Error(`Provider OAuth non supporté: ${account.provider}`);
  }

  const updates: Record<string, string> = {
    oauth_access_token_encrypted: await encryptValue(refreshed.access_token, encryptionKey),
    oauth_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };

  if (refreshed.refresh_token) {
    updates.oauth_refresh_token_encrypted = await encryptValue(refreshed.refresh_token, encryptionKey);
  }

  const { error } = await supabase.from("email_accounts").update(updates).eq("id", account.id);
  if (error) {
    console.error("email-bridge-send token persist error:", error);
  }

  account.oauth_access_token_encrypted = updates.oauth_access_token_encrypted;
  account.oauth_token_expires_at = updates.oauth_token_expires_at;
  if (updates.oauth_refresh_token_encrypted) {
    account.oauth_refresh_token_encrypted = updates.oauth_refresh_token_encrypted;
  }

  return refreshed.access_token;
}

function formatRecipient(recipient: Recipient): string {
  return recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email;
}

async function sendViaSmtp(account: EmailAccountRow, email: QueuedEmailRow, encryptionKey: string): Promise<string> {
  if (!account.smtp_host) {
    throw new Error("Configuration SMTP manquante pour ce compte email");
  }

  const password = await decryptValue(account.smtp_password_encrypted, encryptionKey);
  if (!password) {
    throw new Error("Mot de passe SMTP manquant");
  }

  const security = (account.smtp_security || "STARTTLS").toUpperCase();
  const transporter = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port || 587,
    secure: security === "SSL",
    requireTLS: security === "STARTTLS",
    ignoreTLS: security === "NONE",
    auth: {
      user: account.smtp_username || account.email_address,
      pass: password,
    },
  });

  const info = await transporter.sendMail({
    from: account.email_address,
    replyTo: account.email_address,
    to: email.to_recipients.map(formatRecipient).join(", "),
    cc: email.cc_recipients?.length ? email.cc_recipients.map(formatRecipient).join(", ") : undefined,
    bcc: email.bcc_recipients?.length ? email.bcc_recipients.map(formatRecipient).join(", ") : undefined,
    subject: email.subject || "",
    text: email.body_text || undefined,
    html: ensureHtml(email.body_html, email.body_text),
    inReplyTo: email.reply_to_message_id || undefined,
    references: email.reply_to_message_id || undefined,
    attachments: (email.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content_base64, "base64"),
      contentType: attachment.content_type || "application/octet-stream",
    })),
  });

  transporter.close();
  return info.messageId || `smtp-${crypto.randomUUID()}`;
}

async function sendViaOutlook(
  supabase: ReturnType<typeof createClient>,
  account: EmailAccountRow,
  email: QueuedEmailRow,
  encryptionKey: string,
): Promise<string> {
  const executeSend = async (token: string) => {
    const response = await fetch(`${GRAPH_API}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: email.subject || "",
          body: {
            contentType: "html",
            content: ensureHtml(email.body_html, email.body_text),
          },
          toRecipients: email.to_recipients.map((recipient) => ({
            emailAddress: { address: recipient.email, name: recipient.name || recipient.email },
          })),
          ccRecipients: (email.cc_recipients || []).map((recipient) => ({
            emailAddress: { address: recipient.email, name: recipient.name || recipient.email },
          })),
          bccRecipients: (email.bcc_recipients || []).map((recipient) => ({
            emailAddress: { address: recipient.email, name: recipient.name || recipient.email },
          })),
          replyTo: [{ emailAddress: { address: account.email_address, name: account.label || account.email_address } }],
          internetMessageHeaders: email.reply_to_message_id
            ? [
                { name: "In-Reply-To", value: email.reply_to_message_id },
                { name: "References", value: email.reply_to_message_id },
              ]
            : undefined,
          attachments: (email.attachments || []).map((attachment) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: attachment.filename,
            contentType: attachment.content_type || "application/octet-stream",
            contentBytes: attachment.content_base64,
          })),
        },
        saveToSentItems: true,
      }),
    });

    return response;
  };

  let accessToken = await getOauthAccessToken(supabase, account, encryptionKey);
  let response = await executeSend(accessToken);

  if (response.status === 401) {
    accessToken = await getOauthAccessToken(supabase, account, encryptionKey, true);
    response = await executeSend(accessToken);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Outlook sendMail failed [${response.status}]: ${text}`);
  }

  return `outlook-${crypto.randomUUID()}`;
}

function buildGmailMimeMessage(account: EmailAccountRow, email: QueuedEmailRow): string {
  const alternativeBoundary = `alt_${crypto.randomUUID()}`;
  const mixedBoundary = `mixed_${crypto.randomUUID()}`;
  const hasAttachments = !!email.attachments?.length;
  const lines: string[] = [];

  lines.push(`From: ${account.email_address}`);
  lines.push(`To: ${email.to_recipients.map(formatRecipient).join(", ")}`);
  if (email.cc_recipients?.length) lines.push(`Cc: ${email.cc_recipients.map(formatRecipient).join(", ")}`);
  if (email.bcc_recipients?.length) lines.push(`Bcc: ${email.bcc_recipients.map(formatRecipient).join(", ")}`);
  lines.push(`Reply-To: ${account.email_address}`);
  lines.push(`Subject: ${email.subject || ""}`);
  if (email.reply_to_message_id) {
    lines.push(`In-Reply-To: ${email.reply_to_message_id}`);
    lines.push(`References: ${email.reply_to_message_id}`);
  }
  lines.push("MIME-Version: 1.0");
  lines.push(
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
  );
  lines.push("");

  if (hasAttachments) {
    lines.push(`--${mixedBoundary}`);
    lines.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
    lines.push("");
  }

  lines.push(`--${alternativeBoundary}`);
  lines.push(`Content-Type: text/plain; charset="UTF-8"`);
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(email.body_text || "");
  lines.push("");

  lines.push(`--${alternativeBoundary}`);
  lines.push(`Content-Type: text/html; charset="UTF-8"`);
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(ensureHtml(email.body_html, email.body_text));
  lines.push("");
  lines.push(`--${alternativeBoundary}--`);

  if (hasAttachments) {
    for (const attachment of email.attachments || []) {
      lines.push("");
      lines.push(`--${mixedBoundary}`);
      lines.push(`Content-Type: ${attachment.content_type || "application/octet-stream"}; name="${attachment.filename}"`);
      lines.push("Content-Transfer-Encoding: base64");
      lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      lines.push("");
      lines.push(chunkString(attachment.content_base64));
    }

    lines.push(`--${mixedBoundary}--`);
  }

  return lines.join("\r\n");
}

async function sendViaGmail(
  supabase: ReturnType<typeof createClient>,
  account: EmailAccountRow,
  email: QueuedEmailRow,
  encryptionKey: string,
): Promise<string> {
  const executeSend = async (token: string) => {
    const raw = toBase64Url(buildGmailMimeMessage(account, email));
    return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
  };

  let accessToken = await getOauthAccessToken(supabase, account, encryptionKey);
  let response = await executeSend(accessToken);

  if (response.status === 401) {
    accessToken = await getOauthAccessToken(supabase, account, encryptionKey, true);
    response = await executeSend(accessToken);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    throw new Error(`Gmail send failed [${response.status}]: ${JSON.stringify(data)}`);
  }

  return data.id as string;
}

async function dispatchQueuedEmail(
  supabase: ReturnType<typeof createClient>,
  account: EmailAccountRow,
  email: QueuedEmailRow,
): Promise<string> {
  const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
  if (!encryptionKey) {
    throw new Error("EMAIL_ENCRYPTION_KEY non configurée");
  }

  if (account.auth_method === "oauth2") {
    if (account.provider === "outlook") {
      return sendViaOutlook(supabase, account, email, encryptionKey);
    }

    if (account.provider === "gmail") {
      return sendViaGmail(supabase, account, email, encryptionKey);
    }

    throw new Error(`Provider OAuth non supporté: ${account.provider}`);
  }

  return sendViaSmtp(account, email, encryptionKey);
}

async function persistQueueResult(
  supabase: ReturnType<typeof createClient>,
  email: QueuedEmailRow,
  success: boolean,
  sentMessageId?: string,
  sendError?: string,
): Promise<void> {
  const update = {
    status: success ? "sent" : "failed",
    sent_at: success ? new Date().toISOString() : null,
    error: success ? null : sendError || null,
    sent_message_id: success ? sentMessageId || null : null,
  };

  const { error: updateError } = await supabase.from("email_outbox").update(update).eq("id", email.id);
  if (updateError) {
    console.error("email-bridge-send queue update error:", updateError);
  }

  if (!success || !sentMessageId) return;

  const { error: syncedError } = await supabase.from("synced_emails").upsert({
    company_id: email.company_id,
    email_account_id: email.account_id,
    message_id: sentMessageId,
    direction: "outbound",
    from_email: null,
    to_emails: email.to_recipients,
    cc_emails: email.cc_recipients || [],
    subject: email.subject,
    body_text: email.body_text,
    body_html: email.body_html,
    received_at: new Date().toISOString(),
    client_id: email.client_id,
    dossier_id: email.dossier_id,
    folder: "Sent",
  }, { onConflict: "email_account_id,message_id" });

  if (syncedError) {
    console.error("email-bridge-send synced_emails upsert error:", syncedError);
  }

  const { error: messageError } = await supabase.from("messages").insert({
    company_id: email.company_id,
    client_id: email.client_id,
    channel: "email",
    direction: "outbound",
    sender: null,
    subject: email.subject,
    body: (email.body_text || "").slice(0, 10000),
    is_read: true,
    delivery_status: "sent",
    delivered_at: new Date().toISOString(),
    attachments: (email.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      content_type: attachment.content_type || "application/octet-stream",
      size: Buffer.from(attachment.content_base64, "base64").byteLength,
    })),
  });

  if (messageError) {
    console.error("email-bridge-send messages insert error:", messageError);
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

  try {
    if (req.method === "GET" && action === "poll") {
      const bridgeSecret = req.headers.get("X-Bridge-Secret") || url.searchParams.get("bridge_secret");
      const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
      if (!expectedSecret || bridgeSecret !== expectedSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const { data: queue, error } = await supabase
        .from("email_outbox")
        .select(`
          *,
          email_accounts(
            id,
            company_id,
            email_address,
            label,
            provider,
            auth_method,
            smtp_host,
            smtp_port,
            smtp_security,
            smtp_username,
            smtp_password_encrypted,
            oauth_access_token_encrypted,
            oauth_refresh_token_encrypted,
            oauth_token_expires_at,
            oauth_client_id,
            status
          )
        `)
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) throw error;
      return jsonResponse({ emails: queue || [] });
    }

    if (req.method === "POST" && action === "confirm") {
      const bridgeSecret = req.headers.get("X-Bridge-Secret");
      const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
      if (!expectedSecret || bridgeSecret !== expectedSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const body = await req.json();
      const { queue_id, success, error: sendError, sent_message_id } = body;

      if (!queue_id) {
        return jsonResponse({ error: "queue_id required" }, 400);
      }

      const { data: outbox, error: outboxError } = await supabase
        .from("email_outbox")
        .select("id, account_id, company_id, client_id, dossier_id, to_recipients, cc_recipients, bcc_recipients, subject, body_html, body_text, reply_to_message_id, attachments")
        .eq("id", queue_id)
        .maybeSingle();

      if (outboxError) throw outboxError;
      if (!outbox) return jsonResponse({ error: "Queue item not found" }, 404);

      await persistQueueResult(supabase, outbox as QueuedEmailRow, !!success, sent_message_id, sendError);
      return jsonResponse({ success: true });
    }

    if (req.method === "POST" && !action) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Missing authorization" }, 401);
      }

      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data: { user }, error: authErr } = await anonClient.auth.getUser();
      if (authErr || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const body = await req.json();
      const { account_id, to, cc, bcc, subject, body_html, body_text, reply_to_message_id, attachments, client_id, dossier_id } = body;

      if (!account_id || !Array.isArray(to) || to.length === 0) {
        return jsonResponse({ error: "account_id and to[] required" }, 400);
      }

      const { data: account, error: accountError } = await anonClient
        .from("email_accounts")
        .select("id, company_id, email_address, label, provider, auth_method, smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted, oauth_access_token_encrypted, oauth_refresh_token_encrypted, oauth_token_expires_at, oauth_client_id, status")
        .eq("id", account_id)
        .single();

      if (accountError || !account) {
        return jsonResponse({ error: "Account not found or access denied" }, 403);
      }

      const normalizedEmail: Omit<QueuedEmailRow, "id"> = {
        company_id: account.company_id,
        account_id,
        to_recipients: to.slice(0, 50),
        cc_recipients: Array.isArray(cc) ? cc.slice(0, 50) : [],
        bcc_recipients: Array.isArray(bcc) ? bcc.slice(0, 50) : [],
        subject: String(subject || "").slice(0, 1000),
        body_html: String(body_html || "").slice(0, 500000),
        body_text: String(body_text || "").slice(0, 200000),
        reply_to_message_id: reply_to_message_id || null,
        attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
        client_id: client_id || null,
        dossier_id: dossier_id || null,
      };

      const { data: queued, error: queueErr } = await supabase
        .from("email_outbox")
        .insert({
          ...normalizedEmail,
          created_by: user.id,
          status: "queued",
        })
        .select("id, account_id, company_id, client_id, dossier_id, to_recipients, cc_recipients, bcc_recipients, subject, body_html, body_text, reply_to_message_id, attachments")
        .single();

      if (queueErr) throw queueErr;

      try {
        const sentMessageId = await dispatchQueuedEmail(supabase, account as EmailAccountRow, queued as QueuedEmailRow);
        await persistQueueResult(supabase, queued as QueuedEmailRow, true, sentMessageId);
        return jsonResponse({ success: true, queue_id: queued.id, sent_message_id: sentMessageId });
      } catch (sendErr) {
        const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
        await persistQueueResult(supabase, queued as QueuedEmailRow, false, undefined, message.slice(0, 500));
        console.error("email-bridge-send immediate send error:", message);
        return jsonResponse({ error: message }, 500);
      }
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("email-bridge-send error:", e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
