import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { TextField } from '@/components/form/text-field';
import { PickerField } from '@/components/form/picker-field';
import { DateField } from '@/components/form/date-field';
import { SelectField } from '@/components/form/select-field';
import { PhoneInput } from '@/components/form/phone-input';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/auth/useAuth';
import { useSubmitEnvelope } from '@/features/professional-sync/useSubmitEnvelope';
import { useBleScan } from '@/features/ble-sync/useBleScan';
import { seal } from '@/services/sealed-box.service';
import { connectAndSubmit } from '@/services/ble-central.service';
import { PatientKeyNotFoundError } from '@/services/professional-submission.service';
import { getErrorMessage, getErrorStatus } from '@/api/errors';
import { useTheme } from '@/hooks/use-theme';
import { parseEmergencySummary } from '@/lib/parse-emergency-summary';
import { GENDER_OPTIONS, type Gender } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS, type BloodType } from '@/constants/blood-type';
import { SUFFIX_OPTIONS, type Suffix } from '@/constants/suffix';
import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';
import type { AllergyVerificationEnvelope, DiagnosisVerificationEnvelope, TransfusionWitnessEnvelope, GeneralNoteEnvelope, MedicalInformationUpdateEnvelope, MedicalInformationPatch } from '@/lib/envelope-schema';
import type { EnvelopeType } from '@/api/types';

const ENVELOPE_TYPES: { value: EnvelopeType; label: string }[] = [
  { value: 'allergy_verification', label: 'Verify allergy' },
  { value: 'diagnosis_verification', label: 'Verify diagnosis' },
  { value: 'transfusion_witness', label: 'Witness transfusion consent' },
  { value: 'general_note', label: 'Leave a note' },
  { value: 'medical_information_update', label: 'Edit medical info' },
];

const SEVERITIES: AllergyVerificationEnvelope['severity'][] = ['mild', 'moderate', 'severe', 'life-threatening'];

type SubmitOutcome = { kind: 'success' } | { kind: 'error'; message: string } | null;

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

