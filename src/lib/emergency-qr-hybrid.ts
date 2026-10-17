import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate';
import QRCode from 'qrcode';
import sodium, { ready } from 'react-native-libsodium';

import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { signEmergencyPayload, verifyEmergencyPayload } from '@/services/emergency-qr-signing.service';
import type { QrVerificationResult } from '@/types/emergency';

export const QR_HYBRID_PREFIX = 'MEDISCAN:v4:';
const MAX_QR_MODULES = 113; // Version 24, including a separate four-module quiet zone when rendered.
const MAX_UNCOMPRESSED_BYTES = 65_536;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type CompactSnapshot = {
  i: string;
  g: string;
  u: string;
  n: string;
  b: string;
  t: string;
  rg?: string;
  a: [string, string, string | null][];
  c: string[];
  d: [string, string, string | null][];
  m: [string, string, string | null][];
  e: [string, string | null, string | null][];
  l?: [string, string, string, string, string, string];
  r?: string;
  x?: [string, string, string, string];
  k?: ScannedEmergencyInfo['knowledge'];
  q?: ScannedEmergencyInfo['latestVerifiedEncounter'];
};

type HybridEnvelope = { t: string; p: string; k: string; s: string };

function toCompact(info: ScannedEmergencyInfo, options?: { maxContacts?: number }): CompactSnapshot {
  const contacts = options?.maxContacts !== undefined
    ? info.emergencyContacts.slice(0, options.maxContacts)
    : info.emergencyContacts;

  return {
    i: String(info.patientId ?? ''),
    g: info.generatedAt,
    u: info.lastUpdatedAt || info.generatedAt,
    n: info.name,
    b: info.bloodType,
    t: info.noBloodTransfusion,
    rg: info.religion || undefined,
    a: info.allergies.map(({ allergen, severity, reaction }) => [allergen, severity, reaction]),
    c: info.conditions.map(({ description }) => description),
    d: info.diagnoses.map(({ condition, severity, dateOfDiagnosis }) => [condition, severity, dateOfDiagnosis]),
    m: info.medications.map(({ name, dosage, frequency }) => [name, dosage, frequency]),
    e: contacts.map(({ name, relationship, phone }) => [name, relationship, phone]),
    l: [info.street, info.unit, info.city, info.province, info.postalCode, info.country],
    r: info.barangay || undefined,
    x: [info.dateOfBirth, info.gender, info.phone, info.phoneCountryCode],
    k: info.knowledge,
    q: info.latestVerifiedEncounter,
  };
}

function fromCompact(value: CompactSnapshot): ScannedEmergencyInfo {
  return {
    patientId: value.i,
    generatedAt: value.g,
    lastUpdatedAt: value.u,
    name: value.n,
    firstName: '', middleName: '', lastName: '', suffix: '',
    dateOfBirth: value.x?.[0] ?? '', gender: value.x?.[1] ?? '',
    bloodType: value.b, religion: value.rg ?? '', noBloodTransfusion: value.t,
    phone: value.x?.[2] ?? '', phoneCountryCode: value.x?.[3] ?? '',
    street: value.l?.[0] ?? '', unit: value.l?.[1] ?? '', city: value.l?.[2] ?? '',
    barangay: value.r ?? '',
    province: value.l?.[3] ?? '', postalCode: value.l?.[4] ?? '', country: value.l?.[5] ?? '',
    allergies: value.a.map(([allergen, severity, reaction]) => ({ allergen, severity, reaction })),
    conditions: value.c.map((description) => ({ description })),
    diagnoses: value.d.map(([condition, severity, dateOfDiagnosis]) => ({ condition, severity, dateOfDiagnosis })),
    medications: value.m.map(([name, dosage, frequency]) => ({ name, dosage, frequency })),
    emergencyContacts: value.e.map(([name, relationship, phone]) => ({ name, relationship, phone })),
    knowledge: value.k,
    withheld: { dateOfBirth: !value.x, bloodType: false, phone: !value.x },
    latestVerifiedEncounter: value.q,
  };
}

