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

export function getAdminProfessionalApplications() {
  return invokeFunction<ProfessionalApplication[]>('admin-professional-applications-list');
}

export function getAdminProfessionalApplication(id: string) {
  return invokeFunction<ProfessionalApplication>('admin-professional-application-get', { id });
}

export function reviewProfessionalApplication(id: string, status: 'approved' | 'denied', rejectionReason?: string) {
  return invokeFunction<ProfessionalApplication>('professional-application-review', { id, status, rejection_reason: rejectionReason });
}

export function inviteAdmin(email: string) {
  return invokeFunction<{ email: string; invited: boolean }>('admin-invite', { email });
}
