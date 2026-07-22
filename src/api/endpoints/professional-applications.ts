import { apiClient, postMultipart } from '@/api/client';
import type { ProfessionalApplication } from '@/api/types';

export function submitProfessionalApplication(formData: FormData) {
  return postMultipart<ProfessionalApplication>('api/v1/professional-applications', formData);
}

export function getProfessionalApplication(id: number) {
  return apiClient.get<ProfessionalApplication>(`api/v1/professional-applications/${id}`);
}
