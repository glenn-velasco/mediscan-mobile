import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { medicalInformationQueryKey } from '@/features/medical-information/useMedicalInformation';
import { pushPatientChanges } from '@/services/patient-sync.service';
import type { MedicalInformationPayload } from '@/api/types';

export function useUpdateMedicalInformation() {
  const queryClient = useQueryClient();

  return useMutation({
    // 'pending', not the default 'synced' - this is a genuine local edit that needs pushing to the
    // server immediately (and on the next sync cycle if offline), unlike the other saveLocalEdit
    // call sites (registration, reconciling from `/me`) which write data already known server-side.
    mutationFn: async (payload: MedicalInformationPayload) => {
      await medicalInformationRepo.saveLocalEdit(payload, 'pending');
      await pushPatientChanges();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      queryClient.invalidateQueries({ queryKey: ['emergency-field-history'] });
    },
  });
}
