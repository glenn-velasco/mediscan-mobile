import * as SecureStore from '@/lib/secure-store';

import type { MedicalInformationPayload } from '@/api/types';

const PENDING_REGISTRATION_KEY = 'mediscan_pending_registration';

type PendingRegistration = {
  email: string;
  medicalInfo: MedicalInformationPayload;
};

export async function savePendingRegistration(
  email: string,
  medicalInfo: MedicalInformationPayload,
): Promise<void> {
  const pending: PendingRegistration = {
    email: email.trim().toLowerCase(),
    medicalInfo,
  };
  await SecureStore.setItemAsync(PENDING_REGISTRATION_KEY, JSON.stringify(pending));
}

export async function loadPendingRegistration(email: string): Promise<MedicalInformationPayload | null> {
  const raw = await SecureStore.getItemAsync(PENDING_REGISTRATION_KEY);
  if (!raw) return null;

  try {
    const pending = JSON.parse(raw) as Partial<PendingRegistration>;
    if (
      typeof pending.email !== 'string'
      || !pending.medicalInfo
      || pending.email !== email.trim().toLowerCase()
    ) {
      return null;
    }
    return pending.medicalInfo;
  } catch {
    await clearPendingRegistration();
    return null;
  }
}

export async function clearPendingRegistration(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_REGISTRATION_KEY);
}
