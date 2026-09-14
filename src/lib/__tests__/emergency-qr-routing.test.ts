import { isResponderQr } from '@/lib/emergency-qr-routing';

describe('quick-scan QR routing', () => {
  it.each(['MEDISCAN:v2:signed', 'MEDISCAN:v3-ref:token', 'MEDISCAN:v4:hybrid'])('opens the responder scanner for %s', (raw) => {
    expect(isResponderQr(raw)).toBe(true);
  });

  it('keeps foreign and legacy payloads out of the responder route', () => {
    expect(isResponderQr('https://example.com')).toBe(false);
    expect(isResponderQr('legacy-encrypted-summary')).toBe(false);
  });
});
