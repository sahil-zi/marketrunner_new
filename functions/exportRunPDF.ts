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

    const run = await base44.entities.Run.filter({ id: runId });
    if (!run || run.length === 0) {
      return Response.json({ error: 'Run not found' }, { status: 404 });
    }
    const runData = run[0];

    const runItems = await base44.entities.RunItem.filter({ run_id: runId });
    
    const allStores = await base44.entities.Store.list();
    const storeMap = new Map(allStores.map(s => [s.id, s.name]));

    async function loadImageAsBase64(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        let binaryString = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binaryString += String.fromCharCode(bytes[i]);
        }
        
        const base64 = btoa(binaryString);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
      } catch (e) {
        return null;
      }
    }

    const storeGroups = {};
    for (const item of runItems) {
      const storeId = item.store_id || 'unknown';
      const storeName = storeMap.get(storeId) || item.store_name || `Store ${storeId}`;

      if (!storeGroups[storeId]) {
        storeGroups[storeId] = {
          storeName: storeName,
          styles: {},
        };
      }
      const styleKey = item.style_name || item.barcode; 
      if (!storeGroups[storeId].styles[styleKey]) {
        storeGroups[storeId].styles[styleKey] = {
          image_url: item.image_url, 
          sizes: [],
        };
      }
      storeGroups[storeId].styles[styleKey].sizes.push({
        size: item.size || 'N/A',
        quantity: item.target_qty || 0,
      });
    }

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Run #${runData.run_number || 'N/A'} - Store-wise Breakdown`, 20, 20);
    
    doc.setFontSize(10);
    doc.text(`Date: ${runData.date || 'N/A'}`, 20, 30);
    doc.text(`Status: ${runData.status || 'N/A'}`, 20, 36);
    doc.text(`Runner: ${runData.runner_name || 'Not Assigned'}`, 20, 42);

    let y = 55;

    const storeEntries = Object.entries(storeGroups);
    for (let storeIndex = 0; storeIndex < storeEntries.length; storeIndex++) {
      const [storeId, group] = storeEntries[storeIndex];
      
      if (storeIndex > 0) {
        doc.addPage();
        y = 20; 
      }
      
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(group.storeName, 20, y);
      doc.setFont(undefined, 'normal');
      y += 12;

      const styleEntries = Object.entries(group.styles);
      for (const [styleName, styleData] of styleEntries) {
        const tableHeight = (styleData.sizes.length * 6) + 12; 
        const estimatedBlockHeight = 60 + tableHeight; 
        
        if (y + estimatedBlockHeight > 270) { 
          doc.addPage();
          y = 20;
        }

        if (styleData.image_url) {
          const imageData = await loadImageAsBase64(styleData.image_url);
          if (imageData) {
            doc.addImage(imageData, 'JPEG', 20, y, 50, 50); 
          }
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`Style: ${styleName}`, 80, y + 10);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Shop No: ${group.storeName}`, 80, y + 20);
        
        let currentY = y + 35; 
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Size', 80, currentY);
        doc.text('Quantity', 120, currentY);
        doc.setFont(undefined, 'normal');
        currentY += 6; 

        for (const sizeEntry of styleData.sizes) {
          doc.text(sizeEntry.size, 80, currentY);
          doc.text(String(sizeEntry.quantity), 120, currentY); 
          currentY += 6; 
        }
        y = currentY + 10; 
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