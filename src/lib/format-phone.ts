import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

export function formatPhoneWithCountryCode(
  countryCode: string | null | undefined,
  phone: string | null | undefined,
): string {
  if (!phone) return '';
  if (!countryCode) return phone;
  try {
    const dialCode = getCountryCallingCode(countryCode.toUpperCase() as CountryCode);
    return `+${dialCode} ${phone}`;
  } catch {
    return phone;
  }
}
