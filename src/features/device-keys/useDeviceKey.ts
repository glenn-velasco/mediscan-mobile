import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as deviceKeyRepo from '@/db/repositories/device-key.repo';
import { rotateDeviceKey } from '@/services/device-key.service';

export const deviceKeyQueryKey = ['device-key'] as const;

/** Local device-key status, for the account screen (Phase 7) — registration bootstraps at app boot, not from here. */
export function useDeviceKey() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...deviceKeyQueryKey, user?.id],
    queryFn: () => deviceKeyRepo.getLocal(),
    enabled: !!user,
  });
}

export function useRotateDeviceKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rotateDeviceKey,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeyQueryKey });
    },
  });
}
