import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runId } = await req.json();

    if (!runId) {
      return Response.json({ error: 'Run ID is required' }, { status: 400 });
    }

    // Fetch run data
    const run = await base44.entities.Run.filter({ id: runId });
    if (!run || run.length === 0) {
      return Response.json({ error: 'Run not found' }, { status: 404 });
    }
    const runData = run[0];

    // Fetch run items
    const runItems = await base44.entities.RunItem.filter({ run_id: runId });

    // Group items by store
    const storeGroups = {};
    for (const item of runItems) {
      const storeId = item.store_id || 'unknown';
      const storeName = item.store_name || 'Unknown Store';
      if (!storeGroups[storeId]) {
        storeGroups[storeId] = {
          storeName,
          items: []
        };
      }
      storeGroups[storeId].items.push(item);
    }

    // Create PDF
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text(`Run #${runData.run_number} - Store-wise Breakdown`, 20, 20);
    
    doc.setFontSize(10);
    doc.text(`Date: ${runData.date}`, 20, 30);
    doc.text(`Status: ${runData.status}`, 20, 36);
    doc.text(`Runner: ${runData.runner_name || 'Not Assigned'}`, 20, 42);
    
    let y = 55;

    // Iterate through each store
    for (const [storeId, group] of Object.entries(storeGroups)) {
      // Check if we need a new page
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // Store header
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(group.storeName, 20, y);
      doc.setFont(undefined, 'normal');
      y += 8;

      // Table header
      doc.setFontSize(9);
      doc.text('Barcode', 20, y);
      doc.text('Style', 60, y);
      doc.text('Size', 100, y);
      doc.text('Target', 130, y);
      doc.text('Picked', 155, y);
      doc.text('Type', 175, y);
      y += 6;

      // Items
      doc.setFontSize(8);
      for (const item of group.items) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }

        doc.text(item.barcode || '', 20, y);
        doc.text((item.style_name || '').substring(0, 20), 60, y);
        doc.text(item.size || '', 100, y);
        doc.text(String(item.target_qty || 0), 130, y);
        doc.text(String(item.picked_qty || 0), 155, y);
        doc.text(item.type || 'pickup', 175, y);
        y += 5;
      }

      y += 10; // Space between stores
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=run-${runData.run_number}-stores.pdf`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});