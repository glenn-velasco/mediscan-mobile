import type { useAllergies } from '@/features/allergies/useAllergies';
import type { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import type { ConditionRow, DiagnosisRow, EmergencyContactRow, MedicationRow } from '@/db/schema';
import { parseStoredAddress } from '@/db/repositories/medical-information.repo';

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
  conditions?: ConditionRow[],
): string {
  // Name and address are also carried as separate structured fields (below the human-readable
  // "Name" line) so parseEmergencySummary() can populate the "Manage info" form's discrete
  // fields (first/middle/last name, suffix, street/unit/city/etc.) directly instead of having to
  // reverse-guess them by splitting a single formatted display string.
  const address = parseStoredAddress(medicalInformation.address);

  const lines = [
    'MEDISCAN EMERGENCY INFO',
    `Patient ID: ${patientId}`,
    `Generated: ${generatedAt.toISOString()}`,
    `Name: ${medicalInformation.full_name || 'Unknown'}`,
    `First name: ${medicalInformation.first_name || '—'}`,
    `Middle name: ${medicalInformation.middle_name || '—'}`,
    `Last name: ${medicalInformation.last_name || '—'}`,
    `Suffix: ${medicalInformation.suffix || '—'}`,
    `DOB: ${medicalInformation.date_of_birth || '—'}`,
    `Gender: ${medicalInformation.gender || '—'}`,
    `Blood type: ${medicalInformation.blood_type || '—'}`,
    `Religion: ${medicalInformation.religion || '—'}`,
    `No blood transfusion: ${medicalInformation.no_blood_transfusion ? 'Yes' : 'No'}`,
    `Phone: ${medicalInformation.phone || '—'}`,
    `Phone country code: ${medicalInformation.phone_country_code || '—'}`,
    `Street: ${address?.street || '—'}`,
    `Unit: ${address?.unit || '—'}`,
    `City: ${address?.city || '—'}`,
    `Province: ${address?.province || '—'}`,
    `Postal code: ${address?.postal_code || '—'}`,
    `Country: ${address?.country || '—'}`,
  ];

  if (allergies && allergies.length > 0) {
    lines.push('Allergies:');
    for (const allergy of allergies) {
      lines.push(`- ${allergy.allergen} (${allergy.severity}${allergy.reaction ? `, ${allergy.reaction}` : ''})`);
    }
  } else {
    lines.push('Allergies: none recorded');
  }

  if (conditions && conditions.length > 0) {
    lines.push('Conditions:');
    for (const c of conditions) {
      lines.push(`- ${c.description}`);
    }
  } else {
    lines.push('Conditions: none recorded');
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
