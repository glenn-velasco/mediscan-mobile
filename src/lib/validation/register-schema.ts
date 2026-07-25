import { z } from 'zod';

import { SUFFIX_OPTIONS } from '@/constants/suffix';
import { passwordValidation } from '@/lib/validation/password-schema';

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1, 'Last name is required'),
    suffix: z.enum(SUFFIX_OPTIONS).optional(),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: passwordValidation,
    passwordConfirmation: z
      .string()
      .min(12, 'Please confirm your password')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
