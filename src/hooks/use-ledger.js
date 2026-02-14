import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useLedger(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['ledger', sortOrder],
    queryFn: () => base44.entities.Ledger.list(sortOrder),
  });
}

export function useCreateLedgerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Ledger.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger'] }),
  });
}
