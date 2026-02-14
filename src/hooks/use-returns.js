import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useReturns(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['returns', sortOrder],
    queryFn: () => base44.entities.Return.list(sortOrder),
  });
}

export function usePendingReturns() {
  return useQuery({
    queryKey: ['returns', 'pending'],
    queryFn: () => base44.entities.Return.filter({ status: 'pending' }),
  });
}

export function useUpdateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Return.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['returns'] }),
  });
}

export function useBulkCreateReturns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (returns) => base44.entities.Return.bulkCreate(returns),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['returns'] }),
  });
}
