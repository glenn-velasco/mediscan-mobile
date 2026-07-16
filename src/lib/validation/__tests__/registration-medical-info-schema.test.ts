import { registrationMedicalInfoSchema } from '@/lib/validation/registration-medical-info-schema';

describe('registrationMedicalInfoSchema', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const validData = {
    date_of_birth: yesterdayStr,
    gender: 'Male',
    phone_country_code: 'PH',
    phone: '9171234567',
    address: '123 Main Street, Manila',
    blood_type: 'O+',
    religion: 'Catholic',
    no_blood_transfusion: false,
  };

  it('accepts valid medical info during registration', () => {
    const result = registrationMedicalInfoSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects empty date of birth', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, date_of_birth: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.path[0]);
      expect(errors).toContain('date_of_birth');
    }
  });

  it('rejects a future date of birth', () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 1);
    const futureStr = future.toISOString().split('T')[0];
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, date_of_birth: futureStr });
    expect(result.success).toBe(false);
  });

  it('rejects today as date of birth (must be before today)', () => {
    // Construct a local YYYY-MM-DD string correctly
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, date_of_birth: todayStr });
    // The schema requires the date to be strictly before today
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, date_of_birth: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects missing gender', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, gender: undefined });
    expect(result.success).toBe(false);
  });

  it('rejects invalid gender value', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, gender: 'Other' });
    expect(result.success).toBe(false);
  });

  it('accepts both Male and Female genders', () => {
    const maleResult = registrationMedicalInfoSchema.safeParse({ ...validData, gender: 'Male' });
    expect(maleResult.success).toBe(true);

    const femaleResult = registrationMedicalInfoSchema.safeParse({ ...validData, gender: 'Female' });
    expect(femaleResult.success).toBe(true);
  });

  it('rejects empty phone country code', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, phone_country_code: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty phone number', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, phone: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty address', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, address: '' });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields omitted (blood_type, religion, no_blood_transfusion)', () => {
    const result = registrationMedicalInfoSchema.safeParse({
      date_of_birth: yesterdayStr,
      gender: 'Female',
      phone_country_code: 'US',
      phone: '5551234567',
      address: '456 Oak Ave',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid blood type', () => {
    const result = registrationMedicalInfoSchema.safeParse({ ...validData, blood_type: 'XYZ' });
    expect(result.success).toBe(false);
  });

  it('accepts valid blood types (A+, A-, B+, B-, AB+, AB-, O+, O-)', () => {
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    for (const bt of bloodTypes) {
      const result = registrationMedicalInfoSchema.safeParse({ ...validData, blood_type: bt });
      expect(result.success).toBe(true);
    }
  });
});
