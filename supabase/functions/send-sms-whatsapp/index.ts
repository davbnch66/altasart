import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Gateway credentials
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: "TWILIO_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { channel, to, body: messageBody, from, clientId, companyId } = await req.json();

    if (!channel || !to || !messageBody) {
      return new Response(JSON.stringify({ error: "channel, to, and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate company membership
    const { data: membership } = await supabase
      .from("company_memberships")
      .select("id")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Twilio phone number from secrets
    const RAW_TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!RAW_TWILIO_PHONE) {
      return new Response(JSON.stringify({ error: "TWILIO_PHONE_NUMBER is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const TWILIO_PHONE_NUMBER = RAW_TWILIO_PHONE.replace(/[\s.\-()]/g, "");

    // Build Twilio params
    let twilioTo = to;
    let twilioFrom: string;

    if (channel === "whatsapp") {
      const RAW_WA_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
      if (!RAW_WA_NUMBER) {
        return new Response(JSON.stringify({ error: "TWILIO_WHATSAPP_NUMBER is not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const waNumber = RAW_WA_NUMBER.replace(/[\s.\-()]/g, "");
      twilioTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      twilioFrom = `whatsapp:${waNumber}`;
    } else {
      twilioFrom = from || TWILIO_PHONE_NUMBER;
    }

    const params: Record<string, string> = {
      To: twilioTo,
      From: twilioFrom,
      Body: messageBody,
    };

    // Send via Twilio Gateway
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    const twilioData = await response.json();
    if (!response.ok) {
      console.error("Twilio API error:", JSON.stringify(twilioData));
      return new Response(
        JSON.stringify({ error: `Twilio error [${response.status}]: ${twilioData.message || JSON.stringify(twilioData)}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store message in DB using service role
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    await adminClient.from("messages").insert({
      company_id: companyId,
      client_id: clientId || null,
      channel: channel === "whatsapp" ? "whatsapp" : "sms",
      direction: "outbound",
      sender: "Vous",
      body: messageBody,
      is_read: true,
      created_by: userId,
    });

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending message:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
