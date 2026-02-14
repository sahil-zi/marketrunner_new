import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useRunConfirmations(runId) {
  return useQuery({
    queryKey: ['runConfirmations', runId],
    queryFn: () => base44.entities.RunConfirmation.filter({ run_id: runId }),
    enabled: !!runId,
  });
}

export function useAllRunConfirmations(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['runConfirmations', 'all', sortOrder],
    queryFn: () => base44.entities.RunConfirmation.list(sortOrder),
  });
}

export function useCreateRunConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.RunConfirmation.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runConfirmations'] }),
  });
}
