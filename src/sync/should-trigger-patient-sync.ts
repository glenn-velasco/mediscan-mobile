export function shouldTriggerPatientSync(status: string): boolean {
  return status === 'authenticated';
}
