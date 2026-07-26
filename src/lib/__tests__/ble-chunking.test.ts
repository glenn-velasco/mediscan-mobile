import { chunkEnvelope, ChunkReassembler, DEFAULT_CHUNK_PAYLOAD_SIZE } from '@/lib/ble-chunking';

function base64Payload(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[i % alphabet.length];
  }
  return out;
}

describe('chunkEnvelope', () => {
  it('splits a payload into chunks no larger than chunkSize plus header, reassembling identically', () => {
    const payload = base64Payload(DEFAULT_CHUNK_PAYLOAD_SIZE * 3 + 17);
    const chunks = chunkEnvelope(payload);

    expect(chunks.length).toBeGreaterThan(1);

    const reassembler = new ChunkReassembler();
    let result;
    for (const chunk of chunks) {
      result = reassembler.addChunk(chunk);
    }

    expect(result).toEqual({ status: 'complete', payload });
  });

  it('produces exactly one chunk for a payload smaller than chunkSize', () => {
    const payload = base64Payload(42);
    const chunks = chunkEnvelope(payload, 150);

    expect(chunks).toHaveLength(1);

    const reassembler = new ChunkReassembler();
    expect(reassembler.addChunk(chunks[0])).toEqual({ status: 'complete', payload });
  });

  it('throws on an empty payload', () => {
    expect(() => chunkEnvelope('')).toThrow();
  });
});

describe('ChunkReassembler', () => {
  it('reports incomplete until every chunk has arrived', () => {
    const payload = base64Payload(400);
    const chunks = chunkEnvelope(payload, 150);
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    const reassembler = new ChunkReassembler();
    for (const chunk of chunks.slice(0, -1)) {
      expect(reassembler.addChunk(chunk)).toEqual({ status: 'incomplete' });
    }
    expect(reassembler.addChunk(chunks[chunks.length - 1])).toEqual({ status: 'complete', payload });
  });

  it('reassembles correctly when chunks arrive out of order', () => {
    const payload = base64Payload(500);
    const chunks = chunkEnvelope(payload, 150);
    expect(chunks).toHaveLength(4);
    const shuffled = [chunks[2], chunks[0], chunks[3], chunks[1]];

    const reassembler = new ChunkReassembler();
    let result;
    for (const chunk of shuffled) {
      result = reassembler.addChunk(chunk);
    }

    expect(result).toEqual({ status: 'complete', payload });
  });

  it('tolerates a duplicate chunk by overwriting rather than corrupting', () => {
    const payload = base64Payload(300);
    const chunks = chunkEnvelope(payload, 150);

    const reassembler = new ChunkReassembler();
    reassembler.addChunk(chunks[0]);
    reassembler.addChunk(chunks[0]);
    const result = reassembler.addChunk(chunks[1]);

    expect(result).toEqual({ status: 'complete', payload });
  });

  it('flags a chunk shorter than the header as corrupted', () => {
    const reassembler = new ChunkReassembler();
    expect(reassembler.addChunk('abc')).toEqual({ status: 'corrupted', reason: 'chunk shorter than header' });
  });

  it('flags a chunk with a non-hex header as corrupted', () => {
    const reassembler = new ChunkReassembler();
    expect(reassembler.addChunk('zzzzzzzzpayload')).toEqual({
      status: 'corrupted',
      reason: 'invalid seq/total header',
    });
  });

  it('flags a chunk whose seq is out of range for its own total as corrupted', () => {
    const reassembler = new ChunkReassembler();
    // seq=0005 total=0002 — seq >= total
    expect(reassembler.addChunk('00050002payload')).toEqual({
      status: 'corrupted',
      reason: 'invalid seq/total header',
    });
  });

  it('flags a total mismatch across chunks from two different envelopes as corrupted', () => {
    const chunksA = chunkEnvelope(base64Payload(400), 150);
    const chunksB = chunkEnvelope(base64Payload(1000), 150);

    const reassembler = new ChunkReassembler();
    reassembler.addChunk(chunksA[0]);
    const result = reassembler.addChunk(chunksB[0]);

    expect(result).toEqual({ status: 'corrupted', reason: 'total mismatch between chunks' });
  });

  it('resets cleanly so a single reassembler instance can be reused across connections', () => {
    const payload = base64Payload(50);
    const chunks = chunkEnvelope(payload, 150);

    const reassembler = new ChunkReassembler();
    reassembler.addChunk(chunks[0]);
    reassembler.reset();

    expect(reassembler.addChunk(chunks[0])).toEqual({ status: 'complete', payload });
  });
});
