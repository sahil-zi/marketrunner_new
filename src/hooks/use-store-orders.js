import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';

const VISIBLE_STATUSES = ['pending', 'assigned_to_run'];

export function useStoreOrderItems(storeId) {
  return useQuery({
    queryKey: ['store-order-items', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      // Get all barcodes belonging to this store
      const { data: products, error: prodError } = await supabase
        .from('product_catalog')
        .select('barcode, style_name, size, color, image_url')
        .eq('store_id', storeId);

      if (prodError) throw prodError;
      if (!products || products.length === 0) return [];

      const barcodes = products.map((p) => p.barcode);
      const productMap = Object.fromEntries(products.map((p) => [p.barcode, p]));

      // Get order_items for those barcodes with visible statuses
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id, order_id, barcode, quantity, status, notes, created_date')
        .in('barcode', barcodes)
        .in('status', VISIBLE_STATUSES)
        .order('created_date', { ascending: false });

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      // Get related orders
      const orderIds = [...new Set(items.map((i) => i.order_id))];
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, platform_name, platform_order_id, order_timestamp')
        .in('id', orderIds);

      if (ordersError) throw ordersError;
      const orderMap = Object.fromEntries((orders || []).map((o) => [o.id, o]));

      // Combine everything
      return items.map((item) => ({
        ...item,
        product: productMap[item.barcode] || null,
        order: orderMap[item.order_id] || null,
      }));
    },
    enabled: !!storeId,
    refetchInterval: 30000, // fallback polling every 30s
  });
}

export function useStoreOrdersRealtime(storeId) {
  const queryClient = useQueryClient();
  const prevCountRef = useRef(null);

  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`store-orders-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          // Track count before invalidation for new-item toast
          const currentData = queryClient.getQueryData(['store-order-items', storeId]);
          if (currentData) {
            prevCountRef.current = currentData.length;
          }
          queryClient.invalidateQueries({ queryKey: ['store-order-items', storeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  // Show toast when items increase (called via query observer)
  useEffect(() => {
    if (!storeId) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.type === 'updated' &&
        event.query?.queryKey?.[0] === 'store-order-items' &&
        event.query?.queryKey?.[1] === storeId
      ) {
        const newData = event.query.state.data;
        if (
          prevCountRef.current !== null &&
          newData &&
          newData.length > prevCountRef.current
        ) {
          toast.success('New order received!');
        }
        if (newData) {
          prevCountRef.current = newData.length;
        }
      }
    });

    return unsubscribe;
  }, [storeId, queryClient]);
}
