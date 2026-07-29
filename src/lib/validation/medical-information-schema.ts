import { z } from 'zod';
import { isValidPhoneNumber, isPossiblePhoneNumber, validatePhoneNumberLength } from 'libphonenumber-js';

import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { SUFFIX_OPTIONS } from '@/constants/suffix';
import { RELIGION_OPTIONS } from '@/constants/religion';

export const medicalInformationSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  middle_name: z.string().trim().optional(),
  last_name: z.string().trim().min(1, 'Last name is required'),
  suffix: z.enum(SUFFIX_OPTIONS).optional(),
  date_of_birth: z.string().trim().min(1, 'Date of birth is required').refine((val) => {
    const [year, month, day] = val.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return !isNaN(d.getTime()) && d.getTime() < today.getTime();
  }, 'Date of birth must be before today'),
  gender: z.enum(GENDER_OPTIONS, { message: 'Gender is required' }),
  phone_country_code: z.string().trim().min(1, 'Country code is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  blood_type: z.enum(BLOOD_TYPE_OPTIONS).nullable().optional(),
  religion: z.enum(RELIGION_OPTIONS).optional(),
  address: z.object({
    street: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Street is required').max(255)),
    unit: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Unit/Building/House is required').max(255)),
    city: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'City is required').max(255)),
    province: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Province is required').max(255)),
    postal_code: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Postal code is required').max(20)),
    country: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Country is required').max(255)),
  }),
  no_blood_transfusion: z.boolean(),
}).refine(
  (data) => {
    const cc = data.phone_country_code;
    if (!cc) return true;
    try {
      const result = validatePhoneNumberLength(data.phone, cc as any);
      return result === undefined;
    } catch {
      return false;
    }
  },
  { message: 'Phone number length is invalid for the selected country', path: ['phone'] },
).refine(
  (data) => {
    const cc = data.phone_country_code;
    if (!cc) return true;
    try {
      return isPossiblePhoneNumber(data.phone, cc as any);
    } catch {
      return false;
    }
  },
  { message: 'Phone number is not possible for the selected country', path: ['phone'] },
).refine(
  (data) => {
    const cc = data.phone_country_code;
    if (!cc) return true;
    try {
      return isValidPhoneNumber(data.phone, cc as any);
    } catch {
      return false;
    }
  },
  { message: 'Invalid phone number for the selected country', path: ['phone'] },
);

export type MedicalInformationFormValues = z.infer<typeof medicalInformationSchema>;
