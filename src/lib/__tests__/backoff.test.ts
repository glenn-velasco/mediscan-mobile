import { backoffDelayMs } from '@/lib/backoff';

describe('backoffDelayMs', () => {
  it('doubles from a 5s base on each successive attempt', () => {
    expect(backoffDelayMs(0)).toBe(5_000);
    expect(backoffDelayMs(1)).toBe(10_000);
    expect(backoffDelayMs(2)).toBe(20_000);
    expect(backoffDelayMs(3)).toBe(40_000);
  });

  it('caps at 5 minutes regardless of how high the attempt count climbs', () => {
    expect(backoffDelayMs(10)).toBe(5 * 60_000);
    expect(backoffDelayMs(100)).toBe(5 * 60_000);
  });
});
