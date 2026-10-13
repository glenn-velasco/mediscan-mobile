import { registrationAddressSchema } from '@/lib/validation/registration-medical-info-schema';

describe('registrationAddressSchema Barangay field', () => {
  const address = {
    street: '123 Main Street',
    unit: 'Unit 1',
    city: 'Manila',
    province: 'Metro Manila',
    postal_code: '1000',
    country: 'Philippines',
  };

  it('accepts and preserves a selected barangay', () => {
    const result = registrationAddressSchema.safeParse({ ...address, barangay: 'Barangay 1' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.barangay).toBe('Barangay 1');
  });

  it('requires barangay for Philippine registration', () => {
    const result = registrationAddressSchema.safeParse(address);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ['barangay'], message: 'Barangay is required' }),
    );
  });

  it('allows barangay to be omitted for non-Philippine registration', () => {
    expect(registrationAddressSchema.safeParse({ ...address, country: 'United States' }).success).toBe(true);
  });
});
