import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PrimaryButton } from '@/components/primary-button';
import { useCreateCondition } from '@/features/conditions/useCreateCondition';
import { conditionSchema, type ConditionFormValues } from '@/lib/validation/condition-schema';
import { zodResolver } from '@/lib/zod-resolver';

export default function NewConditionScreen() {
  const router = useRouter();
  const { mutateAsync: createCondition, isPending } = useCreateCondition();

  const form = useForm<ConditionFormValues>({
    resolver: zodResolver(conditionSchema),
    defaultValues: { description: '' },
  });

  const onSubmit = async (data: ConditionFormValues) => {
    await createCondition(data);
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      <Controller control={form.control} name="description" render={({ field, fieldState }) => (
        <TextField label="Description" value={field.value} onChangeText={field.onChange} placeholder="e.g. Diabetes, Hypertension" multiline error={fieldState.error?.message} />
      )} />

      <PrimaryButton label="Save" loading={isPending} onPress={() => void form.handleSubmit(onSubmit)()} disabled={isPending} />
    </AppLayout>
  );
}
