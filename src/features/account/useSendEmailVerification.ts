import { useMutation } from '@tanstack/react-query';

import { sendEmailVerificationNotification } from '@/api/endpoints/account';

export function useSendEmailVerification() {
  return useMutation({
    mutationFn: async () => {
      await sendEmailVerificationNotification();
    },
  });
}