export async function buildHybridEmergencyQr(
  patientId: string | number,
  token: string,
  info: ScannedEmergencyInfo,
  options?: {
    requireGender?: boolean;
    maxModules?: number;
    errorCorrectionLevel?: 'L' | 'M';
    maxContacts?: number;
  },
): Promise<string> {
  if (!TOKEN_PATTERN.test(token)) throw new Error('Invalid emergency card token');
  if (options?.requireGender !== false && !info.gender?.trim()) {
    throw new Error('Gender is missing from the local emergency profile. Add it before printing a wallet card.');
  }
  await ready;
  const compact = toCompact(info, options);
  if (compact.i !== String(patientId)) throw new Error('The emergency snapshot belongs to another patient');
  const compressed = zlibSync(strToU8(JSON.stringify(compact)), { level: 9 });
  const p = sodium.to_base64(compressed, sodium.base64_variants.URLSAFE_NO_PADDING);
  const signed = await signEmergencyPayload(patientId, `${QR_HYBRID_PREFIX}${token}:${p}`);
  const envelope: HybridEnvelope = { t: token, p, k: signed.publicKey, s: signed.signature };
  const raw = `${QR_HYBRID_PREFIX}${sodium.to_base64(strToU8(JSON.stringify(envelope)), sodium.base64_variants.URLSAFE_NO_PADDING)}`;
  const maxModules = options?.maxModules ?? MAX_QR_MODULES;
  const errorCorrectionLevel = options?.errorCorrectionLevel ?? 'M';
  if (QRCode.create(raw, { errorCorrectionLevel }).modules.size > maxModules) {
    throw new Error('This emergency summary is too large for a reliable wallet-card QR. Shorten the entries or use the on-phone QR. No medical facts were silently omitted.');
  }
  return raw;
}

export async function parseHybridEmergencyQr(raw: string): Promise<{ token: string; info: ScannedEmergencyInfo; verification: QrVerificationResult } | null> {
  if (!raw.startsWith(QR_HYBRID_PREFIX) || raw.length > 4_000) return null;
  await ready;
  try {
    const envelope = JSON.parse(strFromU8(sodium.from_base64(raw.slice(QR_HYBRID_PREFIX.length), sodium.base64_variants.URLSAFE_NO_PADDING))) as HybridEnvelope;
    if (!TOKEN_PATTERN.test(envelope.t) || typeof envelope.p !== 'string' || typeof envelope.k !== 'string' || typeof envelope.s !== 'string') return null;
    const signatureValid = await verifyEmergencyPayload(`${QR_HYBRID_PREFIX}${envelope.t}:${envelope.p}`, envelope.s, envelope.k);
    if (!signatureValid) return null;
    const compressed = sodium.from_base64(envelope.p, sodium.base64_variants.URLSAFE_NO_PADDING);
    // A printed QR is untrusted input. Refuse oversized decompression before constructing the UI.
    const decoded = unzlibSync(compressed, { out: new Uint8Array(MAX_UNCOMPRESSED_BYTES) });
    const value = JSON.parse(strFromU8(decoded)) as CompactSnapshot;
    if (typeof value.i !== 'string' || !Number.isFinite(Date.parse(value.g)) || !Number.isFinite(Date.parse(value.u)) ||
      typeof value.n !== 'string' || typeof value.b !== 'string' || typeof value.t !== 'string' ||
      !Array.isArray(value.a) || !Array.isArray(value.c) || !Array.isArray(value.d) || !Array.isArray(value.m) || !Array.isArray(value.e) ||
      (value.rg !== undefined && typeof value.rg !== 'string') ||
      (value.l !== undefined && (!Array.isArray(value.l) || value.l.length !== 6 || !value.l.every((part) => typeof part === 'string'))) ||
      (value.x !== undefined && (!Array.isArray(value.x) || value.x.length !== 4 || !value.x.every((part) => typeof part === 'string')))) return null;
    const info = fromCompact(value);
    const stale = Date.now() - Date.parse(info.lastUpdatedAt || info.generatedAt) > 30 * 24 * 60 * 60 * 1000;
    return {
      token: envelope.t,
      info,
      verification: stale
        ? { status: 'stale', authenticity: 'device_signed', message: 'Offline emergency snapshot is over 30 days old. Check with the patient and refresh online when possible.' }
        : { status: 'valid', authenticity: 'device_signed', message: 'Offline emergency snapshot is device-signed, but may have changed or been revoked.' },
    };
  } catch {
    return null;
  }
}
