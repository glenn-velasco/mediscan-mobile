// Always check for typos and sync it with app/Enums/BloodType.php
export const BloodType = {
  APositive: 'a_positive',
  ANegative: 'a_negative',
  BPositive: 'b_positive',
  BNegative: 'b_negative',
  ABPositive: 'ab_positive',
  ABNegative: 'ab_negative',
  OPositive: 'o_positive',
  ONegative: 'o_negative',
} as const;

export type BloodType = (typeof BloodType)[keyof typeof BloodType];

export const BloodTypeLabel: Record<BloodType, string> = {
  a_positive: 'A+',
  a_negative: 'A-',
  b_positive: 'B+',
  b_negative: 'B-',
  ab_positive: 'AB+',
  ab_negative: 'AB-',
  o_positive: 'O+',
  o_negative: 'O-',
};

export const BLOOD_TYPE_OPTIONS = Object.values(BloodType) as BloodType[];
