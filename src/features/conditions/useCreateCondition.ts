import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as conditionsRepo from '@/db/repositories/conditions.repo';
import { conditionsQueryKey } from '@/features/conditions/useConditions';
import type { ConditionPayload } from '@/api/types';

export function useCreateCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ConditionPayload) => conditionsRepo.createLocal(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conditionsQueryKey });
    },
  });
}
