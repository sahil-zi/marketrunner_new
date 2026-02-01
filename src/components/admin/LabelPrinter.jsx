import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';

// Generate ZPL for Zebra printer with QR code
function generateZPL(items) {
  // 3x4cm = ~113x151 dots at 300dpi
  // Using 8 dots/mm = 24x32 dots for 3x4cm
  
  let zpl = '';
  
  items.forEach(item => {
    const barcode = item.barcode || '';
    const style = item.style_name || '';
    const size = item.size || '';
    const qty = item.target_qty || item.quantity || 1;
    
    // Generate one label per quantity
    for (let i = 0; i < qty; i++) {
      zpl += `^XA\n`;
      zpl += `^FO20,10^BQN,2,4^FDQA,${barcode}^FS\n`; // QR code at top
      zpl += `^FO10,100^A0N,20,20^FD${style}^FS\n`; // Style name
      zpl += `^FO10,125^A0N,18,18^FDSize: ${size}^FS\n`; // Size
      zpl += `^FO10,145^A0N,16,16^FD${barcode}^FS\n`; // Barcode text
      zpl += `^XZ\n`;
    }
  });
  
  return zpl;
}

// Send to Zebra printer
async function printToZebra(zplData) {
  try {
    // Create a blob with ZPL data
    const blob = new Blob([zplData], { type: 'text/plain' });
    
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
        console.error('USB printing failed:', usbError);
      }
    }
    
    // Fallback: Download ZPL file
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labels_${Date.now()}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.info('ZPL file downloaded. Send to printer or use Zebra Setup Utilities.');
  } catch (error) {
    toast.error('Failed to print labels');
    console.error(error);
  }
}

export default function LabelPrinter({ items, buttonText = 'Print Labels', variant = 'default' }) {
  const handlePrint = async () => {
    if (!items || items.length === 0) {
      toast.error('No items to print');
      return;
    }
    
    const zpl = generateZPL(items);
    await printToZebra(zpl);
  };
  
  return (
    <Button onClick={handlePrint} variant={variant}>
      <Printer className="w-4 h-4 mr-2" />
      {buttonText}
    </Button>
  );
}

export { generateZPL, printToZebra };