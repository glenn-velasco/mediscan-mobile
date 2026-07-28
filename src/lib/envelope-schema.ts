import type { EnvelopeType, MedicalInformationAddress } from '@/api/types';
import type { Gender } from '@/constants/gender';
import type { BloodType } from '@/constants/blood-type';
import type { Suffix } from '@/constants/suffix';
import type { Religion } from '@/constants/religion';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';
import type { RelationToPatient } from '@/constants/relation-to-patient';
import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { SUFFIX_OPTIONS } from '@/constants/suffix';
import { RELIGION_OPTIONS } from '@/constants/religion';
import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';
import { RELATION_TO_PATIENT_OPTIONS } from '@/constants/relation-to-patient';

/**
 * The backend treats `ciphertext` as fully opaque — it never inspects the plaintext JSON shape sealed
 * inside. These types are a mobile-only contract between the patient app and professional mode (both
 * live in this same codebase, so it's self-consistent). Each carries an explicit `version` so a future
 * shape change can be detected and rejected rather than silently misread.
 */
export type AllergyVerificationEnvelope = {
  type: 'allergy_verification';
  version: 1;
  allergen: string;
  reaction: string | null;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  verified_by: { user_id: number; name: string };
  verified_at: string;
  note?: string;
};

export type DiagnosisVerificationEnvelope = {
  type: 'diagnosis_verification';
  version: 1;
  condition: string;
  date_of_diagnosis: string | null;
  severity: DiagnosisSeverity;
  verified_by: { user_id: number; name: string };
  verified_at: string;
  note?: string;
};

export type MedicationVerificationEnvelope = {
  type: 'medication_verification';
  version: 1;
  name: string;
  dosage: string;
  frequency: string;
  notes: string | null;
  verified_by: { user_id: number; name: string };
  verified_at: string;
  note?: string;
};

export type ConditionVerificationEnvelope = {
  type: 'condition_verification';
  version: 1;
  description: string;
  verified_by: { user_id: number; name: string };
  verified_at: string;
  note?: string;
};

export type EmergencyContactVerificationEnvelope = {
  type: 'emergency_contact_verification';
  version: 1;
  name: string;
  relationship: RelationToPatient | null;
  phone_country_code: string | null;
  phone: string | null;
  is_primary: boolean;
  action: 'create' | 'update' | 'delete';
  verified_by: { user_id: number; name: string };
  verified_at: string;
};

export type TransfusionWitnessEnvelope = {
  type: 'transfusion_witness';
  version: 1;
  consent_value: boolean;
  witnessed_by: { user_id: number; name: string };
  witnessed_at: string;
  note?: string;
};

export type GeneralNoteEnvelope = {
  type: 'general_note';
  version: 1;
  note: string;
  author: { user_id: number; name: string };
  created_at: string;
};

export type MedicalInformationPatch = {
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  suffix?: Suffix | null;
  date_of_birth?: string | null;
  gender?: Gender | null;
  phone_country_code?: string | null;
  phone?: string | null;
  blood_type?: BloodType | null;
  religion?: Religion | null;
  address?: MedicalInformationAddress | null;
  no_blood_transfusion?: boolean;
};

export type MedicalInformationUpdateEnvelope = {
  type: 'medical_information_update';
  version: 1;
  fields: MedicalInformationPatch;
  updated_by: { user_id: number; name: string };
  updated_at: string;
};

export type EnvelopePlaintext = AllergyVerificationEnvelope | DiagnosisVerificationEnvelope | MedicationVerificationEnvelope | ConditionVerificationEnvelope | EmergencyContactVerificationEnvelope | TransfusionWitnessEnvelope | GeneralNoteEnvelope | MedicalInformationUpdateEnvelope;

const SEVERITIES = new Set(['mild', 'moderate', 'severe', 'life-threatening']);
const DIAGNOSIS_SEVERITIES = new Set<string>(DIAGNOSIS_SEVERITY_OPTIONS);
const GENDER_SET = new Set<string>(GENDER_OPTIONS);
const BLOOD_TYPE_SET = new Set<string>(BLOOD_TYPE_OPTIONS);
const SUFFIX_SET = new Set<string>(SUFFIX_OPTIONS);
const RELIGION_SET = new Set<string>(RELIGION_OPTIONS);
const RELATION_TO_PATIENT_SET = new Set<string>(RELATION_TO_PATIENT_OPTIONS);
const ADDRESS_KEYS = new Set(['street', 'unit', 'city', 'province', 'postal_code', 'country']);

function isAddressOrNull(value: unknown): value is MedicalInformationAddress | null {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([key, v]) => ADDRESS_KEYS.has(key) && (typeof v === 'string' || v === null));
}

