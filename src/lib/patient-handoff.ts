import { z } from 'zod';
import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate';
import * as Crypto from 'expo-crypto';
import sodium, { ready } from 'react-native-libsodium';
import { decryptQrPayload, encryptQrPayload } from '@/lib/qr-cipher';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

export const HANDOFF_PREFIX = 'MEDISCAN:handoff:1:';
export const HANDOFF_REFERENCE_PREFIX = 'MEDISCAN:handoff:2:';
export const HANDOFF_FRAME_PREFIX = 'MEDISCAN:handoff:3:';
const HANDOFF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HANDOFF_FRAME_SIZE = 700;
const MAX_HANDOFF_BYTES = 262144;
const text = z.string().max(12000);
const nullable = text.nullable();
const schema = z.object({
  patientId: z.union([text, z.number(), z.null()]),
  generatedAt: text, lastUpdatedAt: text.optional(), age: z.number().nullable().optional(),
  name: text, firstName: text, middleName: text, lastName: text, suffix: text,
  dateOfBirth: text, gender: text, bloodType: text, religion: text, noBloodTransfusion: text,
  phone: text, phoneCountryCode: text, street: text, unit: text, barangay: text.optional(), city: text, province: text, postalCode: text, country: text,
  allergies: z.array(z.object({ allergen: text, severity: text, reaction: nullable })).max(100),
  conditions: z.array(z.object({ description: text })).max(100),
  diagnoses: z.array(z.object({ condition: text, severity: text, dateOfDiagnosis: nullable })).max(100),
  medications: z.array(z.object({ name: text, dosage: text, frequency: nullable })).max(100),
  emergencyContacts: z.array(z.object({ name: text, relationship: nullable, phone: nullable })).max(100),
  latestVerifiedEncounter: z.object({ professionalName: text, professionalId: text, recordedAt: text, updatedAt: text, observations: text, actionsTaken: text,
    vitals: z.array(z.object({ kind: text, value: text, unit: text, measuredAt: text, recordedBy: text })).max(100),
  }).optional(),
}).passthrough();
const envelope = z.object({ info: schema, sharedBy: text, sharedAt: z.string().datetime() });

export async function createPatientHandoff(info: ScannedEmergencyInfo, sharedBy: string): Promise<string> {
  await ready;
  const compactInfo: ScannedEmergencyInfo = {
    ...info,
    recentHistory: undefined,
    allergies: info.allergies.slice(0, 20),
    conditions: info.conditions.slice(0, 20),
    diagnoses: info.diagnoses.slice(0, 20),
    medications: info.medications.slice(0, 20),
    emergencyContacts: info.emergencyContacts.slice(0, 10),
    latestVerifiedEncounter: info.latestVerifiedEncounter ? {
      ...info.latestVerifiedEncounter,
      observations: info.latestVerifiedEncounter.observations.slice(0, 500),
      actionsTaken: info.latestVerifiedEncounter.actionsTaken.slice(0, 500),
      vitals: info.latestVerifiedEncounter.vitals.slice(0, 10),
    } : undefined,
  };
  const bytes = strToU8(JSON.stringify(envelope.parse({ info: compactInfo, sharedBy, sharedAt: new Date().toISOString() })));
  const compressed = sodium.to_base64(zlibSync(bytes, { level: 9 }), sodium.base64_variants.ORIGINAL);
  const encrypted = await encryptQrPayload(`Z1:${bytes.length}:${compressed}`);
  return HANDOFF_PREFIX + encrypted;
}

