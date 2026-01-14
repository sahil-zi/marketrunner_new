import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  CheckCircle2, 
  Circle,
  Package,
  Store
} from 'lucide-react';

export default function OrderSelector({ 
  orderItems, 
  products, 
  stores,
  selectedItems, 
  onSelectionChange 
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Map product and store info
  const enrichedItems = useMemo(() => {
    const productMap = new Map(products.map(p => [p.barcode, p]));
    const storeMap = new Map(stores.map(s => [s.id, s]));

    return orderItems.map(item => {
      const product = productMap.get(item.barcode);
      return {
        ...item,
        product,
        store: product?.store_id ? storeMap.get(product.store_id) : null,
      };
    });
  }, [orderItems, products, stores]);

  // Group by style
  const groupedItems = useMemo(() => {
    const groups = {};
    
    enrichedItems.forEach(item => {
      const styleName = item.product?.style_name || 'Unknown';
      if (!groups[styleName]) {
        groups[styleName] = {
          styleName,
          imageUrl: item.product?.image_url,
          store: item.store,
          items: [],
        };
      }
      groups[styleName].items.push(item);
    });

    return Object.values(groups);
  }, [enrichedItems]);

  // Filter by search
  const filteredGroups = groupedItems.filter(group =>
    group.styleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.store?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleItem = (item) => {
    const isSelected = selectedItems.some(i => i.id === item.id);
    if (isSelected) {
      onSelectionChange(selectedItems.filter(i => i.id !== item.id));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  };

  const toggleGroup = (group) => {
    const groupItemIds = group.items.map(i => i.id);
    const allSelected = group.items.every(item => 
      selectedItems.some(si => si.id === item.id)
    );

    if (allSelected) {
      onSelectionChange(selectedItems.filter(si => 
        !groupItemIds.includes(si.id)
      ));
    } else {
      const newItems = group.items.filter(item =>
        !selectedItems.some(si => si.id === item.id)
      );
      onSelectionChange([...selectedItems, ...newItems]);
    }
  };

  const selectedCount = selectedItems.length;
  const totalCount = enrichedItems.length;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by style or store..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Summary */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Selected Items:</span>
          <span className="font-bold text-teal-700">{selectedCount} / {totalCount}</span>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredGroups.map(group => {
          const allSelected = group.items.every(item => 
            selectedItems.some(si => si.id === item.id)
          );

          return (
            <Card key={group.styleName} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Group Header */}
                <div 
                  className="flex items-center gap-4 cursor-pointer mb-3"
                  onClick={() => toggleGroup(group)}
                >
                  <div className="shrink-0">
                    {allSelected ? (
                      <CheckCircle2 className="w-6 h-6 text-teal-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  {group.imageUrl && (
                    <img 
                      src={group.imageUrl}
                      alt={group.styleName}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{group.styleName}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {group.store && (
                        <Badge variant="secondary" className="text-xs">
                          <Store className="w-3 h-3 mr-1" />
                          {group.store.name}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        <Package className="w-3 h-3 mr-1" />
                        {group.items.length} sizes
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Individual Items */}
                <div className="ml-10 space-y-2">
                  {group.items.map(item => {
                    const isSelected = selectedItems.some(si => si.id === item.id);
                    
                    return (
                      <div 
                        key={item.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleItem(item)}
                      >
                        <div className="flex items-center gap-3">
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-300" />
                          )}
                          <span className="text-sm text-gray-700">
                            Size: <strong>{item.product?.size || 'N/A'}</strong>
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          Qty: {item.quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No items found
        </div>
      )}
    </div>
  );
}