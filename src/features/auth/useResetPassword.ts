import { useMutation } from '@tanstack/react-query';

import { resetPassword } from '@/api/endpoints/account';

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { token: string; email: string; password: string; password_confirmation: string }) =>
      resetPassword(payload),
  });
}
