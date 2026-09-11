import { getPatientPublicKey, submitEnvelope } from '@/api/endpoints/professional-sync';
import { seal } from '@/services/sealed-box.service';
import { ApiError } from '@/api/errors';
import type { EnvelopeType } from '@/api/types';

export class PatientKeyNotFoundError extends Error {
  constructor() {
    super('This patient has not registered a device yet.');
    this.name = 'PatientKeyNotFoundError';
  }
}

/**
 * Seals and submits an envelope to a patient via the relay. This is Scenario 2 (patient not physically
 * present) — Scenario 1 (both devices present, over BLE) is handled separately by ble-central.service.ts,
 * which performs its own seal step using the public key read directly off the patient's peripheral.
 */
export async function submitToPatient(
  patientId: string | number,
  envelopeType: EnvelopeType,
  payload: unknown,
  itemIdentifier?: string,
): Promise<void> {
  let publicKey: string;
  try {
    const result = await getPatientPublicKey(patientId);
    publicKey = result.public_key;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) throw new PatientKeyNotFoundError();
    throw err;
  }

  const ciphertext = await seal(payload, publicKey);
  await submitEnvelope(patientId, {
    ciphertext,
    envelope_type: envelopeType,
    ...(itemIdentifier ? { item_identifier: itemIdentifier } : {}),
  });
}
