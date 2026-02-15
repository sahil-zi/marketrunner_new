import { useAuth } from '@/lib/AuthContext';

export function useCurrentUser() {
  const { user, isLoadingAuth } = useAuth();
  return {
    data: user,
    isLoading: isLoadingAuth,
  };
}
