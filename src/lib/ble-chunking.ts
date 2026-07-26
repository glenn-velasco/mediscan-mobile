/**
 * Length-prefixed chunk/reassembly protocol for writing a sealed envelope
 * (a base64 ciphertext string, possibly several hundred bytes to a few KB)
 * over a BLE characteristic whose single-write payload is far smaller
 * (~20 bytes unnegotiated, ~185-500 bytes with MTU negotiation, not
 * guaranteed uniform across devices/OS versions).
 *
 * Each chunk is plain text: an 8-hex-char header (4 hex chars seq, 4 hex
 * chars total — supports up to 65535 chunks, far beyond any realistic
 * envelope size) followed by a slice of the base64 payload. Implemented
 * identically here and on both native sides is unnecessary — chunking only
 * ever happens in JS (ble-central.service.ts, professional side); native
 * peripheral code just forwards raw chunk strings up to
 * ble-peripheral.service.ts, which reassembles them with ChunkReassembler.
 */

const HEADER_LENGTH = 8;

/** Conservative default: safe under the ~185-byte negotiated MTU floor most devices reach. */
export const DEFAULT_CHUNK_PAYLOAD_SIZE = 150;

export function chunkEnvelope(payloadB64: string, chunkSize: number = DEFAULT_CHUNK_PAYLOAD_SIZE): string[] {
  if (payloadB64.length === 0) {
    throw new Error('chunkEnvelope: payload must not be empty');
  }
  const total = Math.ceil(payloadB64.length / chunkSize);
  if (total > 0xffff) {
    throw new Error(`chunkEnvelope: payload too large to chunk (${total} chunks exceeds 65535 limit)`);
  }
  const totalHex = total.toString(16).padStart(4, '0');
  const chunks: string[] = [];
  for (let seq = 0; seq < total; seq++) {
    const seqHex = seq.toString(16).padStart(4, '0');
    const slice = payloadB64.slice(seq * chunkSize, (seq + 1) * chunkSize);
    chunks.push(`${seqHex}${totalHex}${slice}`);
  }
  return chunks;
}

export type ReassemblyResult =
  | { status: 'incomplete' }
  | { status: 'complete'; payload: string }
  | { status: 'corrupted'; reason: string };

export class ChunkReassembler {
  private total: number | null = null;
  private chunks = new Map<number, string>();

  addChunk(raw: string): ReassemblyResult {
    if (raw.length < HEADER_LENGTH) {
      return { status: 'corrupted', reason: 'chunk shorter than header' };
    }
    const seq = parseInt(raw.slice(0, 4), 16);
    const total = parseInt(raw.slice(4, 8), 16);
    if (Number.isNaN(seq) || Number.isNaN(total) || total <= 0 || seq < 0 || seq >= total) {
      return { status: 'corrupted', reason: 'invalid seq/total header' };
    }
    if (this.total === null) {
      this.total = total;
    } else if (this.total !== total) {
      return { status: 'corrupted', reason: 'total mismatch between chunks' };
    }

    this.chunks.set(seq, raw.slice(HEADER_LENGTH));

    if (this.chunks.size < this.total) {
      return { status: 'incomplete' };
    }

    const parts: string[] = [];
    for (let i = 0; i < this.total; i++) {
      const part = this.chunks.get(i);
      if (part === undefined) {
        // size matched total but an index is missing — unreachable given Map
        // semantics (unique keys 0..total-1), guarded defensively anyway.
        return { status: 'corrupted', reason: `missing chunk ${i}` };
      }
      parts.push(part);
    }
    return { status: 'complete', payload: parts.join('') };
  }

  reset(): void {
    this.total = null;
    this.chunks.clear();
  }
}
