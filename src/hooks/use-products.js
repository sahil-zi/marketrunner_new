import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAll, createOne, updateOne, deleteOne, bulkInsert, bulkUpdate, bulkDelete } from '@/api/supabase/helpers';

export function useProducts(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['products', sortOrder],
    queryFn: () => listAll('product_catalog', sortOrder),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => createOne('product_catalog', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateOne('product_catalog', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteOne('product_catalog', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useBulkCreateProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (products) => bulkInsert('product_catalog', products),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useBulkUpdateProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (products) => bulkUpdate('product_catalog', products),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useBulkDeleteProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productIds) => bulkDelete('product_catalog', productIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}
