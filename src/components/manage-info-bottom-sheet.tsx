import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityIcon, SeverityBadge } from '@/components/severity-badge';
import { DiagnosisSeverityIcon, DiagnosisSeverityBadge } from '@/components/diagnosis-severity-badge';
import { PickerField } from '@/components/form/picker-field';
import { TextField } from '@/components/form/text-field';
import { DateField } from '@/components/form/date-field';
import { SelectField } from '@/components/form/select-field';
import { PhoneInput } from '@/components/form/phone-input';
import { useAuth } from '@/auth/useAuth';
import { useSubmitEnvelope } from '@/features/professional-sync/useSubmitEnvelope';
import { useTheme } from '@/hooks/use-theme';
import { parseEmergencySummary, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { scanForPatient, connectAndSubmit } from '@/services/ble-central.service';
import { seal } from '@/services/sealed-box.service';
import type {
  AllergyVerificationEnvelope,
  DiagnosisVerificationEnvelope,
  MedicationVerificationEnvelope,
  TransfusionWitnessEnvelope,
  GeneralNoteEnvelope,
  MedicalInformationUpdateEnvelope,
  MedicalInformationPatch,
} from '@/lib/envelope-schema';
import type { EnvelopeType } from '@/api/types';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';
import { GENDER_OPTIONS, type Gender } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS, type BloodType } from '@/constants/blood-type';
import { SUFFIX_OPTIONS, type Suffix } from '@/constants/suffix';
import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';

export type ManageInfoBottomSheetHandle = { present: (patientId: number, qrData: string) => void; dismiss: () => void };

const ALLERGY_SEVERITIES: AllergyVerificationEnvelope['severity'][] = ['mild', 'moderate', 'severe', 'life-threatening'];
const DIAGNOSIS_SEVERITIES: DiagnosisSeverity[] = ['chronic', 'ongoing', 'acute', 'critical'];

type ManageAllergy = {
  key: string;
  allergen: string;
  reaction: string;
  severity: AllergyVerificationEnvelope['severity'];
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
  verifyToggle: boolean;
  verifyTouched: boolean;
};

type ManageDiagnosis = {
  key: string;
  condition: string;
  dateOfDiagnosis: string;
  severity: DiagnosisSeverity;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
  verifyToggle: boolean;
  verifyTouched: boolean;
};

type ManageMedication = {
  key: string;
  name: string;
  dosage: string;
  frequency: string;
  notes: string;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
  verifyToggle: boolean;
  verifyTouched: boolean;
};

type MedInfoFormState = {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: Suffix | undefined;
  date_of_birth: string;
  gender: Gender | undefined;
  blood_type: BloodType | undefined;
  religion: string;
  address: string;
  no_blood_transfusion: boolean;
  phone_country_code: string;
  phone: string;
};

const EMPTY_MED_INFO_FORM: MedInfoFormState = {
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: undefined,
  date_of_birth: '',
  gender: undefined,
  blood_type: undefined,
  religion: '',
  address: '',
  no_blood_transfusion: false,
  phone_country_code: 'PH',
  phone: '',
};

type Change = {
  type: 'create' | 'update' | 'delete';
  envelope:
    | AllergyVerificationEnvelope
    | DiagnosisVerificationEnvelope
    | MedicationVerificationEnvelope
    | TransfusionWitnessEnvelope
    | GeneralNoteEnvelope
    | MedicalInformationUpdateEnvelope;
  envelopeType: EnvelopeType;
  label: string;
};

function normaliseSeverity(raw: string): AllergyVerificationEnvelope['severity'] {
  const lower = raw.toLowerCase();
  if (ALLERGY_SEVERITIES.includes(lower as AllergyVerificationEnvelope['severity'])) return lower as AllergyVerificationEnvelope['severity'];
  return 'mild';
}

function normaliseDiagnosisSeverity(raw: string): DiagnosisSeverity {
  const lower = raw.toLowerCase();
  if (DIAGNOSIS_SEVERITIES.includes(lower as DiagnosisSeverity)) return lower as DiagnosisSeverity;
  return 'chronic';
}

function initAllergies(info: ScannedEmergencyInfo): ManageAllergy[] {
  return info.allergies.map((a, i) => ({
    key: `a:${i}`,
    allergen: a.allergen,
    reaction: a.reaction ?? '',
    severity: normaliseSeverity(a.severity),
    isNew: false,
    deleted: false,
    editing: false,
    verifyToggle: true,
    verifyTouched: false,
  }));
}

