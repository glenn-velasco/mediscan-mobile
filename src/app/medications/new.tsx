import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateMedication } from '@/features/medications/useCreateMedication';

export default function NewMedicationScreen() {
  const router = useRouter();
  const { mutateAsync: createMedication, isPending } = useCreateMedication();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [notes, setNotes] = useState('');

  const onSubmit = async () => {
    if (!name.trim()) return;
    await createMedication({ name, dosage, frequency, notes: notes || undefined });
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Metformin" />
      <TextField label="Dosage" value={dosage} onChangeText={setDosage} placeholder="e.g. 500mg" />
      <TextField label="Frequency" value={frequency} onChangeText={setFrequency} placeholder="e.g. Twice daily" />
      <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. Take with food" />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!name.trim()} />
    </AppLayout>
  );
}
