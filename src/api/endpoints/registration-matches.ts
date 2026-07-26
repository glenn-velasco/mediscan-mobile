import { apiClient } from '@/api/client';

export type RegistrationMatch = {
  id: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  created_at: string;
};

/** Pending matches awaiting the authenticated user's decision (as a candidate record's primary user). */
export function listPendingRegistrationMatches() {
  return apiClient.get<RegistrationMatch[]>('api/v1/medical-information-registration-matches');
}

export function acceptRegistrationMatch(id: number) {
  return apiClient.post<null>(`api/v1/medical-information-registration-matches/${id}/accept`);
}

export function denyRegistrationMatch(id: number) {
  return apiClient.post<null>(`api/v1/medical-information-registration-matches/${id}/deny`);
}
