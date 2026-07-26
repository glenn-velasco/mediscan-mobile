import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as allergiesRepo from '@/db/repositories/allergies.repo';
import { allergiesQueryKey } from '@/features/allergies/useAllergies';
import { attestationsQueryKey } from '@/features/professional-attestations/useAttestations';
import type { AllergyPayload } from '@/api/types';

export function useUpdateAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localUuid, payload }: { localUuid: string; payload: Partial<AllergyPayload> }) =>
      allergiesRepo.updateLocal(localUuid, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
      queryClient.invalidateQueries({ queryKey: attestationsQueryKey });
    },
  });
}
