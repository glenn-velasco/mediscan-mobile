import { View, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { PhoneInput } from '@/components/form/phone-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useCreateEmergencyContact } from '@/features/emergency-contacts';
import { emergencyContactSchema, type EmergencyContactFormValues } from '@/lib/validation/emergency-contact-schema';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel } from '@/constants/relation-to-patient';
import { zodResolver } from '@/lib/zod-resolver';

export default function NewEmergencyContactScreen() {
  const router = useRouter();
  const { mutateAsync: createContact, isPending } = useCreateEmergencyContact();

  const form = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: { name: '', relationship: undefined, phone_country_code: 'PH', phone: '', is_primary: false },
  });

  const onSubmit = async (data: EmergencyContactFormValues) => {
    await createContact(data);
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      <Controller control={form.control} name="name" render={({ field, fieldState }) => (
        <TextField label="Name" value={field.value} onChangeText={field.onChange} placeholder="e.g. Juan Dela Cruz" error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="relationship" render={({ field, fieldState }) => (
        <SelectField placeholder="Relationship" options={RELATION_TO_PATIENT_OPTIONS} value={field.value} onChange={field.onChange} getLabel={(v) => RelationToPatientLabel[v]} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="phone" render={({ field, fieldState }) => (
        <PhoneInput
          value={{ countryCode: form.getValues('phone_country_code') ?? 'PH', phone: field.value ?? '' }}
          onChange={(v) => { form.setValue('phone_country_code', v.countryCode, { shouldDirty: true }); form.setValue('phone', v.phone, { shouldDirty: true }); }}
          error={fieldState.error?.message}
        />
      )} />
      <Controller control={form.control} name="is_primary" render={({ field }) => (
        <View className="flex-row items-center justify-between mb-4">
          <ThemedText>Primary contact</ThemedText>
          <Switch value={field.value} onValueChange={field.onChange} />
        </View>
      )} />

      <PrimaryButton label="Save" loading={isPending} onPress={() => void form.handleSubmit(onSubmit)()} disabled={isPending} />
    </AppLayout>
  );
}
