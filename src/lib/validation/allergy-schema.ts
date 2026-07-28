import { z } from 'zod';

import { ALLERGY_SEVERITY_OPTIONS } from '@/constants/allergy-severity';

export const allergySchema = z.object({
  allergen: z.string().trim().min(1, 'Allergen is required').max(255, 'Allergen must be 255 characters or fewer'),
  reaction: z.string().trim().max(1000, 'Reaction must be 1000 characters or fewer').optional(),
  severity: z.enum(ALLERGY_SEVERITY_OPTIONS, { message: 'Severity is required' }),
});

export type AllergyFormValues = z.infer<typeof allergySchema>;
