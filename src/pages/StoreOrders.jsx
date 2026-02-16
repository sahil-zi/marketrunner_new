import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useStoreOrderItems, useStoreOrdersRealtime } from '@/hooks/use-store-orders';
import { Loader2, Package, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusStyles = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  assigned_to_run: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const statusLabels = {
  pending: 'Pending',
  assigned_to_run: 'Assigned to Run',
};

function groupByOrder(items) {
  const groups = {};
  for (const item of items) {
    const key = item.order?.platform_order_id || item.order_id;
    if (!groups[key]) {
      groups[key] = {
        order: item.order,
        items: [],
      };
    }
    groups[key].items.push(item);
  }
  return Object.values(groups);
}

export default function StoreOrders() {
  const { user } = useAuth();
  const storeId = user?.store_id;
  const { data: orderItems = [], isLoading } = useStoreOrderItems(storeId);

  // Subscribe to realtime updates
  useStoreOrdersRealtime(storeId);

  const orderGroups = groupByOrder(orderItems);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {orderItems.length} pending item{orderItems.length !== 1 ? 's' : ''}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : orderGroups.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No pending orders</h3>
            <p className="text-sm text-muted-foreground">
              New orders will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orderGroups.map((group) => {
            const order = group.order;
            return (
              <Card key={order?.platform_order_id || group.items[0]?.order_id} className="bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-foreground">
                      {order?.platform_name || 'Order'}{' '}
                      <span className="text-muted-foreground font-normal">
                        #{order?.platform_order_id || '—'}
                      </span>
                    </CardTitle>
                    {order?.order_timestamp && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.order_timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y divide-border">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        {item.product?.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.style_name}
                            className="w-12 h-12 rounded-lg object-cover bg-muted"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.product?.style_name || item.barcode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.barcode}
                            {item.product?.size && ` · ${item.product.size}`}
                            {item.product?.color && ` · ${item.product.color}`}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">
                            Qty: {item.quantity}
                          </span>
                          <Badge
                            variant="outline"
                            className={statusStyles[item.status] || ''}
                          >
                            {statusLabels[item.status] || item.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
