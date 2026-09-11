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

export type ScannedCondition = {
  description: string;
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
  patientId: string | number | null;
  generatedAt: string;
  name: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  religion: string;
  noBloodTransfusion: string;
  phone: string;
  phoneCountryCode: string;
  street: string;
  unit: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  allergies: ScannedAllergy[];
  conditions: ScannedCondition[];
  diagnoses: ScannedDiagnosis[];
  medications: ScannedMedication[];
  emergencyContacts: ScannedEmergencyContact[];
};

const FIELD_PATTERN =
  /^(Patient ID|Generated|Name|First name|Middle name|Last name|Suffix|DOB|Gender|Blood type|Religion|No blood transfusion|Phone country code|Phone|Street|Unit|City|Province|Postal code|Country):\s*(.*)$/;
const ALLERGY_PATTERN = /^-\s*(.+?)\s*\(([^,)]+)(?:,\s*([^)]+))?\)$/;
const CONDITION_PATTERN = /^-\s*(.+)$/;
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
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    religion: '',
    noBloodTransfusion: '',
    phone: '',
    phoneCountryCode: '',
    street: '',
    unit: '',
    city: '',
    province: '',
    postalCode: '',
    country: '',
    allergies: [],
    conditions: [],
    diagnoses: [],
    medications: [],
    emergencyContacts: [],
  };

  let inAllergies = false;
  let inConditions = false;
  let inDiagnoses = false;
  let inMedications = false;
  let inEmergencyContacts = false;

  for (const line of lines.slice(1)) {
    if (line === 'Allergies:' || line === 'Allergies: none recorded') {
      inAllergies = true;
      inConditions = false;
      inDiagnoses = false;
      inMedications = false;
      inEmergencyContacts = false;
      continue;
    }

    if (line === 'Conditions:' || line === 'Conditions: none recorded') {
      inAllergies = false;
      inConditions = true;
      inDiagnoses = false;
      inMedications = false;
      inEmergencyContacts = false;
      continue;
    }

    if (line === 'Diagnoses:' || line === 'Diagnoses: none recorded') {
      inAllergies = false;
      inConditions = false;
      inDiagnoses = true;
      inMedications = false;
      inEmergencyContacts = false;
      continue;
    }

    if (line === 'Medications:' || line === 'Medications: none recorded') {
      inAllergies = false;
      inConditions = false;
      inDiagnoses = false;
      inMedications = true;
      inEmergencyContacts = false;
      continue;
    }

    if (line === 'Emergency contacts:') {
      inAllergies = false;
      inConditions = false;
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

    if (inConditions) {
      const conditionMatch = CONDITION_PATTERN.exec(line);
      if (conditionMatch) {
        info.conditions.push({
          description: conditionMatch[1].trim(),
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
        info.patientId = Number.isInteger(id) && id > 0 ? id : (value.length > 0 ? value : null);
        break;
      }
      case 'Generated':
        info.generatedAt = value;
        break;
      case 'Name':
        info.name = value;
        break;
      case 'First name':
        info.firstName = value;
        break;
      case 'Middle name':
        info.middleName = value;
        break;
      case 'Last name':
        info.lastName = value;
        break;
      case 'Suffix':
        info.suffix = value;
        break;
      case 'DOB':
        info.dateOfBirth = value;
        break;
      case 'Gender':
        info.gender = value;
        break;
      case 'Blood type':
        info.bloodType = value;
        break;
      case 'Religion':
        info.religion = value;
        break;
      case 'No blood transfusion':
        info.noBloodTransfusion = value;
        break;
      case 'Phone':
        info.phone = value;
        break;
      case 'Phone country code':
        info.phoneCountryCode = value;
        break;
      case 'Street':
        info.street = value;
        break;
      case 'Unit':
        info.unit = value;
        break;
      case 'City':
        info.city = value;
        break;
      case 'Province':
        info.province = value;
        break;
      case 'Postal code':
        info.postalCode = value;
        break;
      case 'Country':
        info.country = value;
        break;
    }
  }

  return info;
}
