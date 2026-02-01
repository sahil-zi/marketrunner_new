import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';

// Generate ZPL for Zebra printer with QR code
// Label size: 3x4cm at 203dpi (8 dots/mm) = 94x118 dots
export function generateZPL(items) {
  let zpl = '';
  
  items.forEach(item => {
    const barcode = item.barcode || '';
    const style = (item.style_name || '').substring(0, 25); // Truncate to fit
    const size = item.size || '';
    const qty = item.target_qty || item.quantity || 1;
    
    // Generate one label per quantity
    for (let i = 0; i < qty; i++) {
      zpl += '^XA\n';
      zpl += '^PW240\n'; // Print width for 3cm
      zpl += '^LL320\n'; // Label length for 4cm
      
      // QR Code centered at top (model 2, magnification 3)
      zpl += '^FO30,10^BQN,2,3^FDQA,${barcode}^FS\n';
      
      // Style name (smaller font, truncated)
      zpl += '^FO10,90^A0N,20,20^FD${style}^FS\n';
      
      // Size
      zpl += '^FO10,115^A0N,18,18^FDSize: ${size}^FS\n';
      
      // Barcode text
      zpl += '^FO10,140^A0N,16,16^FD${barcode}^FS\n';
      
      zpl += '^XZ\n';
    }
  });
  
  return zpl;
}

// Send to Zebra printer
export async function printToZebra(zplData) {
  try {
    // Try to use Web USB API for direct printer access
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
    
    // Fallback: Download ZPL file for manual printing
    const blob = new Blob([zplData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labels_${Date.now()}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.info('ZPL file downloaded. Send to Zebra printer or use Zebra Setup Utilities.');
  } catch (error) {
    toast.error('Failed to print labels');
    console.error(error);
  }
}

export default function LabelPrinter({ items, buttonText = 'Print Labels', variant = 'default', className = '' }) {
  const handlePrint = async () => {
    if (!items || items.length === 0) {
      toast.error('No items to print');
      return;
    }
    
    const zpl = generateZPL(items);
    await printToZebra(zpl);
  };
  
  return (
    <Button onClick={handlePrint} variant={variant} className={className}>
      <Printer className="w-4 h-4 mr-2" />
      {buttonText}
    </Button>
  );
}