export default function ProfessionalSubmitScreen() {
  const { patientId: patientIdParam, qrData } = useLocalSearchParams<{ patientId: string; qrData?: string }>();
  const patientId = Number(patientIdParam);
  const { user } = useAuth();
  const theme = useTheme();

  const [envelopeType, setEnvelopeType] = useState<EnvelopeType>('allergy_verification');
  const [allergen, setAllergen] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<AllergyVerificationEnvelope['severity']>('mild');
  const [condition, setCondition] = useState('');
  const [dateOfDiagnosis, setDateOfDiagnosis] = useState('');
  const [diagnosisSeverity, setDiagnosisSeverity] = useState<DiagnosisVerificationEnvelope['severity']>('chronic');
  const [consentValue, setConsentValue] = useState(true);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<SubmitOutcome>(null);
  const [bleSubmitting, setBleSubmitting] = useState(false);

  const [medInfoForm, setMedInfoForm] = useState<MedInfoFormState>(EMPTY_MED_INFO_FORM);
  const [medInfoInitial, setMedInfoInitial] = useState<MedInfoFormState>(EMPTY_MED_INFO_FORM);
  const [medInfoReferenceName, setMedInfoReferenceName] = useState('');

  useEffect(() => {
    if (!qrData) return;
    parseEmergencySummary(qrData).then((info) => {
      if (!info) return;
      const prefilled: MedInfoFormState = {
        ...EMPTY_MED_INFO_FORM,
        date_of_birth: info.dateOfBirth && info.dateOfBirth !== '—' ? info.dateOfBirth : '',
        gender: GENDER_OPTIONS.includes(info.gender as Gender) ? (info.gender as Gender) : undefined,
        address: info.address && info.address !== '—' ? info.address : '',
        phone: info.phone && info.phone !== '—' ? info.phone : '',
        no_blood_transfusion: info.noBloodTransfusion === 'Yes',
      };
      setMedInfoForm(prefilled);
      setMedInfoInitial(prefilled);
      setMedInfoReferenceName(info.name && info.name !== 'Unknown' ? info.name : '');
    });
  }, [qrData]);

  const setMedInfoField = useCallback(<K extends keyof MedInfoFormState>(key: K, value: MedInfoFormState[K]) => {
    setMedInfoForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const { mutateAsync: submitViaRelay, isPending: relaySubmitting } = useSubmitEnvelope();
  const bleScan = useBleScan();

  const isSubmitting = relaySubmitting || bleSubmitting;

  const buildPayload = useCallback((): AllergyVerificationEnvelope | DiagnosisVerificationEnvelope | TransfusionWitnessEnvelope | GeneralNoteEnvelope | MedicalInformationUpdateEnvelope | null => {
    if (!user) return null;
    const professional = { user_id: user.id, name: user.fullname };
    const now = new Date().toISOString();

    switch (envelopeType) {
      case 'allergy_verification':
        if (!allergen.trim()) return null;
        return {
          type: 'allergy_verification',
          version: 1,
          allergen: allergen.trim(),
          reaction: reaction.trim() || null,
          severity,
          verified_by: professional,
          verified_at: now,
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      case 'diagnosis_verification':
        if (!condition.trim()) return null;
        return {
          type: 'diagnosis_verification',
          version: 1,
          condition: condition.trim(),
          date_of_diagnosis: dateOfDiagnosis.trim() || null,
          severity: diagnosisSeverity,
          verified_by: professional,
          verified_at: now,
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      case 'transfusion_witness':
        return {
          type: 'transfusion_witness',
          version: 1,
          consent_value: consentValue,
          witnessed_by: professional,
          witnessed_at: now,
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      case 'general_note':
        if (!note.trim()) return null;
        return { type: 'general_note', version: 1, note: note.trim(), author: professional, created_at: now };
      case 'medical_information_update': {
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
        if (Object.keys(patch).length === 0) return null;
        return { type: 'medical_information_update', version: 1, fields: patch, updated_by: professional, updated_at: now };
      }
    }
  }, [user, envelopeType, allergen, reaction, severity, condition, dateOfDiagnosis, diagnosisSeverity, consentValue, note, medInfoForm, medInfoInitial]);

  const describeError = (err: unknown): string => {
    if (err instanceof PatientKeyNotFoundError) return err.message;
    if (getErrorStatus(err) === 403) {
      return "You don't have professional access to submit updates yet.";
    }
    return getErrorMessage(err);
  };

  const onSubmitViaRelay = async () => {
    setOutcome(null);
    const payload = buildPayload();
    if (!payload) {
      setOutcome({ kind: 'error', message: 'Please fill in the required fields.' });
      return;
    }
    try {
      await submitViaRelay({ patientId, envelopeType, payload });
      setOutcome({ kind: 'success' });
    } catch (err) {
      setOutcome({ kind: 'error', message: describeError(err) });
    }
  };

  const onSubmitViaBle = async () => {
    setOutcome(null);
    const payload = buildPayload();
    if (!payload) {
      setOutcome({ kind: 'error', message: 'Please fill in the required fields.' });
      return;
    }

    const peer = bleScan.peer ?? (await bleScan.scan(patientId));
    if (!peer) {
      setOutcome({ kind: 'error', message: bleScan.error ?? 'Could not find the patient device nearby.' });
      return;
    }

    setBleSubmitting(true);
    try {
      const ciphertext = await seal(payload, peer.publicKeyBase64);
      const result = await connectAndSubmit(peer, envelopeType, ciphertext);
      if (result === 'acked') {
        setOutcome({ kind: 'success' });
      } else {
        setOutcome({ kind: 'error', message: 'The patient device did not confirm receipt. Please try again.' });
      }
    } catch {
      setOutcome({ kind: 'error', message: 'Bluetooth submission failed. Please try again.' });
    } finally {
      setBleSubmitting(false);
    }
  };

  const fields = useMemo(() => {
    switch (envelopeType) {
      case 'allergy_verification':
        return (
          <>
            <TextField label="Allergen" value={allergen} onChangeText={setAllergen} placeholder="e.g. Penicillin" />
            <TextField label="Reaction (optional)" value={reaction} onChangeText={setReaction} placeholder="e.g. Hives" />
            <PickerField label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />
            <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />
          </>
        );
      case 'diagnosis_verification':
        return (
          <>
            <TextField label="Condition" value={condition} onChangeText={setCondition} placeholder="e.g. Type 2 diabetes" />
            <DateField label="Date of diagnosis" value={dateOfDiagnosis} onChange={setDateOfDiagnosis} maximumDate={new Date()} />
            <PickerField label="Severity" options={DIAGNOSIS_SEVERITY_OPTIONS} value={diagnosisSeverity} onChange={setDiagnosisSeverity} />
            <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />
          </>
        );
      case 'transfusion_witness':
        return (
          <>
            <Card className="mb-4 flex-row items-center justify-between">
              <ThemedText>Patient consents to transfusion</ThemedText>
              <Switch value={consentValue} onValueChange={setConsentValue} />
            </Card>
            <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />
          </>
        );
      case 'general_note':
        return <TextField label="Note" value={note} onChangeText={setNote} multiline />;
      case 'medical_information_update':
        return (
          <>
            {medInfoReferenceName ? (
              <Card className="mb-4">
                <ThemedText type="small" color="mutedForeground">
                  Current name on file: {medInfoReferenceName}
                </ThemedText>
              </Card>
            ) : null}
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
            <View className="flex-row items-center justify-between">
              <ThemedText>No blood transfusion</ThemedText>
              <Switch value={medInfoForm.no_blood_transfusion} onValueChange={(v) => setMedInfoField('no_blood_transfusion', v)} />
            </View>
          </>
        );
    }
  }, [envelopeType, allergen, reaction, severity, condition, dateOfDiagnosis, diagnosisSeverity, consentValue, note, medInfoForm, medInfoReferenceName, setMedInfoField]);

  if (!Number.isInteger(patientId) || patientId <= 0) {
    return (
      <AppLayout>
        <ThemedText color="mutedForeground" className="text-center">Missing or invalid patient code. Please scan again.</ThemedText>
      </AppLayout>
    );
  }

  if (outcome?.kind === 'success') {
    return (
      <AppLayout>
        <Card className="items-center gap-2 py-8">
          <ThemedText type="heading" className="text-center">
            Update sent
          </ThemedText>
          <ThemedText type="caption" className="text-center">
            The patient will see this the next time their device syncs.
          </ThemedText>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View className="mb-6 flex-row flex-wrap gap-2">
        {ENVELOPE_TYPES.map(({ value, label }) => {
          const selected = value === envelopeType;
          return (
            <Pressable
              key={value}
              onPress={() => {
                setEnvelopeType(value);
                setOutcome(null);
              }}
              className="rounded-full border px-3.5 py-1.5"
              style={{ borderColor: selected ? theme.primary : theme.input, backgroundColor: selected ? theme.primary : 'transparent' }}
            >
              <ThemedText type="small" style={selected ? { color: theme.primaryForeground } : undefined}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {fields}

      <FormError message={outcome?.kind === 'error' ? outcome.message : null} />

      <View className="mt-2 gap-3">
        <PrimaryButton label="Send now" loading={relaySubmitting} onPress={() => void onSubmitViaRelay()} disabled={isSubmitting} />
        <PrimaryButton
          label={bleScan.state === 'scanning' ? 'Scanning for patient device…' : 'Sync via Bluetooth (patient nearby)'}
          variant="ghost"
          loading={bleScan.state === 'scanning' || bleSubmitting}
          onPress={() => void onSubmitViaBle()}
          disabled={isSubmitting}
        />
      </View>

      <ThemedText type="small" color="mutedForeground" className="mt-4 text-center">
        &quot;Send now&quot; delivers over the network next time the patient&apos;s device syncs. &quot;Sync via
        Bluetooth&quot; delivers immediately if the patient has Bluetooth sync open nearby.
      </ThemedText>
    </AppLayout>
  );
}
