import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, filterBy, updateOne, bulkInsert } from '@/api/supabase/helpers';

export function useReturns(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['returns', sortOrder],
    queryFn: () => listAll('returns', sortOrder),
  });
}

export function usePendingReturns() {
  return useQuery({
    queryKey: ['returns', 'pending'],
    queryFn: () => filterBy('returns', { status: 'pending' }),
  });
}

export function useUpdateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateOne('returns', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['returns'] }),
  });
}

export function useBulkCreateReturns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (returns) => bulkInsert('returns', returns),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['returns'] }),
  });
}
