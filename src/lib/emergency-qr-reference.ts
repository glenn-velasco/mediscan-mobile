export const QR_V3_REFERENCE_PREFIX = 'MEDISCAN:v3-ref:';
const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function buildEmergencyCardReference(token: string): string {
  if (!CARD_TOKEN_PATTERN.test(token)) throw new Error('Invalid emergency card token');
  return `${QR_V3_REFERENCE_PREFIX}${token}`;
}

export function parseEmergencyCardReference(raw: string): string | null {
  if (!raw.startsWith(QR_V3_REFERENCE_PREFIX)) return null;
  const token = raw.slice(QR_V3_REFERENCE_PREFIX.length);
  return CARD_TOKEN_PATTERN.test(token) ? token : null;
}
