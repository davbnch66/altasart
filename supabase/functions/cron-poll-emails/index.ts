import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// This function is called by a pg_cron job every 2 minutes
// It triggers poll-email-accounts independently of any client
serve(async () => {
  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/poll-email-accounts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({}),
      }
    );
    const data = await res.json();
    console.log("Cron poll result:", JSON.stringify(data));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Cron poll error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
