import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { PasswordField } from '@/components/form/password-field';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { ConflictBanner } from '@/components/conflict-banner';
import { useUpdatePassword } from '@/features/account/useUpdatePassword';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useApiError } from '@/api/use-api-error';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { isConnected } = useNetworkStatus();
  const { mutateAsync: updatePassword, isPending } = useUpdatePassword();
  const { message, setError, clearErrors } = useApiError();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  // Password changes are never queued for offline sync — storing a pending password change at rest
  // locally would be a security liability, so this always requires a live connection.
  const onSubmit = async () => {
    clearErrors();
    try {
      await updatePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      router.back();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <AppLayout avoidKeyboard>
      {!isConnected ? (
        <ConflictBanner message="Changing your password requires an internet connection." className="mb-4" />
      ) : null}

      <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
      <PasswordField label="New password" value={password} onChangeText={setPassword} />
      <PasswordField
        label="Confirm new password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
      />

      <FormError message={message} />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!isConnected} />
    </AppLayout>
  );
}
