import type { EnvelopeType } from '@/api/types';
import type { Gender } from '@/constants/gender';
import type { BloodType } from '@/constants/blood-type';
import type { Suffix } from '@/constants/suffix';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';
import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { SUFFIX_OPTIONS } from '@/constants/suffix';
import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';

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
  religion?: string | null;
  address?: string | null;
  no_blood_transfusion?: boolean;
};

export type MedicalInformationUpdateEnvelope = {
  type: 'medical_information_update';
  version: 1;
  fields: MedicalInformationPatch;
  updated_by: { user_id: number; name: string };
  updated_at: string;
};

export type EnvelopePlaintext = AllergyVerificationEnvelope | DiagnosisVerificationEnvelope | TransfusionWitnessEnvelope | GeneralNoteEnvelope | MedicalInformationUpdateEnvelope;

const SEVERITIES = new Set(['mild', 'moderate', 'severe', 'life-threatening']);
const DIAGNOSIS_SEVERITIES = new Set<string>(DIAGNOSIS_SEVERITY_OPTIONS);
const GENDER_SET = new Set<string>(GENDER_OPTIONS);
const BLOOD_TYPE_SET = new Set<string>(BLOOD_TYPE_OPTIONS);
const SUFFIX_SET = new Set<string>(SUFFIX_OPTIONS);

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
          case 'religion':
          case 'address':
            if (!isStrOrNull(value)) return null;
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
