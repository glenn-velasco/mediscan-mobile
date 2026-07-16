import { useState } from 'react';
import { Pressable, View, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PhoneInput, type PhoneInputValue } from '@/components/form/phone-input';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateEmergencyContact } from '@/features/emergency-contacts';

export default function NewEmergencyContactScreen() {
  const router = useRouter();
  const { mutateAsync: createContact, isPending } = useCreateEmergencyContact();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({ countryCode: 'PH', phone: '' });
  const [isPrimary, setIsPrimary] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) return;
    await createContact({
      name,
      relationship: relationship || undefined,
      phone_country_code: phoneValue.countryCode || undefined,
      phone: phoneValue.phone || undefined,
      is_primary: isPrimary,
    });
    router.back();
  };

  return (
    <AppLayout>
      <TextField label="Name *" value={name} onChangeText={setName} placeholder="e.g. Juan Dela Cruz" />
      <TextField label="Relationship" value={relationship} onChangeText={setRelationship} placeholder="e.g. Spouse" />
      <PhoneInput value={phoneValue} onChange={setPhoneValue} />

      <View className="flex-row items-center justify-between mb-4">
        <ThemedText>Primary contact</ThemedText>
        <Switch value={isPrimary} onValueChange={setIsPrimary} />
      </View>

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!name.trim()} />
    </AppLayout>
  );
}
