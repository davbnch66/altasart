import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bridge-secret",
};

/**
 * Email Bridge Sync Endpoint
 * 
 * Called by the external Email Bridge service to push synced emails into the SaaS.
 * Auth: X-Bridge-Secret header must match the EMAIL_BRIDGE_SECRET env var.
 * 
 * Body: {
 *   account_id: string,          // email_accounts.id
 *   emails: Array<{
 *     message_id: string,         // RFC Message-ID
 *     direction: "inbound" | "outbound",
 *     from_email: string,
 *     from_name?: string,
 *     to_emails: Array<{ email: string, name?: string }>,
 *     cc_emails?: Array<{ email: string, name?: string }>,
 *     subject?: string,
 *     body_text?: string,
 *     body_html?: string,
 *     attachments?: Array<{ filename: string, content_type: string, size: number, url?: string }>,
 *     received_at: string,        // ISO 8601
 *     folder?: string,
 *     raw_headers?: object,
 *   }>
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate bridge
    const bridgeSecret = req.headers.get("X-Bridge-Secret");
    const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
    if (!expectedSecret || bridgeSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { account_id, emails } = body;

    if (!account_id || !Array.isArray(emails)) {
      return new Response(JSON.stringify({ error: "account_id and emails[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify account exists
    const { data: account, error: accErr } = await supabase
      .from("email_accounts")
      .select("id, company_id, auto_link_clients")
      .eq("id", account_id)
      .single();

    if (accErr || !account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let inserted = 0;
    let skipped = 0;
    let linked = 0;

    for (const email of emails.slice(0, 100)) {
      // Validate message_id
      if (!email.message_id || typeof email.message_id !== "string") {
        skipped++;
        continue;
      }

      const safeSubject = String(email.subject || "").slice(0, 1000);
      const safeBodyText = String(email.body_text || "").slice(0, 200000);
      const safeBodyHtml = String(email.body_html || "").slice(0, 500000);
      const safeFromEmail = String(email.from_email || "").slice(0, 320).toLowerCase();
      const safeFromName = String(email.from_name || "").slice(0, 200);

      // Try to match client
      let clientId: string | null = null;
      if (account.auto_link_clients && safeFromEmail) {
        const contactEmail = email.direction === "inbound" ? safeFromEmail : null;
        const recipientEmail = email.direction === "outbound" && email.to_emails?.length > 0
          ? String(email.to_emails[0].email || "").slice(0, 320).toLowerCase()
          : null;
        const matchEmail = contactEmail || recipientEmail;

        if (matchEmail) {
          // Check clients table
          const { data: client } = await supabase
            .from("clients")
            .select("id")
            .eq("company_id", account.company_id)
            .eq("email", matchEmail)
            .maybeSingle();

          if (client) {
            clientId = client.id;
          } else {
            // Check client_contacts
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
      }

      // Upsert synced email
      const { error: insertErr } = await supabase
        .from("synced_emails")
        .upsert({
          company_id: account.company_id,
          email_account_id: account_id,
          message_id: String(email.message_id).slice(0, 500),
          direction: email.direction === "outbound" ? "outbound" : "inbound",
          from_email: safeFromEmail || null,
          from_name: safeFromName || null,
          to_emails: Array.isArray(email.to_emails) ? email.to_emails.slice(0, 50) : [],
          cc_emails: Array.isArray(email.cc_emails) ? email.cc_emails.slice(0, 50) : [],
          subject: safeSubject,
          body_text: safeBodyText,
          body_html: safeBodyHtml,
          attachments: Array.isArray(email.attachments) ? email.attachments.slice(0, 20) : [],
          received_at: email.received_at || new Date().toISOString(),
          client_id: clientId,
          folder: String(email.folder || "INBOX").slice(0, 100),
          raw_headers: email.raw_headers || null,
        }, { onConflict: "email_account_id,message_id" });

      if (insertErr) {
        console.error("Insert error:", insertErr.message);
        skipped++;
      } else {
        inserted++;
      }

      // Also insert into messages table for timeline
      if (!insertErr && email.direction === "inbound") {
        await supabase.from("messages").insert({
          company_id: account.company_id,
          client_id: clientId,
          channel: "email",
          direction: "inbound",
          sender: safeFromName || safeFromEmail,
          subject: safeSubject,
          body: safeBodyText.slice(0, 10000),
          is_read: false,
        }).then(() => {});
      }
    }

    // Update account sync timestamp
    await supabase
      .from("email_accounts")
      .update({ last_sync_at: new Date().toISOString(), status: "active", last_error: null })
      .eq("id", account_id);

    return new Response(JSON.stringify({
      success: true,
      inserted,
      skipped,
      linked,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-bridge-sync error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
