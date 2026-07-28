import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';

import { useAuth } from '@/auth/useAuth';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { DateField } from '@/components/form/date-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateDiagnosis } from '@/features/diagnoses/useCreateDiagnosis';
import { diagnosisSchema, type DiagnosisFormValues } from '@/lib/validation/diagnosis-schema';
import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';
import { zodResolver } from '@/lib/zod-resolver';

export default function NewDiagnosisScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isVerifiedProfessional = user?.permissions?.includes('verified professional') ?? false;
  const { mutateAsync: createDiagnosis, isPending } = useCreateDiagnosis();

  const form = useForm<DiagnosisFormValues>({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: { condition: '', date_of_diagnosis: '', severity: 'chronic' },
  });

  const onSubmit = async (data: DiagnosisFormValues) => {
    await createDiagnosis(data);
    router.back();
  };

  if (!isVerifiedProfessional) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>Only a verified professional can add a diagnosis.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <AppLayout avoidKeyboard>
      <Controller control={form.control} name="condition" render={({ field, fieldState }) => (
        <TextField label="Condition" value={field.value} onChangeText={field.onChange} placeholder="e.g. Type 2 diabetes" error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="date_of_diagnosis" render={({ field }) => (
        <DateField label="Date of diagnosis" value={field.value ?? ''} onChange={field.onChange} maximumDate={new Date()} />
      )} />
      <Controller control={form.control} name="severity" render={({ field }) => (
        <SelectField placeholder="Severity" options={DIAGNOSIS_SEVERITY_OPTIONS} value={field.value} onChange={field.onChange} getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
      )} />

      <PrimaryButton label="Save" loading={isPending} onPress={() => void form.handleSubmit(onSubmit)()} disabled={isPending} />
    </AppLayout>
  );
}
