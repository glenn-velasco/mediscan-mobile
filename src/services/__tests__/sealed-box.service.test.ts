/**
 * react-native-libsodium's crypto_box_* functions are JSI bindings only available inside a real
 * native runtime — under jest-expo's Node environment `global.jsi_crypto_box_keypair` is never
 * installed, so those calls throw regardless of correctness. Swap in libsodium-wrappers (the same
 * WASM implementation react-native-libsodium itself falls back to on web) directly, bypassing its
 * dynamic `import()` indirection which needs --experimental-vm-modules under Jest's CJS transform.
 */
jest.mock('react-native-libsodium', () => {
  const sodium = require('libsodium-wrappers');
  return { __esModule: true, default: sodium, ready: sodium.ready };
});

import { generateKeypair, seal, unseal } from '@/services/sealed-box.service';

describe('sealed-box.service', () => {
  it('round-trips a plaintext value through seal/unseal with the correct keypair', async () => {
    const keypair = await generateKeypair();
    const message = { allergen: 'Peanuts', severity: 'severe' as const };

    const ciphertext = await seal(message, Buffer.from(keypair.publicKey).toString('base64'));
    const result = await unseal<typeof message>(ciphertext, keypair);

    expect(result).toEqual(message);
  });

  it('returns null instead of throwing when opened with the wrong keypair', async () => {
    const recipient = await generateKeypair();
    const attacker = await generateKeypair();

    const ciphertext = await seal({ note: 'hello' }, Buffer.from(recipient.publicKey).toString('base64'));
    const result = await unseal(ciphertext, attacker);

    expect(result).toBeNull();
  });

  it('returns null instead of throwing on corrupted ciphertext', async () => {
    const keypair = await generateKeypair();
    const result = await unseal('not-valid-base64-ciphertext', keypair);

    expect(result).toBeNull();
  });
});
