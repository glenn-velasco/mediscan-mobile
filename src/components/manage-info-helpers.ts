import type {
  AllergyVerificationEnvelope,
  ConditionVerificationEnvelope,
  DiagnosisVerificationEnvelope,
  EmergencyContactVerificationEnvelope,
  MedicationVerificationEnvelope,
  MedicalInformationPatch,
} from '@/lib/envelope-schema';
import type { EnvelopeType, MedicalInformationAddress } from '@/api/types';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { GENDER_OPTIONS, GenderLabel, type Gender } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS, BloodTypeLabel, type BloodType } from '@/constants/blood-type';
import { SUFFIX_OPTIONS, SuffixLabel, type Suffix } from '@/constants/suffix';
import { RELIGION_OPTIONS, ReligionLabel, type Religion } from '@/constants/religion';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';
import { ALLERGY_SEVERITY_OPTIONS, AllergySeverityLabel, type AllergySeverity } from '@/constants/allergy-severity';
import { DIAGNOSIS_SEVERITY_OPTIONS, DiagnosisSeverityLabel } from '@/constants/diagnosis-severity';
import { EMPTY_ADDRESS } from '@/components/form/address-fields';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';

export const ALLERGY_SEVERITIES: AllergyVerificationEnvelope['severity'][] = [...ALLERGY_SEVERITY_OPTIONS];
export const DIAGNOSIS_SEVERITIES: DiagnosisSeverity[] = [...DIAGNOSIS_SEVERITY_OPTIONS];

export type ManageAllergy = {
  key: string;
  allergen: string;
  reaction: string;
  severity: AllergyVerificationEnvelope['severity'];
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
  verifyToggle: boolean;
  verifyTouched: boolean;
};

export type ManageCondition = {
  key: string;
  description: string;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
  verifyToggle: boolean;
  verifyTouched: boolean;
};

export type ManageDiagnosis = {
  key: string;
  condition: string;
  dateOfDiagnosis: string;
  severity: DiagnosisSeverity;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
  verifyToggle: boolean;
  verifyTouched: boolean;
};

export type ManageMedication = {
  key: string;
  name: string;
  dosage: string;
  frequency: string;
  notes: string;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
  verifyToggle: boolean;
  verifyTouched: boolean;
};

export type ManageEmergencyContact = {
  key: string;
  name: string;
  relationship: RelationToPatient | undefined;
  phone_country_code: string;
  phone: string;
  is_primary: boolean;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
};

export type MedInfoFormState = {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: Suffix | undefined;
  date_of_birth: string;
  gender: Gender | undefined;
  blood_type: BloodType | undefined;
  religion: Religion | undefined;
  address: MedicalInformationAddress;
  no_blood_transfusion: boolean;
  phone_country_code: string;
  phone: string;
};

export const EMPTY_MED_INFO_FORM: MedInfoFormState = {
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: undefined,
  date_of_birth: '',
  gender: undefined,
  blood_type: undefined,
  religion: undefined,
  address: EMPTY_ADDRESS,
  no_blood_transfusion: false,
  phone_country_code: 'PH',
  phone: '',
};

export type Change = {
  type: 'create' | 'update' | 'delete';
  envelope:
    | AllergyVerificationEnvelope
    | ConditionVerificationEnvelope
    | DiagnosisVerificationEnvelope
    | MedicationVerificationEnvelope
    | EmergencyContactVerificationEnvelope
    | any;
  envelopeType: EnvelopeType;
  label: string;
};

function normaliseSeverity(raw: string): AllergyVerificationEnvelope['severity'] {
  const lower = raw.toLowerCase();
  if (ALLERGY_SEVERITIES.includes(lower as AllergyVerificationEnvelope['severity'])) return lower as AllergyVerificationEnvelope['severity'];
  return 'mild';
}

function normaliseDiagnosisSeverity(raw: string): DiagnosisSeverity {
  const lower = raw.toLowerCase();
  if (DIAGNOSIS_SEVERITIES.includes(lower as DiagnosisSeverity)) return lower as DiagnosisSeverity;
  return 'chronic';
}