function initDiagnoses(info: ScannedEmergencyInfo): ManageDiagnosis[] {
  return info.diagnoses.map((d, i) => ({
    key: `d:${i}`,
    condition: d.condition,
    dateOfDiagnosis: d.dateOfDiagnosis ?? '',
    severity: normaliseDiagnosisSeverity(d.severity),
    isNew: false,
    deleted: false,
    editing: false,
    verifyToggle: true,
    verifyTouched: false,
  }));
}

function initMedications(info: ScannedEmergencyInfo): ManageMedication[] {
  return info.medications.map((m, i) => ({
    key: `m:${i}`,
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency ?? '',
    notes: '',
    isNew: false,
    deleted: false,
    editing: false,
    verifyToggle: true,
    verifyTouched: false,
  }));
}

function medInfoFromScanned(info: ScannedEmergencyInfo): MedInfoFormState {
  return {
    ...EMPTY_MED_INFO_FORM,
    date_of_birth: info.dateOfBirth && info.dateOfBirth !== '—' ? info.dateOfBirth : '',
    gender: GENDER_OPTIONS.includes(info.gender as Gender) ? (info.gender as Gender) : undefined,
    address: info.address && info.address !== '—' ? info.address : '',
    phone: info.phone && info.phone !== '—' ? info.phone : '',
    no_blood_transfusion: info.noBloodTransfusion === 'Yes',
  };
}

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

