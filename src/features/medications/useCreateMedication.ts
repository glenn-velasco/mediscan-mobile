import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as medicationsRepo from '@/db/repositories/medications.repo';
import { medicationsQueryKey } from '@/features/medications/useMedications';
import type { MedicationPayload } from '@/api/types';

export function useCreateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MedicationPayload) => medicationsRepo.createLocal(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
    },
  });
}
