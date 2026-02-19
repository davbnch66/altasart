import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authenticate caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: corsHeaders });

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !caller) return new Response(JSON.stringify({ error: "Token invalide" }), { status: 401, headers: corsHeaders });

  // Parse body
  const { email, full_name, password, company_id, role } = await req.json();
  if (!email || !password || !company_id || !role) {
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: corsHeaders });
  }

  // Check caller is admin for the target company
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: membership } = await adminClient
    .from("company_memberships")
    .select("role")
    .eq("profile_id", caller.id)
    .eq("company_id", company_id)
    .single();

  if (!membership || membership.role !== "admin") {
    return new Response(JSON.stringify({ error: "Accès refusé : vous devez être admin de cette société" }), { status: 403, headers: corsHeaders });
  }

  // Create user via admin API
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || "" },
  });

  if (createErr || !newUser.user) {
    return new Response(JSON.stringify({ error: createErr?.message || "Erreur création utilisateur" }), { status: 400, headers: corsHeaders });
  }

  // Upsert profile
  await adminClient.from("profiles").upsert({
    id: newUser.user.id,
    email,
    full_name: full_name || "",
  });

  // Create membership
  const { error: memberErr } = await adminClient.from("company_memberships").insert({
    profile_id: newUser.user.id,
    company_id,
    role,
    invited_by: caller.id,
  });

  if (memberErr) {
    return new Response(JSON.stringify({ error: memberErr.message }), { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
