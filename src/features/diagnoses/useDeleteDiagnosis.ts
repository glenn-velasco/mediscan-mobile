import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import { diagnosesQueryKey } from '@/features/diagnoses/useDiagnoses';

export function useDeleteDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (localUuid: string) => diagnosesRepo.deleteLocal(localUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: diagnosesQueryKey });
    },
  });
}
