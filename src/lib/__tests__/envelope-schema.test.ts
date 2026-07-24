import { parseEnvelopePlaintext } from '@/lib/envelope-schema';

const verifiedBy = { user_id: 1, name: 'Dr. Reyes' };

describe('parseEnvelopePlaintext', () => {
  it('accepts a well-formed allergy_verification envelope', () => {
    const plaintext = {
      type: 'allergy_verification',
      version: 1,
      allergen: 'Penicillin',
      reaction: 'Hives',
      severity: 'severe',
      verified_by: verifiedBy,
      verified_at: '2026-01-01T00:00:00.000Z',
    };
    expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toEqual(plaintext);
  });

  it('accepts allergy_verification with a null reaction and optional note', () => {
    const plaintext = {
      type: 'allergy_verification',
      version: 1,
      allergen: 'Peanuts',
      reaction: null,
      severity: 'mild',
      verified_by: verifiedBy,
      verified_at: '2026-01-01T00:00:00.000Z',
      note: 'Confirmed via skin test',
    };
    expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toEqual(plaintext);
  });

  it('rejects allergy_verification with an invalid severity', () => {
    const plaintext = {
      type: 'allergy_verification',
      version: 1,
      allergen: 'Penicillin',
      reaction: null,
      severity: 'extremely-severe',
      verified_by: verifiedBy,
      verified_at: '2026-01-01T00:00:00.000Z',
    };
    expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toBeNull();
  });

  it('rejects when the plaintext type does not match the envelope_type it was filed under', () => {
    const plaintext = {
      type: 'general_note',
      version: 1,
      allergen: 'Penicillin',
      reaction: null,
      severity: 'severe',
      verified_by: verifiedBy,
      verified_at: '2026-01-01T00:00:00.000Z',
    };
    expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toBeNull();
  });

  it('rejects an unsupported version', () => {
    const plaintext = {
      type: 'allergy_verification',
      version: 2,
      allergen: 'Penicillin',
      reaction: null,
      severity: 'severe',
      verified_by: verifiedBy,
      verified_at: '2026-01-01T00:00:00.000Z',
    };
    expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toBeNull();
  });

  describe('diagnosis_verification', () => {
    it('accepts a well-formed diagnosis_verification envelope', () => {
      const plaintext = {
        type: 'diagnosis_verification',
        version: 1,
        condition: 'Type 2 diabetes',
        date_of_diagnosis: '2024-03-15',
        severity: 'chronic',
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('diagnosis_verification', plaintext)).toEqual(plaintext);
    });

    it('accepts diagnosis_verification with a null date_of_diagnosis and optional note', () => {
      const plaintext = {
        type: 'diagnosis_verification',
        version: 1,
        condition: 'Hypertension',
        date_of_diagnosis: null,
        severity: 'ongoing',
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
        note: 'Confirmed via chart review',
      };
      expect(parseEnvelopePlaintext('diagnosis_verification', plaintext)).toEqual(plaintext);
    });

    it('rejects diagnosis_verification with an invalid severity', () => {
      const plaintext = {
        type: 'diagnosis_verification',
        version: 1,
        condition: 'Flu',
        date_of_diagnosis: null,
        severity: 'mild',
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('diagnosis_verification', plaintext)).toBeNull();
    });

    it('rejects diagnosis_verification missing verified_by', () => {
      const plaintext = {
        type: 'diagnosis_verification',
        version: 1,
        condition: 'Flu',
        date_of_diagnosis: null,
        severity: 'acute',
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('diagnosis_verification', plaintext)).toBeNull();
    });
  });

  describe('medication_verification', () => {
    it('accepts a well-formed medication_verification envelope', () => {
      const plaintext = {
        type: 'medication_verification',
        version: 1,
        name: 'Aspirin',
        dosage: '100mg',
        frequency: 'Once daily',
        notes: null,
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medication_verification', plaintext)).toEqual(plaintext);
    });

    it('accepts medication_verification with notes and an optional note', () => {
      const plaintext = {
        type: 'medication_verification',
        version: 1,
        name: 'Metformin',
        dosage: '500mg',
        frequency: 'Twice daily',
        notes: 'Take with meals',
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
        note: 'Confirmed via prescription',
      };
      expect(parseEnvelopePlaintext('medication_verification', plaintext)).toEqual(plaintext);
    });

    it('rejects medication_verification missing a required string field', () => {
      const plaintext = {
        type: 'medication_verification',
        version: 1,
        name: 'Aspirin',
        dosage: '100mg',
        // frequency missing
        notes: null,
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medication_verification', plaintext)).toBeNull();
    });

    it('rejects medication_verification missing verified_by', () => {
      const plaintext = {
        type: 'medication_verification',
        version: 1,
        name: 'Aspirin',
        dosage: '100mg',
        frequency: 'Once daily',
        notes: null,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medication_verification', plaintext)).toBeNull();
    });

    it('rejects a type mismatch (filed under the wrong envelope_type)', () => {
      const plaintext = {
        type: 'medication_verification',
        version: 1,
        name: 'Aspirin',
        dosage: '100mg',
        frequency: 'Once daily',
        notes: null,
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toBeNull();
    });
  });

  describe('condition_verification', () => {
    it('accepts a well-formed condition_verification envelope', () => {
      const plaintext = {
        type: 'condition_verification',
        version: 1,
        description: 'Occasional migraines',
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('condition_verification', plaintext)).toEqual(plaintext);
    });

    it('accepts condition_verification with an optional note', () => {
      const plaintext = {
        type: 'condition_verification',
        version: 1,
        description: 'Seasonal allergies',
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__delete__',
      };
      expect(parseEnvelopePlaintext('condition_verification', plaintext)).toEqual(plaintext);
    });

    it('rejects condition_verification missing description', () => {
      const plaintext = {
        type: 'condition_verification',
        version: 1,
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('condition_verification', plaintext)).toBeNull();
    });

    it('rejects condition_verification missing verified_by', () => {
      const plaintext = {
        type: 'condition_verification',
        version: 1,
        description: 'Occasional migraines',
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('condition_verification', plaintext)).toBeNull();
    });

    it('rejects a type mismatch (filed under the wrong envelope_type)', () => {
      const plaintext = {
        type: 'condition_verification',
        version: 1,
        description: 'Occasional migraines',
        verified_by: verifiedBy,
        verified_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toBeNull();
    });
  });

  it('accepts a well-formed transfusion_witness envelope', () => {
    const plaintext = {
      type: 'transfusion_witness',
      version: 1,
      consent_value: true,
      witnessed_by: verifiedBy,
      witnessed_at: '2026-01-01T00:00:00.000Z',
    };
    expect(parseEnvelopePlaintext('transfusion_witness', plaintext)).toEqual(plaintext);
  });

  it('rejects transfusion_witness missing witnessed_by', () => {
    const plaintext = {
      type: 'transfusion_witness',
      version: 1,
      consent_value: true,
      witnessed_at: '2026-01-01T00:00:00.000Z',
    };
    expect(parseEnvelopePlaintext('transfusion_witness', plaintext)).toBeNull();
  });

  it('accepts a well-formed general_note envelope', () => {
    const plaintext = {
      type: 'general_note',
      version: 1,
      note: 'Patient reports improved symptoms',
      author: verifiedBy,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    expect(parseEnvelopePlaintext('general_note', plaintext)).toEqual(plaintext);
  });

  it('rejects general_note with a non-string note', () => {
    const plaintext = { type: 'general_note', version: 1, note: 123, author: verifiedBy, created_at: 'now' };
    expect(parseEnvelopePlaintext('general_note', plaintext)).toBeNull();
  });

  it('rejects non-object plaintext (e.g. corrupted/garbage decrypt output)', () => {
    expect(parseEnvelopePlaintext('general_note', null)).toBeNull();
    expect(parseEnvelopePlaintext('general_note', 'just a string')).toBeNull();
    expect(parseEnvelopePlaintext('general_note', 42)).toBeNull();
  });

  it('rejects a person field missing user_id or name', () => {
    const plaintext = {
      type: 'general_note',
      version: 1,
      note: 'hello',
      author: { name: 'Dr. Reyes' },
      created_at: 'now',
    };
    expect(parseEnvelopePlaintext('general_note', plaintext)).toBeNull();
  });

  describe('medical_information_update', () => {
    const updatedBy = { user_id: 2, name: 'Nurse Santos' };

    it('accepts a valid partial patch with a single field', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { blood_type: 'O+' },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toEqual(plaintext);
    });

    it('accepts a patch with all fields set', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: {
          first_name: 'Jane',
          middle_name: 'Cruz',
          last_name: 'Dela Cruz',
          suffix: 'Jr.',
          date_of_birth: '1990-01-15',
          gender: 'Female',
          phone_country_code: 'PH',
          phone: '9171234567',
          blood_type: 'A+',
          religion: 'Catholic',
          address: '123 St.',
          no_blood_transfusion: true,
        },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toEqual(plaintext);
    });

    it('accepts nullable fields set to null (clearing them)', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { middle_name: null, suffix: null, blood_type: null },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toEqual(plaintext);
    });

    it('rejects an empty fields object (no changes)', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: {},
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects a non-object fields value', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: 'blood_type=O+',
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects an invalid blood_type value', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { blood_type: 'C+' },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects an invalid gender value', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { gender: 'Other' },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects an invalid suffix value', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { suffix: 'PhD' },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects no_blood_transfusion with a non-boolean value', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { no_blood_transfusion: 1 },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects an unknown field key in the patch', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { email: 'jane@example.com' },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects missing updated_by', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { blood_type: 'O+' },
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('medical_information_update', plaintext)).toBeNull();
    });

    it('rejects a type mismatch (filed under the wrong envelope_type)', () => {
      const plaintext = {
        type: 'medical_information_update',
        version: 1,
        fields: { blood_type: 'O+' },
        updated_by: updatedBy,
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      expect(parseEnvelopePlaintext('allergy_verification', plaintext)).toBeNull();
    });
  });
});
