import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { ConflictBanner } from '@/components/conflict-banner';
import { useUpdateEmail } from '@/features/account/useUpdateEmail';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useAuth } from '@/auth/useAuth';
import { useApiError } from '@/api/use-api-error';
import { emailSchema } from '@/lib/validation/email-schema';

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected } = useNetworkStatus();
  const { mutateAsync: updateEmail, isPending } = useUpdateEmail();
  const { message, setError, clearErrors } = useApiError();
  const [email, setEmail] = useState(user?.email ?? '');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    clearErrors();
    setValidationErrors({});
    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setValidationErrors(errors);
      return;
    }
    try {
      await updateEmail(email);
      router.back();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AppLayout avoidKeyboard>
      {!isConnected ? (
        <ConflictBanner message="Changing your email requires an internet connection." className="mb-4" />
      ) : null}

      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={validationErrors.email} />

      <FormError message={message} />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!isConnected} />
    </AppLayout>
  );
}
