import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateEmail } from '@/api/endpoints/account';
import { useAuth } from '@/auth/useAuth';

export function useUpdateEmail() {
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      await updateEmail(email);
      await refreshUser();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
