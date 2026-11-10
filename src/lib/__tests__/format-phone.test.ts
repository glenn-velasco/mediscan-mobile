import { formatPhoneWithCountryCode, nationalPhoneNumber } from '@/lib/format-phone';

describe('phone formatting', () => {
  it('removes the selected country prefix from an E.164 form fallback', () => {
    expect(nationalPhoneNumber('PH', '+639707164396')).toBe('9707164396');
  });

  it('leaves an already-national input unchanged', () => {
    expect(nationalPhoneNumber('PH', '9707164396')).toBe('9707164396');
  });

  it('formats the selector country and national number once', () => {
    expect(formatPhoneWithCountryCode('PH', nationalPhoneNumber('PH', '+639707164396')))
      .toBe('+63 9707164396');
  });
});
