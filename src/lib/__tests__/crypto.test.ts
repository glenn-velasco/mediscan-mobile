import { encryptField, decryptField, encryptJson, decryptJson } from '@/lib/crypto';

describe('encryptField / decryptField', () => {
  it('round-trips a plain string', async () => {
    const ciphertext = await encryptField('Peanuts');
    expect(ciphertext).not.toBeNull();
    expect(ciphertext).not.toContain('Peanuts');

    expect(await decryptField(ciphertext)).toBe('Peanuts');
  });

  it('returns null for null/undefined input without throwing', async () => {
    expect(await encryptField(null)).toBeNull();
    expect(await encryptField(undefined)).toBeNull();
  });

  it('decryptField returns null for null/empty/malformed input', async () => {
    expect(await decryptField(null)).toBeNull();
    expect(await decryptField(undefined)).toBeNull();
    expect(await decryptField('')).toBeNull();
    expect(await decryptField('not-a-valid-payload')).toBeNull();
  });

  it('produces a different ciphertext each time (random IV per call), same plaintext either way', async () => {
    const first = await encryptField('Metformin');
    const second = await encryptField('Metformin');

    expect(first).not.toBe(second);
    expect(await decryptField(first)).toBe('Metformin');
    expect(await decryptField(second)).toBe('Metformin');
  });

  it('is independent of encryptJson/decryptJson (different serialization, same key/IV scheme)', async () => {
    const fieldCiphertext = await encryptField('hello');
    // encryptJson JSON-stringifies before encrypting, so decryptField (which does not
    // JSON.parse) would return the literal quoted string, not equal to decryptJson's output.
    const jsonCiphertext = await encryptJson('hello');

    expect(await decryptField(fieldCiphertext)).toBe('hello');
    expect(await decryptJson<string>(jsonCiphertext)).toBe('hello');
  });
});
