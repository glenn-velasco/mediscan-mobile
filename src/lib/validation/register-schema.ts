import { z } from 'zod';

import { SUFFIX_OPTIONS } from '@/constants/suffix';

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1, 'Last name is required'),
    suffix: z.enum(SUFFIX_OPTIONS).optional(),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirmation: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
