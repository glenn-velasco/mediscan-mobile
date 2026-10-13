import { z } from 'zod';
import { isValidPhoneNumber, isPossiblePhoneNumber, validatePhoneNumberLength } from 'libphonenumber-js';

import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { RELIGION_OPTIONS } from '@/constants/religion';
import { isPastCalendarDate } from '@/lib/validation/calendar-date';

export const registrationMedicalInfoSchema = z.object({
  date_of_birth: z.string().trim().min(1, 'Date of birth is required').refine(isPastCalendarDate, 'Enter a valid date of birth before today'),
  gender: z.enum(GENDER_OPTIONS, { message: 'Gender is required' }),
  phone_country_code: z.string().trim().min(1, 'Country code is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  blood_type: z.enum(BLOOD_TYPE_OPTIONS).optional(),
  religion: z.enum(RELIGION_OPTIONS).optional(),
  no_blood_transfusion: z.boolean().optional(),
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

export const registrationAddressSchema = z.object({
  street: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Street is required')),
  unit: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Unit/Building/House is required')),
  barangay: z.string().trim().max(255).nullable().optional(),
  city: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'City is required')),
  province: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Province is required')),
  postal_code: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Postal code is required')),
  country: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Country is required')),
}).superRefine((address, context) => {
  if (address.country.toLowerCase() === 'philippines' && !address.barangay?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Barangay is required',
      path: ['barangay'],
    });
  }
});

export type RegistrationMedicalInfoFormValues = z.infer<typeof registrationMedicalInfoSchema>;
