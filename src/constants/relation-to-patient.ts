// Always check for typos and sync it with app/Enums/RelationToPatient.php
export const RelationToPatient = {
  Parent: 'parent',
  Spouse: 'spouse',
  Sibling: 'sibling',
  Child: 'child',
  Guardian: 'guardian',
  Friend: 'friend',
  Other: 'other',
} as const;

export type RelationToPatient = (typeof RelationToPatient)[keyof typeof RelationToPatient];

export const RelationToPatientLabel: Record<RelationToPatient, string> = {
  parent: 'Parent',
  spouse: 'Spouse',
  sibling: 'Sibling',
  child: 'Child',
  guardian: 'Guardian',
  friend: 'Friend',
  other: 'Other',
};

export const RELATION_TO_PATIENT_OPTIONS = Object.values(RelationToPatient) as RelationToPatient[];
