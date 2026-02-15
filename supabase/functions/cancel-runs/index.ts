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

    // Helper: revert order/return items back to pending for a given run item
    async function revertRunItem(runId: string, item: any) {
      if (item.type === "pickup") {
        // Find order items assigned to this run with matching barcode
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("*")
          .eq("run_id", runId)
          .eq("barcode", item.barcode);

        for (const oi of orderItems || []) {
          await supabase
            .from("order_items")
            .update({ status: "pending", run_id: null })
            .eq("id", oi.id);
        }

        // Also try filtering by status in case run_id filter doesn't match
        if (!orderItems || orderItems.length === 0) {
          const { data: byStatus } = await supabase
            .from("order_items")
            .select("*")
            .eq("status", "assigned_to_run")
            .eq("barcode", item.barcode);

          for (const oi of byStatus || []) {
            await supabase
              .from("order_items")
              .update({ status: "pending", run_id: null })
              .eq("id", oi.id);
          }
        }
      } else if (item.type === "return") {
        // Revert return items back to pending
        if (item.original_return_id) {
          await supabase
            .from("returns")
            .update({ status: "pending", run_id: null, run_number: null })
            .eq("id", item.original_return_id);
        } else {
          // Fallback: find returns assigned to this run with matching barcode
          const { data: returns } = await supabase
            .from("returns")
            .select("*")
            .eq("run_id", runId)
            .eq("barcode", item.barcode);

          for (const ret of returns || []) {
            await supabase
              .from("returns")
              .update({ status: "pending", run_id: null, run_number: null })
              .eq("id", ret.id);
          }
        }
      }
    }

    for (const runId of runIds) {
      // Get run items
      const { data: runItems } = await supabase
        .from("run_items")
        .select("*")
        .eq("run_id", runId);

      const pickedItems = (runItems || []).filter((i) => (i.picked_qty || 0) > 0);
      const unpickedItems = (runItems || []).filter((i) => (i.picked_qty || 0) === 0);

      if (pickedItems.length > 0) {
        // Has picked items: mark run as completed, revert unpicked
        await supabase
          .from("runs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", runId);

        for (const item of unpickedItems) {
          await revertRunItem(runId, item);
          await supabase
            .from("run_items")
            .update({ status: "cancelled" })
            .eq("id", item.id);
        }

        results.push({ runId, status: "completed", pickedCount: pickedItems.length, revertedCount: unpickedItems.length });
      } else {
        // No picked items: cancel entire run
        await supabase
          .from("runs")
          .update({ status: "cancelled" })
          .eq("id", runId);

        for (const item of runItems || []) {
          await revertRunItem(runId, item);
          await supabase
            .from("run_items")
            .update({ status: "cancelled" })
            .eq("id", item.id);
        }

        results.push({ runId, status: "cancelled", revertedCount: (runItems || []).length });
      }
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
