/**
 * Static symmetric key (`crypto_secretbox_KEYBYTES`, generated once via `sodium.crypto_secretbox_keygen()`)
 * used to encrypt the emergency-info QR payload — see `src/lib/qr-cipher.ts`.
 *
 * This is NOT a secrecy boundary: the key ships inside the app bundle, so anyone who decompiles the
 * app can recover it. Its purpose is narrower — it stops a generic QR-scanner app from showing raw
 * medical text, and it funnels every read through this app so scan events can be logged for analytics.
 * Real secrecy for the relay-submission path is handled separately via per-device sealed-box keys
 * (see `src/services/sealed-box.service.ts`).
 */
export const QR_CIPHER_KEY_B64 = 'Dwx7M5miEbSuym2BqHIzz/g0id41OYDYl6CqlHhQJF4=';
