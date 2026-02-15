import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, filterBy, createOne } from '@/api/supabase/helpers';

export function useRunConfirmations(runId) {
  return useQuery({
    queryKey: ['runConfirmations', runId],
    queryFn: () => filterBy('run_confirmations', { run_id: runId }),
    enabled: !!runId,
  });
}

export function useAllRunConfirmations(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['runConfirmations', 'all', sortOrder],
    queryFn: () => listAll('run_confirmations', sortOrder),
  });
}

export function useCreateRunConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => createOne('run_confirmations', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runConfirmations'] }),
  });
}
