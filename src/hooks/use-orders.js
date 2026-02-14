import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useOrders(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['orders', sortOrder],
    queryFn: () => base44.entities.Order.list(sortOrder),
  });
}

export function useOrderItems(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['orderItems', sortOrder],
    queryFn: () => base44.entities.OrderItem.list(sortOrder),
  });
}

export function usePendingOrderItems() {
  return useQuery({
    queryKey: ['orderItems', 'pending'],
    queryFn: () => base44.entities.OrderItem.filter({ status: 'pending' }),
  });
}

export function useOrderItemsByRun(runId) {
  return useQuery({
    queryKey: ['orderItems', 'run', runId],
    queryFn: () => base44.entities.OrderItem.filter({ barcode: undefined, run_id: runId }),
    enabled: !!runId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrderItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orderItems'] }),
  });
}

export function useBulkCreateOrderItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) => base44.entities.OrderItem.bulkCreate(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orderItems'] }),
  });
}
