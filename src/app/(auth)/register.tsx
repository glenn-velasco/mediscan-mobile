import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { PasswordField } from '@/components/form/password-field';
import { SelectField } from '@/components/form/select-field';
import { DateField } from '@/components/form/date-field';
import { PhoneInput, type PhoneInputValue } from '@/components/form/phone-input';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useRegister } from '@/features/auth/useRegister';
import { useApiError } from '@/api/use-api-error';
import { getFieldErrors } from '@/api/errors';
import { SUFFIX_OPTIONS, type Suffix } from '@/constants/suffix';
import { GENDER_OPTIONS, type Gender } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS, type BloodType } from '@/constants/blood-type';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { registerSchema } from '@/lib/validation/register-schema';
import { registrationMedicalInfoSchema } from '@/lib/validation/registration-medical-info-schema';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterScreen() {
  const { mutateAsync: register, isPending } = useRegister();
  const theme = useTheme();
  const { message, setError, clearErrors } = useApiError();

  const [step, setStep] = useState(0);

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState<Suffix | undefined>(undefined);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({ countryCode: 'PH', phone: '' });
  const [address, setAddress] = useState('');

  const [bloodType, setBloodType] = useState<BloodType | undefined>(undefined);
  const [religion, setReligion] = useState('');
  const [noBloodTransfusion, setNoBloodTransfusion] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const parseFieldErrors = (issues: readonly any[]) => {
    const errors: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path[0] as string;
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return errors;
  };

  const onNext = () => {
    clearErrors();
    setFieldErrors({});
    if (step === 0) {
      const result = registerSchema.safeParse({
        firstName,
        middleName,
        lastName,
        suffix,
        email,
        password,
        passwordConfirmation,
      });
      if (!result.success) {
        setFieldErrors(parseFieldErrors(result.error.issues));
        return;
      }
    }
    if (step === 1) {
      const result = registrationMedicalInfoSchema.safeParse({
        date_of_birth: dateOfBirth,
        gender,
        phone_country_code: phoneValue.countryCode,
        phone: phoneValue.phone,
        address,
        blood_type: bloodType,
        religion,
        no_blood_transfusion: noBloodTransfusion,
      });
      if (!result.success) {
        setFieldErrors(parseFieldErrors(result.error.issues));
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const onBack = () => {
    clearErrors();
    setFieldErrors({});
    setStep((s) => s - 1);
  };

  const onSubmit = async () => {
    clearErrors();
    setFieldErrors({});

    const step0Result = registerSchema.safeParse({
      firstName,
      middleName,
      lastName,
      suffix,
      email,
      password,
      passwordConfirmation,
    });
    if (!step0Result.success) {
      setFieldErrors(parseFieldErrors(step0Result.error.issues));
      return;
    }

    const medicalResult = registrationMedicalInfoSchema.safeParse({
      date_of_birth: dateOfBirth,
      gender,
      phone_country_code: phoneValue.countryCode,
      phone: phoneValue.phone,
      address,
      blood_type: bloodType,
      religion,
      no_blood_transfusion: noBloodTransfusion,
    });
    if (!medicalResult.success) {
      setFieldErrors(parseFieldErrors(medicalResult.error.issues));
      setStep(1);
      return;
    }

    try {
      let phoneNumber = '';
      if (phoneValue.phone && phoneValue.countryCode) {
        const parsed = parsePhoneNumberFromString(phoneValue.phone, phoneValue.countryCode as any);
        phoneNumber = parsed ? parsed.number : `+${phoneValue.countryCode}${phoneValue.phone}`;
      }
      console.warn('[register] phoneNumber constructed:', phoneNumber, '| raw phone:', phoneValue.phone, '| cc:', phoneValue.countryCode);

      const registerPayload = {
        email: step0Result.data.email,
        password: step0Result.data.password,
        password_confirmation: step0Result.data.passwordConfirmation,
        first_name: step0Result.data.firstName,
        middle_name: step0Result.data.middleName,
        last_name: step0Result.data.lastName,
        suffix: step0Result.data.suffix,
        dob: dateOfBirth,
        gender: medicalResult.data.gender.toLowerCase(),
        address,
        phone_number: phoneNumber,
        phone_country_code: phoneValue.countryCode,
      };
      console.warn('[register] payload:', registerPayload);

      const medicalInfo = {
        email: step0Result.data.email,
        first_name: step0Result.data.firstName,
        middle_name: step0Result.data.middleName,
        last_name: step0Result.data.lastName,
        suffix: step0Result.data.suffix,
        date_of_birth: dateOfBirth || undefined,
        gender: gender || undefined,
        phone_country_code: phoneValue.countryCode || undefined,
        phone: phoneValue.phone || undefined,
        address: address || undefined,
        blood_type: bloodType || undefined,
        religion: religion || undefined,
        no_blood_transfusion: noBloodTransfusion,
      };

      await register({ payload: registerPayload, medicalInfo });
    } catch (err) {
      console.warn('[register] error:', err);
      setError(err);
      const apiErrors = getFieldErrors(err, { dob: 'date_of_birth', phone_number: 'phone' });
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...apiErrors }));
        const step1Keys = ['date_of_birth', 'gender', 'address', 'phone', 'phone_country_code'];
        const step0Keys = ['firstName', 'lastName', 'email', 'password', 'passwordConfirmation'];
        if (step1Keys.some((k) => k in apiErrors)) setStep(1);
        else if (step0Keys.some((k) => k in apiErrors)) setStep(0);
      }
    }
  };

  return (
    <AuthLayout>
      <View className="mb-6 items-center gap-1">
        <ThemedText type="title">Create your account</ThemedText>
        <ThemedText type="caption" color="mutedForeground" className="mt-1 text-center">
          MediScan puts your complete medical profile behind a QR code on your phone.
        </ThemedText>
      </View>

      <View className="mb-2 flex-row items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ backgroundColor: i <= step ? theme.primary : theme.muted }}
          />
        ))}
      </View>

      <ThemedText type="caption" color="mutedForeground" className="mb-6 text-center">
        Step {step + 1} of 3
      </ThemedText>

      {step === 0 && (
        <>
          <ThemedText type="overline" className="mb-3">
            Your name
          </ThemedText>
          <TextField label="First name" leftIcon="person-outline" value={firstName} onChangeText={setFirstName} error={fieldErrors.firstName} />
          <TextField label="Middle name" leftIcon="person-outline" value={middleName} onChangeText={setMiddleName} />
          <TextField label="Last name" leftIcon="person-outline" value={lastName} onChangeText={setLastName} error={fieldErrors.lastName} />
          <SelectField placeholder="Suffix" options={SUFFIX_OPTIONS} value={suffix} onChange={setSuffix} allowClear />

          <ThemedText type="overline" className="mb-3 mt-4">
            Account credentials
          </ThemedText>
          <TextField
            label="Email"
            leftIcon="mail-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldErrors.email}
          />
          <PasswordField label="Password" value={password} onChangeText={setPassword} error={fieldErrors.password} />
          <PasswordField
            label="Confirm password"
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            error={fieldErrors.passwordConfirmation}
          />

          <FormError message={message} />
          <PrimaryButton label="Next" onPress={onNext} />
        </>
      )}

      {step === 1 && (
        <>
          <ThemedText type="overline" className="mb-3">
            Identity & contact
          </ThemedText>
          <DateField
            label="Date of birth"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            maximumDate={new Date()}
            error={fieldErrors.date_of_birth}
          />
          <SelectField
            placeholder="Gender"
            options={GENDER_OPTIONS}
            value={gender}
            onChange={setGender}
            error={fieldErrors.gender}
          />
          <PhoneInput value={phoneValue} onChange={setPhoneValue} error={fieldErrors.phone || fieldErrors.phoneNumber || fieldErrors.phone_country_code} />
          <TextField label="Address" value={address} onChangeText={setAddress} multiline error={fieldErrors.address} />

          <FormError message={message} />
          <PrimaryButton label="Next" onPress={onNext} />
          <PrimaryButton label="Back" onPress={onBack} variant="ghost" />
        </>
      )}

      {step === 2 && (
        <>
          <ThemedText type="overline" className="mb-3">
            Medical details
          </ThemedText>
          <SelectField
            placeholder="Blood type"
            options={BLOOD_TYPE_OPTIONS}
            value={bloodType}
            onChange={setBloodType}
          />
          <TextField label="Religion" value={religion} onChangeText={setReligion} />
          <View className="mb-4 flex-row items-center justify-between">
            <ThemedText>No blood transfusion</ThemedText>
            <Switch value={noBloodTransfusion} onValueChange={setNoBloodTransfusion} />
          </View>

          <FormError message={message} />
          <PrimaryButton label="Create account" loading={isPending} onPress={onSubmit} />
          <PrimaryButton label="Back" onPress={onBack} variant="ghost" />
        </>
      )}

      <Link href="/" className="mt-6 self-center">
        <ThemedText type="link">Already have an account? Log in</ThemedText>
      </Link>
    </AuthLayout>
  );
}

