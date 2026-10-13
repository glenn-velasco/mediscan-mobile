import NetInfo from '@react-native-community/netinfo';

import { createEmergencyCard, publishEmergencyCard, revokeEmergencyCard } from '@/api/endpoints/emergency-wallet-card';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as conditionsRepo from '@/db/repositories/conditions.repo';
import * as contactsRepo from '@/db/repositories/emergency-contacts.repo';
import * as emergencyHistoryRepo from '@/db/repositories/emergency-field-history.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as cardRepo from '@/db/repositories/dynamic-emergency-card.repo';
import * as medicalRepo from '@/db/repositories/medical-information.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import { buildEmergencyQrV2, parseEmergencyQrV2 } from '@/lib/emergency-qr-v2';
import { buildHybridEmergencyQr } from '@/lib/emergency-qr-hybrid';
import { DEFAULT_EMERGENCY_DISCLOSURE } from '@/types/emergency';
import { getProfessionalEncounters } from '@/api/endpoints/professional-scans';

let publishPromise: Promise<boolean> | null = null;

async function buildCurrentSnapshot(userId: string | number): Promise<{ payload: string; generatedAt: string } | null> {
  const [medical, allergies, conditions, diagnoses, medications, contacts, recentHistory, encounters] = await Promise.all([
    medicalRepo.getByUserId(userId),
    allergiesRepo.getAll(),
    conditionsRepo.getAll(),
    diagnosesRepo.getAll(),
    medicationsRepo.getAll(),
    contactsRepo.getAll(),
    emergencyHistoryRepo.getRecent(5, userId),
    getProfessionalEncounters().catch(() => []),
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
    recentHistory,
    latestVerifiedEncounter: encounters[0],
  });
  return { payload, generatedAt: new Date().toISOString() };
}

export async function buildPrintableEmergencyCardQr(userId: string | number, token: string): Promise<{ payload: string; lastUpdatedAt: string }> {
  const snapshot = await buildCurrentSnapshot(userId);
  if (!snapshot) throw new Error('Complete your emergency profile before printing a wallet card.');
  const parsed = await parseEmergencyQrV2(snapshot.payload);
  if (!parsed || parsed.verification.status === 'invalid') throw new Error('Unable to prepare the printed emergency snapshot.');
  return { payload: await buildHybridEmergencyQr(userId, token, parsed.info), lastUpdatedAt: parsed.info.lastUpdatedAt || parsed.info.generatedAt };
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
