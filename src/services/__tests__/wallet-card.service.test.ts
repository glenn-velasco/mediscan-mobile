import { formatWalletCardTimestamps } from '@/lib/wallet-card-timestamps';

describe('formatWalletCardTimestamps', () => {
  it('returns the card issue date and latest medical publication time', () => {
    const result = formatWalletCardTimestamps('2026-09-01T00:00:00.000Z', '2026-09-12T08:30:00.000Z');

    expect(result.issued).toBe(new Date('2026-09-01T00:00:00.000Z').toLocaleDateString());
    expect(result.updated).toBe(new Date('2026-09-12T08:30:00.000Z').toLocaleString());
  });

  it('makes an unpublished snapshot explicit', () => {
    expect(formatWalletCardTimestamps('2026-09-01T00:00:00.000Z', null).updated).toBe('Not yet published');
  });
});
