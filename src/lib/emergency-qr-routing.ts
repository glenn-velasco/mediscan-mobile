/** QR formats decoded by the responder screen, rather than the legacy quick-scan parser. */
export function isResponderQr(raw: string): boolean {
  const value = raw.trim();
  return value.startsWith('MEDISCAN:v2:') || value.startsWith('MEDISCAN:v3-ref:') || value.startsWith('MEDISCAN:v4:');
}
