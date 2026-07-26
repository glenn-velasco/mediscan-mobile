import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as allergiesRepo from '@/db/repositories/allergies.repo';
import { allergiesQueryKey } from '@/features/allergies/useAllergies';

export function useDeleteAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (localUuid: string) => allergiesRepo.deleteLocal(localUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
    },
  });
}
