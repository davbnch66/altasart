import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Twilio sends webhooks as application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let fromNumber: string;
    let toNumber: string;
    let messageBody: string;
    let messageSid: string;
    let numMedia: number;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      
      // Check if this is a status callback (has MessageStatus field)
      const messageStatus = formData.get("MessageStatus") as string | null;
      if (messageStatus) {
        // Handle delivery status callback
        const sid = (formData.get("MessageSid") as string) || "";
        if (sid) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const adminClient = createClient(supabaseUrl, serviceRoleKey);

          // Map Twilio statuses to our delivery_status
          let deliveryStatus = "sent";
          if (messageStatus === "delivered") deliveryStatus = "delivered";
          else if (messageStatus === "read") deliveryStatus = "read";
          else if (messageStatus === "failed" || messageStatus === "undelivered") deliveryStatus = "failed";
          else if (messageStatus === "sent") deliveryStatus = "sent";

          const updateData: Record<string, any> = { delivery_status: deliveryStatus };
          if (deliveryStatus === "delivered") updateData.delivered_at = new Date().toISOString();
          if (deliveryStatus === "read") {
            updateData.delivered_at = updateData.delivered_at || new Date().toISOString();
            updateData.read_at = new Date().toISOString();
          }

          await adminClient
            .from("messages")
            .update(updateData)
            .eq("external_id", sid);
        }

        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      }

      fromNumber = (formData.get("From") as string) || "";
      toNumber = (formData.get("To") as string) || "";
      messageBody = (formData.get("Body") as string) || "";
      messageSid = (formData.get("MessageSid") as string) || "";
      numMedia = parseInt((formData.get("NumMedia") as string) || "0", 10);
    } else {
      const body = await req.json();
      fromNumber = body.From || "";
      toNumber = body.To || "";
      messageBody = body.Body || "";
      messageSid = body.MessageSid || "";
      numMedia = parseInt(body.NumMedia || "0", 10);
    }

    if (!fromNumber || !messageBody) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    // Determine channel
    const isWhatsApp = fromNumber.startsWith("whatsapp:");
    const channel = isWhatsApp ? "whatsapp" : "sms";
    const cleanFrom = fromNumber.replace("whatsapp:", "");

    // Use service role to store message
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Try to find the client by phone number
    // Search in clients table (phone, mobile) and client_contacts table (mobile, phone_direct)
    let clientId: string | null = null;
    let companyId: string | null = null;

    // Search clients table
    const { data: clientsByPhone } = await adminClient
      .from("clients")
      .select("id, company_id, name")
      .or(`phone.ilike.%${cleanFrom.slice(-9)}%,mobile.ilike.%${cleanFrom.slice(-9)}%`)
      .limit(1);

    if (clientsByPhone && clientsByPhone.length > 0) {
      clientId = clientsByPhone[0].id;
      companyId = clientsByPhone[0].company_id;
    } else {
      // Search client_contacts table
      const { data: contactsByPhone } = await adminClient
        .from("client_contacts")
        .select("client_id, company_id")
        .or(`mobile.ilike.%${cleanFrom.slice(-9)}%,phone_direct.ilike.%${cleanFrom.slice(-9)}%`)
        .limit(1);

      if (contactsByPhone && contactsByPhone.length > 0) {
        clientId = contactsByPhone[0].client_id;
        companyId = contactsByPhone[0].company_id;
      }
    }

    // If no company found, we need at least one to store the message
    if (!companyId) {
      // Get first company as fallback
      const { data: companies } = await adminClient
        .from("companies")
        .select("id")
        .limit(1);
      if (companies && companies.length > 0) {
        companyId = companies[0].id;
      }
    }

    if (!companyId) {
      console.error("No company found to store incoming message");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    // Insert message
    const { error: insertError } = await adminClient.from("messages").insert({
      company_id: companyId,
      client_id: clientId,
      channel,
      direction: "inbound",
      sender: cleanFrom,
      body: messageBody,
      is_read: false,
    });

    if (insertError) {
      console.error("Error inserting message:", insertError);
    }

    // Create notification for company members if client found
    if (clientId) {
      const { data: members } = await adminClient
        .from("company_memberships")
        .select("profile_id")
        .eq("company_id", companyId);

      if (members) {
        const clientName = clientsByPhone?.[0]?.name || cleanFrom;
        const notifications = members.map((m) => ({
          company_id: companyId!,
          user_id: m.profile_id,
          type: "client_response" as const,
          title: `${isWhatsApp ? "WhatsApp" : "SMS"} reçu`,
          body: `${clientName}: ${messageBody.substring(0, 100)}`,
          link: `/clients/${clientId}`,
        }));

        await adminClient.from("notifications").insert(notifications);
      }
    }

    // Return TwiML empty response (Twilio expects XML)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  } catch (error: unknown) {
    console.error("Error processing incoming message:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
