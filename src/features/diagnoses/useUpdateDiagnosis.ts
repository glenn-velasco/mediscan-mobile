import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import { diagnosesQueryKey } from '@/features/diagnoses/useDiagnoses';
import type { DiagnosisPayload } from '@/api/types';

export function useUpdateDiagnosis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localUuid, payload }: { localUuid: string; payload: Partial<DiagnosisPayload> }) =>
      diagnosesRepo.updateLocal(localUuid, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: diagnosesQueryKey });
    },
  });
}
