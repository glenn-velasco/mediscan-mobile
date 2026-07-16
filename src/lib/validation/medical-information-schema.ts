import { z } from 'zod';

import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { SUFFIX_OPTIONS } from '@/constants/suffix';

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
  religion: z.string().trim().optional(),
  address: z.string().trim().min(1, 'Address is required'),
  no_blood_transfusion: z.boolean(),
});

export type MedicalInformationFormValues = z.infer<typeof medicalInformationSchema>;
