import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, createOne, updateOne, deleteOne, bulkInsert } from '@/api/supabase/helpers';

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: () => listAll('stores'),
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => createOne('stores', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateOne('stores', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteOne('stores', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useBulkCreateStores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stores) => bulkInsert('stores', stores),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}
