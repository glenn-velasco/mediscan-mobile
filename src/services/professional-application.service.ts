import { File } from 'expo-file-system';

import { submitProfessionalApplication as submitProfessionalApplicationRequest } from '@/api/endpoints/professional-applications';
import type { ProfessionalApplication, ProfessionalApplicationIdType } from '@/api/types';

export type CapturedFile = { uri: string; name: string; type: string };

export type ProfessionalApplicationSubmission = {
  idType: ProfessionalApplicationIdType;
  idPhoto: CapturedFile;
  selfieFrames: CapturedFile[];
  flashFrames: CapturedFile[];
  flashColors: string[];
  coe: CapturedFile;
};

function appendFile(formData: FormData, field: string, file: CapturedFile) {
  // SDK 57's fetch (expo/src/winter) replaces RN's classic {uri, name, type} FormData shorthand
  // with a spec-compliant one that only accepts a real Blob — passing the shorthand object fails
  // at request-build time with "Unsupported FormDataPart implementation". expo-file-system's
  // `File` implements Blob (readable via .bytes()), which this fetch layer does support.
  formData.append(field, new File(file.uri) as unknown as Blob);
}

export function submitProfessionalApplication(submission: ProfessionalApplicationSubmission): Promise<ProfessionalApplication> {
  const formData = new FormData();
  formData.append('id_type', submission.idType);
  appendFile(formData, 'id_photo', submission.idPhoto);
  submission.selfieFrames.forEach((frame) => appendFile(formData, 'selfie_frames[]', frame));
  submission.flashFrames.forEach((frame) => appendFile(formData, 'flash_frames[]', frame));
  submission.flashColors.forEach((color) => formData.append('flash_colors[]', color));
  appendFile(formData, 'coe', submission.coe);

  return submitProfessionalApplicationRequest(formData);
}
