import { isResponderQr } from '@/lib/emergency-qr-routing';

describe('quick-scan QR routing', () => {
  it.each(['MEDISCAN:handoff:1:encrypted', `MEDISCAN:handoff:2:${'a'.repeat(43)}`, 'MEDISCAN:handoff:3:abcdef123456:1:2:chunk', 'MEDISCAN:v2:signed', 'MEDISCAN:v3-ref:token', 'MEDISCAN:v4:hybrid'])('opens the responder scanner for %s', (raw) => {
    expect(isResponderQr(raw)).toBe(true);
  });

  it('keeps foreign and legacy payloads out of the responder route', () => {
    expect(isResponderQr('https://example.com')).toBe(false);
    expect(isResponderQr('legacy-encrypted-summary')).toBe(false);
  });
});
