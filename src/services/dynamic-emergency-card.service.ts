import NetInfo from '@react-native-community/netinfo';

import { createEmergencyCard, publishEmergencyCard, revokeEmergencyCard } from '@/api/endpoints/emergency-wallet-card';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as conditionsRepo from '@/db/repositories/conditions.repo';
import * as contactsRepo from '@/db/repositories/emergency-contacts.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as cardRepo from '@/db/repositories/dynamic-emergency-card.repo';
import * as medicalRepo from '@/db/repositories/medical-information.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import { buildEmergencyQrV2 } from '@/lib/emergency-qr-v2';
import { DEFAULT_EMERGENCY_DISCLOSURE } from '@/types/emergency';

let publishPromise: Promise<boolean> | null = null;

async function buildCurrentSnapshot(userId: string | number): Promise<{ payload: string; generatedAt: string } | null> {
  const [medical, allergies, conditions, diagnoses, medications, contacts] = await Promise.all([
    medicalRepo.getByUserId(userId),
    allergiesRepo.getAll(),
    conditionsRepo.getAll(),
    diagnosesRepo.getAll(),
    medicationsRepo.getAll(),
    contactsRepo.getAll(),
  ]);
  if (!medical) return null;
  const payload = await buildEmergencyQrV2({
    patientId: userId,
    medical,
    allergies,
    conditions,
    diagnoses,
    medications,
    contacts,
    disclosure: DEFAULT_EMERGENCY_DISCLOSURE,
    confirmedNone: DEFAULT_EMERGENCY_DISCLOSURE.confirmedNone,
  });
  return { payload, generatedAt: new Date().toISOString() };
}

export async function publishDynamicEmergencyCard(userId: string | number, options?: { throwOnError?: boolean }): Promise<boolean> {
  if (publishPromise) return publishPromise;
  publishPromise = (async () => {
    const card = await cardRepo.getDynamicCard(userId);
    if (!card) return false;
    const network = await NetInfo.fetch();
    const isConnected = network.isInternetReachable ?? network.isConnected ?? false;
    if (!isConnected) {
      await cardRepo.markDynamicCardPending(userId);
      return false;
    }
    try {
      const snapshot = await buildCurrentSnapshot(userId);
      if (!snapshot) return false;
      const result = await publishEmergencyCard(snapshot.payload, snapshot.generatedAt);
      await cardRepo.markDynamicCardPublished(userId, result.published_at);
      return true;
    } catch (error) {
      await cardRepo.markDynamicCardPublishFailed(userId);
      if (options?.throwOnError) throw error;
      return false;
    }
  })().finally(() => { publishPromise = null; });
  return publishPromise;
}

export async function queueDynamicEmergencyCardPublication(userId: string | number): Promise<boolean> {
  const card = await cardRepo.getDynamicCard(userId);
  if (!card) return false;
  await cardRepo.markDynamicCardPending(userId);
  return publishDynamicEmergencyCard(userId);
}

export async function createDynamicEmergencyCard(userId: string | number): Promise<cardRepo.LocalDynamicEmergencyCard> {
  const created = await createEmergencyCard();
  await cardRepo.saveDynamicCard(userId, created.token, created.issued_at);
  await publishDynamicEmergencyCard(userId, { throwOnError: true });
  return (await cardRepo.getDynamicCard(userId))!;
}

export async function replaceDynamicEmergencyCard(userId: string | number): Promise<cardRepo.LocalDynamicEmergencyCard> {
  await revokeEmergencyCard();
  await cardRepo.removeDynamicCard(userId);
  return createDynamicEmergencyCard(userId);
}

export async function revokeDynamicEmergencyCard(userId: string | number): Promise<void> {
  await revokeEmergencyCard();
  await cardRepo.removeDynamicCard(userId);
}

export async function retryPendingDynamicEmergencyCard(userId: string | number): Promise<boolean> {
  const card = await cardRepo.getDynamicCard(userId);
  return card?.pendingPublish ? publishDynamicEmergencyCard(userId) : false;
}
