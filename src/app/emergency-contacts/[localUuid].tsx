import { useState } from 'react';
import { View, Switch, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { PhoneInput, type PhoneInputValue } from '@/components/form/phone-input';
import { PrimaryButton } from '@/components/primary-button';
import { useEmergencyContacts, useUpdateEmergencyContact, useDeleteEmergencyContact } from '@/features/emergency-contacts';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';

type Contact = NonNullable<ReturnType<typeof useEmergencyContacts>['data']>[number];

function ContactForm({ localUuid, contact }: { localUuid: string; contact: Contact }) {
  const router = useRouter();
  const { mutateAsync: updateContact, isPending: isSaving } = useUpdateEmergencyContact();
  const { mutateAsync: deleteContact, isPending: isDeleting } = useDeleteEmergencyContact();

  const [name, setName] = useState(contact.name);
  const [relationship, setRelationship] = useState<RelationToPatient | undefined>(
    (contact.relationship as RelationToPatient | null) ?? undefined,
  );
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({
    countryCode: contact.phone_country_code ?? 'PH',
    phone: contact.phone ?? '',
  });
  const [isPrimary, setIsPrimary] = useState(!!contact.is_primary);

  const onSubmit = async () => {
    if (!name.trim()) return;
    await updateContact({
      localUuid: contact.local_uuid,
      serverId: contact.server_id,
      payload: {
        name,
        relationship,
        phone_country_code: phoneValue.countryCode || undefined,
        phone: phoneValue.phone || undefined,
        is_primary: isPrimary,
      },
    });
    router.back();
  };

  const onDelete = async () => {
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
      <TextField label="Name *" value={name} onChangeText={setName} />
      <SelectField
        placeholder="Relationship"
        options={RELATION_TO_PATIENT_OPTIONS}
        value={relationship}
        onChange={setRelationship}
        allowClear
        getLabel={(v) => RelationToPatientLabel[v]}
      />
      <PhoneInput value={phoneValue} onChange={setPhoneValue} />

      <View className="flex-row items-center justify-between mb-4">
        <ThemedText>Primary contact</ThemedText>
        <Switch value={isPrimary} onValueChange={setIsPrimary} />
      </View>

      <PrimaryButton label="Save" loading={isSaving} onPress={onSubmit} disabled={isDeleting || !name.trim()} className="mb-2" />
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
