import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const MAX_EMAILS_PER_SYNC = 100;

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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google token refresh failed [${res.status}]: ${txt}`);
  }
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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Microsoft token refresh failed [${res.status}]: ${txt}`);
  }
  const data = await res.json();
  return data.access_token;
}

interface ParsedEmail {
  message_id: string;
  provider_message_id: string; // Gmail ID or Outlook ID for re-fetching attachments
  from_email: string;
  from_name: string;
  to_emails: Array<{ email: string; name?: string }>;
  cc_emails: Array<{ email: string; name?: string }>;
  subject: string;
  body_text: string;
  body_html: string;
  received_at: string;
  attachments: Array<{ filename: string; content_type: string; size: number; attachment_id?: string; provider_msg_id?: string }>;
  in_reply_to?: string;
  folder?: string;
}

// ─── Gmail Polling (all folders including spam/trash) ────────────
async function fetchGmailEmails(accessToken: string, since: Date, maxResults: number): Promise<ParsedEmail[]> {
  const afterEpoch = Math.floor(since.getTime() / 1000);
  const queries = [
    `after:${afterEpoch} in:anywhere -label:drafts`,
  ];

  const allMessageIds = new Set<string>();

  for (const query of queries) {
    try {
      let pageToken: string | undefined;
      do {
        const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
        url.searchParams.set("q", query);
        url.searchParams.set("maxResults", String(maxResults));
        url.searchParams.set("includeSpamTrash", "true");
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const listRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!listRes.ok) {
          console.warn(`Gmail list failed [${listRes.status}]`);
          break;
        }
        const listData = await listRes.json();
        for (const m of (listData.messages || [])) allMessageIds.add(m.id);
        pageToken = listData.nextPageToken;
      } while (pageToken && allMessageIds.size < maxResults);
    } catch (e) {
      console.warn(`Gmail query error:`, e);
    }
  }

  if (allMessageIds.size === 0) return [];

  const emails: ParsedEmail[] = [];
  const idsToFetch = [...allMessageIds].slice(0, maxResults);

  for (const msgId of idsToFetch) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();

      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      const fromRaw = getHeader("From");
      const fromMatch = fromRaw.match(/(?:"?([^"]*)"?\s)?<?([^\s>]+@[^\s>]+)>?/);
      const fromName = fromMatch?.[1] || "";
      const fromEmail = (fromMatch?.[2] || fromRaw).toLowerCase();

      const toRaw = getHeader("To");
      const toEmails = parseEmailList(toRaw);
      const ccRaw = getHeader("Cc");
      const ccEmails = parseEmailList(ccRaw);

      // Determine folder from Gmail labels
      const labelIds: string[] = msg.labelIds || [];
      let folder = "inbox";
      if (labelIds.includes("SPAM")) folder = "spam";
      else if (labelIds.includes("TRASH")) folder = "trash";
      else if (labelIds.includes("SENT") && !labelIds.includes("INBOX")) folder = "sent";
      else if (labelIds.includes("DRAFT")) folder = "drafts";

      // Extract body
      let bodyText = "";
      let bodyHtml = "";
      const parts = flattenParts(msg.payload);
      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = base64UrlDecode(part.body.data);
        }
        if (part.mimeType === "text/html" && part.body?.data) {
          bodyHtml = base64UrlDecode(part.body.data);
        }
      }

      const attachments = parts
        .filter((p: any) => p.filename && p.filename.length > 0)
        .map((p: any) => ({
          filename: p.filename,
          content_type: p.mimeType || "application/octet-stream",
          size: p.body?.size || 0,
          attachment_id: p.body?.attachmentId || undefined,
          provider_msg_id: msgId,
        }));

      emails.push({
        message_id: getHeader("Message-ID") || msgId,
        provider_message_id: msgId,
        from_email: fromEmail,
        from_name: fromName,
        to_emails: toEmails,
        cc_emails: ccEmails,
        subject: getHeader("Subject"),
        body_text: bodyText,
        body_html: bodyHtml,
        received_at: new Date(parseInt(msg.internalDate)).toISOString(),
        attachments,
        in_reply_to: getHeader("In-Reply-To") || undefined,
        folder,
      });
    } catch (e) {
      console.error(`Gmail message ${msgId} parse error:`, e);
    }
  }

  return emails;
}

