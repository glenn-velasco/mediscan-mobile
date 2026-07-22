import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { medicalInformationQueryKey } from '@/features/medical-information/useMedicalInformation';
import type { MedicalInformationPayload } from '@/api/types';

export function useUpdateMedicalInformation() {
  const queryClient = useQueryClient();

  return useMutation({
    // 'pending', not the default 'synced' - this is a genuine local edit that needs pushing to the
    // server on the next sync cycle, unlike the other saveLocalEdit call sites (registration,
    // reconciling from `/me`) which write data that's already known server-side.
    mutationFn: (payload: MedicalInformationPayload) => medicalInformationRepo.saveLocalEdit(payload, 'pending'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
    },
  });
}
