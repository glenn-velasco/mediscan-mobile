import { ageFromDateOfBirth } from '../age-from-date-of-birth';

describe('ageFromDateOfBirth', () => {
  const today = new Date(2026, 8, 19);

  it('uses completed years rather than subtracting birth years', () => {
    expect(ageFromDateOfBirth('2002-03-29', today)).toBe(24);
    expect(ageFromDateOfBirth('2002-12-29', today)).toBe(23);
  });

  it('does not turn missing or invalid dates into zero', () => {
    expect(ageFromDateOfBirth(null, today)).toBeNull();
    expect(ageFromDateOfBirth('2026-02-30', today)).toBeNull();
    expect(ageFromDateOfBirth('2027-01-01', today)).toBeNull();
  });
});
