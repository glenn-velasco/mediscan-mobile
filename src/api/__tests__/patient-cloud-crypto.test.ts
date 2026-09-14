import { invokeFunction } from '@/api/supabase';
import { openPatientPayloads, sealPatientPayload } from '@/api/patient-cloud-crypto';

jest.mock('@/api/supabase', () => ({ invokeFunction: jest.fn() }));

const invoke = invokeFunction as jest.Mock;

beforeEach(() => invoke.mockReset());

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
