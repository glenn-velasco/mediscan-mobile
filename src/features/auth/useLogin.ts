import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import type { LoginPayload } from '@/api/types';

export function useLogin() {
  const { login } = useAuth();

  return useMutation({
    mutationFn: (payload: Omit<LoginPayload, 'device_name'>) => login(payload),
  });
}
