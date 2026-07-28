import type { Gender } from '@/constants/gender';
import type { BloodType } from '@/constants/blood-type';
import type { Suffix } from '@/constants/suffix';
import type { Religion } from '@/constants/religion';
import type { AllergySeverity } from '@/constants/allergy-severity';
import type { RelationToPatient } from '@/constants/relation-to-patient';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';

export type ApiEnvelope<T> = {
  status: number;
  message: string;
  data?: T;
  errors?: Record<string, string[]> | null;
};

export type User = {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  fullname: string;
  dob: string;
  age: number | null;
  gender: Gender;
  address: string;
  phone_number: string;
  phone_country_code: string;
  email: string;
  email_verified_at: string | null;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  medical_information?: MedicalInformation | null;
};

/** Matches the server's structured `MedicalInformation.address` shape — see resources/js/types/medicalinformation.ts on the backend. */
export type MedicalInformationAddress = {
  street: string | null;
  unit: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
};

export type Allergy = {
  id: number;
  allergen: string;
  reaction: string | null;
  severity: AllergySeverity;
};

/** A patient's own free-text note on their general health state - distinct from `Diagnosis`, which is the professional-authored formal identification of a specific condition. */
export type Condition = {
  id: number;
  description: string;
};

export type DiagnosedBy = {
  id: number;
  fullname: string;
};

export type Diagnosis = {
  id: number;
  condition: string;
  date_of_diagnosis: string | null;
  severity: DiagnosisSeverity;
  diagnosed_by: DiagnosedBy | null;
};

export type Medication = {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  notes: string | null;
};

export type MedicalInformation = {
  id: number;
  email?: string;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  phone: string;
  phone_country_code?: string | null;
  address: MedicalInformationAddress | null;
  blood_type: BloodType | null;
  religion: Religion | null;
  no_blood_transfusion: boolean;
  allergies: Allergy[];
  conditions: Condition[];
  diagnoses: Diagnosis[];
  emergency_contacts: EmergencyContact[];
};

export type LoginPayload = {
  email: string;
  password: string;
  device_name: string;
};

export type RegisterPayload = LoginPayload & {
  password_confirmation: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: Suffix;
  dob: string;
  gender: string;
  address: string;
  phone_number: string;
  phone_country_code: string;
};

export type LoginResponseData = {
  token: string;
  user: User;
};

/**
 * Registration either materializes an account immediately (the common
 * case), or - when the submitted name+dob matches an existing primary-owned
 * medical record - holds the data server-side pending that record's primary
 * user confirming it's really them. No account/token exists yet in the
 * pending case.
 */
export type RegisterResponseData =
  | { pending: true }
  | ({ pending: false } & LoginResponseData);

export type MedicalInformationPayload = {
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: Suffix;
  date_of_birth?: string;
  gender?: Gender;
  phone_country_code?: string;
  phone?: string;
  blood_type?: BloodType;
  religion?: Religion;
  address?: MedicalInformationAddress;
  no_blood_transfusion?: boolean;
};

export type EmergencyContact = {
  id: number;
  name: string;
  relationship: RelationToPatient | null;
  phone_country_code: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
};

export type EmergencyContactPayload = {
  name: string;
  relationship?: RelationToPatient;
  phone_country_code?: string;
  phone?: string;
  is_primary?: boolean;
};

export type AllergyPayload = {
  allergen: string;
  reaction?: string;
  severity: AllergySeverity;
};

export type ConditionPayload = {
  description: string;
};

export type DiagnosisPayload = {
  condition: string;
  date_of_diagnosis?: string;
  severity: DiagnosisSeverity;
};

export type MedicationPayload = {
  name: string;
  dosage: string;
  frequency: string;
  notes?: string;
};

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type PaginationLinks = {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

export type DeviceKey = {
  id: number;
  user_id: number;
  public_key: string;
  label: string | null;
  is_active: boolean;
  registered_at: string;
};

export type DeviceKeyPayload = {
  public_key: string;
  label?: string;
};

export type EnvelopeType = 'allergy_verification' | 'diagnosis_verification' | 'medication_verification' | 'condition_verification' | 'transfusion_witness' | 'general_note' | 'medical_information_update' | 'emergency_contact_verification';

export type PendingSyncEnvelope = {
  id: number;
  sender_id: number;
  recipient_id: number;
  envelope_type: EnvelopeType;
  ciphertext: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type EnvelopeSubmitPayload = {
  ciphertext: string;
  envelope_type: EnvelopeType;
};

export type ProfessionalApplicationIdType = 'ph_prc';

export type ProfessionalApplicationStatus =
  | 'processing'
  | 'pending_review'
  | 'approved'
  | 'auto_rejected'
  | 'denied';

export type ProfessionalApplication = {
  id: number;
  id_type: ProfessionalApplicationIdType;
  issuing_country: string;
  profession: string | null;
  full_name_on_id?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  status: ProfessionalApplicationStatus;
  rejection_reason: string | null;
  role_granted: string | null;
  created_at: string;
};