// ─── Outlook Polling ─────────────────────────────────────────────
async function fetchOutlookEmails(accessToken: string, since: Date, maxResults: number): Promise<ParsedEmail[]> {
  const sinceStr = since.toISOString();
  const outlookFolders = [
    { id: "inbox", folder: "inbox", dateField: "receivedDateTime" },
    { id: "junkemail", folder: "spam", dateField: "receivedDateTime" },
    { id: "sentitems", folder: "sent", dateField: "sentDateTime" },
    { id: "deleteditems", folder: "trash", dateField: "receivedDateTime" },
  ];

  const emails: ParsedEmail[] = [];
  const seenIds = new Set<string>();

  for (const { id: folderId, folder: folderName, dateField } of outlookFolders) {
    try {
      const url = new URL(`https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages`);
      url.searchParams.set("$filter", `${dateField} ge ${sinceStr}`);
      url.searchParams.set("$top", String(maxResults));
      url.searchParams.set("$orderby", `${dateField} desc`);
      url.searchParams.set(
        "$select",
        "id,subject,from,toRecipients,ccRecipients,body,receivedDateTime,sentDateTime,internetMessageId,internetMessageHeaders,hasAttachments,parentFolderId",
      );

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        console.warn(`Outlook folder ${folderId} failed [${res.status}]`);
        continue;
      }

      const data = await res.json();
      const messages = data.value || [];

      for (const msg of messages) {
        const msgUniqueId = msg.internetMessageId || msg.id;
        if (seenIds.has(msgUniqueId)) continue;
        seenIds.add(msgUniqueId);

        try {
          const fromEmail = (msg.from?.emailAddress?.address || "").toLowerCase();
          const fromName = msg.from?.emailAddress?.name || "";

          const toEmails = (msg.toRecipients || []).map((r: any) => ({
            email: (r.emailAddress?.address || "").toLowerCase(),
            name: r.emailAddress?.name,
          }));
          const ccEmails = (msg.ccRecipients || []).map((r: any) => ({
            email: (r.emailAddress?.address || "").toLowerCase(),
            name: r.emailAddress?.name,
          }));

          const bodyContent = msg.body?.content || "";
          const isHtml = String(msg.body?.contentType || "").toLowerCase() === "html";

          let attachments: Array<{ filename: string; content_type: string; size: number; attachment_id?: string; provider_msg_id?: string }> = [];
          if (msg.hasAttachments) {
            try {
              const attRes = await fetch(
                `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments?$select=id,name,contentType,size`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (attRes.ok) {
                const attData = await attRes.json();
                attachments = (attData.value || []).map((a: any) => ({
                  filename: a.name || "attachment",
                  content_type: a.contentType || "application/octet-stream",
                  size: a.size || 0,
                  attachment_id: a.id || undefined,
                  provider_msg_id: msg.id,
                }));
              }
            } catch (_) {}
          }

          const inReplyTo = (msg.internetMessageHeaders || [])
            .find((h: any) => String(h.name || "").toLowerCase() === "in-reply-to")?.value;

          const messageDate = folderName === "sent"
            ? (msg.sentDateTime || msg.receivedDateTime || new Date().toISOString())
            : (msg.receivedDateTime || msg.sentDateTime || new Date().toISOString());

          emails.push({
            message_id: msgUniqueId,
            provider_message_id: msg.id,
            from_email: fromEmail,
            from_name: fromName,
            to_emails: toEmails,
            cc_emails: ccEmails,
            subject: msg.subject || "",
            body_text: isHtml ? "" : bodyContent,
            body_html: isHtml ? bodyContent : "",
            received_at: messageDate,
            attachments,
            in_reply_to: inReplyTo,
            folder: folderName,
          });
        } catch (e) {
          console.error(`Outlook message parse error:`, e);
        }
      }
    } catch (e) {
      console.warn(`Outlook folder ${folderId} error:`, e);
    }
  }

  return emails;
}

// ─── Helpers ─────────────────────────────────────────────────────
function parseEmailList(raw: string): Array<{ email: string; name?: string }> {
  if (!raw) return [];
  return raw.split(",").map(part => {
    const match = part.trim().match(/(?:"?([^"]*)"?\s)?<?([^\s>]+@[^\s>]+)>?/);
    if (match) {
      return { email: (match[2] || "").toLowerCase(), name: match[1] || undefined };
    }
    return { email: part.trim().toLowerCase() };
  }).filter(e => e.email.includes("@"));
}

function flattenParts(part: any): any[] {
  if (!part) return [];
  const result: any[] = [part];
  if (part.parts) {
    for (const p of part.parts) {
      result.push(...flattenParts(p));
    }
  }
  return result;
}

function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

