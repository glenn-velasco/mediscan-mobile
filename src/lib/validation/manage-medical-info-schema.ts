import { z } from 'zod';
import { isValidPhoneNumber, isPossiblePhoneNumber, validatePhoneNumberLength } from 'libphonenumber-js';

import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { SUFFIX_OPTIONS } from '@/constants/suffix';
import { RELIGION_OPTIONS } from '@/constants/religion';
import { optionalPersonName } from '@/lib/validation/person-name-schema';
import { isPastCalendarDate } from '@/lib/validation/calendar-date';

export const manageMedicalInfoSchema = z.object({
  first_name: optionalPersonName('First name').optional(),
  middle_name: optionalPersonName('Middle name').optional(),
  last_name: optionalPersonName('Last name').optional(),
  suffix: z.enum(SUFFIX_OPTIONS).nullable().optional(),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || isPastCalendarDate(val), 'Enter a valid date of birth before today'),
  gender: z.enum(GENDER_OPTIONS).nullable().optional(),
  phone_country_code: z.string().trim().max(10).optional(),
  phone: z.string().trim().max(30).optional(),
  blood_type: z.enum(BLOOD_TYPE_OPTIONS).nullable().optional(),
  religion: z.enum(RELIGION_OPTIONS).nullable().optional(),
  address: z
    .object({
      street: z.string().trim().max(255).nullable().optional(),
      unit: z.string().trim().max(255).nullable().optional(),
      barangay: z.string().trim().max(255).nullable().optional(),
      city: z.string().trim().max(255).nullable().optional(),
      province: z.string().trim().max(255).nullable().optional(),
      postal_code: z.string().trim().max(20).nullable().optional(),
      country: z.string().trim().max(255).nullable().optional(),
    })
    .optional(),
  no_blood_transfusion: z.boolean().optional(),
}).refine(
  (data) => {
    if (!data.phone || data.phone.length === 0) return true;
    const cc = data.phone_country_code;
    if (!cc || cc.length === 0) return true;
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
    if (!data.phone || data.phone.length === 0) return true;
    const cc = data.phone_country_code;
    if (!cc || cc.length === 0) return true;
    try {
      return isPossiblePhoneNumber(data.phone, cc as any);
    } catch {
      return false;
    }
  },
  { message: 'Phone number is not possible for the selected country', path: ['phone'] },
).refine(
  (data) => {
    if (!data.phone || data.phone.length === 0) return true;
    const cc = data.phone_country_code;
    if (!cc || cc.length === 0) return true;
    try {
      return isValidPhoneNumber(data.phone, cc as any);
    } catch {
      return false;
    }
  },
  { message: 'Invalid phone number for the selected country', path: ['phone'] },
);

export type ManageMedicalInfoFormValues = z.infer<typeof manageMedicalInfoSchema>;
