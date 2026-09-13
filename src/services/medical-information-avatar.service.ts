import { File } from 'expo-file-system';

import { uploadMedicalInformationAvatar } from '@/api/endpoints/medical-information';
import type { MedicalInformationApiRecord } from '@/api/endpoints/medical-information';

export type SelectedAvatarPhoto = { uri: string; name: string; type: string };

export async function submitMedicalInformationAvatar(
  medicalInformationId: number,
  photo: SelectedAvatarPhoto,
): Promise<MedicalInformationApiRecord> {
  const bytes = await new File(photo.uri).arrayBuffer();
  return uploadMedicalInformationAvatar(medicalInformationId, bytes, photo.type);
}
