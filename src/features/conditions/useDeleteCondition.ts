import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as conditionsRepo from '@/db/repositories/conditions.repo';
import { conditionsQueryKey } from '@/features/conditions/useConditions';
import { pushPatientChanges } from '@/services/patient-sync.service';

export function useDeleteCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (localUuid: string) => conditionsRepo.deleteLocal(localUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conditionsQueryKey });
      void pushPatientChanges();
    },
  });
}
