import { invokeFunction, requireAuthUserId } from '@/api/supabase';
import { migrateLegacyMedicalInformation, openPatientPayloads, sealPatientPayload } from '@/api/patient-cloud-crypto';

const mockSecondEq = jest.fn();
const mockFirstEq = jest.fn(() => ({ eq: mockSecondEq }));
const mockUpdate = jest.fn(() => ({ eq: mockFirstEq }));
const mockFrom = jest.fn((_table: string) => ({ update: mockUpdate }));

jest.mock('@/api/supabase', () => ({
  invokeFunction: jest.fn(),
  requireAuthUserId: jest.fn(),
  supabase: { from: (table: string) => mockFrom(table) },
  throwSupabaseError: jest.fn((error) => { throw error; }),
}));

const invoke = invokeFunction as jest.Mock;
const requireUserId = requireAuthUserId as jest.Mock;

beforeEach(() => {
  invoke.mockReset();
  requireUserId.mockReset();
  mockFrom.mockClear();
  mockUpdate.mockClear();
  mockFirstEq.mockClear();
  mockSecondEq.mockReset();
});

it('sends cloud plaintext only to the authenticated crypto function', async () => {
  invoke.mockResolvedValue({ encrypted_payload: 'gcm1:ciphertext' });
  await expect(sealPatientPayload({ blood_type: 'o_positive' })).resolves.toBe('gcm1:ciphertext');
  expect(invoke).toHaveBeenCalledWith('patient-crypto-seal', { value: { blood_type: 'o_positive' } });
});

it('opens a batch and rejects truncated responses', async () => {
  invoke.mockResolvedValueOnce({ values: [{ name: 'Alice' }, { name: 'Bob' }] });
  await expect(openPatientPayloads(['gcm1:first', 'gcm1:second'])).resolves.toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
  expect(invoke).toHaveBeenCalledWith('patient-crypto-open', { values: ['gcm1:first', 'gcm1:second'] });

  invoke.mockResolvedValueOnce({ values: [] });
  await expect(openPatientPayloads(['gcm1:missing'])).rejects.toThrow('Incomplete patient record decryption');
});

it('does not request the network for an empty batch', async () => {
  await expect(openPatientPayloads([])).resolves.toEqual([]);
  expect(invoke).not.toHaveBeenCalled();
});

it('upgrades a legacy profile only if the owned ciphertext is still unchanged', async () => {
  requireUserId.mockResolvedValue('patient-1');
  invoke.mockResolvedValue({ encrypted_payload: 'gcm1:upgraded' });
  mockSecondEq.mockResolvedValue({ error: null });

  await migrateLegacyMedicalInformation('legacy-iv:ciphertext', { first_name: 'Glenn' });

  expect(mockFrom).toHaveBeenCalledWith('medical_information');
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ encrypted_payload: 'gcm1:upgraded' }));
  expect(mockFirstEq).toHaveBeenCalledWith('user_id', 'patient-1');
  expect(mockSecondEq).toHaveBeenCalledWith('encrypted_payload', 'legacy-iv:ciphertext');
});