export function initAllergies(info: ScannedEmergencyInfo, verified: Set<string> = new Set()): ManageAllergy[] {
  return info.allergies.map((a, i) => ({
    key: `a:${i}`,
    allergen: a.allergen,
    reaction: a.reaction ?? '',
    severity: normaliseSeverity(a.severity),
    isNew: false,
    deleted: false,
    editing: false,
    verifyToggle: verified.has(a.allergen.toLowerCase()),
    verifyTouched: false,
  }));
}

export function initConditions(info: ScannedEmergencyInfo, verified: Set<string> = new Set()): ManageCondition[] {
  return info.conditions.map((c, i) => ({
    key: `c:${i}`,
    description: c.description,
    isNew: false,
    deleted: false,
    editing: false,
    verifyToggle: verified.has(c.description.toLowerCase()),
    verifyTouched: false,
  }));
}

export function initDiagnoses(info: ScannedEmergencyInfo, verified: Set<string> = new Set()): ManageDiagnosis[] {
  return info.diagnoses.map((d, i) => ({
    key: `d:${i}`,
    condition: d.condition,
    dateOfDiagnosis: d.dateOfDiagnosis ?? '',
    severity: normaliseDiagnosisSeverity(d.severity),
    isNew: false,
    deleted: false,
    editing: false,
    verifyToggle: verified.has(d.condition.toLowerCase()),
    verifyTouched: false,
  }));
}

export function initMedications(info: ScannedEmergencyInfo, verified: Set<string> = new Set()): ManageMedication[] {
  return info.medications.map((m, i) => ({
    key: `m:${i}`,
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency ?? '',
    notes: '',
    isNew: false,
    deleted: false,
    editing: false,
    verifyToggle: verified.has(m.name.toLowerCase()),
    verifyTouched: false,
  }));
}

export function initEmergencyContacts(info: ScannedEmergencyInfo): ManageEmergencyContact[] {
  return info.emergencyContacts.map((c, i) => ({
    key: `ec:${i}`,
    name: c.name,
    relationship: RELATION_TO_PATIENT_OPTIONS.includes(c.relationship as RelationToPatient) ? (c.relationship as RelationToPatient) : undefined,
    phone_country_code: '',
    phone: c.phone ?? '',
    is_primary: false,
    isNew: false,
    deleted: false,
    editing: false,
  }));
}

function scannedField(value: string): string {
  return value && value !== '—' ? value : '';
}

export function medInfoFromScanned(info: ScannedEmergencyInfo): MedInfoFormState {
  return {
    ...EMPTY_MED_INFO_FORM,
    first_name: scannedField(info.firstName),
    middle_name: scannedField(info.middleName),
    last_name: scannedField(info.lastName),
    suffix: SUFFIX_OPTIONS.includes(info.suffix as Suffix) ? (info.suffix as Suffix) : undefined,
    date_of_birth: scannedField(info.dateOfBirth),
    gender: GENDER_OPTIONS.includes(info.gender as Gender) ? (info.gender as Gender) : undefined,
    blood_type: BLOOD_TYPE_OPTIONS.includes(info.bloodType as BloodType) ? (info.bloodType as BloodType) : undefined,
    religion: RELIGION_OPTIONS.includes(info.religion as Religion) ? (info.religion as Religion) : undefined,
    address: {
      street: scannedField(info.street) || null,
      unit: scannedField(info.unit) || null,
      city: scannedField(info.city) || null,
      province: scannedField(info.province) || null,
      postal_code: scannedField(info.postalCode) || null,
      country: scannedField(info.country) || null,
    },
    phone: scannedField(info.phone),
    phone_country_code: scannedField(info.phoneCountryCode) || 'PH',
    no_blood_transfusion: info.noBloodTransfusion === 'Yes',
  };
}

export function buildAllergyEnvelope(item: ManageAllergy, action: 'create' | 'update' | 'delete' | 'revoke', user: { id: string | number; fullname: string }): AllergyVerificationEnvelope {
  const base = {
    type: 'allergy_verification' as const,
    version: 1 as const,
    allergen: item.allergen,
    reaction: item.reaction || null,
    severity: item.severity,
    verified_by: { user_id: user.id, name: user.fullname },
    verified_at: new Date().toISOString(),
  };
  if (action === 'delete') return { ...base, note: '__delete__' };
  if (action === 'revoke') return { ...base, note: '__unverify__' };
  return base;
}

