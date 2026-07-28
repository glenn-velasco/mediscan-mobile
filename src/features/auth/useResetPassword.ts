import { useMutation, useQueryClient } from '@tanstack/react-query';

import { resetPassword } from '@/api/endpoints/account';

export function useResetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { token: string; email: string; password: string; password_confirmation: string }) =>
      resetPassword(payload),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
