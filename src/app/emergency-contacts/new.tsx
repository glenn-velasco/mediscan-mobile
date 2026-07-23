import { useState } from 'react';
import { Pressable, View, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { PhoneInput, type PhoneInputValue } from '@/components/form/phone-input';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateEmergencyContact } from '@/features/emergency-contacts';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';

export default function NewEmergencyContactScreen() {
  const router = useRouter();
  const { mutateAsync: createContact, isPending } = useCreateEmergencyContact();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<RelationToPatient | undefined>(undefined);
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({ countryCode: 'PH', phone: '' });
  const [isPrimary, setIsPrimary] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) return;
    await createContact({
      name,
      relationship,
      phone_country_code: phoneValue.countryCode || undefined,
      phone: phoneValue.phone || undefined,
      is_primary: isPrimary,
    });
    router.back();
  };

  return (
    <AppLayout>
      <TextField label="Name *" value={name} onChangeText={setName} placeholder="e.g. Juan Dela Cruz" />
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

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!name.trim()} />
    </AppLayout>
  );
}
