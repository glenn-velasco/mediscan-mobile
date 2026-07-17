import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as medicationsRepo from '@/db/repositories/medications.repo';
import { medicationsQueryKey } from '@/features/medications/useMedications';
import type { MedicationPayload } from '@/api/types';

export function useUpdateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localUuid, payload }: { localUuid: string; payload: Partial<MedicationPayload> }) =>
      medicationsRepo.updateLocal(localUuid, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
    },
  });
}
