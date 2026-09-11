import { invokeFunction } from '@/api/supabase';

export type RegistrationMatch = {
  id: string | number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  created_at: string;
};

/** Pending matches awaiting the authenticated user's decision (as a candidate record's primary user). */
export function listPendingRegistrationMatches() {
  return invokeFunction<RegistrationMatch[]>('registration-matches-list');
}

export function acceptRegistrationMatch(id: string | number) {
  return invokeFunction<null>('registration-match-decide', { id, decision: 'accept' });
}

export function denyRegistrationMatch(id: string | number) {
  return invokeFunction<null>('registration-match-decide', { id, decision: 'deny' });
}
