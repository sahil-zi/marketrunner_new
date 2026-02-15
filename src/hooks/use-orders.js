import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, filterBy, createOne, updateOne, bulkInsert } from '@/api/supabase/helpers';

export function useOrders(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['orders', sortOrder],
    queryFn: () => listAll('orders', sortOrder),
  });
}

export function useOrderItems(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['orderItems', sortOrder],
    queryFn: () => listAll('order_items', sortOrder),
  });
}

export function usePendingOrderItems() {
  return useQuery({
    queryKey: ['orderItems', 'pending'],
    queryFn: () => filterBy('order_items', { status: 'pending' }),
  });
}

export function useOrderItemsByRun(runId) {
  return useQuery({
    queryKey: ['orderItems', 'run', runId],
    queryFn: () => filterBy('order_items', { run_id: runId }),
    enabled: !!runId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => createOne('orders', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateOne('order_items', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useBulkCreateOrderItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) => bulkInsert('order_items', items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orderItems'] }),
  });
}