export async function createPatientHandoffFrames(info: ScannedEmergencyInfo, sharedBy: string): Promise<string[]> {
  await ready;
  const bytes = strToU8(JSON.stringify(envelope.parse({ info, sharedBy, sharedAt: new Date().toISOString() })));
  if (bytes.length > MAX_HANDOFF_BYTES) throw new Error('This patient record is too large to transfer.');
  const compressed = sodium.to_base64(zlibSync(bytes, { level: 9 }), sodium.base64_variants.ORIGINAL);
  const encrypted = await encryptQrPayload(`Z1:${bytes.length}:${compressed}`);
  const transferId = Crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const total = Math.ceil(encrypted.length / HANDOFF_FRAME_SIZE);
  return Array.from({ length: total }, (_, index) =>
    `${HANDOFF_FRAME_PREFIX}${transferId}:${index + 1}:${total}:${encrypted.slice(index * HANDOFF_FRAME_SIZE, (index + 1) * HANDOFF_FRAME_SIZE)}`,
  );
}

export type PatientHandoffFrame = { transferId: string; index: number; total: number; chunk: string };

export function parsePatientHandoffFrame(raw: string): PatientHandoffFrame | null {
  const value = raw.trim();
  if (!value.startsWith(HANDOFF_FRAME_PREFIX)) return null;
  const match = /^MEDISCAN:handoff:3:([a-f0-9]{12}):(\d{1,3}):(\d{1,3}):([A-Za-z0-9+/:=_-]+)$/.exec(value);
  if (!match) return null;
  const index = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || total > 100 || index < 1 || index > total) return null;
  return { transferId: match[1], index, total, chunk: match[4] };
}

export async function parsePatientHandoffFrames(frames: PatientHandoffFrame[]) {
  if (!frames.length) return null;
  const { transferId, total } = frames[0];
  if (frames.some((frame) => frame.transferId !== transferId || frame.total !== total)) return null;
  const unique = new Map(frames.map((frame) => [frame.index, frame.chunk]));
  if (unique.size !== total) return null;
  return parseEncryptedPatientHandoff(Array.from({ length: total }, (_, index) => unique.get(index + 1) ?? '').join(''));
}

export function createPatientHandoffReferenceQr(token: string): string {
  if (!HANDOFF_TOKEN_PATTERN.test(token)) throw new Error('The handoff token is invalid.');
  return HANDOFF_REFERENCE_PREFIX + token;
}

export function parsePatientHandoffReference(raw: string): string | null {
  const value = raw.trim();
  if (!value.startsWith(HANDOFF_REFERENCE_PREFIX)) return null;
  const token = value.slice(HANDOFF_REFERENCE_PREFIX.length);
  return HANDOFF_TOKEN_PATTERN.test(token) ? token : null;
}

export function validatePatientHandoffInfo(value: unknown): ScannedEmergencyInfo | null {
  const result = schema.safeParse(value);
  return result.success ? result.data as ScannedEmergencyInfo : null;
}

export async function parsePatientHandoff(raw: string) {
  if (!raw.startsWith(HANDOFF_PREFIX) || raw.length > 20000) return null;
  return parseEncryptedPatientHandoff(raw.slice(HANDOFF_PREFIX.length));
}

async function parseEncryptedPatientHandoff(encrypted: string) {
  try {
    const plain = await decryptQrPayload(encrypted);
    if (!plain) return null;
    let json = plain;
    if (plain.startsWith('Z1:')) {
      const parts = /^Z1:(\d+):([A-Za-z0-9+/=]+)$/.exec(plain);
      if (!parts) return null;
      const size = Number(parts[1]);
      if (!Number.isInteger(size) || size < 1 || size > MAX_HANDOFF_BYTES) return null;
      await ready;
      const bytes = unzlibSync(sodium.from_base64(parts[2], sodium.base64_variants.ORIGINAL), { out: new Uint8Array(size) });
      if (bytes.length !== size) return null;
      json = strFromU8(bytes);
    }
    const value = envelope.parse(JSON.parse(json));
    return { info: value.info as ScannedEmergencyInfo, verification: {
      status: 'legacy' as const, authenticity: 'unverified' as const,
      message: `Forwarded snapshot · shared by ${value.sharedBy} at ${value.sharedAt}. Sender and clinical claims have not been independently verified.`,
    } };
  } catch { return null; }
}
