import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { submitMedicalInformationAvatar } from '@/services/medical-information-avatar.service';
import type { SelectedAvatarPhoto } from '@/services/medical-information-avatar.service';
import { medicalInformationAvatarQueryKey } from '@/lib/query-keys';
import { getIsOffline, isNetworkStateKnown } from '@/lib/network-state';
import { hasCurrentUser } from '@/db/context';
import { getCachedToken } from '@/auth/token-storage';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useAvatarStore } from '@/stores/avatar-store';

const TAG = '[avatar-upload]';

export function useUpdateMedicalInformationAvatar() {
  const queryClient = useQueryClient();
  const setServerUrl = useAvatarStore((s) => s.setServerUrl);

  return useMutation({
    mutationFn: ({ medicalInformationId, photo }: { medicalInformationId: number; photo: SelectedAvatarPhoto }) => {
      console.log(TAG, 'mutation: uploading...', { medicalInformationId, photo });
      return submitMedicalInformationAvatar(medicalInformationId, photo);
    },
    retry: 3,
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
      console.log(TAG, `mutation: retry ${attemptIndex + 1}, waiting ${delay}ms`);
      return delay;
    },
    onSuccess: (data) => {
      console.log(TAG, 'mutation: success', { avatar: data.avatar });
      setServerUrl(data.avatar ?? null);
      queryClient.invalidateQueries({ queryKey: medicalInformationAvatarQueryKey });
    },
    onError: (error) => {
      console.warn(TAG, 'mutation: failed', error);
    },
  });
}

/** Mount at app level — retries pending uploads on startup, survives app restart. */
export function usePendingAvatarUpload() {
  const mutation = useUpdateMedicalInformationAvatar();
  const pendingUpload = useAvatarStore((s) => s.pendingUpload);
  const setPendingUpload = useAvatarStore((s) => s.setPendingUpload);
  const setServerUrl = useAvatarStore((s) => s.setServerUrl);
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    if (!pendingUpload || mutation.isPending) {
      return;
    }

    // Don't retry if the user has logged out — the upload is for a different session
    if (!hasCurrentUser() || !getCachedToken()) {
      console.log(TAG, 'pending check: skipped — no authenticated user');
      return;
    }

    // Wait until NetInfo has reported at least once before attempting upload
    if (!isNetworkStateKnown() || getIsOffline()) {
      console.log(TAG, 'pending check: skipped', { known: isNetworkStateKnown(), connected: isConnected });
      return;
    }

    console.log(TAG, 'pending: uploading from queue', pendingUpload);
    const photo: SelectedAvatarPhoto = { uri: pendingUpload.localUri, name: 'avatar.jpg', type: 'image/jpeg' };
    mutation.mutate(
      { medicalInformationId: pendingUpload.medicalInformationId, photo },
      {
        onSuccess: (data) => {
          console.log(TAG, 'pending: upload success', { avatar: data.avatar });
          setServerUrl(data.avatar ?? null);
          setPendingUpload(null);
        },
        onError: (error) => {
          console.warn(TAG, 'pending: upload failed, will retry on next app launch', error);
        },
      },
    );
  }, [pendingUpload, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps
}
