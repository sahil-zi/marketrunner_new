// Supabase Edge Function: create-store-owner
// Creates a store owner user with a direct password (no invite email).
//
// Deploy: supabase functions deploy create-store-owner
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, password, full_name = "", store_id } = await req.json();

    if (!email || !password || !store_id) {
      return new Response(
        JSON.stringify({ error: "Email, password, and store_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create auth user with direct password (no invite email)
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) throw createError;

    // Create profile row with store_owner role and store_id
    const userId = userData.user.id;
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      role: "store_owner",
      store_id,
    });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ success: true, userId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
