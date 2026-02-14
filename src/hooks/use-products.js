import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useProducts(sortOrder = '-created_date') {
  return useQuery({
    queryKey: ['products', sortOrder],
    queryFn: () => base44.entities.ProductCatalog.list(sortOrder),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.ProductCatalog.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductCatalog.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.entities.ProductCatalog.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useBulkCreateProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (products) => base44.entities.ProductCatalog.bulkCreate(products),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useBulkUpdateProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (products) => base44.functions.invoke('bulkUpdateProducts', { products }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useBulkDeleteProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productIds) => base44.functions.invoke('bulkDeleteProducts', { productIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}
