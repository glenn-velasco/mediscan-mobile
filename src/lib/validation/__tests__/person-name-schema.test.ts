import { optionalPersonName, personName } from '../person-name-schema';
import { isValidCalendarDate } from '../calendar-date';

describe('person name validation', () => {
  it.each(['Glenn Luis', "O'Neil", 'María-José', 'De la Cruz', 'Jr.'])('accepts %s', (name) => {
    expect(personName('Name').safeParse(name).success).toBe(true);
  });

  it.each(['123', 'John2', 'Ana@Home', 'A_One'])('rejects %s', (name) => {
    expect(personName('Name').safeParse(name).success).toBe(false);
  });

  it('allows an empty optional middle name', () => {
    expect(optionalPersonName('Middle name').safeParse('').success).toBe(true);
  });
});

describe('calendar date validation', () => {
  it('rejects normalized invalid dates', () => {
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
  });

  it('accepts leap day only in a leap year', () => {
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
    expect(isValidCalendarDate('2025-02-29')).toBe(false);
  });
});
