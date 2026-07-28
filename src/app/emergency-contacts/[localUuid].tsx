import { useEffect } from 'react';
import { View, Switch, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller, useFormState } from 'react-hook-form';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { PhoneInput } from '@/components/form/phone-input';
import { PrimaryButton } from '@/components/primary-button';
import { useEmergencyContacts, useUpdateEmergencyContact, useDeleteEmergencyContact } from '@/features/emergency-contacts';
import { emergencyContactSchema, type EmergencyContactFormValues } from '@/lib/validation/emergency-contact-schema';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';
import { zodResolver } from '@/lib/zod-resolver';

type Contact = NonNullable<ReturnType<typeof useEmergencyContacts>['data']>[number];

function ContactForm({ localUuid, contact }: { localUuid: string; contact: Contact }) {
  const router = useRouter();
  const { mutateAsync: updateContact, isPending: isSaving } = useUpdateEmergencyContact();
  const { mutateAsync: deleteContact, isPending: isDeleting } = useDeleteEmergencyContact();

  const form = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: {
      name: contact.name,
      relationship: (contact.relationship as RelationToPatient | null) ?? undefined,
      phone_country_code: contact.phone_country_code ?? 'PH',
      phone: contact.phone ?? '',
      is_primary: !!contact.is_primary,
    },
  });

  const { isDirty } = useFormState({ control: form.control });

  // react-doctor-disable-next-line react-hooks-js/exhaustive-deps
  useEffect(() => {
    form.reset({
      name: contact.name,
      relationship: (contact.relationship as RelationToPatient | null) ?? undefined,
      phone_country_code: contact.phone_country_code ?? 'PH',
      phone: contact.phone ?? '',
      is_primary: !!contact.is_primary,
    });
  }, [contact, form.reset]);

  const onSubmit = async (data: EmergencyContactFormValues) => {
    await updateContact({ localUuid: contact.local_uuid, serverId: contact.server_id, payload: data });
    router.back();
  };

  const onDelete = () => {
    Alert.alert('Remove Contact', `Are you sure you want to remove ${contact.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteContact(localUuid);
          router.back();
        },
      },
    ]);
  };

  return (
    <AppLayout avoidKeyboard>
      <Controller control={form.control} name="name" render={({ field, fieldState }) => (
        <TextField label="Name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
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

      <PrimaryButton label="Save" loading={isSaving} onPress={() => void form.handleSubmit(onSubmit)()} disabled={!isDirty || isDeleting || isSaving} className="mb-2" />
      <PrimaryButton label="Remove contact" variant="danger" loading={isDeleting} onPress={onDelete} disabled={isSaving} />
    </AppLayout>
  );
}

export default function EditEmergencyContactScreen() {
  const { localUuid } = useLocalSearchParams<{ localUuid: string }>();
  const { data: contacts } = useEmergencyContacts();
  const contact = contacts?.find((c) => c.local_uuid === localUuid);

  if (!contact) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>Contact not found</ThemedText>
      </ThemedView>
    );
  }

  return <ContactForm key={localUuid} localUuid={localUuid} contact={contact} />;
}