export const ManageInfoBottomSheet = forwardRef<ManageInfoBottomSheetHandle>(function ManageInfoBottomSheet(_props, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useTheme();
  const { user } = useAuth();
  const { mutateAsync: submitEnvelope } = useSubmitEnvelope();

  const [patientId, setPatientId] = useState<number | null>(null);
  const [info, setInfo] = useState<ScannedEmergencyInfo | null>(null);
  const [parseError, setParseError] = useState(false);

  const [allergies, setAllergies] = useState<ManageAllergy[]>([]);
  const [diagnoses, setDiagnoses] = useState<ManageDiagnosis[]>([]);
  const [medications, setMedications] = useState<ManageMedication[]>([]);
  const [originalAllergies, setOriginalAllergies] = useState<ScannedEmergencyInfo['allergies']>([]);
  const [originalDiagnoses, setOriginalDiagnoses] = useState<ScannedEmergencyInfo['diagnoses']>([]);
  const [originalMedications, setOriginalMedications] = useState<ScannedEmergencyInfo['medications']>([]);

  const [medInfoForm, setMedInfoForm] = useState<MedInfoFormState>(EMPTY_MED_INFO_FORM);
  const [medInfoInitial, setMedInfoInitial] = useState<MedInfoFormState>(EMPTY_MED_INFO_FORM);

  const [transfusionWitnessed, setTransfusionWitnessed] = useState(true);
  const [transfusionTouched, setTransfusionTouched] = useState(false);
  const [transfusionNote, setTransfusionNote] = useState('');
  const [generalNote, setGeneralNote] = useState('');

  const [sending, setSending] = useState(false);
  const [sentSuccessfully, setSentSuccessfully] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<'ble' | 'internet' | null>(null);

  const resetAll = useCallback((pid: number, qrData: string) => {
    setPatientId(pid);
    setInfo(null);
    setParseError(false);
    setAllergies([]);
    setDiagnoses([]);
    setMedications([]);
    setOriginalAllergies([]);
    setOriginalDiagnoses([]);
    setOriginalMedications([]);
    setMedInfoForm(EMPTY_MED_INFO_FORM);
    setMedInfoInitial(EMPTY_MED_INFO_FORM);
    setTransfusionWitnessed(true);
    setTransfusionTouched(false);
    setTransfusionNote('');
    setGeneralNote('');
    setSending(false);
    setSentSuccessfully(false);
    setSyncError(null);
    setSendMode(null);

    parseEmergencySummary(qrData).then((parsed) => {
      if (!parsed) {
        setParseError(true);
        return;
      }
      setInfo(parsed);
      setAllergies(initAllergies(parsed));
      setDiagnoses(initDiagnoses(parsed));
      setMedications(initMedications(parsed));
      setOriginalAllergies(parsed.allergies);
      setOriginalDiagnoses(parsed.diagnoses);
      setOriginalMedications(parsed.medications);
      const prefilled = medInfoFromScanned(parsed);
      setMedInfoForm(prefilled);
      setMedInfoInitial(prefilled);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    present: (pid: number, qrData: string) => {
      resetAll(pid, qrData);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const setMedInfoField = useCallback(<K extends keyof MedInfoFormState>(key: K, value: MedInfoFormState[K]) => {
    setMedInfoForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setAllergy = useCallback((key: string, patch: Partial<ManageAllergy>) => {
    setAllergies((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }, []);

  const setDiagnosis = useCallback((key: string, patch: Partial<ManageDiagnosis>) => {
    setDiagnoses((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }, []);

  const setMedication = useCallback((key: string, patch: Partial<ManageMedication>) => {
    setMedications((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }, []);

  const handleAddAllergy = useCallback(() => {
    const key = `a:new:${Date.now()}`;
    setAllergies((prev) => [
      { key, allergen: '', reaction: '', severity: 'mild', isNew: true, deleted: false, editing: true, verifyToggle: true, verifyTouched: false },
      ...prev,
    ]);
  }, []);

  const handleAddDiagnosis = useCallback(() => {
    const key = `d:new:${Date.now()}`;
    setDiagnoses((prev) => [
      { key, condition: '', dateOfDiagnosis: '', severity: 'chronic', isNew: true, deleted: false, editing: true, verifyToggle: true, verifyTouched: false },
      ...prev,
    ]);
  }, []);

  const handleAddMedication = useCallback(() => {
    const key = `m:new:${Date.now()}`;
    setMedications((prev) => [
      { key, name: '', dosage: '', frequency: '', notes: '', isNew: true, deleted: false, editing: true, verifyToggle: true, verifyTouched: false },
      ...prev,
    ]);
  }, []);

  const handleEdit = useCallback((type: 'allergy' | 'diagnosis' | 'medication', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: true });
    else if (type === 'diagnosis') setDiagnosis(key, { editing: true });
    else setMedication(key, { editing: true });
  }, [setAllergy, setDiagnosis, setMedication]);

  const handleCancelEdit = useCallback((type: 'allergy' | 'diagnosis' | 'medication', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: false });
    else if (type === 'diagnosis') setDiagnosis(key, { editing: false });
    else setMedication(key, { editing: false });
  }, [setAllergy, setDiagnosis, setMedication]);

  const handleSaveEdit = useCallback((type: 'allergy' | 'diagnosis' | 'medication', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: false });
    else if (type === 'diagnosis') setDiagnosis(key, { editing: false });
    else setMedication(key, { editing: false });
  }, [setAllergy, setDiagnosis, setMedication]);

  const handleDelete = useCallback((type: 'allergy' | 'diagnosis' | 'medication', key: string, label: string) => {
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
            else if (type === 'diagnosis') setDiagnosis(key, { deleted: true, editing: false });
            else setMedication(key, { deleted: true, editing: false });
          },
        },
      ],
    );
  }, [setAllergy, setDiagnosis, setMedication]);

  const visibleAllergies = useMemo(() => allergies.filter((a) => !a.deleted), [allergies]);
  const visibleDiagnoses = useMemo(() => diagnoses.filter((d) => !d.deleted), [diagnoses]);
  const visibleMedications = useMemo(() => medications.filter((m) => !m.deleted), [medications]);

  const buildAllergyEnvelope = useCallback(
    (item: ManageAllergy, action: 'create' | 'update' | 'delete' | 'revoke'): AllergyVerificationEnvelope => {
      if (!user) throw new Error('Not authenticated');
      const base = {
        type: 'allergy_verification' as const,
        version: 1 as const,
        allergen: item.allergen,
        reaction: item.reaction || null,
        severity: item.severity,
        verified_by: { user_id: user.id, name: user.fullname },
        verified_at: new Date().toISOString(),
      };
      if (action === 'delete') return { ...base, note: '__delete__' };
      if (action === 'revoke') return { ...base, note: '__unverify__' };
      return base;
    },
    [user],
  );

  const buildDiagnosisEnvelope = useCallback(
    (item: ManageDiagnosis, action: 'create' | 'update' | 'delete' | 'revoke'): DiagnosisVerificationEnvelope => {
      if (!user) throw new Error('Not authenticated');
      const base = {
        type: 'diagnosis_verification' as const,
        version: 1 as const,
        condition: item.condition,
        date_of_diagnosis: item.dateOfDiagnosis || null,
        severity: item.severity,
        verified_by: { user_id: user.id, name: user.fullname },
        verified_at: new Date().toISOString(),
      };
      if (action === 'delete') return { ...base, note: '__delete__' };
      if (action === 'revoke') return { ...base, note: '__unverify__' };
      return base;
    },
    [user],
  );

  const buildMedicationEnvelope = useCallback(
    (item: ManageMedication, action: 'create' | 'update' | 'delete' | 'revoke'): MedicationVerificationEnvelope => {
      if (!user) throw new Error('Not authenticated');
      const base = {
        type: 'medication_verification' as const,
        version: 1 as const,
        name: item.name,
        dosage: item.dosage,
        frequency: item.frequency,
        notes: item.notes || null,
        verified_by: { user_id: user.id, name: user.fullname },
        verified_at: new Date().toISOString(),
      };
      if (action === 'delete') return { ...base, note: '__delete__' };
      if (action === 'revoke') return { ...base, note: '__unverify__' };
      return base;
    },
    [user],
  );

  const buildMedInfoPatch = useCallback((): MedicalInformationPatch => {
    const patch: MedicalInformationPatch = {};
    if (medInfoForm.first_name !== medInfoInitial.first_name) patch.first_name = medInfoForm.first_name;
    if (medInfoForm.middle_name !== medInfoInitial.middle_name) patch.middle_name = medInfoForm.middle_name || null;
    if (medInfoForm.last_name !== medInfoInitial.last_name) patch.last_name = medInfoForm.last_name;
    if (medInfoForm.suffix !== medInfoInitial.suffix) patch.suffix = medInfoForm.suffix ?? null;
    if (medInfoForm.date_of_birth !== medInfoInitial.date_of_birth) patch.date_of_birth = medInfoForm.date_of_birth || null;
    if (medInfoForm.gender !== medInfoInitial.gender) patch.gender = medInfoForm.gender ?? null;
    if (medInfoForm.blood_type !== medInfoInitial.blood_type) patch.blood_type = medInfoForm.blood_type ?? null;
    if (medInfoForm.religion !== medInfoInitial.religion) patch.religion = medInfoForm.religion || null;
    if (medInfoForm.address !== medInfoInitial.address) patch.address = medInfoForm.address || null;
    if (medInfoForm.phone !== medInfoInitial.phone) patch.phone = medInfoForm.phone || null;
    if (medInfoForm.phone_country_code !== medInfoInitial.phone_country_code) patch.phone_country_code = medInfoForm.phone_country_code || null;
    if (medInfoForm.no_blood_transfusion !== medInfoInitial.no_blood_transfusion) patch.no_blood_transfusion = medInfoForm.no_blood_transfusion;
    return patch;
  }, [medInfoForm, medInfoInitial]);

  const computeChanges = useCallback((): Change[] => {
    if (!user) return [];
    const changes: Change[] = [];

    for (const item of allergies) {
      const orig = originalAllergies.find((a) => a.allergen === item.allergen);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildAllergyEnvelope(item, 'delete'), envelopeType: 'allergy_verification', label: item.allergen });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildAllergyEnvelope(item, 'create'), envelopeType: 'allergy_verification', label: item.allergen });
      } else if (orig && (orig.severity !== item.severity || (orig.reaction ?? '') !== item.reaction)) {
        changes.push({ type: 'update', envelope: buildAllergyEnvelope(item, 'update'), envelopeType: 'allergy_verification', label: item.allergen });
      } else if (item.verifyTouched) {
        changes.push({
          type: 'update',
          envelope: buildAllergyEnvelope(item, item.verifyToggle ? 'update' : 'revoke'),
          envelopeType: 'allergy_verification',
          label: item.allergen,
        });
      }
    }

    for (const item of diagnoses) {
      const orig = originalDiagnoses.find((d) => d.condition === item.condition);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildDiagnosisEnvelope(item, 'delete'), envelopeType: 'diagnosis_verification', label: item.condition });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildDiagnosisEnvelope(item, 'create'), envelopeType: 'diagnosis_verification', label: item.condition });
      } else if (orig && (orig.severity !== item.severity || (orig.dateOfDiagnosis ?? '') !== item.dateOfDiagnosis)) {
        changes.push({ type: 'update', envelope: buildDiagnosisEnvelope(item, 'update'), envelopeType: 'diagnosis_verification', label: item.condition });
      } else if (item.verifyTouched) {
        changes.push({
          type: 'update',
          envelope: buildDiagnosisEnvelope(item, item.verifyToggle ? 'update' : 'revoke'),
          envelopeType: 'diagnosis_verification',
          label: item.condition,
        });
      }
    }

    for (const item of medications) {
      const orig = originalMedications.find((m) => m.name === item.name);
      if (item.deleted) {
        if (orig) changes.push({ type: 'delete', envelope: buildMedicationEnvelope(item, 'delete'), envelopeType: 'medication_verification', label: item.name });
      } else if (item.isNew) {
        changes.push({ type: 'create', envelope: buildMedicationEnvelope(item, 'create'), envelopeType: 'medication_verification', label: item.name });
      } else if (orig && (orig.dosage !== item.dosage || (orig.frequency ?? '') !== item.frequency)) {
        changes.push({ type: 'update', envelope: buildMedicationEnvelope(item, 'update'), envelopeType: 'medication_verification', label: item.name });
      } else if (item.verifyTouched) {
        changes.push({
          type: 'update',
          envelope: buildMedicationEnvelope(item, item.verifyToggle ? 'update' : 'revoke'),
          envelopeType: 'medication_verification',
          label: item.name,
        });
      }
    }

    const patch = buildMedInfoPatch();
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
        type: 'create',
        envelope: {
          type: 'general_note',
          version: 1,
          note: generalNote.trim(),
          author: { user_id: user.id, name: user.fullname },
          created_at: new Date().toISOString(),
        },
        envelopeType: 'general_note',
        label: 'Note',
      });
    }

    return changes;
  }, [
    user,
    allergies,
    diagnoses,
    medications,
    originalAllergies,
    originalDiagnoses,
    originalMedications,
    buildAllergyEnvelope,
    buildDiagnosisEnvelope,
    buildMedicationEnvelope,
    buildMedInfoPatch,
    transfusionTouched,
    transfusionWitnessed,
    transfusionNote,
    generalNote,
  ]);

  const changes = useMemo(() => computeChanges(), [computeChanges]);
  const hasChanges = changes.length > 0;

  const handleSendBle = useCallback(async () => {
    if (!user || patientId === null) return;
    setSending(true);
    setSyncError(null);
    setSendMode('ble');
    try {
      const pending = computeChanges();
      if (pending.length === 0) {
        sheetRef.current?.dismiss();
        return;
      }

      const peer = await scanForPatient(patientId, 20000);
      if (!peer) {
        setSyncError('Could not find the patient device nearby. Make sure they have Bluetooth sync open.');
        return;
      }

      for (const change of pending) {
        const ciphertext = await seal(change.envelope, peer.publicKeyBase64);
        const result = await connectAndSubmit(peer, change.envelopeType, ciphertext);
        if (result !== 'acked') {
          setSyncError(`"${change.label}" was not acknowledged by the patient device.`);
          return;
        }
      }

      setSentSuccessfully(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Bluetooth sync failed.');
    } finally {
      setSending(false);
      setSendMode(null);
    }
  }, [user, patientId, computeChanges]);

  const handleSendInternet = useCallback(async () => {
    if (!user || patientId === null) return;
    setSending(true);
    setSyncError(null);
    setSendMode('internet');
    try {
      const pending = computeChanges();
      if (pending.length === 0) {
        sheetRef.current?.dismiss();
        return;
      }

      for (const change of pending) {
        await submitEnvelope({ patientId, envelopeType: change.envelopeType, payload: change.envelope });
      }

      setSentSuccessfully(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Internet sync failed.');
    } finally {
      setSending(false);
      setSendMode(null);
    }
  }, [user, patientId, computeChanges, submitEnvelope]);

  let body: React.ReactNode;

  if (parseError) {
    body = (
      <View className="items-center gap-4 py-8 px-6">
        <ThemedText className="text-center">Could not read the patient&apos;s QR data.</ThemedText>
      </View>
    );
  } else if (!info) {
    body = (
      <View className="items-center gap-4 py-8 px-6">
        <ThemedText className="text-center">Loading patient info…</ThemedText>
      </View>
    );
  } else if (sentSuccessfully) {
    body = (
      <View className="flex-1 items-center justify-center gap-3 px-6 py-12">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary + '20' }}>
          <Ionicons name="checkmark-circle" size={36} color={theme.primary} />
        </View>
        <ThemedText type="heading" className="text-center">Update sent</ThemedText>
        <ThemedText type="caption" className="text-center">The patient will see this the next time their device syncs.</ThemedText>
      </View>
    );
  } else {
    body = (
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 }}>
        <View className="mb-3 flex-row items-center justify-between">
          <ThemedText type="overline">Manage info</ThemedText>
          <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
            <Ionicons name="close" size={20} color={theme.mutedForeground} />
          </Pressable>
        </View>

        <Card className="mb-4 gap-1">
          <ThemedText className="text-lg font-semibold">{info.name}</ThemedText>
          <ThemedText type="small" color="mutedForeground">
            {info.dateOfBirth} · {info.gender}
          </ThemedText>
        </Card>

        {syncError ? (
          <Card className="mb-4" style={{ backgroundColor: theme.destructive + '15', borderColor: theme.destructive }}>
            <ThemedText type="small" color="destructive">{syncError}</ThemedText>
          </Card>
        ) : null}

        {/* Medical information */}
        <View className="mb-6 gap-1">
          <ThemedText type="overline" className="mb-2">Medical information</ThemedText>
          <TextField label="First name" value={medInfoForm.first_name} onChangeText={(v) => setMedInfoField('first_name', v)} />
          <TextField label="Middle name" value={medInfoForm.middle_name} onChangeText={(v) => setMedInfoField('middle_name', v)} />
          <TextField label="Last name" value={medInfoForm.last_name} onChangeText={(v) => setMedInfoField('last_name', v)} />
          <SelectField placeholder="Suffix" options={SUFFIX_OPTIONS} value={medInfoForm.suffix} onChange={(v) => setMedInfoField('suffix', v)} allowClear />
          <DateField label="Date of birth" value={medInfoForm.date_of_birth} onChange={(v) => setMedInfoField('date_of_birth', v)} maximumDate={new Date()} />
          <SelectField placeholder="Gender" options={GENDER_OPTIONS} value={medInfoForm.gender} onChange={(v) => setMedInfoField('gender', v)} />
          <PhoneInput
            value={{ countryCode: medInfoForm.phone_country_code, phone: medInfoForm.phone }}
            onChange={(v) => { setMedInfoField('phone_country_code', v.countryCode); setMedInfoField('phone', v.phone); }}
          />
          <TextField label="Address" value={medInfoForm.address} onChangeText={(v) => setMedInfoField('address', v)} multiline />
          <SelectField placeholder="Blood type" options={BLOOD_TYPE_OPTIONS} value={medInfoForm.blood_type} onChange={(v) => setMedInfoField('blood_type', v)} />
          <TextField label="Religion" value={medInfoForm.religion} onChangeText={(v) => setMedInfoField('religion', v)} />
          <View className="mb-4 flex-row items-center justify-between">
            <ThemedText>No blood transfusion</ThemedText>
            <Switch value={medInfoForm.no_blood_transfusion} onValueChange={(v) => setMedInfoField('no_blood_transfusion', v)} />
          </View>
        </View>

        {/* Allergies */}
        <View className="mb-6 gap-2">
          <View className="flex-row items-center justify-between">
            <ThemedText type="overline">Allergies</ThemedText>
            <Pressable onPress={handleAddAllergy} hitSlop={8} disabled={sending}>
              <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
                <Ionicons name="add" size={16} color={theme.primaryForeground} />
              </View>
            </Pressable>
          </View>

          {visibleAllergies.length === 0 ? (
            <Card>
              <ThemedText type="label" color="mutedForeground">No allergies recorded for this patient.</ThemedText>
            </Card>
          ) : (
            <Card className="p-0">
              {visibleAllergies.map((item, i) => (
                <View
                  key={item.key}
                  className="px-4 py-3"
                  style={i < visibleAllergies.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
                >
                  {item.editing ? (
                    <View className="gap-2">
                      {item.isNew ? (
                        <BottomSheetTextInput
                          className="rounded-lg border px-3 py-2 text-base"
                          style={{ borderColor: theme.input, color: theme.foreground }}
                          placeholder="Allergen name"
                          placeholderTextColor={theme.mutedForeground}
                          value={item.allergen}
                          onChangeText={(v) => setAllergy(item.key, { allergen: v })}
                        />
                      ) : null}
                      <PickerField label="Severity" options={ALLERGY_SEVERITIES} value={item.severity} onChange={(v) => setAllergy(item.key, { severity: v })} />
                      <BottomSheetTextInput
                        className="rounded-lg border px-3 py-2 text-base"
                        style={{ borderColor: theme.input, color: theme.foreground }}
                        placeholder="Reaction (optional)"
                        placeholderTextColor={theme.mutedForeground}
                        value={item.reaction}
                        onChangeText={(v) => setAllergy(item.key, { reaction: v })}
                      />
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="small">Mark as verified</ThemedText>
                        <Switch value={item.verifyToggle} onValueChange={(v) => setAllergy(item.key, { verifyToggle: v, verifyTouched: true })} />
                      </View>
                      <View className="flex-row gap-2">
                        <PrimaryButton label="Save" onPress={() => handleSaveEdit('allergy', item.key)} className="flex-1" />
                        <PrimaryButton label="Cancel" variant="ghost" onPress={() => handleCancelEdit('allergy', item.key)} className="flex-1" />
                      </View>
                    </View>
                  ) : (
                    <View className="gap-2">
                      <View className="flex-row items-center gap-3">
                        <SeverityIcon severity={item.severity} size={36} />
                        <View className="flex-1 shrink">
                          <ThemedText className="font-semibold">{item.allergen}</ThemedText>
                          {item.reaction ? <ThemedText type="small" color="mutedForeground">{item.reaction}</ThemedText> : null}
                        </View>
                        <SeverityBadge severity={item.severity} />
                        <Pressable onPress={() => handleEdit('allergy', item.key)} hitSlop={6} disabled={sending}>
                          <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                        </Pressable>
                        <Pressable onPress={() => handleDelete('allergy', item.key, item.allergen)} hitSlop={6} disabled={sending}>
                          <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                        </Pressable>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="small" color="mutedForeground">Mark as verified</ThemedText>
                        <Switch value={item.verifyToggle} onValueChange={(v) => setAllergy(item.key, { verifyToggle: v, verifyTouched: true })} disabled={sending} />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </Card>
          )}
        </View>

        {/* Diagnoses */}
        <View className="mb-6 gap-2">
          <View className="flex-row items-center justify-between">
            <ThemedText type="overline">Diagnoses</ThemedText>
            <Pressable onPress={handleAddDiagnosis} hitSlop={8} disabled={sending}>
              <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
                <Ionicons name="add" size={16} color={theme.primaryForeground} />
              </View>
            </Pressable>
          </View>

          {visibleDiagnoses.length === 0 ? (
            <Card>
              <ThemedText type="label" color="mutedForeground">No diagnoses recorded for this patient.</ThemedText>
            </Card>
          ) : (
            <Card className="p-0">
              {visibleDiagnoses.map((item, i) => (
                <View
                  key={item.key}
                  className="px-4 py-3"
                  style={i < visibleDiagnoses.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
                >
                  {item.editing ? (
                    <View className="gap-2">
                      {item.isNew ? (
                        <BottomSheetTextInput
                          className="rounded-lg border px-3 py-2 text-base"
                          style={{ borderColor: theme.input, color: theme.foreground }}
                          placeholder="Condition name"
                          placeholderTextColor={theme.mutedForeground}
                          value={item.condition}
                          onChangeText={(v) => setDiagnosis(item.key, { condition: v })}
                        />
                      ) : null}
                      <PickerField label="Severity" options={DIAGNOSIS_SEVERITIES} value={item.severity} onChange={(v) => setDiagnosis(item.key, { severity: v })} />
                      <BottomSheetTextInput
                        className="rounded-lg border px-3 py-2 text-base"
                        style={{ borderColor: theme.input, color: theme.foreground }}
                        placeholder="Date of diagnosis (optional)"
                        placeholderTextColor={theme.mutedForeground}
                        value={item.dateOfDiagnosis}
                        onChangeText={(v) => setDiagnosis(item.key, { dateOfDiagnosis: v })}
                      />
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="small">Mark as verified</ThemedText>
                        <Switch value={item.verifyToggle} onValueChange={(v) => setDiagnosis(item.key, { verifyToggle: v, verifyTouched: true })} />
                      </View>
                      <View className="flex-row gap-2">
                        <PrimaryButton label="Save" onPress={() => handleSaveEdit('diagnosis', item.key)} className="flex-1" />
                        <PrimaryButton label="Cancel" variant="ghost" onPress={() => handleCancelEdit('diagnosis', item.key)} className="flex-1" />
                      </View>
                    </View>
                  ) : (
                    <View className="gap-2">
                      <View className="flex-row items-center gap-3">
                        <DiagnosisSeverityIcon severity={item.severity} size={36} />
                        <View className="flex-1 shrink">
                          <ThemedText className="font-semibold">{item.condition}</ThemedText>
                          {item.dateOfDiagnosis ? <ThemedText type="small" color="mutedForeground">Diagnosed {item.dateOfDiagnosis}</ThemedText> : null}
                        </View>
                        <DiagnosisSeverityBadge severity={item.severity} />
                        <Pressable onPress={() => handleEdit('diagnosis', item.key)} hitSlop={6} disabled={sending}>
                          <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                        </Pressable>
                        <Pressable onPress={() => handleDelete('diagnosis', item.key, item.condition)} hitSlop={6} disabled={sending}>
                          <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                        </Pressable>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="small" color="mutedForeground">Mark as verified</ThemedText>
                        <Switch value={item.verifyToggle} onValueChange={(v) => setDiagnosis(item.key, { verifyToggle: v, verifyTouched: true })} disabled={sending} />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </Card>
          )}
        </View>

        {/* Medications */}
        <View className="mb-6 gap-2">
          <View className="flex-row items-center justify-between">
            <ThemedText type="overline">Medications</ThemedText>
            <Pressable onPress={handleAddMedication} hitSlop={8} disabled={sending}>
              <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
                <Ionicons name="add" size={16} color={theme.primaryForeground} />
              </View>
            </Pressable>
          </View>

          {visibleMedications.length === 0 ? (
            <Card>
              <ThemedText type="label" color="mutedForeground">No medications recorded for this patient.</ThemedText>
            </Card>
          ) : (
            <Card className="p-0">
              {visibleMedications.map((item, i) => (
                <View
                  key={item.key}
                  className="px-4 py-3"
                  style={i < visibleMedications.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
                >
                  {item.editing ? (
                    <View className="gap-2">
                      {item.isNew ? (
                        <BottomSheetTextInput
                          className="rounded-lg border px-3 py-2 text-base"
                          style={{ borderColor: theme.input, color: theme.foreground }}
                          placeholder="Medication name"
                          placeholderTextColor={theme.mutedForeground}
                          value={item.name}
                          onChangeText={(v) => setMedication(item.key, { name: v })}
                        />
                      ) : null}
                      <BottomSheetTextInput
                        className="rounded-lg border px-3 py-2 text-base"
                        style={{ borderColor: theme.input, color: theme.foreground }}
                        placeholder="Dosage (e.g. 500mg)"
                        placeholderTextColor={theme.mutedForeground}
                        value={item.dosage}
                        onChangeText={(v) => setMedication(item.key, { dosage: v })}
                      />
                      <BottomSheetTextInput
                        className="rounded-lg border px-3 py-2 text-base"
                        style={{ borderColor: theme.input, color: theme.foreground }}
                        placeholder="Frequency (e.g. Twice daily)"
                        placeholderTextColor={theme.mutedForeground}
                        value={item.frequency}
                        onChangeText={(v) => setMedication(item.key, { frequency: v })}
                      />
                      <BottomSheetTextInput
                        className="rounded-lg border px-3 py-2 text-base"
                        style={{ borderColor: theme.input, color: theme.foreground }}
                        placeholder="Notes (optional)"
                        placeholderTextColor={theme.mutedForeground}
                        value={item.notes}
                        onChangeText={(v) => setMedication(item.key, { notes: v })}
                      />
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="small">Mark as verified</ThemedText>
                        <Switch value={item.verifyToggle} onValueChange={(v) => setMedication(item.key, { verifyToggle: v, verifyTouched: true })} />
                      </View>
                      <View className="flex-row gap-2">
                        <PrimaryButton label="Save" onPress={() => handleSaveEdit('medication', item.key)} className="flex-1" />
                        <PrimaryButton label="Cancel" variant="ghost" onPress={() => handleCancelEdit('medication', item.key)} className="flex-1" />
                      </View>
                    </View>
                  ) : (
                    <View className="gap-2">
                      <View className="flex-row items-center gap-3">
                        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
                          <Ionicons name="medical" size={18} color={theme.primary} />
                        </View>
                        <View className="flex-1 shrink">
                          <ThemedText className="font-semibold">{item.name}</ThemedText>
                          {item.dosage || item.frequency ? (
                            <ThemedText type="small" color="mutedForeground">
                              {[item.dosage, item.frequency].filter(Boolean).join(' · ')}
                            </ThemedText>
                          ) : null}
                        </View>
                        <Pressable onPress={() => handleEdit('medication', item.key)} hitSlop={6} disabled={sending}>
                          <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                        </Pressable>
                        <Pressable onPress={() => handleDelete('medication', item.key, item.name)} hitSlop={6} disabled={sending}>
                          <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                        </Pressable>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <ThemedText type="small" color="mutedForeground">Mark as verified</ThemedText>
                        <Switch value={item.verifyToggle} onValueChange={(v) => setMedication(item.key, { verifyToggle: v, verifyTouched: true })} disabled={sending} />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </Card>
          )}
        </View>

        {/* Transfusion witness */}
        <View className="mb-6 gap-2">
          <ThemedText type="overline">Transfusion witness</ThemedText>
          <Card className="flex-row items-center justify-between">
            <ThemedText>Patient consents to transfusion</ThemedText>
            <Switch
              value={transfusionWitnessed}
              onValueChange={(v) => { setTransfusionWitnessed(v); setTransfusionTouched(true); }}
            />
          </Card>
          <TextField label="Note (optional)" value={transfusionNote} onChangeText={setTransfusionNote} multiline />
        </View>

        {/* General note */}
        <View className="mb-2 gap-2">
          <ThemedText type="overline">General note</ThemedText>
          <TextField label="Note (optional)" value={generalNote} onChangeText={setGeneralNote} multiline />
        </View>

        <View className="mt-2 gap-3">
          <PrimaryButton
            label={sendMode === 'ble' ? 'Syncing via Bluetooth…' : 'Send via Bluetooth'}
            loading={sendMode === 'ble'}
            disabled={sending || !hasChanges}
            onPress={() => void handleSendBle()}
          />
          <PrimaryButton
            label={sendMode === 'internet' ? 'Sending via internet…' : 'Send via internet (beta)'}
            variant="ghost"
            loading={sendMode === 'internet'}
            disabled={sending || !hasChanges}
            onPress={() => void handleSendInternet()}
          />
        </View>
      </BottomSheetScrollView>
    );
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['90%']}
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
      handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      {body}
    </BottomSheetModal>
  );
});
