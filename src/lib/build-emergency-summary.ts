import type { useAllergies } from '@/features/allergies/useAllergies';
import type { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import type { DiagnosisRow, EmergencyContactRow, MedicationRow } from '@/db/schema';

/**
 * Builds the plaintext emergency summary encoded in the QR. This stays plain, testable text —
 * `src/lib/qr-cipher.ts` applies encryption as a separate wrapping step at the call site, so a
 * generic QR-scanner app sees an opaque blob rather than this text directly. Mirrored by
 * `parseEmergencySummary()` in `src/lib/parse-emergency-summary.ts`, which reverses this exact
 * format after decrypting a scanned QR code.
 */
export function buildEmergencySummary(
  patientId: number,
  generatedAt: Date,
  medicalInformation: NonNullable<ReturnType<typeof useMedicalInformation>['data']>,
  allergies: ReturnType<typeof useAllergies>['data'],
  emergencyContacts: EmergencyContactRow[],
  diagnoses?: DiagnosisRow[],
  medications?: MedicationRow[],
): string {
  const lines = [
    'MEDISCAN EMERGENCY INFO',
    `Patient ID: ${patientId}`,
    `Generated: ${generatedAt.toISOString()}`,
    `Name: ${medicalInformation.full_name || 'Unknown'}`,
    `DOB: ${medicalInformation.date_of_birth || '—'}`,
    `Gender: ${medicalInformation.gender || '—'}`,
    `No blood transfusion: ${medicalInformation.no_blood_transfusion ? 'Yes' : 'No'}`,
    `Phone: ${medicalInformation.phone || '—'}`,
    `Address: ${medicalInformation.address || '—'}`,
  ];

  if (allergies && allergies.length > 0) {
    lines.push('Allergies:');
    for (const allergy of allergies) {
      lines.push(`- ${allergy.allergen} (${allergy.severity}${allergy.reaction ? `, ${allergy.reaction}` : ''})`);
    }
  } else {
    lines.push('Allergies: none recorded');
  }

  if (diagnoses && diagnoses.length > 0) {
    lines.push('Diagnoses:');
    for (const d of diagnoses) {
      const parts = [d.condition, d.severity];
      if (d.date_of_diagnosis) parts.push(d.date_of_diagnosis);
      lines.push(`- ${parts.join(', ')}`);
    }
  } else {
    lines.push('Diagnoses: none recorded');
  }

  if (medications && medications.length > 0) {
    lines.push('Medications:');
    for (const m of medications) {
      lines.push(`- ${m.name}, ${m.dosage}${m.frequency ? `, ${m.frequency}` : ''}`);
    }
  } else {
    lines.push('Medications: none recorded');
  }

  if (emergencyContacts.length > 0) {
    lines.push('Emergency contacts:');
    for (const contact of emergencyContacts) {
      lines.push(`- ${contact.name}${contact.relationship ? ` (${contact.relationship})` : ''}${contact.phone ? ` — ${contact.phone_country_code ? `+${contact.phone_country_code} ` : ''}${contact.phone}` : ''}`);
    }
  }

  return lines.join('\n');
}
