import { useMutation } from '@tanstack/react-query';

import { resetPassword } from '@/api/endpoints/account';

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { password: string }) => resetPassword(payload),
  });
}
