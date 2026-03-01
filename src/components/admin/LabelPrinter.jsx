import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

// Generate ZPL for QR code layout (4x3cm label, 203dpi)
function generateQRLayout(barcode, style, size, platform) {
  const platformField = platform ? `^FO365,8^A0N,24,24^FD${platform}^FS` : '';
  return `^XA^PW400^LL240^CI28
${platformField}
^FO10,40^BQN,2,7^FDQA,${barcode}^FS
^FO10,250^A0N,22,22^FB140,1,0,C,0^FD${barcode}^FS
^FO240,75^A0N,35,35^FB150,1,0,L^FDStyle:^FS
^FO240,105^A0N,35,35^FB150,2,0,L^FD${style}^FS
^FO240,165^A0N,35,35^FB150,2,0,L^FDSize: ${size}^FS
^XZ`;
}

// Generate ZPL for Barcode (Code 128) layout (4x3cm label, 203dpi)
function generateBarcodeLayout(barcode, style, size, platform) {
  const platformField = platform ? `^FO365,5^A0N,24,24^FD${platform}^FS` : '';
  return `^XA^PW400^LL240^CI28
${platformField}
^FO60,30^BY2,2.0,60^BCN,80,N,N,N^FD${barcode}^FS
^FO125,130^A0N,22,22^FB150,1,0,C,0^FD${barcode}^FS
^FO100,170^A0N,25,25^FB150,1,0,L^FDStyle:^FS
^FO100,200^A0N,25,25^FB150,2,0,L^FD${style}^FS
^FO100,230^A0N,25,25^FB150,2,0,L^FDSize: ${size}^FS
^XZ`;
}

// Generate a store summary label (same 4x3cm format)
function generateStoreSummaryZPL(storeName, unitCount, styleCount) {
  return `^XA^PW400^LL240^CI28
^FO20,40^A0N,50,50^FB360,2,0,C,0^FD${storeName}^FS
^FO20,140^A0N,30,30^FB360,1,0,C,0^FD${unitCount} unit${unitCount !== 1 ? 's' : ''} | ${styleCount} style${styleCount !== 1 ? 's' : ''}^FS
^XZ`;
}

// Generate ZPL for Zebra printer with QR or Barcode layout
// Groups by store and inserts store separator labels
export function generateZPL(items, mode = 'QR') {
  let zpl = '';
  const layoutFn = mode === 'BARCODE' ? generateBarcodeLayout : generateQRLayout;

  // Group items by store_name
  const storeGroups = {};
  items.forEach(item => {
    const storeName = item.store_name || '';
    if (!storeGroups[storeName]) storeGroups[storeName] = [];
    storeGroups[storeName].push(item);
  });

  const storeNames = Object.keys(storeGroups);
  // Check if any item actually has a store name
  const hasStoreNames = storeNames.some(name => name !== '');

  // Sort store names alphabetically, putting empty-string group last
  storeNames.sort((a, b) => {
    if (a === '') return 1;
    if (b === '') return -1;
    return a.localeCompare(b);
  });

  storeNames.forEach(storeName => {
    const groupItems = storeGroups[storeName];

    // Print barcode labels first
    groupItems.forEach(item => {
      const barcode = item.barcode || '';
      const style = (item.style_name || '').substring(0, 30);
      const size = item.size || '';
      const qty = item.target_qty || item.quantity || 1;

      const platform = item.platform || '';
      for (let i = 0; i < qty; i++) {
        zpl += layoutFn(barcode, style, size, platform) + '\n';
      }
    });

    // Then print store summary label at the end
    if (hasStoreNames && storeName !== '') {
      const totalQty = groupItems.reduce((sum, item) => sum + (item.target_qty || item.quantity || 1), 0);
      const styleCount = new Set(groupItems.map(item => item.style_name || item.barcode)).size;
      zpl += generateStoreSummaryZPL(storeName, totalQty, styleCount) + '\n';
    }
  });

  return zpl;
}

// Send to Zebra printer via Web USB or Zebra Browser Print
export async function printToZebra(zplData) {
  try {
    if ('usb' in navigator) {
      try {
        const device = await navigator.usb.requestDevice({
          filters: [{ vendorId: 0x0a5f }] // Zebra vendor ID
        });

        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);

        const encoder = new TextEncoder();
        const data = encoder.encode(zplData);

        await device.transferOut(1, data);
        await device.close();

        toast.success('Labels sent to printer');
        return;
      } catch (usbError) {
        console.log('USB printing not available, downloading ZPL file');
      }
    }

    // Fallback: Download ZPL file
    downloadZPLFile(zplData);
  } catch (error) {
    toast.error('Failed to print labels');
    console.error(error);
  }
}

// Download ZPL as file
export function downloadZPLFile(zplData, filename) {
  const blob = new Blob([zplData], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `labels_${Date.now()}.zpl`;
  a.click();
  URL.revokeObjectURL(url);
  toast.info('ZPL file downloaded. Send to Zebra printer or use Zebra Setup Utilities.');
}

export default function LabelPrinter({ items, mode = 'QR', buttonText, variant = 'default', className = '' }) {
  const handlePrint = async () => {
    if (!items || items.length === 0) {
      toast.error('No items to print');
      return;
    }
    const zpl = generateZPL(items, mode);
    await printToZebra(zpl);
  };

  const handleExport = () => {
    if (!items || items.length === 0) {
      toast.error('No items to export');
      return;
    }
    const zpl = generateZPL(items, mode);
    downloadZPLFile(zpl);
  };

  const label = buttonText || `Print ${items?.length || 0} Label${items?.length !== 1 ? 's' : ''}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button onClick={handlePrint} variant={variant}>
        <Printer className="w-4 h-4 mr-2" />
        {label}
      </Button>
      <Button onClick={handleExport} variant="outline">
        <Download className="w-4 h-4 mr-2" />
        Export ZPL
      </Button>
    </div>
  );
}
