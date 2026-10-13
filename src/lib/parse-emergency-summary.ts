import { decryptQrPayload } from '@/lib/qr-cipher';
import type { ProfessionalEncounter } from '@/api/types';
import type { QrVerificationResult } from '@/types/emergency';
import type { EmergencyFieldChange } from '@/db/repositories/emergency-field-history.repo';

const QR_V2_PREFIX = 'MEDISCAN:v2:';

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

export type ScannedVerifiedEncounter = {
  professionalName: string;
  professionalId: string;
  recordedAt: string;
  updatedAt: string;
  observations: string;
  actionsTaken: string;
  vitals: { kind: string; value: string; unit: string; measuredAt: string; recordedBy: string }[];
};

export type ScannedEmergencyInfo = {
  recentHistory?: EmergencyFieldChange[];
  withheld?: { dateOfBirth: boolean; bloodType: boolean; phone: boolean };
  patientId: string | number | null;
  generatedAt: string;
  lastUpdatedAt?: string;
  age?: number | null;
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
  barangay?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  allergies: ScannedAllergy[];
  conditions: ScannedCondition[];
  diagnoses: ScannedDiagnosis[];
  medications: ScannedMedication[];
  emergencyContacts: ScannedEmergencyContact[];
  latestVerifiedEncounter?: ScannedVerifiedEncounter;
  knowledge?: {
    allergies: 'recorded' | 'confirmed_none' | 'not_recorded';
    medications: 'recorded' | 'confirmed_none' | 'not_recorded';
    diagnoses: 'recorded' | 'confirmed_none' | 'not_recorded';
    conditions: 'recorded' | 'confirmed_none' | 'not_recorded';
  };
};

export function withLatestVerifiedEncounter(
  info: ScannedEmergencyInfo,
  encounter: ProfessionalEncounter | undefined,
): ScannedEmergencyInfo {
  if (!encounter) return info;
  return {
    ...info,
    latestVerifiedEncounter: {
      professionalName: encounter.verifiedBy.name || encounter.professional_name,
      professionalId: encounter.verifiedBy.userId || encounter.professional_id,
      recordedAt: encounter.recordedAt,
      updatedAt: encounter.updatedAt,
      observations: encounter.observations,
      actionsTaken: encounter.actionsTaken,
      vitals: encounter.vitals.map((vital) => ({
        kind: vital.kind,
        value: vital.value,
        unit: vital.unit,
        measuredAt: vital.measuredAt,
        recordedBy: vital.verifiedBy?.name || vital.recordedBy || encounter.professional_name,
      })),
    },
  };
}

const FIELD_PATTERN =
  /^(Patient ID|Generated|Name|First name|Middle name|Last name|Suffix|DOB|Gender|Blood type|Religion|No blood transfusion|Phone country code|Phone|Street|Unit|Barangay|City|Province|Postal code|Country):\s*(.*)$/;
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
    barangay: '',
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
    if (line.startsWith('Verified encounter: ')) {
      inAllergies = inConditions = inDiagnoses = inMedications = inEmergencyContacts = false;
      try {
        const value = JSON.parse(line.slice('Verified encounter: '.length)) as Record<string, unknown>;
        const vitals = Array.isArray(value.vitals) ? value.vitals : [];
        info.latestVerifiedEncounter = {
          professionalName: typeof value.by === 'string' ? value.by : 'Verified professional',
          professionalId: typeof value.byId === 'string' ? value.byId : '',
          recordedAt: typeof value.at === 'string' ? value.at : '',
          updatedAt: typeof value.updated === 'string' ? value.updated : '',
          observations: typeof value.observations === 'string' ? value.observations : '',
          actionsTaken: typeof value.actions === 'string' ? value.actions : '',
          vitals: vitals.slice(0, 5).flatMap((item) => {
            if (!item || typeof item !== 'object') return [];
            const vital = item as Record<string, unknown>;
            if (typeof vital.kind !== 'string' || typeof vital.value !== 'string') return [];
            return [{ kind: vital.kind, value: vital.value, unit: typeof vital.unit === 'string' ? vital.unit : '', measuredAt: typeof vital.at === 'string' ? vital.at : '', recordedBy: typeof vital.by === 'string' ? vital.by : '' }];
          }),
        };
      } catch {
        // Keep the rest of the emergency QR usable if this optional section is malformed.
      }
      continue;
    }
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
      case 'Barangay':
        info.barangay = value;
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

export async function parseEmergencyQr(rawScannedText: string): Promise<{
  info: ScannedEmergencyInfo;
  verification: QrVerificationResult;
} | null> {
  if (rawScannedText.startsWith('MEDISCAN:handoff:1:')) {
    const { parsePatientHandoff } = await import('@/lib/patient-handoff');
    return parsePatientHandoff(rawScannedText);
  }
  if (rawScannedText.startsWith(QR_V2_PREFIX)) {
    const { parseEmergencyQrV2 } = await import('@/lib/emergency-qr-v2');
    return parseEmergencyQrV2(rawScannedText);
  }
  const info = await parseEmergencySummary(rawScannedText);
  if (!info) return null;
  info.lastUpdatedAt ??= info.generatedAt;
  info.knowledge ??= {
    allergies: info.allergies.length ? 'recorded' : 'not_recorded',
    medications: info.medications.length ? 'recorded' : 'not_recorded',
    diagnoses: info.diagnoses.length ? 'recorded' : 'not_recorded',
    conditions: info.conditions.length ? 'recorded' : 'not_recorded',
  };
  return {
    info,
    verification: {
      status: 'legacy',
      authenticity: 'unverified',
      message: 'Legacy QR — authenticity has not been verified.',
    },
  };
}
