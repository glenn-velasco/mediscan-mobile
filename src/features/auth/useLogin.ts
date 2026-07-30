import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { LoginPayload } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { emergencyContactsQueryKey } from '@/features/emergency-contacts';
import {
  allergiesQueryKey,
  attestationsQueryKey,
  conditionsQueryKey,
  diagnosesQueryKey,
  medicalInformationAvatarQueryKey,
  medicalInformationQueryKey,
  medicationsQueryKey,
} from '@/lib/query-keys';

export function useLogin() {
  const { login } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<LoginPayload, 'device_name'>) => login(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      queryClient.invalidateQueries({ queryKey: medicalInformationAvatarQueryKey });
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
      queryClient.invalidateQueries({ queryKey: conditionsQueryKey });
      queryClient.invalidateQueries({ queryKey: diagnosesQueryKey });
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
      queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey });
      queryClient.invalidateQueries({ queryKey: attestationsQueryKey });
    },
  });
}
