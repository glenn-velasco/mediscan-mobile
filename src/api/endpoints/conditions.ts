import { createEncrypted, softDeleteEncrypted, updateEncrypted } from '@/api/encrypted-crud';
import type { ConditionPayload } from '@/api/types';

export type ConditionApiRecord = ConditionPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createCondition(id: string, payload: ConditionPayload) {
  return createEncrypted('conditions', id, payload);
}

export function updateCondition(id: string, payload: ConditionPayload) {
  return updateEncrypted('conditions', id, payload);
}

export function deleteCondition(id: string) {
  return softDeleteEncrypted('conditions', id);
}
