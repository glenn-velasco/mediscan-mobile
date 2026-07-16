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

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected } = useNetworkStatus();
  const { mutateAsync: updateEmail, isPending } = useUpdateEmail();
  const { message, setError, clearErrors } = useApiError();
  const [email, setEmail] = useState(user?.email ?? '');

  // Email is account identity, not a profile field: unlike medical-information edits, it's never
  // queued for offline sync — the server's uniqueness constraint can't be validated locally, so
  // this action requires a live connection every time.
  const onSubmit = async () => {
    clearErrors();
    try {
      await updateEmail(email);
      router.back();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AppLayout>
      {!isConnected ? (
        <ConflictBanner message="Changing your email requires an internet connection." className="mb-4" />
      ) : null}

      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

      <FormError message={message} />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!isConnected} />
    </AppLayout>
  );
}
