import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateMedication } from '@/features/medications/useCreateMedication';
import { medicationSchema, type MedicationFormValues } from '@/lib/validation/medication-schema';
import { zodResolver } from '@/lib/zod-resolver';

export default function NewMedicationScreen() {
  const router = useRouter();
  const { mutateAsync: createMedication, isPending } = useCreateMedication();

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationSchema),
    defaultValues: { name: '', dosage: '', frequency: '', notes: '' },
  });

  const onSubmit = async (data: MedicationFormValues) => {
    await createMedication({ name: data.name, dosage: data.dosage ?? '', frequency: data.frequency ?? '', notes: data.notes });
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      <Controller control={form.control} name="name" render={({ field, fieldState }) => (
        <TextField label="Name" value={field.value} onChangeText={field.onChange} placeholder="e.g. Metformin" error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="dosage" render={({ field, fieldState }) => (
        <TextField label="Dosage" value={field.value ?? ''} onChangeText={field.onChange} placeholder="e.g. 500mg" error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="frequency" render={({ field, fieldState }) => (
        <TextField label="Frequency" value={field.value ?? ''} onChangeText={field.onChange} placeholder="e.g. Twice daily" error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="notes" render={({ field, fieldState }) => (
        <TextField label="Notes (optional)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="e.g. Take with food" error={fieldState.error?.message} />
      )} />

      <PrimaryButton label="Save" loading={isPending} onPress={() => void form.handleSubmit(onSubmit)()} disabled={isPending} />
    </AppLayout>
  );
}
