import { z } from 'zod';

import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';
import { isCurrentOrPastCalendarDate } from '@/lib/validation/calendar-date';

export const diagnosisSchema = z.object({
  condition: z.string().trim().min(1, 'Condition is required').max(255, 'Condition must be 255 characters or fewer'),
  date_of_diagnosis: z.string().optional().refine((val) => !val || !val.trim() || isCurrentOrPastCalendarDate(val), 'Enter a valid diagnosis date no later than today'),
  severity: z.enum(DIAGNOSIS_SEVERITY_OPTIONS, { message: 'Severity is required' }),
});

export type DiagnosisFormValues = z.infer<typeof diagnosisSchema>;
