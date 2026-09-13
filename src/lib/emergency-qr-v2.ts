import * as Crypto from 'expo-crypto';
import sodium, { ready } from 'react-native-libsodium';

import type { AllergyRow, ConditionRow, DiagnosisRow, EmergencyContactRow, MedicalInformationRow, MedicationRow } from '@/db/schema';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';
import { signEmergencyPayload, verifyEmergencyPayload } from '@/services/emergency-qr-signing.service';
import type { EmergencyDisclosureSettings, EmergencyQrEnvelopeV2, EmergencyKnowledgeState, QrVerificationResult } from '@/types/emergency';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

export const QR_V2_PREFIX = 'MEDISCAN:v2:';

function parseAddress(value: string | null): { street?: string; unit?: string; city?: string; province?: string; postal_code?: string; country?: string } | null {
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
}): Promise<string> {
  await ready;
  const { patientId, medical, allergies, conditions, diagnoses, medications, contacts, disclosure } = input;
  const generatedAt = new Date();
  const address = parseAddress(medical.address);
  const allRows = [...allergies, ...conditions, ...diagnoses, ...medications, ...contacts];
  const lastUpdatedAt = latestUpdated(medical, allRows);
  const knowledge = {
    allergies: stateFor(allergies, input.confirmedNone?.allergies),
    conditions: stateFor(conditions, input.confirmedNone?.conditions),
    diagnoses: stateFor(diagnoses, input.confirmedNone?.diagnoses),
    medications: stateFor(medications, input.confirmedNone?.medications),
  };
  const info: ScannedEmergencyInfo = {
    patientId,
    generatedAt: generatedAt.toISOString(),
    lastUpdatedAt,
    age: ageFromDob(medical.date_of_birth),
    name: disclosure.name ? medical.full_name || 'Unknown' : '',
    firstName: disclosure.name ? medical.first_name || '' : '',
    middleName: disclosure.name ? medical.middle_name || '' : '',
    lastName: disclosure.name ? medical.last_name || '' : '',
    suffix: disclosure.name ? medical.suffix || '' : '',
    dateOfBirth: disclosure.dateOfBirth ? medical.date_of_birth || '' : '',
    gender: disclosure.gender ? medical.gender || '' : '',
    bloodType: disclosure.bloodType ? medical.blood_type || '' : '',
    religion: disclosure.religion ? medical.religion || '' : '',
    noBloodTransfusion: disclosure.transfusionPreference ? (medical.no_blood_transfusion ? 'Yes' : 'No') : '',
    phone: disclosure.phone ? medical.phone || '' : '',
    phoneCountryCode: disclosure.phone ? medical.phone_country_code || '' : '',
    street: disclosure.address ? address?.street || '' : '',
    unit: disclosure.address ? address?.unit || '' : '',
    city: disclosure.address ? address?.city || '' : '',
    province: disclosure.address ? address?.province || '' : '',
    postalCode: disclosure.address ? address?.postal_code || '' : '',
    country: disclosure.address ? address?.country || '' : '',
    allergies: disclosure.allergies ? allergies.map(({ allergen, severity, reaction }) => ({ allergen, severity, reaction })) : [],
    conditions: disclosure.conditions ? conditions.map(({ description }) => ({ description })) : [],
    diagnoses: disclosure.diagnoses ? diagnoses.map(({ condition, severity, date_of_diagnosis }) => ({ condition, severity, dateOfDiagnosis: date_of_diagnosis })) : [],
    medications: disclosure.medications ? medications.map(({ name, dosage, frequency }) => ({ name, dosage, frequency })) : [],
    emergencyContacts: disclosure.emergencyContacts
      ? contacts.map((contact) => ({
          name: contact.name,
          relationship: contact.relationship,
          phone: contact.phone ? formatPhoneWithCountryCode(contact.phone_country_code ?? undefined, contact.phone) : null,
        }))
      : [],
    knowledge,
  };
  const unsigned = {
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
    data: info,
  };
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
