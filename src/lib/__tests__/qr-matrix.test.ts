import { buildQrPath, createQrMatrix } from '@/lib/qr-matrix';

describe('qr-matrix', () => {
  it('generates a module matrix and SVG path for standard text', () => {
    const matrix = createQrMatrix('MEDISCAN:v2:test-payload');
    expect(matrix).not.toBeNull();
    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix!.length).toBeGreaterThan(0);

    const path = buildQrPath(matrix!, 2);
    expect(typeof path).toBe('string');
    expect(path.startsWith('M')).toBe(true);
  });

  it('returns null instead of throwing when the payload exceeds maximum QR capacity', () => {
    const oversized = 'A'.repeat(20000);
    expect(() => {
      const result = createQrMatrix(oversized);
      expect(result).toBeNull();
    }).not.toThrow();
  });
});
