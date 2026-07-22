// Always check for typos and sync it with app/Enums/AllergySeverity.php
export const AllergySeverity = {
  Mild: 'mild',
  Moderate: 'moderate',
  Severe: 'severe',
  LifeThreatening: 'life-threatening',
} as const;

export type AllergySeverity = (typeof AllergySeverity)[keyof typeof AllergySeverity];

export const AllergySeverityLabel: Record<AllergySeverity, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
  'life-threatening': 'Life-threatening',
};

export const ALLERGY_SEVERITY_OPTIONS = Object.values(AllergySeverity) as AllergySeverity[];
