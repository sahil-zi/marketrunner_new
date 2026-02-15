// Supabase Edge Function: export-run-pdf
// Generates a PDF for a run's store breakdown.
//
// Deploy: supabase functions deploy export-run-pdf
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// NOTE: For full PDF generation, add a PDF library (e.g. jspdf).
// This stub returns a simple text-based PDF placeholder.

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

    const { runId } = await req.json();

    // Get run details
    const { data: run } = await supabase
      .from("runs")
      .select("*")
      .eq("id", runId)
      .single();

    // Get run items
    const { data: runItems } = await supabase
      .from("run_items")
      .select("*")
      .eq("run_id", runId);

    // Group items by store
    const storeGroups: Record<string, typeof runItems> = {};
    for (const item of runItems || []) {
      const storeName = item.store_name || "Unknown Store";
      if (!storeGroups[storeName]) storeGroups[storeName] = [];
      storeGroups[storeName].push(item);
    }

    // Build a simple text representation (replace with actual PDF generation)
    let content = `Run #${run?.run_number} - ${run?.date}\n`;
    content += `Status: ${run?.status}\n\n`;

    for (const [storeName, items] of Object.entries(storeGroups)) {
      content += `--- ${storeName} ---\n`;
      for (const item of items!) {
        content += `  ${item.style_name} | Size: ${item.size} | Qty: ${item.target_qty} | Type: ${item.type}\n`;
      }
      content += "\n";
    }

    // Return as text (replace with PDF binary when PDF lib is added)
    return new Response(content, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="run-${run?.run_number}.txt"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
