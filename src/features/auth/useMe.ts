import { useQuery } from '@tanstack/react-query';

import { me } from '@/api/endpoints/auth';
import { useAuth } from '@/auth/useAuth';

export function useMe() {
  const { status } = useAuth();

  return useQuery({
    queryKey: ['me'],
    queryFn: () => me(),
    enabled: status === 'authenticated',
  });
}
