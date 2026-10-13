import type { MedicalInformationAddress } from '@/api/types';

/** Joins the structured address into a single human-readable line, e.g. for the QR emergency summary or a read-only card. */
export function formatAddress(address: MedicalInformationAddress | null | undefined): string {
  if (!address) return '';
  const { unit, street, barangay, city, province, postal_code, country } = address;
  const meaningful = (value: string | null | undefined) => {
    const normalized = value?.trim();
    return normalized && normalized !== '—' && normalized !== '-' ? normalized : null;
  };
  const line1 = [meaningful(unit), meaningful(street)].filter(Boolean).join(' ');
  const line2 = [meaningful(barangay), meaningful(city), meaningful(province)].filter(Boolean).join(', ');
  const line3 = [meaningful(postal_code), meaningful(country)].filter(Boolean).join(' ');
  return [line1, line2, line3].filter(Boolean).join(', ');
}
