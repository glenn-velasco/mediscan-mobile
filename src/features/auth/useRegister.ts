import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import type { MedicalInformationPayload, RegisterPayload } from '@/api/types';

type RegisterArgs = {
  payload: Omit<RegisterPayload, 'device_name'>;
  medicalInfo?: MedicalInformationPayload;
};

export function useRegister() {
  const { register } = useAuth();

  return useMutation({
    mutationFn: (args: RegisterArgs) => register(args.payload, args.medicalInfo),
  });
}
