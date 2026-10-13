import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useForm, useFormState } from 'react-hook-form';

import { useAuth } from '@/auth/useAuth';
import { useSubmitEnvelope } from '@/features/professional-sync/useSubmitEnvelope';
import { setUpdatedScannedInfo } from '@/lib/manage-info-pending';
import { parseEmergencySummary, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { scanForPatient, connectAndSubmit } from '@/services/ble-central.service';
import { seal } from '@/services/sealed-box.service';
import { getEffectiveVerificationSets } from '@/services/verification-sync.service';
import { allergySchema } from '@/lib/validation/allergy-schema';
import { conditionSchema } from '@/lib/validation/condition-schema';
import { diagnosisSchema } from '@/lib/validation/diagnosis-schema';
import { emergencyContactSchema } from '@/lib/validation/emergency-contact-schema';
import { medicationSchema } from '@/lib/validation/medication-schema';
import { manageMedicalInfoSchema } from '@/lib/validation/manage-medical-info-schema';
import { zodResolver } from '@/lib/zod-resolver';
import {
  type ManageAllergy,
  type ManageCondition,
  type ManageDiagnosis,
  type ManageMedication,
  type ManageEmergencyContact,
  type MedInfoFormState,
  EMPTY_MED_INFO_FORM,
  type Change,
  initAllergies,
  initConditions,
  initDiagnoses,
  initMedications,
  initEmergencyContacts,
  medInfoFromScanned,
  buildAllergyEnvelope,
  buildConditionEnvelope,
  buildDiagnosisEnvelope,
  buildMedicationEnvelope,
  buildContactEnvelope,
  buildMedInfoPatch,
} from '@/components/manage-info-helpers';

export function useManageInfo() {
  const { user } = useAuth();
  const isVerifiedProfessional = user?.permissions?.includes('verified professional') ?? false;
  const { mutateAsync: submitEnvelope } = useSubmitEnvelope();

  const [patientId, setPatientId] = useState<string | number | null>(null);
  const [info, setInfo] = useState<ScannedEmergencyInfo | null>(null);
  const [parseError, setParseError] = useState(false);

  const [allergies, setAllergies] = useState<ManageAllergy[]>([]);
  const [conditions, setConditions] = useState<ManageCondition[]>([]);
  const [diagnoses, setDiagnoses] = useState<ManageDiagnosis[]>([]);
  const [medications, setMedications] = useState<ManageMedication[]>([]);
  const [contacts, setContacts] = useState<ManageEmergencyContact[]>([]);
  const [originalAllergies, setOriginalAllergies] = useState<ScannedEmergencyInfo['allergies']>([]);
  const [originalConditions, setOriginalConditions] = useState<ScannedEmergencyInfo['conditions']>([]);
  const [originalDiagnoses, setOriginalDiagnoses] = useState<ScannedEmergencyInfo['diagnoses']>([]);
  const [originalMedications, setOriginalMedications] = useState<ScannedEmergencyInfo['medications']>([]);
  const [originalContacts, setOriginalContacts] = useState<ScannedEmergencyInfo['emergencyContacts']>([]);

  const medInfoForm = useForm<MedInfoFormState>({
    resolver: zodResolver(manageMedicalInfoSchema) as any,
    defaultValues: EMPTY_MED_INFO_FORM,
  });
  const medInfoInitialRef = useRef<MedInfoFormState>(EMPTY_MED_INFO_FORM);

  const [transfusionWitnessed, setTransfusionWitnessed] = useState(true);
  const [transfusionTouched, setTransfusionTouched] = useState(false);
  const [transfusionNote, setTransfusionNote] = useState('');
  const [generalNote, setGeneralNote] = useState('');

  const [sending, setSending] = useState(false);
  const [sentSuccessfully, setSentSuccessfully] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<'ble' | 'internet' | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, Record<string, string>>>({});

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const resetAll = (pid: string | number, qrData: string) => {
    setPatientId(pid);
    setInfo(null);
    setParseError(false);
    setAllergies([]);
    setConditions([]);
    setDiagnoses([]);
    setMedications([]);
    setContacts([]);
    setOriginalAllergies([]);
    setOriginalConditions([]);
    setOriginalDiagnoses([]);
    setOriginalMedications([]);
    setOriginalContacts([]);
    medInfoForm.reset(EMPTY_MED_INFO_FORM);
    medInfoInitialRef.current = EMPTY_MED_INFO_FORM;
    setTransfusionWitnessed(true);
    setTransfusionTouched(false);
    setTransfusionNote('');
    setGeneralNote('');
    setSending(false);
    setSentSuccessfully(false);
    setSyncError(null);
    setSendMode(null);
    setItemErrors({});
    medInfoForm.clearErrors();
    parseEmergencySummary(qrData).then((parsed) => {
      if (!parsed) {
        setParseError(true);
        return;
      }
      setInfo(parsed);
      setOriginalAllergies(parsed.allergies);
      setOriginalConditions(parsed.conditions);
      setOriginalDiagnoses(parsed.diagnoses);
      setOriginalMedications(parsed.medications);
      setOriginalContacts(parsed.emergencyContacts);
      const prefilled = medInfoFromScanned(parsed);
      medInfoForm.reset(prefilled);
      medInfoInitialRef.current = prefilled;

      getEffectiveVerificationSets(pid)
        .then(({ verifiedAllergens, verifiedConditions, verifiedDiagnoses, verifiedMedications }) => {
          setAllergies(initAllergies(parsed, verifiedAllergens));
          setConditions(initConditions(parsed, verifiedConditions));
          setDiagnoses(initDiagnoses(parsed, verifiedDiagnoses));
          setMedications(initMedications(parsed, verifiedMedications));
          setContacts(initEmergencyContacts(parsed));
        })
        .catch(() => {
          setAllergies(initAllergies(parsed));
          setConditions(initConditions(parsed));
          setDiagnoses(initDiagnoses(parsed));
          setMedications(initMedications(parsed));
          setContacts(initEmergencyContacts(parsed));
        });
    });
  };

  const setAllergy = (key: string, patch: Partial<ManageAllergy>) => {
    setAllergies((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };

  const setCondition = (key: string, patch: Partial<ManageCondition>) => {
    setConditions((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const setDiagnosis = (key: string, patch: Partial<ManageDiagnosis>) => {
    setDiagnoses((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const setMedication = (key: string, patch: Partial<ManageMedication>) => {
    setMedications((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  };

  const setContact = (key: string, patch: Partial<ManageEmergencyContact>) => {
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const clearItemError = (key: string) => {
    setItemErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const parseItemErrors = (issues: readonly any[]) => {
    const errors: Record<string, string> = {};
    for (const issue of issues) {
      const path = issue.path as string[];
      if (path.length === 1) {
        const key = path[0];
        if (key && !errors[key]) errors[key] = issue.message;
      }
    }
    return errors;
  };

  const computeChanges = async (): Promise<{ changes: Change[]; validationFailed: boolean }> => {
    if (!user) return { changes: [], validationFailed: false };
    const changes: Change[] = [];

    const allergyMap = new Map(originalAllergies.map((a) => [a.allergen, a]));
    const conditionMap = new Map(originalConditions.map((c) => [c.description, c]));
    const diagnosisMap = new Map(originalDiagnoses.map((d) => [d.condition, d]));
    const medicationMap = new Map(originalMedications.map((m) => [m.name, m]));

    for (const item of allergies) {
      const orig = allergyMap.get(item.allergen);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildAllergyEnvelope(item, 'delete', user), envelopeType: 'allergy_verification', label: item.allergen });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildAllergyEnvelope(item, 'create', user), envelopeType: 'allergy_verification', label: item.allergen });
      } else if (orig && (orig.severity !== item.severity || (orig.reaction ?? '') !== item.reaction)) {
        changes.push({ type: 'update', envelope: buildAllergyEnvelope(item, 'update', user), envelopeType: 'allergy_verification', label: item.allergen });
      } else if (item.verifyTouched) {
        changes.push({
          type: 'update',
          envelope: buildAllergyEnvelope(item, item.verifyToggle ? 'update' : 'revoke', user),
          envelopeType: 'allergy_verification',
          label: item.allergen,
        });
      }
    }

    for (const item of conditions) {
      const orig = conditionMap.get(item.description);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildConditionEnvelope(item, 'delete', user), envelopeType: 'condition_verification', label: item.description });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildConditionEnvelope(item, 'create', user), envelopeType: 'condition_verification', label: item.description });
      } else if (item.verifyTouched) {
        changes.push({
          type: 'update',
          envelope: buildConditionEnvelope(item, item.verifyToggle ? 'update' : 'revoke', user),
          envelopeType: 'condition_verification',
          label: item.description,
        });
      }
    }

    for (const item of diagnoses) {
      const orig = diagnosisMap.get(item.condition);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildDiagnosisEnvelope(item, 'delete', user), envelopeType: 'diagnosis_verification', label: item.condition });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildDiagnosisEnvelope(item, 'create', user), envelopeType: 'diagnosis_verification', label: item.condition });
      } else if (orig && (orig.severity !== item.severity || (orig.dateOfDiagnosis ?? '') !== item.dateOfDiagnosis)) {
        changes.push({ type: 'update', envelope: buildDiagnosisEnvelope(item, 'update', user), envelopeType: 'diagnosis_verification', label: item.condition });
      } else if (item.verifyTouched) {
        changes.push({
          type: 'update',
          envelope: buildDiagnosisEnvelope(item, item.verifyToggle ? 'update' : 'revoke', user),
          envelopeType: 'diagnosis_verification',
          label: item.condition,
        });
      }
    }

    for (const item of medications) {
      const orig = medicationMap.get(item.name);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildMedicationEnvelope(item, 'delete', user), envelopeType: 'medication_verification', label: item.name });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildMedicationEnvelope(item, 'create', user), envelopeType: 'medication_verification', label: item.name });
      } else if (orig && (orig.dosage !== item.dosage || (orig.frequency ?? '') !== item.frequency)) {
        changes.push({ type: 'update', envelope: buildMedicationEnvelope(item, 'update', user), envelopeType: 'medication_verification', label: item.name });
      } else if (item.verifyTouched) {
        changes.push({
          type: 'update',
          envelope: buildMedicationEnvelope(item, item.verifyToggle ? 'update' : 'revoke', user),
          envelopeType: 'medication_verification',
          label: item.name,
        });
      }
    }

    const contactMap = new Map(originalContacts.map((c) => [c.name, c]));
    for (const item of contacts) {
      const orig = contactMap.get(item.name);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildContactEnvelope(item, 'delete', user), envelopeType: 'emergency_contact_verification', label: item.name });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildContactEnvelope(item, 'create', user), envelopeType: 'emergency_contact_verification', label: item.name });
      } else if (orig && ((orig.relationship ?? '') !== (item.relationship ?? '') || (orig.phone ?? '') !== (item.phone ?? ''))) {
        changes.push({ type: 'update', envelope: buildContactEnvelope(item, 'update', user), envelopeType: 'emergency_contact_verification', label: item.name });
      }
    }

    const medInfoValid = await medInfoForm.trigger();
    if (!medInfoValid) {
      return { changes: [], validationFailed: true };
    }

    const patch = buildMedInfoPatch(medInfoForm.getValues(), medInfoInitialRef.current);
    if (Object.keys(patch).length > 0) {
      changes.push({
        type: 'update',
        envelope: { type: 'medical_information_update', version: 1, fields: patch, updated_by: { user_id: user.id, name: user.fullname }, updated_at: new Date().toISOString() },
        envelopeType: 'medical_information_update',
        label: 'Medical information',
      });
    }

    if (transfusionTouched || transfusionNote.trim()) {
      changes.push({
        type: 'update',
        envelope: {
          type: 'transfusion_witness',
          version: 1,
          consent_value: transfusionWitnessed,
          witnessed_by: { user_id: user.id, name: user.fullname },
          witnessed_at: new Date().toISOString(),
          ...(transfusionNote.trim() ? { note: transfusionNote.trim() } : {}),
        },
        envelopeType: 'transfusion_witness',
        label: 'Transfusion witness',
      });
    }

    if (generalNote.trim()) {
      changes.push({
        type: 'update',
        envelope: {
          type: 'general_note',
          version: 1,
          note: generalNote.trim(),
          author: { user_id: user.id, name: user.fullname },
          created_at: new Date().toISOString(),
        },
        envelopeType: 'general_note',
        label: 'General note',
      });
    }

    return { changes, validationFailed: false };
  };

  const handleAddAllergy = () => {
    const key = `a:new:${Date.now()}`;
    setAllergies((prev) => [
      { key, allergen: '', reaction: '', severity: 'mild', isNew: true, deleted: false, editing: true, verifyToggle: true, verifyTouched: false },
      ...prev,
    ]);
  };

  const handleAddCondition = () => {
    const key = `c:new:${Date.now()}`;
    setConditions((prev) => [
      { key, description: '', isNew: true, deleted: false, editing: true, verifyToggle: true, verifyTouched: false },
      ...prev,
    ]);
  };

  const handleAddDiagnosis = () => {
    const key = `d:new:${Date.now()}`;
    setDiagnoses((prev) => [
      { key, condition: '', dateOfDiagnosis: '', severity: 'chronic', isNew: true, deleted: false, editing: true, verifyToggle: true, verifyTouched: false },
      ...prev,
    ]);
  };

  const handleAddMedication = () => {
    const key = `m:new:${Date.now()}`;
    setMedications((prev) => [
      { key, name: '', dosage: '', frequency: '', notes: '', isNew: true, deleted: false, editing: true, verifyToggle: true, verifyTouched: false },
      ...prev,
    ]);
  };

  const handleAddContact = () => {
    const key = `ec:new:${Date.now()}`;
    setContacts((prev) => [
      { key, name: '', relationship: undefined, phone_country_code: 'PH', phone: '', is_primary: false, isNew: true, deleted: false, editing: true },
      ...prev,
    ]);
  };

  const handleEdit = (type: 'allergy' | 'condition' | 'diagnosis' | 'medication' | 'contact', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: true });
    else if (type === 'condition') setCondition(key, { editing: true });
    else if (type === 'diagnosis') setDiagnosis(key, { editing: true });
    else if (type === 'medication') setMedication(key, { editing: true });
    else setContact(key, { editing: true });
  };

  const handleCancelEdit = (type: 'allergy' | 'condition' | 'diagnosis' | 'medication' | 'contact', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: false });
    else if (type === 'condition') setCondition(key, { editing: false });
    else if (type === 'diagnosis') setDiagnosis(key, { editing: false });
    else if (type === 'medication') setMedication(key, { editing: false });
    else setContact(key, { editing: false });
  };

  const handleSaveEdit = (type: 'allergy' | 'condition' | 'diagnosis' | 'medication' | 'contact', key: string) => {
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    let result: { success: boolean; error?: any };
    if (type === 'allergy') {
      const item = allergies.find((a) => a.key === key);
      if (!item) return;
      result = allergySchema.safeParse({ allergen: item.allergen, reaction: item.reaction || undefined, severity: item.severity });
    } else if (type === 'condition') {
      const item = conditions.find((c) => c.key === key);
      if (!item) return;
      result = conditionSchema.safeParse({ description: item.description });
    } else if (type === 'diagnosis') {
      const item = diagnoses.find((d) => d.key === key);
      if (!item) return;
      result = diagnosisSchema.safeParse({ condition: item.condition, date_of_diagnosis: item.dateOfDiagnosis || undefined, severity: item.severity });
    } else if (type === 'medication') {
      const item = medications.find((m) => m.key === key);
      if (!item) return;
      result = medicationSchema.safeParse({ name: item.name, dosage: item.dosage || undefined, frequency: item.frequency || undefined, notes: item.notes || undefined });
    } else {
      const item = contacts.find((c) => c.key === key);
      if (!item) return;
      result = emergencyContactSchema.safeParse({ name: item.name, relationship: item.relationship, phone_country_code: item.phone_country_code || undefined, phone: item.phone || undefined, is_primary: item.is_primary });
    }

    if (!result.success) {
      setItemErrors((prev) => ({ ...prev, [key]: parseItemErrors(result.error.issues) }));
      return;
    }

    if (type === 'allergy') setAllergy(key, { editing: false });
    else if (type === 'condition') setCondition(key, { editing: false });
    else if (type === 'diagnosis') setDiagnosis(key, { editing: false });
    else if (type === 'medication') setMedication(key, { editing: false });
    else setContact(key, { editing: false });
  };

  const handleDelete = (type: 'allergy' | 'condition' | 'diagnosis' | 'medication' | 'contact', key: string, label: string) => {
    Alert.alert(
      `Remove ${label}?`,
      `This will mark "${label}" for removal from the patient's record when you sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (type === 'allergy') setAllergy(key, { deleted: true, editing: false });
            else if (type === 'condition') setCondition(key, { deleted: true, editing: false });
            else if (type === 'diagnosis') setDiagnosis(key, { deleted: true, editing: false });
            else if (type === 'medication') setMedication(key, { deleted: true, editing: false });
            else setContact(key, { deleted: true, editing: false });
          },
        },
      ],
    );
  };

  const visibleAllergies = allergies.filter((a) => !a.deleted);
  const visibleConditions = conditions.filter((c) => !c.deleted);
  const visibleDiagnoses = diagnoses.filter((d) => !d.deleted);
  const visibleMedications = medications.filter((m) => !m.deleted);
  const visibleContacts = contacts.filter((c) => !c.deleted);

  const hasUnsavedEdits = [...allergies, ...conditions, ...diagnoses, ...medications, ...contacts].some((item) => item.editing);

  const publishUpdatedInfo = () => {
    if (!info) return;
    const updated: ScannedEmergencyInfo = {
      ...info,
      allergies: allergies.filter((a) => !a.deleted).map((a) => ({ allergen: a.allergen, reaction: a.reaction || null, severity: a.severity })),
      conditions: conditions.filter((c) => !c.deleted).map((c) => ({ description: c.description })),
      diagnoses: diagnoses.filter((d) => !d.deleted).map((d) => ({ condition: d.condition, severity: d.severity, dateOfDiagnosis: d.dateOfDiagnosis || null })),
      medications: medications.filter((m) => !m.deleted).map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency || null })),
      emergencyContacts: contacts.filter((c) => !c.deleted).map((c) => ({ name: c.name, relationship: c.relationship ?? null, phone: c.phone || null })),
    };
    const medInfo = medInfoForm.getValues();
    if (medInfo.first_name) updated.firstName = medInfo.first_name;
    if (medInfo.last_name) updated.lastName = medInfo.last_name;
    updated.name = [medInfo.first_name, medInfo.middle_name, medInfo.last_name].filter(Boolean).join(' ') || updated.name;
    if (medInfo.date_of_birth) updated.dateOfBirth = medInfo.date_of_birth;
    if (medInfo.gender) updated.gender = medInfo.gender;
    if (medInfo.blood_type) updated.bloodType = medInfo.blood_type;
    if (medInfo.phone) updated.phone = medInfo.phone;
    if (medInfo.phone_country_code) updated.phoneCountryCode = medInfo.phone_country_code;
    if (medInfo.address) {
      updated.street = medInfo.address.street ?? '';
      updated.unit = medInfo.address.unit ?? '';
      updated.barangay = medInfo.address.barangay ?? '';
      updated.city = medInfo.address.city ?? '';
      updated.province = medInfo.address.province ?? '';
      updated.postalCode = medInfo.address.postal_code ?? '';
      updated.country = medInfo.address.country ?? '';
    }
    setUpdatedScannedInfo(updated);
  };

  const { isDirty: medInfoDirty } = useFormState({ control: medInfoForm.control });

  const hasFormChanges = medInfoDirty || allergies.some((a) => a.isNew || a.deleted || a.verifyTouched) || conditions.some((c) => c.isNew || c.deleted || c.verifyTouched) || diagnoses.some((d) => d.isNew || d.deleted || d.verifyTouched) || medications.some((m) => m.isNew || m.deleted || m.verifyTouched) || contacts.some((c) => c.isNew || c.deleted || c.editing) || transfusionTouched || !!generalNote.trim();

  const finishSending = () => {
    setSending(false);
    setSendMode(null);
  };

  const executeBleSync = async (pending: Change[]): Promise<string | null> => {
    const peer = await scanForPatient(patientId!, 20000);
    if (!peer) return 'Could not find the patient device nearby. Make sure they have Bluetooth sync open.';

    for (const change of pending) {
      const ciphertext = await seal(change.envelope, peer.publicKeyBase64);
      const result = await connectAndSubmit(peer, change.envelopeType, ciphertext);
      if (result !== 'acked') return `"${change.label}" was not acknowledged by the patient device.`;
    }
    return null;
  };

  const handleSendBle = async (sheetRef: React.RefObject<any>, onSuccess?: () => void) => {
    if (!user || patientId === null) return;
    setSending(true);
    setSyncError(null);
    setSendMode('ble');

    const { changes: pending, validationFailed } = await computeChanges();
    if (validationFailed) {
      finishSending();
      return;
    }
    if (pending.length === 0) {
      finishSending();
      sheetRef.current?.dismiss();
      return;
    }

    const errorMsg = await executeBleSync(pending).catch((err) =>
      err instanceof Error ? err.message : 'Bluetooth sync failed.',
    );

    if (errorMsg) {
      setSyncError(errorMsg);
    } else {
      publishUpdatedInfo();
      setSentSuccessfully(true);
      closeTimerRef.current = setTimeout(() => {
        sheetRef.current?.dismiss();
        onSuccess?.();
      }, 1500);
    }
    finishSending();
  };

  const executeInternetSync = async (pending: Change[]): Promise<void> => {
    await Promise.all(pending.map((change) =>
      submitEnvelope({ patientId: patientId!, envelopeType: change.envelopeType, payload: change.envelope, itemIdentifier: change.label }),
    ));
  };

  const handleSendInternet = async (sheetRef: React.RefObject<any>, onSuccess?: () => void) => {
    if (!user || patientId === null) return;
    setSending(true);
    setSyncError(null);
    setSendMode('internet');

    const { changes: pending, validationFailed } = await computeChanges();
    if (validationFailed) {
      finishSending();
      return;
    }
    if (pending.length === 0) {
      finishSending();
      sheetRef.current?.dismiss();
      return;
    }

    const errorMsg = await executeInternetSync(pending)
      .then(() => null)
      .catch((err) => (err instanceof Error ? err.message : 'Internet sync failed.'));

    if (errorMsg) {
      setSyncError(errorMsg);
    } else {
      publishUpdatedInfo();
      setSentSuccessfully(true);
      closeTimerRef.current = setTimeout(() => {
        sheetRef.current?.dismiss();
        onSuccess?.();
      }, 1500);
    }
    finishSending();
  };

  return {
    patientId,
    info,
    parseError,
    medInfoForm,
    allergies,
    conditions,
    diagnoses,
    medications,
    contacts,
    visibleAllergies,
    visibleConditions,
    visibleDiagnoses,
    visibleMedications,
    visibleContacts,
    itemErrors,
    sending,
    sentSuccessfully,
    syncError,
    sendMode,
    transfusionWitnessed,
    transfusionTouched,
    transfusionNote,
    generalNote,
    isVerifiedProfessional,
    hasFormChanges,
    hasUnsavedEdits,
    resetAll,
    setAllergy,
    setCondition,
    setDiagnosis,
    setMedication,
    setContact,
    clearItemError,
    handleAddAllergy,
    handleAddCondition,
    handleAddDiagnosis,
    handleAddMedication,
    handleAddContact,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDelete,
    handleSendBle,
    handleSendInternet,
    setTransfusionWitnessed,
    setTransfusionTouched,
    setTransfusionNote,
    setGeneralNote,
    finishSending,
  };
}
