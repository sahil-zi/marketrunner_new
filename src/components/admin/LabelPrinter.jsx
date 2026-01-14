import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Printer, 
  Search, 
  Loader2, 
  Package,
  Minus,
  Plus,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function LabelPrinter({ products, stores }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [isPrinting, setIsPrinting] = useState(false);

  // Group products by style
  const styleGroups = React.useMemo(() => {
    const groups = {};
    products.forEach(product => {
      const styleName = product.style_name || 'Unknown';
      if (!groups[styleName]) {
        groups[styleName] = {
          styleName,
          imageUrl: product.image_url,
          storeId: product.store_id,
          items: [],
        };
      }
      groups[styleName].items.push(product);
    });
    return Object.values(groups);
  }, [products]);

  // Filter by search
  const filteredStyles = styleGroups.filter(group =>
    group.styleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get store name
  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store?.name || 'Unknown';
  };

  // Update quantity
  const updateQuantity = (barcode, delta) => {
    setQuantities(prev => ({
      ...prev,
      [barcode]: Math.max(0, (prev[barcode] || 0) + delta),
    }));
  };

  // Generate labels
  const generateLabels = async () => {
    const selectedItems = selectedStyle?.items.filter(
      item => (quantities[item.barcode] || 0) > 0
    ) || [];

    if (selectedItems.length === 0) {
      toast.error('Please select quantities to print');
      return;
    }

    setIsPrinting(true);
    try {
      let labelContent = '';
      
      selectedItems.forEach(item => {
        const qty = quantities[item.barcode] || 0;
        for (let i = 0; i < qty; i++) {
          labelContent += `
╔═══════════════════════════════╗
║  BARCODE: ${item.barcode.padEnd(20)}║
╠═══════════════════════════════╣
║  Style: ${(item.style_name || '').substring(0, 22).padEnd(22)}║
║  Size: ${(item.size || 'N/A').padEnd(23)}║
║  Color: ${(item.color || 'N/A').padEnd(22)}║
║  Store: ${getStoreName(item.store_id).substring(0, 22).padEnd(22)}║
╚═══════════════════════════════╝

`;
        }
      });

      const blob = new Blob([labelContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Labels_${selectedStyle?.styleName.replace(/\s+/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Labels generated');
      setSelectedStyle(null);
      setQuantities({});
    } catch (error) {
      toast.error('Failed to generate labels');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredStyles.map(group => (
          <Card 
            key={group.styleName}
            className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            onClick={() => {
              setSelectedStyle(group);
              setQuantities({});
            }}
          >
            <div className="aspect-square bg-gray-100 relative">
              {group.imageUrl ? (
                <img 
                  src={group.imageUrl}
                  alt={group.styleName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 truncate">{group.styleName}</h3>
              <div className="flex items-center justify-between mt-2">
                <Badge variant="secondary">{group.items.length} sizes</Badge>
                <span className="text-sm text-gray-500">{getStoreName(group.storeId)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStyles.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
        </div>
      )}

      {/* Print Dialog */}
      <Dialog open={!!selectedStyle} onOpenChange={() => setSelectedStyle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print Labels</DialogTitle>
          </DialogHeader>
          
          {selectedStyle && (
            <div className="space-y-4">
              {/* Product Info */}
              <div className="flex gap-4">
                {selectedStyle.imageUrl ? (
                  <img 
                    src={selectedStyle.imageUrl}
                    alt={selectedStyle.styleName}
                    className="w-24 h-24 object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedStyle.styleName}</h3>
                  <p className="text-sm text-gray-500">{getStoreName(selectedStyle.storeId)}</p>
                </div>
              </div>

              {/* Size Selection */}
              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-3">
                  {selectedStyle.items.map(item => (
                    <div 
                      key={item.barcode}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                    >
                      <div>
                        <p className="font-medium">Size {item.size || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{item.barcode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-10 h-10"
                          onClick={() => updateQuantity(item.barcode, -1)}
                          disabled={(quantities[item.barcode] || 0) === 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-10 text-center text-xl font-bold">
                          {quantities[item.barcode] || 0}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-10 h-10"
                          onClick={() => updateQuantity(item.barcode, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center p-3 bg-teal-50 rounded-xl">
                <span className="font-medium text-teal-800">Total Labels:</span>
                <span className="text-xl font-bold text-teal-600">
                  {Object.values(quantities).reduce((sum, qty) => sum + qty, 0)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedStyle(null)}>
              Cancel
            </Button>
            <Button 
              onClick={generateLabels}
              disabled={isPrinting || Object.values(quantities).every(q => q === 0)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              Print Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}