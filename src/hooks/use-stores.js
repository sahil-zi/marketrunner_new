import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: () => base44.entities.Store.list(),
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Store.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Store.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.entities.Store.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useBulkCreateStores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stores) => base44.entities.Store.bulkCreate(stores),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
}
