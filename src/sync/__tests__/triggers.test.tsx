import { shouldTriggerPatientSync } from '@/sync/should-trigger-patient-sync';

describe('patient sync trigger authentication gate', () => {
  it.each(['idle', 'unauthenticated'])('does not start patient sync for %s auth state', (status) => {
    expect(shouldTriggerPatientSync(status)).toBe(false);
  });

  it('allows normal patient sync after authentication', () => {
    expect(shouldTriggerPatientSync('authenticated')).toBe(true);
  });
});
