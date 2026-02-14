import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });
}
