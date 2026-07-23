import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import { getMedicalInformation } from '@/api/endpoints/medical-information';
import { submitMedicalInformationAvatar } from '@/services/medical-information-avatar.service';
import type { SelectedAvatarPhoto } from '@/services/medical-information-avatar.service';
import { medicalInformationAvatarQueryKey } from '@/lib/query-keys';

/** Server-sourced avatar URL — see medicalInformationAvatarQueryKey for why this bypasses the local offline store. */
export function useMedicalInformationAvatar() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...medicalInformationAvatarQueryKey, user?.id],
    queryFn: () => getMedicalInformation(),
    enabled: !!user,
  });
}

export function useUpdateMedicalInformationAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ medicalInformationId, photo }: { medicalInformationId: number; photo: SelectedAvatarPhoto }) =>
      submitMedicalInformationAvatar(medicalInformationId, photo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalInformationAvatarQueryKey });
    },
  });
}
