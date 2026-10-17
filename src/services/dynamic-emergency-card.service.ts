import NetInfo from '@react-native-community/netinfo';
import sodium, { ready } from 'react-native-libsodium';

import { createEmergencyCard, publishEmergencyCard, revokeEmergencyCard } from '@/api/endpoints/emergency-wallet-card';
import type { AllergyRow, ConditionRow, DiagnosisRow, EmergencyContactRow, MedicalInformationRow, MedicationRow } from '@/db/schema';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as conditionsRepo from '@/db/repositories/conditions.repo';
import * as contactsRepo from '@/db/repositories/emergency-contacts.repo';
import * as emergencyHistoryRepo from '@/db/repositories/emergency-field-history.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as cardRepo from '@/db/repositories/dynamic-emergency-card.repo';
import * as medicalRepo from '@/db/repositories/medical-information.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import { buildHybridEmergencyQr } from '@/lib/emergency-qr-hybrid';
import { getProfessionalEncounters } from '@/api/endpoints/professional-scans';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';

let publishPromise: Promise<boolean> | null = null;

function parseAddress(value: string | null): { street?: string; unit?: string; barangay?: string; city?: string; province?: string; postal_code?: string; country?: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed === 'object' && parsed !== null ? (parsed as ReturnType<typeof parseAddress>) : null;
  } catch {
    return null;
  }
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export function compileEmergencyInfo(input: {
  patientId: string | number;
  medical: MedicalInformationRow;
  allergies: AllergyRow[];
  conditions: ConditionRow[];
  diagnoses: DiagnosisRow[];
  medications: MedicationRow[];
  contacts: EmergencyContactRow[];
  recentHistory?: emergencyHistoryRepo.EmergencyFieldChange[];
  latestVerifiedEncounter?: any;
}): ScannedEmergencyInfo {
  const { patientId, medical, allergies, conditions, diagnoses, medications, contacts } = input;
  const generatedAt = new Date().toISOString();
  const address = parseAddress(medical.address);
  const allRows = [...allergies, ...conditions, ...diagnoses, ...medications, ...contacts];
  const lastUpdatedAt = [
    medical.updated_at_local,
    medical.server_updated_at,
    ...allRows.map((r) => r.updated_at_local),
    input.latestVerifiedEncounter?.updatedAt,
  ].filter(Boolean).sort().at(-1) || generatedAt;

  return {
    patientId,
    generatedAt,
    lastUpdatedAt,
    age: ageFromDob(medical.date_of_birth),
    name: medical.full_name || 'Unknown',
    firstName: medical.first_name || '',
    middleName: medical.middle_name || '',
    lastName: medical.last_name || '',
    suffix: medical.suffix || '',
    dateOfBirth: medical.date_of_birth || '',
    gender: medical.gender || '',
    bloodType: medical.blood_type || '',
    religion: medical.religion || '',
    noBloodTransfusion: medical.no_blood_transfusion ? 'Yes' : 'No',
    phone: medical.phone || '',
    phoneCountryCode: medical.phone_country_code || '',
    street: address?.street || '',
    unit: address?.unit || '',
    barangay: address?.barangay || '',
    city: address?.city || '',
    province: address?.province || '',
    postalCode: address?.postal_code || '',
    country: address?.country || '',
    allergies: allergies.map(({ allergen, severity, reaction }) => ({ allergen, severity, reaction })),
    conditions: conditions.map(({ description }) => ({ description })),
    diagnoses: diagnoses.map(({ condition, severity, date_of_diagnosis }) => ({ condition, severity, dateOfDiagnosis: date_of_diagnosis })),
    medications: medications.map(({ name, dosage, frequency }) => ({ name, dosage, frequency })),
    emergencyContacts: contacts.map((contact) => ({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone ? formatPhoneWithCountryCode(contact.phone_country_code ?? undefined, contact.phone) : null,
    })),
    latestVerifiedEncounter: input.latestVerifiedEncounter ? {
      professionalName: input.latestVerifiedEncounter.verifiedBy?.name || input.latestVerifiedEncounter.professional_name || 'Verified Professional',
      professionalId: input.latestVerifiedEncounter.verifiedBy?.userId || input.latestVerifiedEncounter.professional_id || '',
      recordedAt: input.latestVerifiedEncounter.recordedAt,
      updatedAt: input.latestVerifiedEncounter.updatedAt,
      observations: input.latestVerifiedEncounter.observations,
      actionsTaken: input.latestVerifiedEncounter.actionsTaken,
      vitals: (input.latestVerifiedEncounter.vitals || []).map((vital: any) => ({
        kind: vital.kind,
        value: vital.value,
        unit: vital.unit,
        measuredAt: vital.measuredAt,
        recordedBy: vital.verifiedBy?.name || vital.recordedBy || '',
      })),
    } : undefined,
    recentHistory: input.recentHistory,
    knowledge: {
      allergies: allergies.length > 0 ? 'recorded' : 'not_recorded',
      conditions: conditions.length > 0 ? 'recorded' : 'not_recorded',
      diagnoses: diagnoses.length > 0 ? 'recorded' : 'not_recorded',
      medications: medications.length > 0 ? 'recorded' : 'not_recorded',
    },
  };
}

