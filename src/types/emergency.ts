export type EmergencyKnowledgeState = 'recorded' | 'confirmed_none' | 'not_recorded';

export type EmergencyDisclosureSettings = {
  name: boolean;
  gender: boolean;
  dateOfBirth: boolean;
  bloodType: boolean;
  allergies: boolean;
  medications: boolean;
  diagnoses: boolean;
  conditions: boolean;
  transfusionPreference: boolean;
  emergencyContacts: boolean;
  phone: boolean;
  address: boolean;
  religion: boolean;
  staleAfterHours: number;
  confirmedNone: {
    allergies: boolean;
    medications: boolean;
    diagnoses: boolean;
    conditions: boolean;
  };
};

export type EmergencyProvenance = {
  source: 'patient_entered' | 'mixed';
  lastUpdatedAt: string;
  allergies: EmergencyKnowledgeState;
  medications: EmergencyKnowledgeState;
  diagnoses: EmergencyKnowledgeState;
  conditions: EmergencyKnowledgeState;
};

export type EmergencyQrCertificate = {
  publicKey: string;
  subject: string;
  issuedAt: string;
  issuer: 'device';
};

export type EmergencyQrEnvelopeV2 = {
  version: 2;
  payloadId: string;
  generatedAt: string;
  expiresAt: string;
  provenance: EmergencyProvenance;
  data: import('@/lib/parse-emergency-summary').ScannedEmergencyInfo;
  certificate: EmergencyQrCertificate;
  signature: string;
};

export type EmergencyQrReferenceV3 = {
  version: 3;
  kind: 'dynamic-reference';
  token: string;
};

export type DynamicEmergencyCardStatus = {
  active: boolean;
  issuedAt: string | null;
  publishedAt: string | null;
  snapshotGeneratedAt: string | null;
  pendingPublish: boolean;
};

export type QrVerificationResult =
  | { status: 'valid'; authenticity: 'device_signed'; message: string }
  | { status: 'valid'; authenticity: 'server_verified'; message: string }
  | { status: 'legacy'; authenticity: 'unverified'; message: string }
  | { status: 'stale'; authenticity: 'device_signed'; message: string }
  | { status: 'expired'; authenticity: 'device_signed'; message: string }
  | { status: 'invalid'; authenticity: 'unverified'; message: string }
  | { status: 'unsupported'; authenticity: 'unverified'; message: string };

export type ResponderNote = {
  text: string;
  updatedAt: string;
  title?: string;
  photoUris?: string[];
  blocks?: ResponderNoteBlock[];
};

export type EncounterVital = {
  kind: 'blood_pressure' | 'heart_rate' | 'respiratory_rate' | 'temperature' | 'oxygen_saturation';
  value: string;
  unit: string;
  measuredAt: string;
  recordedBy: string;
  verifiedBy?: { userId: string; name: string };
};

export type ResponderEncounter = {
  authorName: string;
  authorIdentity: 'self_declared' | 'verified_professional';
  authorId?: string;
  verifiedBy?: { userId: string; name: string };
  cloudEncounterId?: string;
  observations: string;
  actionsTaken: string;
  vitals: EncounterVital[];
  recordedAt: string;
  updatedAt: string;
};

export type ResponderNoteBlock =
  | { id: string; type: 'text'; text: string; createdAt: string }
  | { id: string; type: 'image'; uri: string; createdAt: string };

export type RecentEmergencyScan = {
  id: string;
  payloadHash: string;
  info: import('@/lib/parse-emergency-summary').ScannedEmergencyInfo;
  verification: QrVerificationResult;
  source: 'qr' | 'dynamic-card' | 'printable-offline';
  scannedAt: string;
  lastViewedAt: string;
  expiresAt: string;
  scanCount: number;
  note: ResponderNote | null;
  encounter: ResponderEncounter | null;
};

export const DEFAULT_EMERGENCY_DISCLOSURE: EmergencyDisclosureSettings = {
  name: true,
  gender: true,
  dateOfBirth: true,
  bloodType: true,
  allergies: true,
  medications: true,
  diagnoses: true,
  conditions: true,
  transfusionPreference: true,
  emergencyContacts: true,
  phone: true,
  address: true,
  religion: false,
  staleAfterHours: 24 * 30,
  confirmedNone: { allergies: false, medications: false, diagnoses: false, conditions: false },
};
