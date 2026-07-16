export const SUFFIX_OPTIONS = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'] as const;

export type Suffix = (typeof SUFFIX_OPTIONS)[number];
