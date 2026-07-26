import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { formatAddress } from '@/lib/format-address';
import type { MedicalInformationAddress } from '@/api/types';

/**
 * Builds the API register payload and medical info payload from form state.
 * Extracted from register.tsx onSubmit for testability.
 *
 * There is a single structured `address` collected once (medical details step); the flat
 * `users.address` string sent in registerPayload is derived from it via `formatAddress`,
 * rather than being a second, separately-typed address field (see register.tsx).
 */
function buildRegisterPayloads(
  formData: {
    firstName: string;
    middleName: string;
    lastName: string;
    suffix?: string;
    email: string;
    password: string;
    passwordConfirmation: string;
    dateOfBirth: string;
    gender: string;
    phoneCountryCode: string;
    phone: string;
    address: MedicalInformationAddress;
    bloodType?: string;
    religion?: string;
    noBloodTransfusion: boolean;
  },
) {
  let phoneNumber = '';
  if (formData.phone && formData.phoneCountryCode) {
    const parsed = parsePhoneNumberFromString(formData.phone, formData.phoneCountryCode as any);
    phoneNumber = parsed ? parsed.number : `+${formData.phoneCountryCode}${formData.phone}`;
  }

  const registerPayload = {
    email: formData.email,
    password: formData.password,
    password_confirmation: formData.passwordConfirmation,
    first_name: formData.firstName,
    middle_name: formData.middleName,
    last_name: formData.lastName,
    suffix: formData.suffix,
    dob: formData.dateOfBirth,
    gender: formData.gender.toLowerCase(),
    address: formatAddress(formData.address),
    phone_number: phoneNumber,
    phone_country_code: formData.phoneCountryCode,
  };

  const medicalInfo = {
    email: formData.email,
    first_name: formData.firstName,
    middle_name: formData.middleName,
    last_name: formData.lastName,
    suffix: formData.suffix,
    date_of_birth: formData.dateOfBirth || undefined,
    gender: formData.gender || undefined,
    phone_country_code: formData.phoneCountryCode || undefined,
    phone: formData.phone || undefined,
    address: formData.address,
    blood_type: formData.bloodType || undefined,
    religion: formData.religion || undefined,
    no_blood_transfusion: formData.noBloodTransfusion,
  };

  return { registerPayload, medicalInfo };
}

describe('register payload construction', () => {
  const fullFormData = {
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    suffix: 'Jr.',
    email: 'john@example.com',
    password: 'password123',
    passwordConfirmation: 'password123',
    dateOfBirth: '1990-05-15',
    gender: 'Male',
    phoneCountryCode: 'PH',
    phone: '9171234567',
    address: {
      street: '123 Main Street',
      unit: null,
      city: 'Manila',
      province: 'Metro Manila',
      postal_code: '1000',
      country: 'Philippines',
    } as MedicalInformationAddress,
    bloodType: 'O+',
    religion: 'Catholic',
    noBloodTransfusion: false,
  };

  it('constructs registerPayload with all fields filled', () => {
    const { registerPayload } = buildRegisterPayloads(fullFormData);

    expect(registerPayload.email).toBe('john@example.com');
    expect(registerPayload.password).toBe('password123');
    expect(registerPayload.password_confirmation).toBe('password123');
    expect(registerPayload.first_name).toBe('John');
    expect(registerPayload.middle_name).toBe('Michael');
    expect(registerPayload.last_name).toBe('Doe');
    expect(registerPayload.suffix).toBe('Jr.');
    expect(registerPayload.dob).toBe('1990-05-15');
    expect(registerPayload.address).toBe('123 Main Street, Manila');
    expect(registerPayload.phone_country_code).toBe('PH');
  });

  it('lowercases gender in registerPayload', () => {
    const { registerPayload } = buildRegisterPayloads({ ...fullFormData, gender: 'Male' });
    expect(registerPayload.gender).toBe('male');

    const femaleResult = buildRegisterPayloads({ ...fullFormData, gender: 'Female' });
    expect(femaleResult.registerPayload.gender).toBe('female');
  });

  it('constructs medicalInfo with all fields', () => {
    const { medicalInfo } = buildRegisterPayloads(fullFormData);

    expect(medicalInfo.email).toBe('john@example.com');
    expect(medicalInfo.first_name).toBe('John');
    expect(medicalInfo.middle_name).toBe('Michael');
    expect(medicalInfo.last_name).toBe('Doe');
    expect(medicalInfo.suffix).toBe('Jr.');
    expect(medicalInfo.date_of_birth).toBe('1990-05-15');
    expect(medicalInfo.gender).toBe('Male');
    expect(medicalInfo.phone_country_code).toBe('PH');
    expect(medicalInfo.phone).toBe('9171234567');
    expect(medicalInfo.address).toEqual(fullFormData.address);
    expect(medicalInfo.blood_type).toBe('O+');
    expect(medicalInfo.religion).toBe('Catholic');
    expect(medicalInfo.no_blood_transfusion).toBe(false);
  });

  it('maps noBloodTransfusion to medicalInfo', () => {
    const { medicalInfo } = buildRegisterPayloads({ ...fullFormData, noBloodTransfusion: true });
    expect(medicalInfo.no_blood_transfusion).toBe(true);
  });

  it('handles optional fields as undefined when empty', () => {
    const { medicalInfo } = buildRegisterPayloads({
      ...fullFormData,
      middleName: '',
      suffix: undefined,
      bloodType: undefined,
      religion: '',
    });

    expect(medicalInfo.middle_name).toBe('');
    expect(medicalInfo.suffix).toBeUndefined();
    expect(medicalInfo.blood_type).toBeUndefined();
    // Empty religion string maps to undefined via || undefined
    expect(medicalInfo.religion).toBeUndefined();
  });

  it('formats phone number with country code', () => {
    const { registerPayload } = buildRegisterPayloads({
      ...fullFormData,
      phone: '9171234567',
      phoneCountryCode: 'PH',
    });

    // Should produce a formatted phone number
    expect(registerPayload.phone_number).toBeTruthy();
    expect(registerPayload.phone_number).toContain('+63');
  });

  it('handles empty phone gracefully', () => {
    const { registerPayload } = buildRegisterPayloads({
      ...fullFormData,
      phone: '',
      phoneCountryCode: 'PH',
    });

    expect(registerPayload.phone_number).toBe('');
  });

  it('handles empty phone country code gracefully', () => {
    const { registerPayload } = buildRegisterPayloads({
      ...fullFormData,
      phone: '5551234',
      phoneCountryCode: '',
    });

    expect(registerPayload.phone_number).toBe('');
  });

  it('keeps gender as-is in medicalInfo (not lowercased)', () => {
    const { medicalInfo } = buildRegisterPayloads({ ...fullFormData, gender: 'Male' });
    expect(medicalInfo.gender).toBe('Male');
  });

  it('does not include password in medicalInfo', () => {
    const { medicalInfo } = buildRegisterPayloads(fullFormData);
    expect(medicalInfo).not.toHaveProperty('password');
    expect(medicalInfo).not.toHaveProperty('password_confirmation');
  });
});
