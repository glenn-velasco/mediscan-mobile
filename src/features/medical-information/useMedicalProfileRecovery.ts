import { useCallback, useEffect, useRef, useState } from 'react';

import { hydratePatientChanges } from '@/services/patient-sync.service';

type MedicalProfileStorageState = 'missing' | 'current' | 'legacy' | undefined;

type UseMedicalProfileRecoveryOptions = {
  userId: string | number | null | undefined;
  hasProfile: boolean;
  storageState: MedicalProfileStorageState;
  isLocalLoading: boolean;
  isStorageStateLoading: boolean;
  isStorageStateError: boolean;
  refetchLocalProfile: () => Promise<unknown>;
};

const PROFILE_RECOVERY_TIMEOUT_MS = 15_000;

/**
 * Restores an existing cloud profile without flashing an empty/error state after authentication.
 * It never creates or overwrites a missing profile; only the explicit `current` cloud state is
 * eligible, and each account gets one automatic attempt plus user-initiated retries.
 */
export function useMedicalProfileRecovery({
  userId,
  hasProfile,
  storageState,
  isLocalLoading,
  isStorageStateLoading,
  isStorageStateError,
  refetchLocalProfile,
}: UseMedicalProfileRecoveryOptions) {
  const activeUserId = userId == null ? null : String(userId);
  const [recoveringUserId, setRecoveringUserId] = useState<string | null>(null);
  const [attemptedUserId, setAttemptedUserId] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => () => {
    generation.current += 1;
  }, [activeUserId]);

  const recoverMedicalProfile = useCallback(async (): Promise<void> => {
    if (!activeUserId) return;
    const attemptGeneration = ++generation.current;
    setAttemptedUserId(activeUserId);
    setRecoveringUserId(activeUserId);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        hydratePatientChanges(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Medical profile recovery timed out')),
            PROFILE_RECOVERY_TIMEOUT_MS,
          );
        }),
      ]);
      await refetchLocalProfile();
    } finally {
      if (timeout) clearTimeout(timeout);
      if (generation.current === attemptGeneration) {
        setRecoveringUserId(null);
      }
    }
  }, [activeUserId, refetchLocalProfile]);

  const shouldAutomaticallyRecoverProfile = Boolean(
    activeUserId
      && !hasProfile
      && !isLocalLoading
      && !isStorageStateLoading
      && !isStorageStateError
      && storageState === 'current'
      && attemptedUserId !== activeUserId,
  );
  const isRecoveringProfile = recoveringUserId === activeUserId;

  useEffect(() => {
    if (!shouldAutomaticallyRecoverProfile) return;
    const timer = setTimeout(() => {
      void recoverMedicalProfile().catch(() => {
        // End the neutral loading state and allow the explicit fallback to render.
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [recoverMedicalProfile, shouldAutomaticallyRecoverProfile]);

  return {
    isRecoveringProfile,
    shouldAutomaticallyRecoverProfile,
    recoverMedicalProfile,
  };
}
