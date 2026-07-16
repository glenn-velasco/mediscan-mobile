import { useMutation } from '@tanstack/react-query';

import { updateEmail } from '@/api/endpoints/account';
import { useAuth } from '@/auth/useAuth';

export function useUpdateEmail() {
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: async (email: string) => {
      await updateEmail(email);
      await refreshUser();
    },
  });
}
