// Supabase Edge Function: cancel-runs
// Cancels runs, reverts unpicked items to pending, completes runs with picked items.
//
// Deploy: supabase functions deploy cancel-runs
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

    const { runIds } = await req.json();
    const results = [];

    for (const runId of runIds) {
      // Get run items
      const { data: runItems } = await supabase
        .from("run_items")
        .select("*")
        .eq("run_id", runId);

      const pickedItems = (runItems || []).filter((i) => (i.picked_qty || 0) > 0);
      const unpickedItems = (runItems || []).filter((i) => (i.picked_qty || 0) === 0);

      // Revert unpicked order items to pending
      for (const item of unpickedItems) {
        if (item.type === "pickup") {
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("*")
            .eq("barcode", item.barcode)
            .eq("run_id", runId);

          for (const oi of orderItems || []) {
            await supabase
              .from("order_items")
              .update({ status: "pending", run_id: null })
              .eq("id", oi.id);
          }
        } else if (item.type === "return" && item.original_return_id) {
          await supabase
            .from("returns")
            .update({ status: "pending", run_id: null, run_number: null })
            .eq("id", item.original_return_id);
        }

        // Mark run item as cancelled
        await supabase
          .from("run_items")
          .update({ status: "cancelled" })
          .eq("id", item.id);
      }

      // Determine final run status
      const finalStatus = pickedItems.length > 0 ? "completed" : "cancelled";

      await supabase
        .from("runs")
        .update({ status: finalStatus })
        .eq("id", runId);

      results.push({ runId, status: finalStatus });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
