import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as medicationsRepo from '@/db/repositories/medications.repo';
import { medicationsQueryKey } from '@/features/medications/useMedications';

export function useDeleteMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (localUuid: string) => medicationsRepo.deleteLocal(localUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
    },
  });
}
