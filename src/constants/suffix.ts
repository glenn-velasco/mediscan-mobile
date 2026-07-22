// Always check for typos and sync it with app/Enums/NameSuffix.php
export const Suffix = {
  Junior: 'junior',
  Senior: 'senior',
  TheSecond: 'the_second',
  TheThird: 'the_third',
  TheForth: 'the_forth',
  TheFifth: 'the_fifth',
} as const;

export type Suffix = (typeof Suffix)[keyof typeof Suffix];

export const SuffixLabel: Record<Suffix, string> = {
  junior: 'Jr',
  senior: 'Sr',
  the_second: 'Ⅱ',
  the_third: 'Ⅲ',
  the_forth: 'Ⅳ',
  the_fifth: '.Ⅴ',
};

export const SUFFIX_OPTIONS = Object.values(Suffix) as Suffix[];
