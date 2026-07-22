// Always check for typos and sync it with app/Enums/Religion.php
export const Religion = {
  Catholic: 'catholic',
  Christian: 'christian',
  Islam: 'islam',
  Buddhist: 'buddhist',
  Hindu: 'hindu',
  Jewish: 'jewish',
  None: 'none',
  Other: 'other',
} as const;

export type Religion = (typeof Religion)[keyof typeof Religion];

export const ReligionLabel: Record<Religion, string> = {
  catholic: 'Catholic',
  christian: 'Christian',
  islam: 'Islam',
  buddhist: 'Buddhist',
  hindu: 'Hindu',
  jewish: 'Jewish',
  none: 'None',
  other: 'Other',
};

export const RELIGION_OPTIONS = Object.values(Religion) as Religion[];
