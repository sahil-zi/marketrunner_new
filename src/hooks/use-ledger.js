import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, createOne, bulkDelete } from '@/api/supabase/helpers';

export function useLedger(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['ledger', sortOrder],
    queryFn: () => listAll('ledger', sortOrder),
  });
}

export function useCreateLedgerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => createOne('ledger', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger'] }),
  });
}

// Removes all but the most recent ledger entry per run+store combination.
export function useCleanupDuplicateLedger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const entries = await listAll('ledger');
      const groups = {};
      for (const entry of entries) {
        if (!entry.run_number || !entry.store_id) continue;
        const key = `${entry.run_number}-${entry.store_id}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(entry);
      }
      const toDelete = [];
      for (const group of Object.values(groups)) {
        if (group.length <= 1) continue;
        // Sort by date desc, keep the most recent
        const sorted = [...group].sort((a, b) => new Date(b.date) - new Date(a.date));
        toDelete.push(...sorted.slice(1).map(e => e.id));
      }
      if (toDelete.length > 0) await bulkDelete('ledger', toDelete);
      return toDelete.length;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger'] }),
  });
}
