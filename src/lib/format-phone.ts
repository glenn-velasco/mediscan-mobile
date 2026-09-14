import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

export function formatPhoneWithCountryCode(
  countryCode: string | null | undefined,
  phone: string | null | undefined,
): string {
  if (!phone) return '';
  if (phone.trim().startsWith('+')) return phone.trim();
  if (!countryCode) return phone;
  // If the value is already a numeric dial code (e.g. "63"), use it directly.
  if (/^\d+$/.test(countryCode)) return `+${countryCode} ${phone}`;
  try {
    const dialCode = getCountryCallingCode(countryCode.toUpperCase() as CountryCode);
    return `+${dialCode} ${phone}`;
  } catch {
    return phone;
  }
}
