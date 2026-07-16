import type { EnvelopeType } from '@/api/types';

/**
 * Over the relay, `envelope_type` travels alongside the ciphertext as server-side metadata
 * (see PendingSyncEnvelope). BLE has no such side channel — the professional device writes
 * straight to a single envelope_write characteristic — so the envelope type is framed into the
 * same wire payload the ciphertext is chunked from. Values of EnvelopeType never contain '|'.
 */
const DELIMITER = '|';

export function encodeBleEnvelopePayload(envelopeType: EnvelopeType, ciphertextB64: string): string {
  return `${envelopeType}${DELIMITER}${ciphertextB64}`;
}

export function decodeBleEnvelopePayload(raw: string): { envelopeType: string; ciphertextB64: string } | null {
  const index = raw.indexOf(DELIMITER);
  if (index === -1) return null;
  return { envelopeType: raw.slice(0, index), ciphertextB64: raw.slice(index + 1) };
}