function isPerson(value: unknown): value is { user_id: number; name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { user_id?: unknown }).user_id === 'number' &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

/** Validates a decrypted envelope's plaintext shape against its declared `envelope_type`. Returns null on any mismatch. */
export function parseEnvelopePlaintext(envelopeType: EnvelopeType, plaintext: unknown): EnvelopePlaintext | null {
  if (typeof plaintext !== 'object' || plaintext === null) return null;
  const p = plaintext as Record<string, unknown>;
  if (p.version !== 1 || p.type !== envelopeType) return null;

  switch (envelopeType) {
    case 'allergy_verification':
      if (
        typeof p.allergen === 'string' &&
        (p.reaction === null || typeof p.reaction === 'string') &&
        typeof p.severity === 'string' &&
        SEVERITIES.has(p.severity) &&
        isPerson(p.verified_by) &&
        typeof p.verified_at === 'string'
      ) {
        return p as unknown as AllergyVerificationEnvelope;
      }
      return null;

    case 'diagnosis_verification':
      if (
        typeof p.condition === 'string' &&
        (p.date_of_diagnosis === null || typeof p.date_of_diagnosis === 'string') &&
        typeof p.severity === 'string' &&
        DIAGNOSIS_SEVERITIES.has(p.severity) &&
        isPerson(p.verified_by) &&
        typeof p.verified_at === 'string'
      ) {
        return p as unknown as DiagnosisVerificationEnvelope;
      }
      return null;

    case 'medication_verification':
      if (
        typeof p.name === 'string' &&
        typeof p.dosage === 'string' &&
        typeof p.frequency === 'string' &&
        (p.notes === null || typeof p.notes === 'string') &&
        isPerson(p.verified_by) &&
        typeof p.verified_at === 'string'
      ) {
        return p as unknown as MedicationVerificationEnvelope;
      }
      return null;

    case 'condition_verification':
      if (
        typeof p.description === 'string' &&
        isPerson(p.verified_by) &&
        typeof p.verified_at === 'string'
      ) {
        return p as unknown as ConditionVerificationEnvelope;
      }
      return null;

    case 'emergency_contact_verification':
      if (
        typeof p.name === 'string' &&
        (p.relationship === null || (typeof p.relationship === 'string' && RELATION_TO_PATIENT_SET.has(p.relationship))) &&
        (p.phone_country_code === null || typeof p.phone_country_code === 'string') &&
        (p.phone === null || typeof p.phone === 'string') &&
        typeof p.is_primary === 'boolean' &&
        typeof p.action === 'string' &&
        ['create', 'update', 'delete'].includes(p.action) &&
        isPerson(p.verified_by) &&
        typeof p.verified_at === 'string'
      ) {
        return p as unknown as EmergencyContactVerificationEnvelope;
      }
      return null;

    case 'transfusion_witness':
      if (typeof p.consent_value === 'boolean' && isPerson(p.witnessed_by) && typeof p.witnessed_at === 'string') {
        return p as unknown as TransfusionWitnessEnvelope;
      }
      return null;

    case 'general_note':
      if (typeof p.note === 'string' && isPerson(p.author) && typeof p.created_at === 'string') {
        return p as unknown as GeneralNoteEnvelope;
      }
      return null;

    case 'medical_information_update': {
      if (!isPerson(p.updated_by) || typeof p.updated_at !== 'string') return null;
      const fields = p.fields;
      if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) return null;
      const f = fields as Record<string, unknown>;
      if (Object.keys(f).length === 0) return null;

      const isStrOrNull = (v: unknown) => typeof v === 'string' || v === null;
      const isEnumOrNull = (v: unknown, set: Set<string>) => v === null || (typeof v === 'string' && set.has(v));

      for (const [key, value] of Object.entries(f)) {
        switch (key) {
          case 'first_name':
          case 'last_name':
            if (typeof value !== 'string') return null;
            break;
          case 'middle_name':
          case 'date_of_birth':
          case 'phone_country_code':
          case 'phone':
            if (!isStrOrNull(value)) return null;
            break;
          case 'address':
            if (!isAddressOrNull(value)) return null;
            break;
          case 'suffix':
            if (!isEnumOrNull(value, SUFFIX_SET)) return null;
            break;
          case 'gender':
            if (!isEnumOrNull(value, GENDER_SET)) return null;
            break;
          case 'blood_type':
            if (!isEnumOrNull(value, BLOOD_TYPE_SET)) return null;
            break;
          case 'religion':
            if (!isEnumOrNull(value, RELIGION_SET)) return null;
            break;
          case 'no_blood_transfusion':
            if (typeof value !== 'boolean') return null;
            break;
          default:
            return null;
        }
      }
      return p as unknown as MedicalInformationUpdateEnvelope;
    }

    default:
      return null;
  }
}
