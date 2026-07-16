import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PickerField } from '@/components/form/picker-field';
import { DateField } from '@/components/form/date-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateDiagnosis } from '@/features/diagnoses/useCreateDiagnosis';
import { DIAGNOSIS_SEVERITY_OPTIONS, type DiagnosisSeverity } from '@/constants/diagnosis-severity';

export default function NewDiagnosisScreen() {
  const router = useRouter();
  const { mutateAsync: createDiagnosis, isPending } = useCreateDiagnosis();
  const [condition, setCondition] = useState('');
  const [dateOfDiagnosis, setDateOfDiagnosis] = useState('');
  const [severity, setSeverity] = useState<DiagnosisSeverity>('chronic');

  const onSubmit = async () => {
    if (!condition.trim()) return;
    await createDiagnosis({ condition, date_of_diagnosis: dateOfDiagnosis || undefined, severity });
    router.back();
  };

  return (
    <AppLayout>
      <TextField label="Condition" value={condition} onChangeText={setCondition} placeholder="e.g. Type 2 diabetes" />
      <DateField label="Date of diagnosis" value={dateOfDiagnosis} onChange={setDateOfDiagnosis} maximumDate={new Date()} />
      <PickerField label="Severity" options={DIAGNOSIS_SEVERITY_OPTIONS} value={severity} onChange={setSeverity} />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!condition.trim()} />
    </AppLayout>
  );
}
