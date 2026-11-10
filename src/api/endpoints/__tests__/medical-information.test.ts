import { updateMedicalInformation } from '@/api/endpoints/medical-information';
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

it('preserves phone fields in the encrypted medical-information payload', async () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  (supabase.from as jest.Mock).mockReturnValue({ upsert });

  await updateMedicalInformation(1, {
    email: 'vea@example.com',
    first_name: 'Vea',
    last_name: 'Capistrano',
    phone_country_code: 'PH',
    phone: '9171234567',
  });

  expect(requireAuthUserId).toHaveBeenCalled();
  expect(sealPatientPayload).toHaveBeenCalledWith(expect.objectContaining({
    phone_country_code: 'PH',
    phone: '9171234567',
  }));
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'user-1', encrypted_payload: 'sealed-payload' }),
    { onConflict: 'user_id' },
  );
});
