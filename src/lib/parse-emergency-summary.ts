import { decryptQrPayload } from '@/lib/qr-cipher';

export type ScannedAllergy = {
  allergen: string;
  severity: string;
  reaction: string | null;
};

export type ScannedEmergencyContact = {
  name: string;
  relationship: string | null;
  phone: string | null;
};

export type ScannedDiagnosis = {
  condition: string;
  severity: string;
  dateOfDiagnosis: string | null;
};

export type ScannedMedication = {
  name: string;
  dosage: string;
  frequency: string | null;
};

export type ScannedEmergencyInfo = {
  patientId: number | null;
  generatedAt: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  noBloodTransfusion: string;
  phone: string;
  address: string;
  allergies: ScannedAllergy[];
  diagnoses: ScannedDiagnosis[];
  medications: ScannedMedication[];
  emergencyContacts: ScannedEmergencyContact[];
};

const FIELD_PATTERN = /^(Patient ID|Generated|Name|DOB|Gender|No blood transfusion|Phone|Address):\s*(.*)$/;
const ALLERGY_PATTERN = /^-\s*(.+?)\s*\(([^,)]+)(?:,\s*([^)]+))?\)$/;
const DIAGNOSIS_PATTERN = /^-\s*([^,]+),\s*(\S+)(?:,\s*(.+))?$/;
const MEDICATION_PATTERN = /^-\s*([^,]+),\s*([^,]+)(?:,\s*(.+))?$/;
const CONTACT_PATTERN = /^-\s*(.+?)(?:\s*\(([^)]+)\))?(?:\s*—\s*(.+))?$/;

/**
 * Decrypts a scanned QR string (see `src/lib/qr-cipher.ts`) and reverses `buildEmergencySummary()`,
 * parsing the plaintext back into structured fields for display. Returns null if the scanned text
 * isn't a MediScan emergency QR at all (e.g. some other unrelated QR code was scanned) or fails to
 * decrypt.
 */
export async function parseEmergencySummary(rawScannedText: string): Promise<ScannedEmergencyInfo | null> {
  const text = await decryptQrPayload(rawScannedText);
  if (text === null) return null;

  const lines = text.split('\n').map((line) => line.trim());
  if (lines[0] !== 'MEDISCAN EMERGENCY INFO') return null;

  const info: ScannedEmergencyInfo = {
    patientId: null,
    generatedAt: '',
    name: '',
    dateOfBirth: '',
    gender: '',
    noBloodTransfusion: '',
    phone: '',
    address: '',
    allergies: [],
    diagnoses: [],
    medications: [],
    emergencyContacts: [],
  };

  let inAllergies = false;
  let inDiagnoses = false;
  let inMedications = false;
  let inEmergencyContacts = false;

  for (const line of lines.slice(1)) {
    if (line === 'Allergies:' || line === 'Allergies: none recorded') {
      inAllergies = true;
      inDiagnoses = false;
      inMedications = false;
      inEmergencyContacts = false;
      continue;
    }

    if (line === 'Diagnoses:' || line === 'Diagnoses: none recorded') {
      inAllergies = false;
      inDiagnoses = true;
      inMedications = false;
      inEmergencyContacts = false;
      continue;
    }

    if (line === 'Medications:' || line === 'Medications: none recorded') {
      inAllergies = false;
      inDiagnoses = false;
      inMedications = true;
      inEmergencyContacts = false;
      continue;
    }

    if (line === 'Emergency contacts:') {
      inAllergies = false;
      inDiagnoses = false;
      inMedications = false;
      inEmergencyContacts = true;
      continue;
    }

    if (inAllergies) {
      const allergyMatch = ALLERGY_PATTERN.exec(line);
      if (allergyMatch) {
        info.allergies.push({
          allergen: allergyMatch[1],
          severity: allergyMatch[2].trim(),
          reaction: allergyMatch[3]?.trim() ?? null,
        });
      }
      continue;
    }

    if (inDiagnoses) {
      const diagnosisMatch = DIAGNOSIS_PATTERN.exec(line);
      if (diagnosisMatch) {
        info.diagnoses.push({
          condition: diagnosisMatch[1].trim(),
          severity: diagnosisMatch[2].trim(),
          dateOfDiagnosis: diagnosisMatch[3]?.trim() ?? null,
        });
      }
      continue;
    }

    if (inMedications) {
      const medicationMatch = MEDICATION_PATTERN.exec(line);
      if (medicationMatch) {
        info.medications.push({
          name: medicationMatch[1].trim(),
          dosage: medicationMatch[2].trim(),
          frequency: medicationMatch[3]?.trim() ?? null,
        });
      }
      continue;
    }

    if (inEmergencyContacts) {
      const contactMatch = CONTACT_PATTERN.exec(line);
      if (contactMatch) {
        info.emergencyContacts.push({
          name: contactMatch[1].trim(),
          relationship: contactMatch[2]?.trim() ?? null,
          phone: contactMatch[3]?.trim() ?? null,
        });
      }
      continue;
    }

    const fieldMatch = FIELD_PATTERN.exec(line);
    if (!fieldMatch) continue;
    const [, key, value] = fieldMatch;
    switch (key) {
      case 'Patient ID': {
        const id = Number(value);
        info.patientId = Number.isInteger(id) && id > 0 ? id : null;
        break;
      }
      case 'Generated':
        info.generatedAt = value;
        break;
      case 'Name':
        info.name = value;
        break;
      case 'DOB':
        info.dateOfBirth = value;
        break;
      case 'Gender':
        info.gender = value;
        break;
      case 'No blood transfusion':
        info.noBloodTransfusion = value;
        break;
      case 'Phone':
        info.phone = value;
        break;
      case 'Address':
        info.address = value;
        break;
    }
  }

  return info;
}
