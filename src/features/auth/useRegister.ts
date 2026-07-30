import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { MedicalInformationPayload, RegisterPayload } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { emergencyContactsQueryKey } from '@/features/emergency-contacts';
import {
  allergiesQueryKey,
  conditionsQueryKey,
  medicalInformationAvatarQueryKey,
  medicalInformationQueryKey,
  medicationsQueryKey,
} from '@/lib/query-keys';

type RegisterArgs = {
  payload: Omit<RegisterPayload, 'device_name'>;
  medicalInfo?: MedicalInformationPayload;
};

export function useRegister() {
  const { register } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: RegisterArgs) => register(args.payload, args.medicalInfo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      queryClient.invalidateQueries({ queryKey: medicalInformationAvatarQueryKey });
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
      queryClient.invalidateQueries({ queryKey: conditionsQueryKey });
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
      queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey });
    },
  });
}
