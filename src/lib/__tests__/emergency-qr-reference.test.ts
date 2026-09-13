import { buildEmergencyCardReference, parseEmergencyCardReference, QR_V3_REFERENCE_PREFIX } from '@/lib/emergency-qr-reference';

const TOKEN = 'A'.repeat(43);

describe('dynamic emergency-card QR reference', () => {
  it('round-trips a 256-bit base64url token', () => {
    expect(parseEmergencyCardReference(buildEmergencyCardReference(TOKEN))).toBe(TOKEN);
  });

  it.each([
    '',
    `${QR_V3_REFERENCE_PREFIX}${'A'.repeat(42)}`,
    `${QR_V3_REFERENCE_PREFIX}${'A'.repeat(44)}`,
    `${QR_V3_REFERENCE_PREFIX}${'A'.repeat(42)}+`,
    `https://example.com/${TOKEN}`,
  ])('rejects malformed or foreign references: %s', (value) => {
    expect(parseEmergencyCardReference(value)).toBeNull();
  });
});
