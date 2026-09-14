import { pullSync } from '@/api/endpoints/sync';
import { openPatientPayloads } from '@/api/patient-cloud-crypto';
import { supabase } from '@/api/supabase';

jest.mock('@/api/supabase', () => ({
  requireAuthUserId: jest.fn().mockResolvedValue('patient-1'),
  supabase: { rpc: jest.fn() },
  throwSupabaseError: jest.fn((error) => { throw error; }),
}));
jest.mock('@/api/patient-cloud-crypto', () => ({ openPatientPayloads: jest.fn() }));

const rpc = supabase.rpc as jest.Mock;
const open = openPatientPayloads as jest.Mock;

beforeEach(() => { rpc.mockReset(); open.mockReset(); });

it('decrypts all current rows in one batch and ignores unreadable development rows', async () => {
  rpc.mockResolvedValue({ error: null, data: {
    server_time: '2026-09-14T00:00:00Z',
    medical_information: { encrypted_payload: 'gcm1:medical', updated_at: '2026-09-14T00:00:00Z' },
    allergies: [
      { id: 'a', encrypted_payload: 'gcm1:allergy', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
      { id: 'legacy', encrypted_payload: 'iv:old', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
    ],
    conditions: [], diagnoses: [], medications: [], emergency_contacts: [],
  } });
  open.mockResolvedValue([{ first_name: 'Alice' }, { allergen: 'Peanut' }]);

  const result = await pullSync();
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(['gcm1:medical', 'gcm1:allergy']);
  expect(result.medical_information).toMatchObject({ first_name: 'Alice' });
  expect(result.allergies).toEqual([expect.objectContaining({ id: 'a', allergen: 'Peanut' })]);
});
