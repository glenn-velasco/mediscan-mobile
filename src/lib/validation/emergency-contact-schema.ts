import { z } from 'zod';
import { isValidPhoneNumber, isPossiblePhoneNumber, validatePhoneNumberLength } from 'libphonenumber-js';

import { RELATION_TO_PATIENT_OPTIONS } from '@/constants/relation-to-patient';
import { personName } from '@/lib/validation/person-name-schema';

export const emergencyContactSchema = z.object({
  name: personName('Name'),
  relationship: z.enum(RELATION_TO_PATIENT_OPTIONS, { message: 'Relationship is required' }),
  phone_country_code: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Country code is required').max(5, 'Country code must be 5 characters or fewer')),
  phone: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Phone number is required').max(32, 'Phone number must be 32 characters or fewer')),
  is_primary: z.boolean().optional(),
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

export type EmergencyContactFormValues = z.infer<typeof emergencyContactSchema>;
