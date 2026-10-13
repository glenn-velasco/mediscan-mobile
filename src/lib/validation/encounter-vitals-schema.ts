import { z } from 'zod';

const whole = (minimum: number, maximum: number) => z.string()
  .regex(/^\d{1,3}$/)
  .refine((value) => Number(value) >= minimum && Number(value) <= maximum);

export const encounterVitalsSchema = z.object({
  blood_pressure: z.string().trim().refine((value) => {
    if (!value) return true;
    const match = /^(\d{2,3})\/(\d{2,3})$/.exec(value);
    if (!match) return false;
    const systolic = Number(match[1]);
    const diastolic = Number(match[2]);
    return systolic >= 40 && systolic <= 300 && diastolic >= 20 && diastolic <= 200 && systolic > diastolic;
  }, 'Enter a valid blood pressure as systolic/diastolic, for example 120/80'),
  heart_rate: z.string().trim().refine((value) => !value || whole(20, 250).safeParse(value).success, 'Heart rate must be 20–250 bpm'),
  respiratory_rate: z.string().trim().refine((value) => !value || whole(4, 80).safeParse(value).success, 'Respiratory rate must be 4–80 breaths/min'),
  temperature: z.string().trim().refine((value) => !value || /^\d{2}(?:\.\d)?$/.test(value) && Number(value) >= 25 && Number(value) <= 45, 'Temperature must be 25–45 °C'),
  oxygen_saturation: z.string().trim().refine((value) => !value || whole(50, 100).safeParse(value).success, 'Oxygen saturation must be 50–100%'),
});
