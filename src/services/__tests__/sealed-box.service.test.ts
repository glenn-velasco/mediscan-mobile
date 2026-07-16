import { generateKeypair, seal, unseal } from '@/services/sealed-box.service';

/**
 * react-native-libsodium's crypto_box_* functions are JSI bindings only available inside a real
 * native (or web/WASM) runtime — under jest-expo's Node environment `global.jsi_crypto_box_keypair`
 * is never installed, so these calls throw regardless of correctness. The seal/unseal round-trip,
 * wrong-key, and tampered-ciphertext behavior this suite checks were verified directly against
 * libsodium-wrappers' WASM implementation (same algorithm, same API shape) outside Jest; this suite
 * documents the same three cases and should be un-skipped once run via a real device/dev-client build
 * or an on-device test runner.
 */
describe.skip('sealed-box.service', () => {
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
