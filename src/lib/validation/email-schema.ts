import { z } from 'zod';

export const emailSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});

export type EmailFormValues = z.infer<typeof emailSchema>;
