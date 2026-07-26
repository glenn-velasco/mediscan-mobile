import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PickerField } from '@/components/form/picker-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateAllergy } from '@/features/allergies/useCreateAllergy';
import type { Allergy } from '@/api/types';

const SEVERITIES: Allergy['severity'][] = ['mild', 'moderate', 'severe', 'life-threatening'];

export default function NewAllergyScreen() {
  const router = useRouter();
  const { mutateAsync: createAllergy, isPending } = useCreateAllergy();
  const [allergen, setAllergen] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<Allergy['severity']>('mild');

  const onSubmit = async () => {
    if (!allergen.trim()) return;
    await createAllergy({ allergen, reaction: reaction || undefined, severity });
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      <TextField label="Allergen" value={allergen} onChangeText={setAllergen} placeholder="e.g. Peanuts" />
      <TextField label="Reaction (optional)" value={reaction} onChangeText={setReaction} placeholder="e.g. Hives" />
      <PickerField label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!allergen.trim()} />
    </AppLayout>
  );
}