export async function getOrCreateDynamicCardToken(userId: string | number): Promise<string> {
  const existing = await cardRepo.getDynamicCard(userId);
  if (existing?.token) return existing.token;
  try {
    const created = await createDynamicEmergencyCard(userId);
    return created.token;
  } catch {
    await ready;
    const bytes = sodium.randombytes_buf(32);
    const token = sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
    const issuedAt = new Date().toISOString();
    await cardRepo.saveDynamicCard(userId, token, issuedAt);
    return token;
  }
}

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
  const token = await getOrCreateDynamicCardToken(userId);
  const info = compileEmergencyInfo({
    patientId: userId,
    medical,
    allergies,
    conditions,
    diagnoses,
    medications,
    contacts,
    recentHistory,
    latestVerifiedEncounter: encounters[0],
  });
  const payload = await buildHybridEmergencyQr(userId, token, info, {
    requireGender: false,
    maxModules: 177,
    errorCorrectionLevel: 'L',
  });
  return { payload, generatedAt: new Date().toISOString() };
}

/** Builds the centralized hybrid emergency QR payload (V4) for on-phone display and lock-screen widgets. */
export async function buildEmergencyQrPayload(userId: string | number): Promise<{ payload: string; lastUpdatedAt: string } | null> {
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

  const token = await getOrCreateDynamicCardToken(userId);
  const info = compileEmergencyInfo({
    patientId: userId,
    medical,
    allergies,
    conditions,
    diagnoses,
    medications,
    contacts,
    recentHistory,
    latestVerifiedEncounter: encounters[0],
  });

  const payload = await buildHybridEmergencyQr(userId, token, info, {
    requireGender: false,
    maxModules: 177,
    errorCorrectionLevel: 'L',
  });
  return { payload, lastUpdatedAt: info.lastUpdatedAt || info.generatedAt };
}

export async function buildPrintableEmergencyCardQr(userId: string | number, token: string): Promise<{ payload: string; lastUpdatedAt: string }> {
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
  if (!medical) throw new Error('Complete your emergency profile before printing a wallet card.');

  const info = compileEmergencyInfo({
    patientId: userId,
    medical,
    allergies,
    conditions,
    diagnoses,
    medications,
    contacts,
    recentHistory,
    latestVerifiedEncounter: encounters[0],
  });

  const payload = await buildHybridEmergencyQr(userId, token, info, {
    requireGender: true,
    maxModules: 113,
    errorCorrectionLevel: 'M',
    maxContacts: 2,
  });
  return { payload, lastUpdatedAt: info.lastUpdatedAt || info.generatedAt };
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
