import { useMutation } from '@tanstack/react-query';

import { submitToPatient } from '@/services/professional-submission.service';
import type { EnvelopeType } from '@/api/types';

export type SubmitEnvelopeParams = {
  patientId: number;
  envelopeType: EnvelopeType;
  payload: unknown;
};

/** Scenario 2 (patient not physically present) submission over the relay — Scenario 1 goes through ble-central.service.ts directly, wired up alongside the BLE scan/submit screen in Phase 7. */
export function useSubmitEnvelope() {
  return useMutation({
    mutationFn: ({ patientId, envelopeType, payload }: SubmitEnvelopeParams) => submitToPatient(patientId, envelopeType, payload),
  });
}
