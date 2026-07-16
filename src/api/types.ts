import type { Gender } from '@/constants/gender';
import type { BloodType } from '@/constants/blood-type';
import type { Suffix } from '@/constants/suffix';
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

export type Allergy = {
  id: number;
  allergen: string;
  reaction: string | null;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
};

export type Diagnosis = {
  id: number;
  condition: string;
  date_of_diagnosis: string | null;
  severity: DiagnosisSeverity;
};

export type MedicalInformation = {
  id: number;
  email?: string;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  phone: string;
  address: string;
  blood_type: BloodType | null;
  religion: string;
  no_blood_transfusion: boolean;
  allergies: Allergy[];
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
  religion?: string;
  address?: string;
  no_blood_transfusion?: boolean;
};

export type EmergencyContact = {
  id: number;
  name: string;
  relationship: string | null;
  phone_country_code: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
};

export type EmergencyContactPayload = {
  name: string;
  relationship?: string;
  phone_country_code?: string;
  phone?: string;
  is_primary?: boolean;
};

export type AllergyPayload = {
  allergen: string;
  reaction?: string;
  severity: Allergy['severity'];
};

export type DiagnosisPayload = {
  condition: string;
  date_of_diagnosis?: string;
  severity: DiagnosisSeverity;
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

export type EnvelopeType = 'allergy_verification' | 'diagnosis_verification' | 'transfusion_witness' | 'general_note' | 'medical_information_update';

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


