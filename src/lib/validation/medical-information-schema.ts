import { z } from 'zod';

import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { SUFFIX_OPTIONS } from '@/constants/suffix';
import { RELIGION_OPTIONS } from '@/constants/religion';

export const medicalInformationSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  middle_name: z.string().trim().optional(),
  last_name: z.string().trim().min(1, 'Last name is required'),
  suffix: z.enum(SUFFIX_OPTIONS).optional(),
  date_of_birth: z.string().trim().min(1, 'Date of birth is required'),
  gender: z.enum(GENDER_OPTIONS, { message: 'Gender is required' }),
  phone_country_code: z.string().trim().min(1, 'Country code is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  blood_type: z.enum(BLOOD_TYPE_OPTIONS, { message: 'Blood type is required' }),
  religion: z.enum(RELIGION_OPTIONS).optional(),
  address: z.object({
    street: z.string().trim().max(255).nullable(),
    unit: z.string().trim().max(255).nullable(),
    city: z.string().trim().max(255).nullable(),
    province: z.string().trim().max(255).nullable(),
    postal_code: z.string().trim().max(20).nullable(),
    country: z.string().trim().max(255).nullable(),
  }),
  no_blood_transfusion: z.boolean(),
});

export type MedicalInformationFormValues = z.infer<typeof medicalInformationSchema>;
