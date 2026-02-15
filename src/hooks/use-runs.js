import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, getById, filterBy, createOne, updateOne, bulkInsert } from '@/api/supabase/helpers';
import { supabase } from '@/api/supabaseClient';

export function useRuns(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['runs', sortOrder],
    queryFn: () => listAll('runs', sortOrder),
  });
}

export function useRunById(id) {
  return useQuery({
    queryKey: ['runs', id],
    queryFn: () => getById('runs', id),
    enabled: !!id,
  });
}

export function useRunItems(runId) {
  return useQuery({
    queryKey: ['runItems', runId],
    queryFn: () => filterBy('run_items', { run_id: runId }),
    enabled: !!runId,
  });
}

export function useAllRunItems() {
  return useQuery({
    queryKey: ['runItems', 'all'],
    queryFn: () => listAll('run_items'),
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => createOne('runs', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  });
}

export function useUpdateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateOne('runs', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useUpdateRunItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateOne('run_items', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runItems'] }),
  });
}

export function useBulkCreateRunItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) => bulkInsert('run_items', items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runItems'] }),
  });
}

export function useCancelRuns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runIds) => {
      const { data, error } = await supabase.functions.invoke('cancel-runs', {
        body: { runIds },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['runItems'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
    },
  });
}