export function buildConditionEnvelope(item: ManageCondition, action: 'create' | 'update' | 'delete' | 'revoke', user: { id: string | number; fullname: string }): ConditionVerificationEnvelope {
  const base = {
    type: 'condition_verification' as const,
    version: 1 as const,
    description: item.description,
    verified_by: { user_id: user.id, name: user.fullname },
    verified_at: new Date().toISOString(),
  };
  if (action === 'delete') return { ...base, note: '__delete__' };
  if (action === 'revoke') return { ...base, note: '__unverify__' };
  return base;
}

export function buildDiagnosisEnvelope(item: ManageDiagnosis, action: 'create' | 'update' | 'delete' | 'revoke', user: { id: string | number; fullname: string }): DiagnosisVerificationEnvelope {
  const base = {
    type: 'diagnosis_verification' as const,
    version: 1 as const,
    condition: item.condition,
    date_of_diagnosis: item.dateOfDiagnosis || null,
    severity: item.severity,
    verified_by: { user_id: user.id, name: user.fullname },
    verified_at: new Date().toISOString(),
  };
  if (action === 'delete') return { ...base, note: '__delete__' };
  if (action === 'revoke') return { ...base, note: '__unverify__' };
  return base;
}

export function buildMedicationEnvelope(item: ManageMedication, action: 'create' | 'update' | 'delete' | 'revoke', user: { id: string | number; fullname: string }): MedicationVerificationEnvelope {
  const base = {
    type: 'medication_verification' as const,
    version: 1 as const,
    name: item.name,
    dosage: item.dosage,
    frequency: item.frequency,
    notes: item.notes || null,
    verified_by: { user_id: user.id, name: user.fullname },
    verified_at: new Date().toISOString(),
  };
  if (action === 'delete') return { ...base, note: '__delete__' };
  if (action === 'revoke') return { ...base, note: '__unverify__' };
  return base;
}

export function buildContactEnvelope(item: ManageEmergencyContact, action: 'create' | 'update' | 'delete', user: { id: string | number; fullname: string }): EmergencyContactVerificationEnvelope {
  return {
    type: 'emergency_contact_verification',
    version: 1,
    name: item.name,
    relationship: item.relationship ?? null,
    phone_country_code: item.phone_country_code || null,
    phone: item.phone || null,
    is_primary: item.is_primary,
    action,
    verified_by: { user_id: user.id, name: user.fullname },
    verified_at: new Date().toISOString(),
  };
}

export function buildMedInfoPatch(values: MedInfoFormState, initial: MedInfoFormState): MedicalInformationPatch {
  const patch: MedicalInformationPatch = {};
  if (values.first_name !== initial.first_name) patch.first_name = values.first_name;
  if (values.middle_name !== initial.middle_name) patch.middle_name = values.middle_name || null;
  if (values.last_name !== initial.last_name) patch.last_name = values.last_name;
  if (values.suffix !== initial.suffix) patch.suffix = values.suffix ?? null;
  if (values.date_of_birth !== initial.date_of_birth) patch.date_of_birth = values.date_of_birth || null;
  if (values.gender !== initial.gender) patch.gender = values.gender ?? null;
  if (values.blood_type !== initial.blood_type) patch.blood_type = values.blood_type ?? null;
  if (values.religion !== initial.religion) patch.religion = values.religion ?? null;
  if (JSON.stringify(values.address) !== JSON.stringify(initial.address)) patch.address = values.address;
  if (values.phone !== initial.phone) patch.phone = values.phone || null;
  if (values.phone_country_code !== initial.phone_country_code) patch.phone_country_code = values.phone_country_code || null;
  if (values.no_blood_transfusion !== initial.no_blood_transfusion) patch.no_blood_transfusion = values.no_blood_transfusion;
  return patch;
}

export { formatPhoneWithCountryCode, GenderLabel, BloodTypeLabel, SuffixLabel, ReligionLabel, RelationToPatientLabel, AllergySeverityLabel, DiagnosisSeverityLabel };
export { GENDER_OPTIONS, BLOOD_TYPE_OPTIONS, SUFFIX_OPTIONS, RELIGION_OPTIONS, RELATION_TO_PATIENT_OPTIONS, ALLERGY_SEVERITY_OPTIONS, DIAGNOSIS_SEVERITY_OPTIONS };
