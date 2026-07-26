import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as conditionsRepo from '@/db/repositories/conditions.repo';
import { conditionsQueryKey } from '@/features/conditions/useConditions';
import { attestationsQueryKey } from '@/features/professional-attestations/useAttestations';
import type { ConditionPayload } from '@/api/types';

export function useUpdateCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localUuid, payload }: { localUuid: string; payload: Partial<ConditionPayload> }) =>
      conditionsRepo.updateLocal(localUuid, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conditionsQueryKey });
      queryClient.invalidateQueries({ queryKey: attestationsQueryKey });
    },
  });
}
