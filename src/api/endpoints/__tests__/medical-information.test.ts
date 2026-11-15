import { getMedicalInformationStorageState, updateMedicalInformation } from '@/api/endpoints/medical-information';
import { sealPatientPayload } from '@/api/patient-cloud-crypto';
import { requireAuthUserId, supabase } from '@/api/supabase';

jest.mock('@/api/patient-cloud-crypto', () => ({
  sealPatientPayload: jest.fn().mockResolvedValue('sealed-payload'),
}));

jest.mock('@/api/supabase', () => ({
  requireAuthUserId: jest.fn().mockResolvedValue('user-1'),
  supabase: { from: jest.fn() },
  throwSupabaseError: jest.fn((error) => { throw error; }),
}));

it('preserves phone fields in the encrypted medical-information payload and syncs public.profiles', async () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ eq }));
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'profiles') return { update };
    return { upsert };
  });

  await updateMedicalInformation(1, {
    email: 'vea@example.com',
    first_name: 'Vea',
    middle_name: 'Morete',
    last_name: 'Capistrano',
    date_of_birth: '2004-03-29',
    gender: 'female',
    phone_country_code: 'PH',
    phone: '9171234567',
  });

  expect(requireAuthUserId).toHaveBeenCalled();
  expect(sealPatientPayload).toHaveBeenCalledWith(expect.objectContaining({
    dob: '2004-03-29',
    phone_country_code: 'PH',
    phone: '9171234567',
  }));
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'user-1', encrypted_payload: 'sealed-payload' }),
    { onConflict: 'user_id' },
  );
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      first_name: 'Vea',
      middle_name: 'Morete',
      last_name: 'Capistrano',
      dob: '2004-03-29',
      gender: 'female',
      phone_number: '+639171234567',
      phone_country_code: 'PH',
    }),
  );
  expect(eq).toHaveBeenCalledWith('id', 'user-1');
});

it.each([
  [null, 'missing'],
  [{ encrypted_payload: 'gcm1:current' }, 'current'],
  [{ encrypted_payload: 'legacy-iv:ciphertext' }, 'legacy'],
] as const)('classifies cloud medical-information storage without exposing it as a new profile', async (data, expected) => {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error: null });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  (supabase.from as jest.Mock).mockReturnValue({ select });

  await expect(getMedicalInformationStorageState()).resolves.toBe(expected);
  expect(select).toHaveBeenCalledWith('encrypted_payload');
  expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
});
