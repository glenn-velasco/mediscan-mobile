import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateAllergy } from '@/features/allergies/useCreateAllergy';
import { allergySchema, type AllergyFormValues } from '@/lib/validation/allergy-schema';
import { ALLERGY_SEVERITY_OPTIONS } from '@/constants/allergy-severity';
import { zodResolver } from '@/lib/zod-resolver';

export default function NewAllergyScreen() {
  const router = useRouter();
  const { mutateAsync: createAllergy, isPending } = useCreateAllergy();

  const form = useForm<AllergyFormValues>({
    resolver: zodResolver(allergySchema),
    defaultValues: { allergen: '', reaction: '', severity: 'mild' },
  });

  const onSubmit = async (data: AllergyFormValues) => {
    await createAllergy(data);
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      <Controller control={form.control} name="allergen" render={({ field, fieldState }) => (
        <TextField label="Allergen" value={field.value} onChangeText={field.onChange} placeholder="e.g. Peanuts" error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="reaction" render={({ field, fieldState }) => (
        <TextField label="Reaction (optional)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="e.g. Hives" error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="severity" render={({ field }) => (
        <SelectField placeholder="Severity" options={ALLERGY_SEVERITY_OPTIONS} value={field.value} onChange={field.onChange} getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
      )} />

      <PrimaryButton label="Save" loading={isPending} onPress={() => void form.handleSubmit(onSubmit)()} disabled={isPending} />
    </AppLayout>
  );
}
