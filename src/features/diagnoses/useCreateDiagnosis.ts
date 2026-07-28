import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DiagnosisPayload } from '@/api/types';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import { diagnosesQueryKey } from '@/features/diagnoses/useDiagnoses';

export function useCreateDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DiagnosisPayload) => diagnosesRepo.createLocal(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: diagnosesQueryKey });
    },
  });
}
