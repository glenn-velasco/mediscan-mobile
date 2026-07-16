import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as allergiesRepo from '@/db/repositories/allergies.repo';
import { allergiesQueryKey } from '@/features/allergies/useAllergies';
import type { AllergyPayload } from '@/api/types';

export function useCreateAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AllergyPayload) => allergiesRepo.createLocal(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
    },
  });
}
