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
    const storeEntries = Object.entries(storeGroups);
    for (let storeIndex = 0; storeIndex < storeEntries.length; storeIndex++) {
      const [storeId, group] = storeEntries[storeIndex];
      
      // Store header
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(group.storeName, 20, y);
      doc.setFont(undefined, 'normal');
      y += 10;

      // Items with images
      for (const item of group.items) {
        // Check if we need a new page
        if (y > 240) {
          doc.addPage();
          y = 20;
        }

        // Add product image if available
        if (item.image_url) {
          try {
            doc.addImage(item.image_url, 'JPEG', 20, y, 30, 30);
          } catch (e) {
            // Skip image if loading fails
          }
        }

        // Item details next to image
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text((item.style_name || '').substring(0, 35), 55, y + 5);
        doc.setFont(undefined, 'normal');
        
        doc.setFontSize(8);
        doc.text(`Barcode: ${item.barcode || ''}`, 55, y + 12);
        doc.text(`Size: ${item.size || ''}`, 55, y + 17);
        doc.text(`Color: ${item.color || ''}`, 55, y + 22);
        doc.text(`Quantity: ${item.target_qty || 0}`, 55, y + 27);
        doc.text(`Type: ${item.type || 'pickup'}`, 120, y + 27);

        y += 35; // Space for next item
      }

      // Add page break after each store (except the last one)
      if (storeIndex < storeEntries.length - 1) {
        doc.addPage();
        y = 20;
      }
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