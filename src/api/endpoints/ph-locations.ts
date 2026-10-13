import locationsData from '@/data/philippine-locations.json';
import barangaysData from '@/data/philippine-barangays.json';
import type { MedicalInformationAddress } from '@/api/types';

export type PhilippineCity = {
  name: string;
  province: string;
  postalCode: string | null;
};

export type PhilippineLocations = {
  source: string;
  updatedAt: string;
  provinces: string[];
  cities: PhilippineCity[];
};

export type PhilippineBarangays = {
  generatedAt: string;
  source: string;
  sourceVersion: string;
  attribution: string;
  cityCount: number;
  barangayCount: number;
  byCity: Record<string, string[]>;
};

// This bundled PSGC Cloud snapshot is refreshed with app updates, not at runtime.
export const PHILIPPINE_LOCATIONS: PhilippineLocations = locationsData;
export const PHILIPPINE_BARANGAYS: PhilippineBarangays = barangaysData;

export function getPhilippineBarangayOptions(city: string | null, province: string | null): string[] {
  if (!city || !province) return [];
  return PHILIPPINE_BARANGAYS.byCity[`${province}|${city}`] ?? [];
}

export function normalizeLegacyPhilippineAddress(address: MedicalInformationAddress): MedicalInformationAddress {
  if (address.city || address.province) return address;
  if (address.country && address.country.trim().toLowerCase() !== 'philippines') return address;

  const parts = (address.street ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return address;

  const lastPart = parts.at(-1) ?? '';
  const countryMatch = lastPart.match(/^(?:(\d{3,10})\s+)?Philippines$/i);
  if (!countryMatch && address.country?.trim().toLowerCase() !== 'philippines') return address;

  const cityIndex = parts.findIndex((part, index) =>
    PHILIPPINE_LOCATIONS.cities.some((city) => city.name === part && city.province === parts[index + 1]),
  );
  if (cityIndex < 0) return address;

  const city = PHILIPPINE_LOCATIONS.cities.find(
    (candidate) => candidate.name === parts[cityIndex] && candidate.province === parts[cityIndex + 1],
  );
  if (!city) return address;

  const precedingPart = parts[cityIndex - 1];
  const hasBarangay = precedingPart !== undefined &&
    getPhilippineBarangayOptions(city.name, city.province).includes(precedingPart);
  const addressEndIndex = cityIndex - (hasBarangay ? 1 : 0);
  const legacyStreet = parts.slice(0, addressEndIndex).join(', ');
  const streetMatch = legacyStreet.match(/^(\d+[A-Za-z]?)\s+(.+)$/);

  return {
    ...address,
    street: streetMatch?.[2] ?? (legacyStreet || address.street),
    unit: streetMatch?.[1] ?? address.unit,
    barangay: hasBarangay ? precedingPart : null,
    city: city.name,
    province: city.province,
    postal_code: countryMatch?.[1] ?? address.postal_code,
    country: 'Philippines',
  };
}
