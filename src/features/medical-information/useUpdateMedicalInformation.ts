import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { medicalInformationQueryKey } from '@/features/medical-information/useMedicalInformation';
import type { MedicalInformationPayload } from '@/api/types';

export function useUpdateMedicalInformation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MedicalInformationPayload) => medicalInformationRepo.saveLocalEdit(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
    },
  });
}
