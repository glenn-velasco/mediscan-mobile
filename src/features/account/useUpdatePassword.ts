import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updatePassword } from '@/api/endpoints/account';

export function useUpdatePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { current_password: string; password: string; password_confirmation: string }) =>
      updatePassword(payload),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
