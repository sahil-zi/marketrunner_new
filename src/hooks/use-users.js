import { useQuery } from '@tanstack/react-query';
import { listAll } from '@/api/supabase/helpers';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => listAll('profiles'),
  });
}
