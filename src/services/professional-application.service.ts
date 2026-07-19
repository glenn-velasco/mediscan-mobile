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
  // React Native's FormData accepts this {uri, name, type} shape in place of a Blob/File — fetch
  // reads it directly off the filesystem when the request is sent.
  formData.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
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
