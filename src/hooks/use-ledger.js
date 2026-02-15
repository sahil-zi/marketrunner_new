import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, createOne } from '@/api/supabase/helpers';

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
