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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['runItems'] });
      const previousData = queryClient.getQueriesData({ queryKey: ['runItems'] });
      queryClient.setQueriesData({ queryKey: ['runItems'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map(item => item.id === id ? { ...item, ...data } : item);
      });
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
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
      const results = [];

      for (const runId of runIds) {
        const { data: runItems, error: riError } = await supabase
          .from('run_items')
          .select('*')
          .eq('run_id', runId);
        if (riError) throw riError;

        const pickedItems = (runItems || []).filter((i) => (i.picked_qty || 0) > 0);
        const unpickedItems = (runItems || []).filter((i) => (i.picked_qty || 0) === 0);

        if (pickedItems.length > 0) {
          // Has picks: mark run completed, revert unpicked items
          const { error: runErr } = await supabase
            .from('runs')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', runId);
          if (runErr) throw runErr;

          for (const item of unpickedItems) {
            await supabase.from('run_items').update({ status: 'cancelled' }).eq('id', item.id);
            if (item.type === 'pickup') {
              await supabase
                .from('order_items')
                .update({ status: 'pending', run_id: null })
                .eq('run_id', runId)
                .eq('barcode', item.barcode);
            } else if (item.type === 'return' && item.original_return_id) {
              await supabase
                .from('returns')
                .update({ status: 'pending', run_id: null, run_number: null })
                .eq('id', item.original_return_id);
            }
          }
          results.push({ runId, status: 'completed', pickedCount: pickedItems.length });
        } else {
          // No picks: cancel entire run
          const { error: runErr } = await supabase
            .from('runs')
            .update({ status: 'cancelled' })
            .eq('id', runId);
          if (runErr) throw runErr;

          for (const item of runItems || []) {
            await supabase.from('run_items').update({ status: 'cancelled' }).eq('id', item.id);
            if (item.type === 'pickup') {
              await supabase
                .from('order_items')
                .update({ status: 'pending', run_id: null })
                .eq('run_id', runId)
                .eq('barcode', item.barcode);
            } else if (item.type === 'return' && item.original_return_id) {
              await supabase
                .from('returns')
                .update({ status: 'pending', run_id: null, run_number: null })
                .eq('id', item.original_return_id);
            }
          }
          results.push({ runId, status: 'cancelled', revertedCount: (runItems || []).length });
        }
      }

      return { results };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['runItems'] });
      queryClient.invalidateQueries({ queryKey: ['orderItems'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
    },
  });
}
