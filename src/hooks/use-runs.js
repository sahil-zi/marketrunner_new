import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useRuns(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['runs', sortOrder],
    queryFn: () => base44.entities.Run.list(sortOrder),
  });
}

export function useRunById(id) {
  return useQuery({
    queryKey: ['runs', id],
    queryFn: async () => {
      const runs = await base44.entities.Run.list();
      return runs.find(r => r.id === id) || null;
    },
    enabled: !!id,
  });
}

export function useRunItems(runId) {
  return useQuery({
    queryKey: ['runItems', runId],
    queryFn: () => base44.entities.RunItem.filter({ run_id: runId }),
    enabled: !!runId,
  });
}

export function useAllRunItems() {
  return useQuery({
    queryKey: ['runItems', 'all'],
    queryFn: () => base44.entities.RunItem.list(),
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Run.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  });
}

export function useUpdateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Run.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useUpdateRunItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.RunItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runItems'] }),
  });
}

export function useBulkCreateRunItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) => base44.entities.RunItem.bulkCreate(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runItems'] }),
  });
}

export function useCancelRuns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runIds) => base44.functions.invoke('cancelRuns', { runIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['runItems'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
    },
  });
}
