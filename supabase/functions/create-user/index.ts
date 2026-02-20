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
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: corsHeaders });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Token invalide" }), { status: 401, headers: corsHeaders });
  }
  const callerId = userData.user.id;

  // Parse body
  const { email, username, full_name, password, company_id, role } = await req.json();
  
  // Either email or username is required
  const hasEmail = email && email.trim().length > 0;
  const hasUsername = username && username.trim().length > 0;
  
  if (!hasEmail && !hasUsername) {
    return new Response(JSON.stringify({ error: "Email ou pseudo requis" }), { status: 400, headers: corsHeaders });
  }
  if (!password || !company_id || !role) {
    return new Response(JSON.stringify({ error: "Champs requis manquants (mot de passe, société, rôle)" }), { status: 400, headers: corsHeaders });
  }

  // Check caller is admin for the target company
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: membership } = await adminClient
    .from("company_memberships")
    .select("role")
    .eq("profile_id", callerId)
    .eq("company_id", company_id)
    .single();

  if (!membership || membership.role !== "admin") {
    return new Response(JSON.stringify({ error: "Accès refusé : vous devez être admin de cette société" }), { status: 403, headers: corsHeaders });
  }

  // For username-only accounts, generate a fake email
  const actualEmail = hasEmail 
    ? email.trim().toLowerCase() 
    : `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@pseudo.local`;
  
  const displayName = full_name?.trim() || (hasUsername ? username.trim() : "");

  try {
    // Try to create user via admin API
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: actualEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });

    if (createErr) {
      // If user already exists, try to find them and just add membership
      if (createErr.message?.includes("already been registered")) {
        const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
        if (listErr) throw listErr;
        
        const existingUser = users?.find((u: any) => u.email === actualEmail);
        if (!existingUser) {
          return new Response(JSON.stringify({ error: "Utilisateur introuvable malgré l'erreur de doublon" }), { status: 400, headers: corsHeaders });
        }

        // Check if membership already exists
        const { data: existingMembership } = await adminClient
          .from("company_memberships")
          .select("id")
          .eq("profile_id", existingUser.id)
          .eq("company_id", company_id)
          .maybeSingle();

        if (existingMembership) {
          return new Response(JSON.stringify({ error: "Cet utilisateur est déjà membre de cette société" }), { status: 400, headers: corsHeaders });
        }

        // Ensure profile exists
        await adminClient.from("profiles").upsert({
          id: existingUser.id,
          email: hasEmail ? actualEmail : null,
          full_name: displayName,
        });

        // Create membership
        const { error: memberErr } = await adminClient.from("company_memberships").insert({
          profile_id: existingUser.id,
          company_id,
          role,
          invited_by: callerId,
        });

        if (memberErr) {
          return new Response(JSON.stringify({ error: memberErr.message }), { status: 400, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, user_id: existingUser.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }

    if (!newUser.user) {
      return new Response(JSON.stringify({ error: "Erreur création utilisateur" }), { status: 400, headers: corsHeaders });
    }

    // Upsert profile
    await adminClient.from("profiles").upsert({
      id: newUser.user.id,
      email: hasEmail ? actualEmail : null,
      full_name: displayName,
    });

    // Create membership
    const { error: memberErr } = await adminClient.from("company_memberships").insert({
      profile_id: newUser.user.id,
      company_id,
      role,
      invited_by: callerId,
    });

    if (memberErr) {
      return new Response(JSON.stringify({ error: memberErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Erreur inattendue" }), { status: 500, headers: corsHeaders });
  }
});
