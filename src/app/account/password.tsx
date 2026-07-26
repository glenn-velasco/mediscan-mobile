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
import { z } from 'zod';
import { passwordValidation } from '@/lib/validation/password-schema';

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    password: passwordValidation,
    passwordConfirmation: z
      .string()
      .min(12, 'Please confirm your password')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { isConnected } = useNetworkStatus();
  const { mutateAsync: updatePassword, isPending } = useUpdatePassword();
  const { message, setError, clearErrors } = useApiError();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    clearErrors();
    setValidationErrors({});
    const result = changePasswordSchema.safeParse({ current_password: currentPassword, password, passwordConfirmation });
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

      <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} error={validationErrors.current_password} />
      <PasswordField label="New password" value={password} onChangeText={setPassword} error={validationErrors.password} />
      <PasswordField
        label="Confirm new password"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={validationErrors.passwordConfirmation}
      />

      <FormError message={message} />

      <PrimaryButton label="Save" loading={isPending} onPress={onSubmit} disabled={!isConnected} />
    </AppLayout>
  );
}
