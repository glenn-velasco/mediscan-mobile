import { useMutation, useQueryClient } from '@tanstack/react-query';

import { forgotPassword } from '@/api/endpoints/account';

export function useForgotPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
