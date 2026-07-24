import { z } from 'zod';

import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { RELIGION_OPTIONS } from '@/constants/religion';

export const registrationMedicalInfoSchema = z.object({
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
  blood_type: z.enum(BLOOD_TYPE_OPTIONS).optional(),
  religion: z.enum(RELIGION_OPTIONS).optional(),
  no_blood_transfusion: z.boolean().optional(),
});

export const registrationAddressSchema = z.object({
  street: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'Street is required')),
  city: z.preprocess((v) => v ?? '', z.string().trim().min(1, 'City is required')),
  unit: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export type RegistrationMedicalInfoFormValues = z.infer<typeof registrationMedicalInfoSchema>;