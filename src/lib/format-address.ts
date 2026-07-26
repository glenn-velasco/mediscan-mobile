import type { MedicalInformationAddress } from '@/api/types';

/** Joins the structured address into a single human-readable line, e.g. for the QR emergency summary or a read-only card. */
export function formatAddress(address: MedicalInformationAddress | null | undefined): string {
  if (!address) return '';
  const { unit, street, city, province, postal_code, country } = address;
  const line1 = [unit, street].filter(Boolean).join(' ');
  const line2 = [city, province].filter(Boolean).join(', ');
  const line3 = [postal_code, country].filter(Boolean).join(' ');
  return [line1, line2, line3].filter(Boolean).join(', ');
}
