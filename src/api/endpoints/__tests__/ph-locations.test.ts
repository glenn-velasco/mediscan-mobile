import {
  getPhilippineBarangayOptions,
  normalizeLegacyPhilippineAddress,
  PHILIPPINE_BARANGAYS,
  PHILIPPINE_LOCATIONS,
} from '../ph-locations';

describe('bundled Philippine locations', () => {
  it('includes provinces, cities, and postal codes without runtime API data', () => {
    expect(PHILIPPINE_LOCATIONS.source).toBe('https://psgc.cloud/api/v2');
    expect(PHILIPPINE_LOCATIONS.provinces).toContain('Metro Manila');
    expect(PHILIPPINE_LOCATIONS.cities).toContainEqual({
      name: 'City of Manila',
      province: 'Metro Manila',
      postalCode: null,
    });
    expect(PHILIPPINE_LOCATIONS.cities).toContainEqual({
      name: 'Peñarrubia',
      province: 'Abra',
      postalCode: null,
    });
    expect(PHILIPPINE_LOCATIONS.cities.length).toBeGreaterThan(1600);
  });

  it('bundles barangays for offline address selection', () => {
    expect(PHILIPPINE_BARANGAYS.cityCount).toBe(PHILIPPINE_LOCATIONS.cities.length);
    expect(PHILIPPINE_BARANGAYS.barangayCount).toBeGreaterThan(40000);
    expect(getPhilippineBarangayOptions('City of Manila', 'Metro Manila')).toContain('Barangay 1');
    expect(getPhilippineBarangayOptions('Bacungan', 'Zamboanga del Norte')).toContain('Bacungan');
    expect(getPhilippineBarangayOptions(null, 'Metro Manila')).toEqual([]);
  });

  it('restores dropdown fields from a legacy formatted Philippine address', () => {
    expect(normalizeLegacyPhilippineAddress({
      street: "171 Marcoville, Engineers' Hill, City of Baguio, Benguet, 2600 Philippines",
      unit: null,
      city: null,
      province: null,
      postal_code: null,
      country: null,
    })).toEqual({
      street: 'Marcoville',
      unit: '171',
      barangay: "Engineers' Hill",
      city: 'City of Baguio',
      province: 'Benguet',
      postal_code: '2600',
      country: 'Philippines',
    });
  });

  it('preserves structured addresses and does not reinterpret other countries', () => {
    const structured = {
      street: 'Main Street',
      unit: null,
      city: 'Manila',
      province: 'Metro Manila',
      postal_code: '1000',
      country: 'Philippines',
    };
    const foreign = { ...structured, city: null, province: null, country: 'United States' };

    expect(normalizeLegacyPhilippineAddress(structured)).toBe(structured);
    expect(normalizeLegacyPhilippineAddress(foreign)).toBe(foreign);
  });
});
