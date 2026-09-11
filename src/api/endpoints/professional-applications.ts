import { invokeFunction } from '@/api/supabase';
import type { ProfessionalApplication } from '@/api/types';

export function submitProfessionalApplication(formData: FormData) {
  return invokeFunction<ProfessionalApplication>('professional-application-submit', formData);
}

export function getProfessionalApplication(id: string | number) {
  return invokeFunction<ProfessionalApplication>('professional-application-get', { id });
}

export async function getMyProfessionalApplication() {
  const applications = await invokeFunction<ProfessionalApplication[]>('professional-applications-mine');
  return applications[0] ?? null;
}
