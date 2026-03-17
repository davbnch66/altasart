import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bridge-secret",
};

/**
 * Email Bridge Send Endpoint
 * 
 * Called by the SaaS frontend to queue an email for sending via the bridge.
 * Auth: Standard Supabase JWT (authenticated user).
 * 
 * The bridge service polls GET /email-bridge-send?action=poll&bridge_secret=xxx
 * to pick up queued emails and sends them via SMTP.
 * 
 * POST body (from frontend):
 * {
 *   account_id: string,           // email_accounts.id to send from
 *   to: Array<{ email: string, name?: string }>,
 *   cc?: Array<{ email: string, name?: string }>,
 *   bcc?: Array<{ email: string, name?: string }>,
 *   subject: string,
 *   body_html?: string,
 *   body_text?: string,
 *   reply_to_message_id?: string, // For threading
 *   attachments?: Array<{ filename: string, content_base64: string, content_type: string }>,
 *   client_id?: string,
 *   dossier_id?: string,
 * }
 * 
 * GET ?action=poll (from bridge, auth via X-Bridge-Secret):
 * Returns queued outbound emails for the bridge to send.
 * 
 * POST ?action=confirm (from bridge, auth via X-Bridge-Secret):
 * { queue_id: string, success: boolean, error?: string, sent_message_id?: string }
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
    // ── Bridge polling for queued emails ──
    if (req.method === "GET" && action === "poll") {
      const bridgeSecret = req.headers.get("X-Bridge-Secret") || url.searchParams.get("bridge_secret");
      const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
      if (!expectedSecret || bridgeSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: queue, error } = await supabase
        .from("email_outbox")
        .select("*, email_accounts(email_address, smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted)")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) throw error;

      return new Response(JSON.stringify({ emails: queue || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Bridge confirms send result ──
    if (req.method === "POST" && action === "confirm") {
      const bridgeSecret = req.headers.get("X-Bridge-Secret");
      const expectedSecret = Deno.env.get("EMAIL_BRIDGE_SECRET");
      if (!expectedSecret || bridgeSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { queue_id, success, error: sendError, sent_message_id } = body;

      if (!queue_id) {
        return new Response(JSON.stringify({ error: "queue_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const update: any = {
        status: success ? "sent" : "failed",
        sent_at: success ? new Date().toISOString() : null,
        error: sendError || null,
        sent_message_id: sent_message_id || null,
      };

      await supabase.from("email_outbox").update(update).eq("id", queue_id);

      // If sent, also record in synced_emails for timeline
      if (success) {
        const { data: outbox } = await supabase
          .from("email_outbox")
          .select("*")
          .eq("id", queue_id)
          .single();

        if (outbox && sent_message_id) {
          await supabase.from("synced_emails").upsert({
            company_id: outbox.company_id,
            email_account_id: outbox.account_id,
            message_id: sent_message_id,
            direction: "outbound",
            from_email: null, // Filled by bridge
            to_emails: outbox.to_recipients,
            cc_emails: outbox.cc_recipients || [],
            subject: outbox.subject,
            body_text: outbox.body_text,
            body_html: outbox.body_html,
            received_at: new Date().toISOString(),
            client_id: outbox.client_id,
            dossier_id: outbox.dossier_id,
            folder: "Sent",
          }, { onConflict: "email_account_id,message_id" });

          // Insert into messages for timeline
          await supabase.from("messages").insert({
            company_id: outbox.company_id,
            client_id: outbox.client_id,
            channel: "email",
            direction: "outbound",
            subject: outbox.subject,
            body: (outbox.body_text || "").slice(0, 10000),
            is_read: true,
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Frontend queues an email to send ──
    if (req.method === "POST" && !action) {
      // Auth: verify JWT
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
      const { account_id, to, cc, bcc, subject, body_html, body_text, reply_to_message_id, attachments, client_id, dossier_id } = body;

      if (!account_id || !to || !Array.isArray(to) || to.length === 0) {
        return new Response(JSON.stringify({ error: "account_id and to[] required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user has access to this account
      const { data: account } = await anonClient
        .from("email_accounts")
        .select("id, company_id")
        .eq("id", account_id)
        .single();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found or access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Queue the email using service role
      const { data: queued, error: queueErr } = await supabase
        .from("email_outbox")
        .insert({
          company_id: account.company_id,
          account_id: account_id,
          to_recipients: to.slice(0, 50),
          cc_recipients: (cc || []).slice(0, 50),
          bcc_recipients: (bcc || []).slice(0, 50),
          subject: String(subject || "").slice(0, 1000),
          body_html: String(body_html || "").slice(0, 500000),
          body_text: String(body_text || "").slice(0, 200000),
          reply_to_message_id: reply_to_message_id || null,
          attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
          client_id: client_id || null,
          dossier_id: dossier_id || null,
          created_by: user.id,
          status: "queued",
        })
        .select("id")
        .single();

      if (queueErr) throw queueErr;

      return new Response(JSON.stringify({ success: true, queue_id: queued.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-bridge-send error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
