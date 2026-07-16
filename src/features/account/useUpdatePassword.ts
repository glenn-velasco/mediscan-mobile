import { useMutation } from '@tanstack/react-query';

import { updatePassword } from '@/api/endpoints/account';

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (payload: { current_password: string; password: string; password_confirmation: string }) =>
      updatePassword(payload),
  });
}
