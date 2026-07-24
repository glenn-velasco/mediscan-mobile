import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateCondition } from '@/features/conditions/useCreateCondition';

export default function NewConditionScreen() {
  const router = useRouter();
  const { mutateAsync: createCondition, isPending } = useCreateCondition();
  const [description, setDescription] = useState('');

  const onSubmit = async () => {
    if (!description.trim()) return;
    await createCondition({ description });
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Diabetes, Hypertension"
        multiline
      />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!description.trim()} />
    </AppLayout>
  );
}
