import { decryptQrPayload, encryptQrPayload } from '@/lib/qr-cipher';

/**
 * `decryptQrPayload` checks the `MEDISCAN-ENC:v1:` prefix before it ever touches libsodium, so the
 * "is this even one of ours?" gate is testable in Node. Everything past that prefix needs the JSI
 * bindings — see the skipped suite below.
 */
describe('decryptQrPayload rejecting foreign QR codes', () => {
  it.each([
    ['a plain URL from any other QR code', 'https://example.com'],
    ['an empty string', ''],
    ['unprefixed base64 that looks encrypted', 'aGVsbG8gd29ybGQ='],
    ['our prefix misspelled', 'MEDISCAN-ENC:v2:aGVsbG8='],
    ['the plaintext summary itself, unencrypted', 'MEDISCAN EMERGENCY INFO\nPatient ID: 1'],
  ])('returns null rather than throwing for %s', async (_label, input) => {
    await expect(decryptQrPayload(input)).resolves.toBeNull();
  });

  it('is the single gate the scanner relies on, so it never rejects by throwing', async () => {
    // The scan handler treats a null return as "not a MediScan QR"; an exception would crash it.
    const results = await Promise.all(
      ['', 'nonsense', 'MEDISCAN-ENC:', 'MEDISCAN-ENC:v1'].map((value) => decryptQrPayload(value)),
    );

    expect(results).toEqual([null, null, null, null]);
  });
});

/**
 * react-native-libsodium's crypto_secretbox_* functions are JSI bindings only available inside a
 * real native (or web/WASM) runtime — under jest-expo's Node environment the bindings are never
 * installed, so these calls throw regardless of correctness. This mirrors the same limitation
 * documented in `src/services/__tests__/sealed-box.service.test.ts`. The round-trip and
 * unique-nonce behaviour below were confirmed on-device; un-skip this suite once these run via a
 * real device/dev-client build or an on-device test runner.
 */
describe.skip('qr-cipher round-trip (requires libsodium JSI)', () => {
  const plaintext = 'MEDISCAN EMERGENCY INFO\nPatient ID: 1\nName: Glenn Gain Velasco';

  it('round-trips the emergency summary through encrypt/decrypt', async () => {
    const encrypted = await encryptQrPayload(plaintext);

    await expect(decryptQrPayload(encrypted)).resolves.toBe(plaintext);
  });

  it('tags the payload with the versioned prefix a scanner keys off', async () => {
    const encrypted = await encryptQrPayload(plaintext);

    expect(encrypted.startsWith('MEDISCAN-ENC:v1:')).toBe(true);
  });

  /**
   * A fresh nonce per call is why the dashboard, widget and notification QRs never look identical
   * even when they encode the same profile — worth pinning so nobody "optimises" it into a
   * deterministic nonce.
   */
  it('produces different ciphertext each time despite identical input', async () => {
    const first = await encryptQrPayload(plaintext);
    const second = await encryptQrPayload(plaintext);

    expect(first).not.toBe(second);
    await expect(decryptQrPayload(first)).resolves.toBe(plaintext);
    await expect(decryptQrPayload(second)).resolves.toBe(plaintext);
  });

  it('returns null for a correctly prefixed but tampered payload', async () => {
    const encrypted = await encryptQrPayload(plaintext);
    const tampered = `${encrypted.slice(0, -4)}AAAA`;

    await expect(decryptQrPayload(tampered)).resolves.toBeNull();
  });
});
