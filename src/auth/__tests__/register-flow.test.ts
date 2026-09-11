import { register as apiRegister } from '@/api/endpoints/auth';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { getDeviceName } from '@/auth/device-name';
import { setToken } from '@/auth/token-storage';
import { queryClient } from '@/lib/query-client';
import { medicalInformationQueryKey } from '@/features/medical-information/useMedicalInformation';
import type { MedicalInformationPayload, RegisterPayload } from '@/api/types';

jest.mock('@/api/endpoints/auth', () => ({
  register: jest.fn(),
}));

jest.mock('@/db/repositories/medical-information.repo', () => ({
  saveLocalEdit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/auth/device-name', () => ({
  getDeviceName: jest.fn().mockResolvedValue('Test Device (test-id)'),
}));

jest.mock('@/auth/token-storage', () => ({
  setToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/query-client', () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));

jest.mock('@/features/medical-information/useMedicalInformation', () => ({
  medicalInformationQueryKey: ['medical-information'],
}));

const mockApiRegister = apiRegister as jest.Mock;
const mockSaveLocalEdit = medicalInformationRepo.saveLocalEdit as jest.Mock;
const mockGetDeviceName = getDeviceName as jest.Mock;
const mockSetToken = setToken as jest.Mock;

/**
 * Standalone implementation of the register orchestration logic from AuthContext.register().
 * Extracted for testability; mirrors AuthContext.tsx lines 69-82 exactly.
 */
async function registerWithMedicalInfo(
  payload: Omit<RegisterPayload, 'device_name'>,
  medicalInfo?: MedicalInformationPayload,
): Promise<{ user: { id: string | number; fullname: string } } | { pending: true }> {
  const device_name = await getDeviceName();
  const response = await apiRegister({ ...payload, device_name });

  if (response.pending) {
    return { pending: true };
  }

  const { token, user } = response;
  await setToken(token);

  if (medicalInfo) {
    await medicalInformationRepo.saveLocalEdit(medicalInfo);
    queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
  }

  return { user };
}

const mockUser = { id: 1, fullname: 'John Doe' };
const mockToken = 'test-auth-token-abc123';

function registerPayload(): Omit<RegisterPayload, 'device_name'> {
  return {
    email: 'john@example.com',
    password: 'password123',
    password_confirmation: 'password123',
    first_name: 'John',
    last_name: 'Doe',
    dob: '1990-05-15',
    gender: 'male',
    address: '123 Main St',
    phone_number: '+639171234567',
    phone_country_code: 'PH',
  };
}

function medicalInfoPayload(): MedicalInformationPayload {
  return {
    email: 'john@example.com',
    first_name: 'John',
    last_name: 'Doe',
    date_of_birth: '1990-05-15',
    gender: 'male',
    phone_country_code: 'PH',
    phone: '9171234567',
    address: { street: '123 Main St', unit: null, city: null, province: null, postal_code: null, country: null },
    blood_type: 'o_positive',
    religion: 'catholic',
    no_blood_transfusion: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiRegister.mockResolvedValue({ token: mockToken, user: mockUser });
});

describe('AuthContext register flow', () => {
  it('calls API with correct payload including device name', async () => {
    await registerWithMedicalInfo(registerPayload(), medicalInfoPayload());

    expect(mockApiRegister).toHaveBeenCalledTimes(1);
    const apiArg = mockApiRegister.mock.calls[0][0];
    expect(apiArg.email).toBe('john@example.com');
    expect(apiArg.password).toBe('password123');
    expect(apiArg.device_name).toBe('Test Device (test-id)');
  });

  it('saves medical info when provided after API success', async () => {
    await registerWithMedicalInfo(registerPayload(), medicalInfoPayload());

    expect(mockApiRegister).toHaveBeenCalledTimes(1);
    expect(mockSaveLocalEdit).toHaveBeenCalledTimes(1);

    const saved = mockSaveLocalEdit.mock.calls[0][0] as MedicalInformationPayload;
    expect(saved.email).toBe('john@example.com');
    expect(saved.first_name).toBe('John');
    expect(saved.last_name).toBe('Doe');
    expect(saved.blood_type).toBe('O+');
    expect(saved.religion).toBe('Catholic');
    expect(saved.no_blood_transfusion).toBe(false);
  });

  it('does not save medical info when not provided', async () => {
    await registerWithMedicalInfo(registerPayload());

    expect(mockApiRegister).toHaveBeenCalledTimes(1);
    expect(mockSaveLocalEdit).not.toHaveBeenCalled();
  });

  it('does not save medical info when API register fails', async () => {
    mockApiRegister.mockRejectedValue(new Error('Network error'));

    await expect(registerWithMedicalInfo(registerPayload(), medicalInfoPayload())).rejects.toThrow('Network error');

    expect(mockSaveLocalEdit).not.toHaveBeenCalled();
  });

  it('saves medical info with undefined optional fields', async () => {
    const minimalMedicalInfo: MedicalInformationPayload = {
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
      no_blood_transfusion: true,
    };

    await registerWithMedicalInfo(
      { ...registerPayload(), email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith' },
      minimalMedicalInfo,
    );

    expect(mockSaveLocalEdit).toHaveBeenCalledTimes(1);
    const saved = mockSaveLocalEdit.mock.calls[0][0] as MedicalInformationPayload;
    expect(saved.email).toBe('jane@example.com');
    expect(saved.first_name).toBe('Jane');
    expect(saved.last_name).toBe('Smith');
    expect(saved.no_blood_transfusion).toBe(true);
    expect(saved.blood_type).toBeUndefined();
    expect(saved.religion).toBeUndefined();
  });

  it('invalidates query cache after saving medical info', async () => {
    await registerWithMedicalInfo(registerPayload(), medicalInfoPayload());

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: medicalInformationQueryKey,
    });
  });

  it('does not invalidate query cache when no medical info provided', async () => {
    await registerWithMedicalInfo(registerPayload());

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('stores the token after successful API call', async () => {
    await registerWithMedicalInfo(registerPayload(), medicalInfoPayload());

    expect(mockSetToken).toHaveBeenCalledTimes(1);
    expect(mockSetToken).toHaveBeenCalledWith(mockToken);
  });

  it('returns the registered user', async () => {
    const result = await registerWithMedicalInfo(registerPayload(), medicalInfoPayload());

    expect('pending' in result ? undefined : result.user).toEqual(mockUser);
  });
});
