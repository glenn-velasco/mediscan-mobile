import { z } from 'zod';

export const conditionSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(1000, 'Description must be 1000 characters or fewer'),
});

export type ConditionFormValues = z.infer<typeof conditionSchema>;
