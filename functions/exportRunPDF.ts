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
    
    // Helper function to load image as base64
    async function loadImageAsBase64(url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return `data:${blob.type};base64,${base64}`;
      } catch (e) {
        return null;
      }
    }

    let y = 55;

    // Iterate through each store
    const storeEntries = Object.entries(storeGroups);
    for (let storeIndex = 0; storeIndex < storeEntries.length; storeIndex++) {
      const [storeId, group] = storeEntries[storeIndex];
      
      // Start new page for each store (except first)
      if (storeIndex > 0) {
        doc.addPage();
        y = 20;
      }
      
      // Store header
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(group.storeName, 20, y);
      doc.setFont(undefined, 'normal');
      y += 12;

      // Items with images
      for (const item of group.items) {
        // Check if we need a new page
        if (y > 230) {
          doc.addPage();
          y = 20;
        }

        // Add product image if available
        if (item.image_url) {
          try {
            const imageData = await loadImageAsBase64(item.image_url);
            if (imageData) {
              doc.addImage(imageData, 'JPEG', 20, y, 35, 35);
            }
          } catch (e) {
            // Skip image if loading fails
          }
        }

        // Item details next to image
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text((item.style_name || '').substring(0, 35), 60, y + 6);
        doc.setFont(undefined, 'normal');
        
        doc.setFontSize(9);
        doc.text(`Barcode: ${item.barcode || ''}`, 60, y + 14);
        doc.text(`Size: ${item.size || 'N/A'}`, 60, y + 20);
        doc.text(`Color: ${item.color || 'N/A'}`, 60, y + 26);
        doc.text(`Quantity: ${item.target_qty || 0}`, 60, y + 32);
        doc.text(`Type: ${(item.type || 'pickup').toUpperCase()}`, 130, y + 32);

        y += 42; // Space for next item
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