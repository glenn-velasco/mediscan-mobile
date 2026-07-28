import { z } from 'zod';

import { GENDER_OPTIONS } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS } from '@/constants/blood-type';
import { SUFFIX_OPTIONS } from '@/constants/suffix';
import { RELIGION_OPTIONS } from '@/constants/religion';

export const manageMedicalInfoSchema = z.object({
  first_name: z.string().trim().max(255).optional(),
  middle_name: z.string().trim().max(255).optional(),
  last_name: z.string().trim().max(255).optional(),
  suffix: z.enum(SUFFIX_OPTIONS).nullable().optional(),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const [year, month, day] = val.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return !isNaN(d.getTime()) && d.getTime() < today.getTime();
    }, 'Date of birth must be before today'),
  gender: z.enum(GENDER_OPTIONS).nullable().optional(),
  phone_country_code: z.string().trim().max(10).optional(),
  phone: z.string().trim().max(30).optional(),
  blood_type: z.enum(BLOOD_TYPE_OPTIONS).nullable().optional(),
  religion: z.enum(RELIGION_OPTIONS).nullable().optional(),
  address: z
    .object({
      street: z.string().trim().max(255).nullable().optional(),
      unit: z.string().trim().max(255).nullable().optional(),
      city: z.string().trim().max(255).nullable().optional(),
      province: z.string().trim().max(255).nullable().optional(),
      postal_code: z.string().trim().max(20).nullable().optional(),
      country: z.string().trim().max(255).nullable().optional(),
    })
    .optional(),
  no_blood_transfusion: z.boolean().optional(),
});

export type ManageMedicalInfoFormValues = z.infer<typeof manageMedicalInfoSchema>;
