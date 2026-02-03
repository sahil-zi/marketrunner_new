import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { runIds } = await req.json();

    if (!Array.isArray(runIds) || runIds.length === 0) {
      return Response.json({ error: 'Invalid run IDs' }, { status: 400 });
    }

    const results = [];

    for (const runId of runIds) {
      // Get run items
      const runItems = await base44.asServiceRole.entities.RunItem.filter({ run_id: runId });
      
      const pickedItems = runItems.filter(item => item.picked_qty > 0);
      const unpickedItems = runItems.filter(item => item.picked_qty === 0);

      // If there are picked items, mark run as completed
      if (pickedItems.length > 0) {
        await base44.asServiceRole.entities.Run.update(runId, { 
          status: 'completed',
          completed_at: new Date().toISOString()
        });
        
        // Delete unpicked items only
        for (const item of unpickedItems) {
          await base44.asServiceRole.entities.RunItem.delete(item.id);
          
          // Revert order items back to pending if they exist
          if (item.type === 'pickup') {
            const orderItems = await base44.asServiceRole.entities.OrderItem.filter({ 
              run_id: runId,
              barcode: item.barcode 
            });
            for (const orderItem of orderItems) {
              await base44.asServiceRole.entities.OrderItem.update(orderItem.id, {
                status: 'pending',
                run_id: null
              });
            }
          }
        }
        
        results.push({ runId, status: 'completed', pickedCount: pickedItems.length, revertedCount: unpickedItems.length });
      } else {
        // No picked items, cancel entire run
        await base44.asServiceRole.entities.Run.update(runId, { status: 'cancelled' });
        
        // Delete all run items and revert orders
        for (const item of runItems) {
          await base44.asServiceRole.entities.RunItem.delete(item.id);
          
          if (item.type === 'pickup') {
            const orderItems = await base44.asServiceRole.entities.OrderItem.filter({ 
              run_id: runId,
              barcode: item.barcode 
            });
            for (const orderItem of orderItems) {
              await base44.asServiceRole.entities.OrderItem.update(orderItem.id, {
                status: 'pending',
                run_id: null
              });
            }
          }
        }
        
        results.push({ runId, status: 'cancelled', revertedCount: runItems.length });
      }
    }

    return Response.json({ 
      success: true, 
      results 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});