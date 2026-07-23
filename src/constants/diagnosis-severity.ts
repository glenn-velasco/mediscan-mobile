// Always check for typos and sync it with app/Enums/DiagnosisSeverity.php
export const DiagnosisSeverity = {
  Chronic: 'chronic',
  Ongoing: 'ongoing',
  Acute: 'acute',
  Critical: 'critical',
} as const;

export type DiagnosisSeverity = (typeof DiagnosisSeverity)[keyof typeof DiagnosisSeverity];

export const DiagnosisSeverityLabel: Record<DiagnosisSeverity, string> = {
  chronic: 'Chronic',
  ongoing: 'Ongoing',
  acute: 'Acute',
  critical: 'Critical',
};

export const DIAGNOSIS_SEVERITY_OPTIONS = Object.values(DiagnosisSeverity) as DiagnosisSeverity[];
