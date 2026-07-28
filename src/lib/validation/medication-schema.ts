import { z } from 'zod';

export const medicationSchema = z.object({
  name: z.string().trim().min(1, 'Medication name is required').max(255, 'Name must be 255 characters or fewer'),
  dosage: z.string().trim().max(255, 'Dosage must be 255 characters or fewer').optional(),
  frequency: z.string().trim().max(255, 'Frequency must be 255 characters or fewer').optional(),
  notes: z.string().trim().max(2000, 'Notes must be 2000 characters or fewer').optional(),
});

export type MedicationFormValues = z.infer<typeof medicationSchema>;
