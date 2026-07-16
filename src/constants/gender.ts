export const GENDER_OPTIONS = ['Male', 'Female'] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
