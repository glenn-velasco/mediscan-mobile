export const DIAGNOSIS_SEVERITY_OPTIONS = ['chronic', 'ongoing', 'acute', 'critical'] as const;

export type DiagnosisSeverity = (typeof DIAGNOSIS_SEVERITY_OPTIONS)[number];
