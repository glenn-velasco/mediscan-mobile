import { z } from 'zod';

import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';

export const diagnosisSchema = z.object({
  condition: z.string().trim().min(1, 'Condition is required').max(255, 'Condition must be 255 characters or fewer'),
  date_of_diagnosis: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    const date = new Date(val);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return !isNaN(date.getTime()) && date.getTime() <= today.getTime();
  }, 'Date of diagnosis must be today or earlier'),
  severity: z.enum(DIAGNOSIS_SEVERITY_OPTIONS, { message: 'Severity is required' }),
});

export type DiagnosisFormValues = z.infer<typeof diagnosisSchema>;