// ─── Main Handler ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: service role, bridge secret, authenticated user, or pg_net cron (no auth header)
    const authHeader = req.headers.get("Authorization");
    const bridgeSecret = req.headers.get("X-Bridge-Secret");
    const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");

    const isServiceRole = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "NONE");
    const isBridgeAuth = expectedSecret && bridgeSecret === expectedSecret;
    // pg_net cron calls: validate via a dedicated cron secret or known Supabase internal headers
    const cronSecret = req.headers.get("X-Cron-Secret");
    const expectedCronSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isCronCall = req.method === "POST" && !authHeader && !bridgeSecret
      && (cronSecret === expectedCronSecret
          || req.headers.get("User-Agent")?.includes("supabase")
          || req.headers.get("X-Supabase-Source") === "pg_cron");

    if (!isServiceRole && !isBridgeAuth && !isCronCall) {
      // Also allow authenticated users
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader || "" } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "EMAIL_ENCRYPTION_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all active, sync-enabled OAuth accounts
    const { data: accounts, error: accErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("sync_enabled", true)
      .eq("auth_method", "oauth2")
      .in("status", ["active", "testing"]);

    if (accErr) throw new Error(`Failed to list accounts: ${accErr.message}`);

    const results: any[] = [];

    for (const account of accounts || []) {
      const accountLog = { id: account.id, email: account.email_address, provider: account.provider };
      try {
        if (!account.oauth_refresh_token_encrypted) {
          console.warn("No refresh token for account:", account.id);
          results.push({ ...accountLog, status: "skipped", reason: "no_refresh_token" });
          continue;
        }

        // Decrypt refresh token
        const refreshToken = await decryptValue(account.oauth_refresh_token_encrypted, encryptionKey);

        // Get access token
        let accessToken: string;
        if (account.provider === "gmail") {
          const clientId = account.oauth_client_id || Deno.env.get("GOOGLE_CLIENT_ID")!;
          const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
          accessToken = await refreshGoogleToken(refreshToken, clientId, clientSecret);
        } else if (account.provider === "outlook") {
          const clientId = account.oauth_client_id || Deno.env.get("MICROSOFT_CLIENT_ID")!;
          const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;
          accessToken = await refreshMicrosoftToken(refreshToken, clientId, clientSecret);
        } else {
          results.push({ ...accountLog, status: "skipped", reason: "unsupported_provider" });
          continue;
        }

        // Calculate since date with overlap to avoid missing emails that appear late in provider APIs
        const sinceDate = account.last_sync_at
          ? new Date(new Date(account.last_sync_at).getTime() - 10 * 60 * 1000)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Fetch emails
        let emails: ParsedEmail[];
        if (account.provider === "gmail") {
          emails = await fetchGmailEmails(accessToken, sinceDate, MAX_EMAILS_PER_SYNC);
        } else {
          emails = await fetchOutlookEmails(accessToken, sinceDate, MAX_EMAILS_PER_SYNC);
        }

        console.log(`Fetched ${emails.length} emails for ${account.email_address}`);

        if (emails.length === 0) {
          // Update last_sync_at even if no new emails
          await supabase
            .from("email_accounts")
            .update({ last_sync_at: new Date().toISOString(), status: "active", last_error: null })
            .eq("id", account.id);
          results.push({ ...accountLog, status: "ok", fetched: 0, inserted: 0 });
          continue;
        }

        // Push emails through the sync pipeline
        let inserted = 0;
        let skipped = 0;
        let linked = 0;

        for (const email of emails) {
          const messageId = email.message_id.slice(0, 500);
          const normalizedFolder = (email.folder || "inbox").toLowerCase();
          const isSentFolder = normalizedFolder === "sent";
          const safeSubject = email.subject.slice(0, 1000);
          const safeBodyText = email.body_text.slice(0, 200000);
          const safeBodyHtml = email.body_html.slice(0, 500000);
          const safeFromEmail = email.from_email.slice(0, 320).toLowerCase();
          const matchEmail = isSentFolder
            ? String(email.to_emails?.[0]?.email || "").slice(0, 320).toLowerCase()
            : safeFromEmail;

          // Try to match client
          let clientId: string | null = null;
          if (account.auto_link_clients && matchEmail) {
            const { data: client } = await supabase
              .from("clients")
              .select("id")
              .eq("company_id", account.company_id)
              .eq("email", matchEmail)
              .maybeSingle();

            if (client) {
              clientId = client.id;
            } else {
              const { data: contact } = await supabase
                .from("client_contacts")
                .select("client_id")
                .eq("company_id", account.company_id)
                .eq("email", matchEmail)
                .limit(1)
                .maybeSingle();
              if (contact) clientId = contact.client_id;
            }
            if (clientId) linked++;
          }

          // Upsert synced email rows — idempotent on (email_account_id, message_id)
          const { error: insertErr } = await supabase
            .from("synced_emails")
            .upsert({
              company_id: account.company_id,
              email_account_id: account.id,
              message_id: messageId,
              direction: isSentFolder ? "outbound" : "inbound",
              from_email: safeFromEmail || null,
              from_name: email.from_name.slice(0, 200) || null,
              to_emails: email.to_emails.slice(0, 50),
              cc_emails: email.cc_emails.slice(0, 50),
              subject: safeSubject,
              body_text: safeBodyText,
              body_html: safeBodyHtml,
              attachments: email.attachments.slice(0, 20),
              received_at: email.received_at,
              client_id: clientId,
              folder: normalizedFolder,
              in_reply_to: email.in_reply_to || null,
            }, { onConflict: "email_account_id,message_id", ignoreDuplicates: true });

          if (insertErr) {
            console.error("Upsert error:", insertErr.message);
            skipped++;
            continue;
          }

          inserted++;

          // Insert into messages table for timeline only for newly synced messages
          await supabase.from("messages").insert({
            company_id: account.company_id,
            client_id: clientId,
            channel: "email",
            direction: isSentFolder ? "outbound" : "inbound",
            sender: email.from_name || safeFromEmail,
            subject: safeSubject,
            body: safeBodyText.slice(0, 10000),
            is_read: isSentFolder,
          }).then(() => {});

          // Also create inbound_email for AI analysis pipeline (with dedup via message_id)
          const emailMessageId = messageId;

          // Check if already exists
          const { data: existingInbound } = await supabase
            .from("inbound_emails")
            .select("id")
            .eq("company_id", account.company_id)
            .eq("message_id", emailMessageId)
            .maybeSingle();

          let inboundEmail = existingInbound;
          const isNewInbound = !existingInbound;
          if (!existingInbound) {
            const { data: newInbound } = await supabase
              .from("inbound_emails")
              .insert({
                company_id: account.company_id,
                email_account_id: account.id,
                from_email: safeFromEmail,
                from_name: email.from_name || null,
                to_email: account.email_address,
                subject: safeSubject,
                body_text: safeBodyText,
                body_html: safeBodyHtml,
                attachments: email.attachments.length > 0 ? email.attachments : null,
                client_id: clientId,
                status: "pending",
                message_id: emailMessageId,
                folder: normalizedFolder,
              })
              .select("id")
              .single();
            inboundEmail = newInbound;
          }

          // Trigger AI analysis for NEW inbound emails — fire-and-forget (non-blocking)
          // For spam/trash: pass flag so AI only checks for false positives
          const spamTrashFolders = ["spam", "junk", "trash", "deleted", "corbeille", "poubelle"];
          const isSpamOrTrash = spamTrashFolders.includes(normalizedFolder);
          if (inboundEmail && isNewInbound) {
            // Fire-and-forget: don't await — prevents sequential timeout with many emails
            const emailId = inboundEmail.id;
            const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-inbound-email`;
            const analyzeWithRetry = async () => {
              let analysisOk = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  const res = await fetch(processUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    },
                    body: JSON.stringify({
                      inbound_email_id: emailId,
                      ...(isSpamOrTrash ? { spam_check_only: true } : {}),
                    }),
                  });
                  if (res.ok) { analysisOk = true; break; }
                  console.warn(`AI analysis attempt ${attempt} failed [${res.status}] for ${emailId}`);
                } catch (e) {
                  console.error(`AI analysis attempt ${attempt} error:`, e);
                }
                if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
              }
              if (!analysisOk) {
                await supabase.from("inbound_emails")
                  .update({ status: "error" })
                  .eq("id", emailId);
                console.error(`AI analysis failed after 3 attempts for email ${emailId}`);
              }
            };
            // Launch without awaiting — runs in background
            analyzeWithRetry().catch(e => console.error("Background analysis error:", e));
          }
        }

        // Update account
        await supabase
          .from("email_accounts")
          .update({ last_sync_at: new Date().toISOString(), status: "active", last_error: null })
          .eq("id", account.id);

        results.push({ ...accountLog, status: "ok", fetched: emails.length, inserted, skipped, linked });
        console.log(`Sync complete for ${account.email_address}: ${inserted} inserted, ${skipped} skipped, ${linked} linked`);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Account ${account.email_address} error:`, errorMsg);
        await supabase
          .from("email_accounts")
          .update({ last_error: errorMsg.slice(0, 1000) })
          .eq("id", account.id);
        results.push({ ...accountLog, status: "error", error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poll-email-accounts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
