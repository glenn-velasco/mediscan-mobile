import { File } from 'expo-file-system';

import { uploadMedicalInformationAvatar } from '@/api/endpoints/medical-information';
import type { MedicalInformationApiRecord } from '@/api/endpoints/medical-information';

export type SelectedAvatarPhoto = { uri: string; name: string; type: string };

export function submitMedicalInformationAvatar(
  medicalInformationId: number,
  photo: SelectedAvatarPhoto,
): Promise<MedicalInformationApiRecord> {
  const formData = new FormData();
  // SDK 57's fetch only accepts a real Blob for multipart parts, not RN's classic
  // {uri,name,type} shorthand — see professional-application.service.ts's appendFile() for the
  // same requirement.
  formData.append('avatar', new File(photo.uri) as unknown as Blob);

  return uploadMedicalInformationAvatar(medicalInformationId, formData);
}
