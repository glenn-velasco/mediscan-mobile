import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/** Returns the digits that belong in PhoneInput when its country selector is rendered separately. */
export function nationalPhoneNumber(
  countryCode: string | null | undefined,
  phone: string | null | undefined,
): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (!trimmed.startsWith("+")) return trimmed;
  try {
    return (
      parsePhoneNumberFromString(
        trimmed,
        countryCode?.toUpperCase() as CountryCode | undefined,
      )?.nationalNumber ?? trimmed.replace(/\D/g, "")
    );
  } catch {
    return trimmed.replace(/\D/g, "");
  }
}

export function formatPhoneWithCountryCode(
  countryCode: string | null | undefined,
  phone: string | null | undefined,
): string {
  if (!phone) return "";
  if (phone.trim().startsWith("+")) return phone.trim();
  if (!countryCode) return phone;
  // If the value is already a numeric dial code (e.g. "63"), use it directly.
  if (/^\d+$/.test(countryCode)) return `+${countryCode} ${phone}`;
  try {
    const dialCode = getCountryCallingCode(
      countryCode.toUpperCase() as CountryCode,
    );
    return `+${dialCode} ${phone}`;
  } catch {
    return phone;
  }
}
