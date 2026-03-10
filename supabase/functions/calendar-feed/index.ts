import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeIcal(str: string): string {
  return (str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcalDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatIcalDateOnly(dateStr: string): string {
  // For all-day events: YYYYMMDD
  return dateStr.replace(/-/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const companyId = url.searchParams.get("company_id");

    if (!token || !companyId) {
      return new Response("Missing token or company_id", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token: get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("company_memberships")
      .select("id")
      .eq("profile_id", user.id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!membership) {
      return new Response("Access denied", { status: 403, headers: corsHeaders });
    }

    // Fetch planning events (last 3 months to next 6 months)
    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    const to = new Date(now);
    to.setMonth(to.getMonth() + 6);
    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    const { data: events } = await supabase
      .from("planning_events")
      .select("id, title, description, start_time, end_time, all_day, event_type, loading_address, loading_city, delivery_address, delivery_city")
      .eq("company_id", companyId)
      .gte("start_time", fromStr)
      .lte("start_time", toStr)
      .order("start_time");

    // Fetch operations
    const { data: operations } = await supabase
      .from("operations")
      .select("id, type, loading_date, loading_time_start, loading_time_end, delivery_date, delivery_time_start, delivery_time_end, loading_address, loading_city, delivery_address, delivery_city, instructions, dossier_id, dossiers(title, clients(name))")
      .eq("company_id", companyId)
      .gte("loading_date", from.toISOString().split("T")[0])
      .lte("loading_date", to.toISOString().split("T")[0])
      .order("loading_date");

    // Build iCal
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AltasArt//Planning//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Planning AltasArt",
      "X-WR-TIMEZONE:Europe/Paris",
    ];

    // Events
    for (const evt of (events || [])) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:evt-${evt.id}@altasart`);
      lines.push(`SUMMARY:${escapeIcal(evt.title)}`);
      
      if (evt.all_day) {
        lines.push(`DTSTART;VALUE=DATE:${formatIcalDateOnly(evt.start_time.split("T")[0])}`);
        lines.push(`DTEND;VALUE=DATE:${formatIcalDateOnly(evt.end_time.split("T")[0])}`);
      } else {
        lines.push(`DTSTART:${formatIcalDate(evt.start_time)}`);
        lines.push(`DTEND:${formatIcalDate(evt.end_time)}`);
      }

      const location = [evt.loading_address, evt.loading_city].filter(Boolean).join(", ") ||
                       [evt.delivery_address, evt.delivery_city].filter(Boolean).join(", ");
      if (location) lines.push(`LOCATION:${escapeIcal(location)}`);
      if (evt.description) lines.push(`DESCRIPTION:${escapeIcal(evt.description)}`);

      lines.push(`CATEGORIES:${evt.event_type || "event"}`);
      lines.push("END:VEVENT");
    }

    // Operations as events
    for (const op of (operations || [])) {
      const dossierTitle = (op.dossiers as any)?.title || "";
      const clientName = (op.dossiers as any)?.clients?.name || "";
      const summary = `${op.type || "Opération"} – ${clientName || dossierTitle}`.trim();

      // Loading event
      if (op.loading_date) {
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:op-load-${op.id}@altasart`);
        lines.push(`SUMMARY:📦 Chargement: ${escapeIcal(summary)}`);

        if (op.loading_time_start) {
          const dtStart = `${op.loading_date}T${op.loading_time_start}:00`;
          const dtEnd = op.loading_time_end ? `${op.loading_date}T${op.loading_time_end}:00` : dtStart;
          lines.push(`DTSTART:${formatIcalDate(dtStart)}`);
          lines.push(`DTEND:${formatIcalDate(dtEnd)}`);
        } else {
          lines.push(`DTSTART;VALUE=DATE:${formatIcalDateOnly(op.loading_date)}`);
          lines.push(`DTEND;VALUE=DATE:${formatIcalDateOnly(op.loading_date)}`);
        }

        const loc = [op.loading_address, op.loading_city].filter(Boolean).join(", ");
        if (loc) lines.push(`LOCATION:${escapeIcal(loc)}`);
        if (op.instructions) lines.push(`DESCRIPTION:${escapeIcal(op.instructions)}`);
        lines.push("CATEGORIES:operation");
        lines.push("END:VEVENT");
      }

      // Delivery event (if different date)
      if (op.delivery_date && op.delivery_date !== op.loading_date) {
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:op-deliv-${op.id}@altasart`);
        lines.push(`SUMMARY:🚚 Livraison: ${escapeIcal(summary)}`);

        if (op.delivery_time_start) {
          const dtStart = `${op.delivery_date}T${op.delivery_time_start}:00`;
          const dtEnd = op.delivery_time_end ? `${op.delivery_date}T${op.delivery_time_end}:00` : dtStart;
          lines.push(`DTSTART:${formatIcalDate(dtStart)}`);
          lines.push(`DTEND:${formatIcalDate(dtEnd)}`);
        } else {
          lines.push(`DTSTART;VALUE=DATE:${formatIcalDateOnly(op.delivery_date)}`);
          lines.push(`DTEND;VALUE=DATE:${formatIcalDateOnly(op.delivery_date)}`);
        }

        const loc = [op.delivery_address, op.delivery_city].filter(Boolean).join(", ");
        if (loc) lines.push(`LOCATION:${escapeIcal(loc)}`);
        lines.push("CATEGORIES:operation");
        lines.push("END:VEVENT");
      }
    }

    lines.push("END:VCALENDAR");

    const icalContent = lines.join("\r\n");

    return new Response(icalContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="planning.ics"',
      },
    });
  } catch (err) {
    return new Response(String(err), { status: 500, headers: corsHeaders });
  }
});
