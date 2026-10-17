import * as Crypto from 'expo-crypto';
import sodium, { ready } from 'react-native-libsodium';

import type { AllergyRow, ConditionRow, DiagnosisRow, EmergencyContactRow, MedicalInformationRow, MedicationRow } from '@/db/schema';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';
import { signEmergencyPayload, verifyEmergencyPayload } from '@/services/emergency-qr-signing.service';
import type { EmergencyDisclosureSettings, EmergencyQrEnvelopeV2, EmergencyKnowledgeState, QrVerificationResult } from '@/types/emergency';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import type { EmergencyFieldChange } from '@/db/repositories/emergency-field-history.repo';
import type { ProfessionalEncounter } from '@/api/types';

export const QR_V2_PREFIX = 'MEDISCAN:v2:';

function clipText(value: string | null | undefined, maxChars: number): string {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
}

function parseAddress(value: string | null): { street?: string; unit?: string; barangay?: string; city?: string; province?: string; postal_code?: string; country?: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed === 'object' && parsed !== null ? parsed as ReturnType<typeof parseAddress> : null;
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

function stateFor(items: unknown[], confirmedNone = false): EmergencyKnowledgeState {
  return items.length > 0 ? 'recorded' : confirmedNone ? 'confirmed_none' : 'not_recorded';
}

function latestUpdated(medical: MedicalInformationRow, rows: { updated_at_local: string }[]): string {
  return [medical.updated_at_local, medical.server_updated_at, ...rows.map((row) => row.updated_at_local)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? new Date().toISOString();
}

export async function buildEmergencyQrV2(input: {
  patientId: string | number;
  medical: MedicalInformationRow;
  allergies: AllergyRow[];
  conditions: ConditionRow[];
  diagnoses: DiagnosisRow[];
  medications: MedicationRow[];
  contacts: EmergencyContactRow[];
  disclosure: EmergencyDisclosureSettings;
  confirmedNone?: Partial<Record<'allergies' | 'conditions' | 'diagnoses' | 'medications', boolean>>;
  recentHistory?: EmergencyFieldChange[];
  latestVerifiedEncounter?: ProfessionalEncounter;
}): Promise<string> {
  await ready;
  const { patientId, medical, allergies, conditions, diagnoses, medications, contacts, disclosure } = input;
  const generatedAt = new Date();
  const address = parseAddress(medical.address);
  const allRows = [...allergies, ...conditions, ...diagnoses, ...medications, ...contacts];
  const lastUpdatedAt = [latestUpdated(medical, allRows), input.latestVerifiedEncounter?.updatedAt].filter((value): value is string => Boolean(value)).sort().at(-1)!;
  const knowledge = {
    allergies: stateFor(allergies, input.confirmedNone?.allergies),
    conditions: stateFor(conditions, input.confirmedNone?.conditions),
    diagnoses: stateFor(diagnoses, input.confirmedNone?.diagnoses),
    medications: stateFor(medications, input.confirmedNone?.medications),
  };

  const initialInfo: ScannedEmergencyInfo = {
    withheld: { dateOfBirth: !disclosure.dateOfBirth, bloodType: !disclosure.bloodType, phone: !disclosure.phone },
    patientId,
    generatedAt: generatedAt.toISOString(),
    lastUpdatedAt,
    age: ageFromDob(medical.date_of_birth),
    name: disclosure.name ? clipText(medical.full_name || 'Unknown', 80) : '',
    firstName: disclosure.name ? clipText(medical.first_name, 40) : '',
    middleName: disclosure.name ? clipText(medical.middle_name, 40) : '',
    lastName: disclosure.name ? clipText(medical.last_name, 40) : '',
    suffix: disclosure.name ? clipText(medical.suffix, 20) : '',
    dateOfBirth: disclosure.dateOfBirth ? clipText(medical.date_of_birth, 20) : '',
    gender: disclosure.gender ? clipText(medical.gender, 20) : '',
    bloodType: disclosure.bloodType ? clipText(medical.blood_type, 20) : '',
    religion: disclosure.religion ? clipText(medical.religion, 40) : '',
    noBloodTransfusion: disclosure.transfusionPreference ? (medical.no_blood_transfusion ? 'Yes' : 'No') : '',
    phone: disclosure.phone ? clipText(medical.phone, 30) : '',
    phoneCountryCode: disclosure.phone ? clipText(medical.phone_country_code, 10) : '',
    street: disclosure.address ? clipText(address?.street, 80) : '',
    unit: disclosure.address ? clipText(address?.unit, 30) : '',
    barangay: disclosure.address ? clipText(address?.barangay, 40) : '',
    city: disclosure.address ? clipText(address?.city, 40) : '',
    province: disclosure.address ? clipText(address?.province, 40) : '',
    postalCode: disclosure.address ? clipText(address?.postal_code, 20) : '',
    country: disclosure.address ? clipText(address?.country, 40) : '',
    allergies: disclosure.allergies
      ? allergies.slice(0, 8).map(({ allergen, severity, reaction }) => ({
          allergen: clipText(allergen, 60),
          severity: clipText(severity, 30),
          reaction: reaction ? clipText(reaction, 60) : null,
        }))
      : [],
    conditions: disclosure.conditions
      ? conditions.slice(0, 8).map(({ description }) => ({
          description: clipText(description, 80),
        }))
      : [],
    diagnoses: disclosure.diagnoses
      ? diagnoses.slice(0, 8).map(({ condition, severity, date_of_diagnosis }) => ({
          condition: clipText(condition, 80),
          severity: clipText(severity, 30),
          dateOfDiagnosis: date_of_diagnosis ? clipText(date_of_diagnosis, 20) : null,
        }))
      : [],
    medications: disclosure.medications
      ? medications.slice(0, 8).map(({ name, dosage, frequency }) => ({
          name: clipText(name, 60),
          dosage: clipText(dosage, 30),
          frequency: frequency ? clipText(frequency, 30) : null,
        }))
      : [],
    emergencyContacts: disclosure.emergencyContacts
      ? contacts.slice(0, 2).map((contact) => ({
          name: clipText(contact.name, 60),
          relationship: contact.relationship ? clipText(contact.relationship, 30) : null,
          phone: contact.phone ? formatPhoneWithCountryCode(contact.phone_country_code ?? undefined, contact.phone) : null,
        }))
      : [],
    latestVerifiedEncounter: input.latestVerifiedEncounter ? {
      professionalName: clipText(input.latestVerifiedEncounter.verifiedBy.name || input.latestVerifiedEncounter.professional_name, 60),
      professionalId: clipText(input.latestVerifiedEncounter.verifiedBy.userId || input.latestVerifiedEncounter.professional_id, 40),
      recordedAt: input.latestVerifiedEncounter.recordedAt,
      updatedAt: input.latestVerifiedEncounter.updatedAt,
      observations: clipText(input.latestVerifiedEncounter.observations, 160),
      actionsTaken: clipText(input.latestVerifiedEncounter.actionsTaken, 160),
      vitals: input.latestVerifiedEncounter.vitals.slice(0, 4).map((vital) => ({
        kind: clipText(vital.kind, 30),
        value: clipText(vital.value, 20),
        unit: clipText(vital.unit, 15),
        measuredAt: vital.measuredAt,
        recordedBy: clipText(vital.verifiedBy?.name || vital.recordedBy, 40),
      })),
    } : undefined,
    recentHistory: (input.recentHistory ?? []).filter((change) =>
      change.field === 'blood_type' ? disclosure.bloodType
        : change.field === 'date_of_birth' ? disclosure.dateOfBirth
          : disclosure.transfusionPreference,
    ).slice(0, 3),
    knowledge,
  };

  const MAX_TARGET_JSON_BYTES = 1800;
  let info = initialInfo;

  const buildUnsigned = (data: ScannedEmergencyInfo) => ({
    version: 2 as const,
    payloadId: Crypto.randomUUID(),
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + disclosure.staleAfterHours * 2 * 60 * 60 * 1000).toISOString(),
    provenance: {
      source: 'patient_entered' as const,
      lastUpdatedAt,
      allergies: knowledge.allergies,
      medications: knowledge.medications,
      diagnoses: knowledge.diagnoses,
      conditions: knowledge.conditions,
    },
    data,
  });

  let unsigned = buildUnsigned(info);

  if (JSON.stringify(unsigned).length > MAX_TARGET_JSON_BYTES && info.latestVerifiedEncounter) {
    info = {
      ...info,
      latestVerifiedEncounter: {
        ...info.latestVerifiedEncounter,
        observations: clipText(info.latestVerifiedEncounter.observations, 60),
        actionsTaken: clipText(info.latestVerifiedEncounter.actionsTaken, 60),
        vitals: info.latestVerifiedEncounter.vitals.slice(0, 2),
      },
    };
    unsigned = buildUnsigned(info);
  }

  if (JSON.stringify(unsigned).length > MAX_TARGET_JSON_BYTES && info.recentHistory?.length) {
    info = { ...info, recentHistory: undefined };
    unsigned = buildUnsigned(info);
  }

  if (JSON.stringify(unsigned).length > MAX_TARGET_JSON_BYTES && info.latestVerifiedEncounter) {
    info = { ...info, latestVerifiedEncounter: undefined };
    unsigned = buildUnsigned(info);
  }

  for (const maxPerCategory of [3, 2, 1]) {
    if (JSON.stringify(unsigned).length <= MAX_TARGET_JSON_BYTES) break;
    info = {
      ...info,
      allergies: info.allergies.slice(0, maxPerCategory).map((a) => ({
        ...a,
        allergen: clipText(a.allergen, 40),
        reaction: a.reaction ? clipText(a.reaction, 30) : null,
      })),
      conditions: info.conditions.slice(0, maxPerCategory).map((c) => ({
        description: clipText(c.description, 40),
      })),
      diagnoses: info.diagnoses.slice(0, maxPerCategory).map((d) => ({
        ...d,
        condition: clipText(d.condition, 40),
      })),
      medications: info.medications.slice(0, maxPerCategory).map((m) => ({
        ...m,
        name: clipText(m.name, 40),
        dosage: clipText(m.dosage, 20),
        frequency: m.frequency ? clipText(m.frequency, 20) : null,
      })),
      emergencyContacts: info.emergencyContacts.slice(0, maxPerCategory > 1 ? 2 : 1),
    };
    unsigned = buildUnsigned(info);
  }

  const signed = await signEmergencyPayload(patientId, JSON.stringify(unsigned));
  const envelope: EmergencyQrEnvelopeV2 = {
    ...unsigned,
    certificate: { publicKey: signed.publicKey, subject: String(patientId), issuedAt: signed.issuedAt, issuer: 'device' },
    signature: signed.signature,
  };
  return `${QR_V2_PREFIX}${sodium.to_base64(JSON.stringify(envelope), sodium.base64_variants.URLSAFE_NO_PADDING)}`;
}

export async function parseEmergencyQrV2(raw: string): Promise<{ info: ScannedEmergencyInfo; verification: QrVerificationResult } | null> {
  if (!raw.startsWith(QR_V2_PREFIX)) return null;
  await ready;
  try {
    const envelope = JSON.parse(sodium.to_string(sodium.from_base64(raw.slice(QR_V2_PREFIX.length), sodium.base64_variants.URLSAFE_NO_PADDING))) as EmergencyQrEnvelopeV2;
    if (envelope.version !== 2) return null;
    const { certificate, signature, ...unsigned } = envelope;
    const valid = await verifyEmergencyPayload(JSON.stringify(unsigned), signature, certificate.publicKey);
    if (!valid || certificate.subject !== String(envelope.data.patientId)) {
      return { info: envelope.data, verification: { status: 'invalid', authenticity: 'unverified', message: 'QR signature is invalid. Do not rely on this information.' } };
    }
    const now = Date.now();
    if (new Date(envelope.expiresAt).getTime() <= now) {
      return { info: envelope.data, verification: { status: 'expired', authenticity: 'device_signed', message: 'This signed QR has expired. Rescan a newly generated code.' } };
    }
    const ageMs = now - new Date(envelope.provenance.lastUpdatedAt).getTime();
    if (ageMs > 30 * 24 * 60 * 60 * 1000) {
      return { info: envelope.data, verification: { status: 'stale', authenticity: 'device_signed', message: 'Device signature valid; medical information may be stale.' } };
    }
    return { info: envelope.data, verification: { status: 'valid', authenticity: 'device_signed', message: 'Integrity verified with the patient device signing key.' } };
  } catch {
    return null;
  }
}
