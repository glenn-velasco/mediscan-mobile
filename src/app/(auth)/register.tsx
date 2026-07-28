import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { TextField } from '@/components/form/text-field';
import { PasswordField } from '@/components/form/password-field';
import { SelectField } from '@/components/form/select-field';
import { AddressFields, EMPTY_ADDRESS } from '@/components/form/address-fields';
import { DateField } from '@/components/form/date-field';
import { PhoneInput, type PhoneInputValue } from '@/components/form/phone-input';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useRegister } from '@/features/auth/useRegister';
import { useApiError } from '@/api/use-api-error';
import { getFieldErrors } from '@/api/errors';
import { SUFFIX_OPTIONS, SuffixLabel, type Suffix } from '@/constants/suffix';
import { GENDER_OPTIONS, GenderLabel, type Gender } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS, BloodTypeLabel, type BloodType } from '@/constants/blood-type';
import { RELIGION_OPTIONS, ReligionLabel, type Religion } from '@/constants/religion';
import { parsePhoneNumberFromString, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import type { MedicalInformationAddress } from '@/api/types';
import { formatAddress } from '@/lib/format-address';
import { registerSchema } from '@/lib/validation/register-schema';
import { registrationMedicalInfoSchema, registrationAddressSchema } from '@/lib/validation/registration-medical-info-schema';
import { useTheme } from '@/hooks/use-theme';

type StepIndicatorProps = {
  step: number;
  activeColor: string;
  inactiveColor: string;
};

function StepIndicator({ step, activeColor, inactiveColor }: StepIndicatorProps) {
  return (
    <View className="mb-2 flex-row items-center justify-center gap-1.5">
      {['step-0', 'step-1', 'step-2'].map((id, i) => (
        <View
          key={id}
          className="h-1 flex-1 rounded-full"
          style={{ backgroundColor: i <= step ? activeColor : inactiveColor }}
        />
      ))}
    </View>
  );
}

type Step0ContentProps = {
  firstName: string;
  setFirstName: (v: string) => void;
  middleName: string;
  setMiddleName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  suffix: Suffix | undefined;
  setSuffix: (v: Suffix | undefined) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  passwordConfirmation: string;
  setPasswordConfirmation: (v: string) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  friendlyMessage: string | null;
  onNext: () => void;
};

function Step0Content({
  firstName, setFirstName,
  middleName, setMiddleName,
  lastName, setLastName,
  suffix, setSuffix,
  email, setEmail,
  password, setPassword,
  passwordConfirmation, setPasswordConfirmation,
  fieldErrors, setFieldErrors, friendlyMessage, onNext,
}: Step0ContentProps) {
  return (
    <>
      <ThemedText type="overline" className="mb-3">
        Your name
      </ThemedText>
      <TextField
        label="First name"
        leftIcon="person-outline"
        value={firstName}
        onChangeText={(v) => {
          setFirstName(v);
          if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: '' }));
        }}
        error={fieldErrors.firstName}
      />
      <TextField label="Middle name" leftIcon="person-outline" value={middleName} onChangeText={setMiddleName} />
      <TextField
        label="Last name"
        leftIcon="person-outline"
        value={lastName}
        onChangeText={(v) => {
          setLastName(v);
          if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: '' }));
        }}
        error={fieldErrors.lastName}
      />
      <SelectField placeholder="Suffix" options={SUFFIX_OPTIONS} value={suffix} onChange={setSuffix} allowClear getLabel={(v) => SuffixLabel[v]} />

      <ThemedText type="overline" className="mb-3 mt-4">
        Account credentials
      </ThemedText>
      <TextField
        label="Email"
        leftIcon="mail-outline"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        error={fieldErrors.email}
      />
      <PasswordField
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
        }}
        error={fieldErrors.password}
      />
      <PasswordField
        label="Confirm password"
        value={passwordConfirmation}
        onChangeText={(v) => {
          setPasswordConfirmation(v);
          if (fieldErrors.passwordConfirmation) setFieldErrors((prev) => ({ ...prev, passwordConfirmation: '' }));
        }}
        error={fieldErrors.passwordConfirmation}
      />

      <FormError message={friendlyMessage} />
      <PrimaryButton label="Next" onPress={onNext} />
    </>
  );
}

type Step1ContentProps = {
  dateOfBirth: string;
  setDateOfBirth: (v: string) => void;
  gender: Gender | undefined;
  setGender: (v: Gender | undefined) => void;
  phoneValue: PhoneInputValue;
  setPhoneValue: (v: PhoneInputValue) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  friendlyMessage: string | null;
  onNext: () => void;
  onBack: () => void;
};

function Step1Content({
  dateOfBirth, setDateOfBirth,
  gender, setGender,
  phoneValue, setPhoneValue,
  fieldErrors, setFieldErrors, friendlyMessage, onNext, onBack,
}: Step1ContentProps) {
  return (
    <>
      <ThemedText type="overline" className="mb-3">
        Identity & contact
      </ThemedText>
      <DateField
        label="Date of birth"
        value={dateOfBirth}
        onChange={(v) => {
          setDateOfBirth(v);
          if (fieldErrors.date_of_birth) setFieldErrors((prev) => ({ ...prev, date_of_birth: '' }));
        }}
        maximumDate={new Date()}
        error={fieldErrors.date_of_birth}
      />
      <SelectField
        placeholder="Gender"
        options={GENDER_OPTIONS}
        value={gender}
        onChange={(v) => {
          setGender(v);
          if (fieldErrors.gender) setFieldErrors((prev) => ({ ...prev, gender: '' }));
        }}
        error={fieldErrors.gender}
        getLabel={(v) => GenderLabel[v]}
      />
      <PhoneInput
        value={phoneValue}
        onChange={(v) => {
          setPhoneValue(v);
          if (fieldErrors.phone || fieldErrors.phone_country_code) {
            setFieldErrors((prev) => ({ ...prev, phone: '', phone_country_code: '' }));
          }
        }}
        error={fieldErrors.phone || fieldErrors.phoneNumber || fieldErrors.phone_country_code}
      />

      <FormError message={friendlyMessage} />
      <PrimaryButton label="Next" onPress={onNext} />
      <PrimaryButton label="Back" onPress={onBack} variant="ghost" />
    </>
  );
}

type Step2ContentProps = {
  medicalAddress: MedicalInformationAddress;
  setMedicalAddress: (v: MedicalInformationAddress) => void;
  bloodType: BloodType | undefined;
  setBloodType: (v: BloodType | undefined) => void;
  religion: Religion | undefined;
  setReligion: (v: Religion | undefined) => void;
  noBloodTransfusion: boolean;
  setNoBloodTransfusion: (v: boolean) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (v: boolean | ((prev: boolean) => boolean)) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  friendlyMessage: string | null;
  isPending: boolean;
  onSubmit: () => void;
  onBack: () => void;
  router: ReturnType<typeof useRouter>;
  theme: ReturnType<typeof useTheme>;
};

function Step2Content({
  medicalAddress, setMedicalAddress,
  bloodType, setBloodType,
  religion, setReligion,
  noBloodTransfusion, setNoBloodTransfusion,
  acceptedTerms, setAcceptedTerms,
  fieldErrors, setFieldErrors, friendlyMessage, isPending, onSubmit, onBack, router, theme,
}: Step2ContentProps) {
  return (
    <>
      <ThemedText type="overline" className="mb-3">
        Medical details
      </ThemedText>
      <AddressFields
        value={medicalAddress}
        onChange={(v) => {
          setMedicalAddress(v);
          const hasAddressError = fieldErrors.street || fieldErrors.address || fieldErrors.unit || fieldErrors.city || fieldErrors.province || fieldErrors.postal_code || fieldErrors.country;
          if (hasAddressError) {
            setFieldErrors((prev) => ({ ...prev, street: '', address: '', unit: '', city: '', province: '', postal_code: '', country: '' }));
          }
        }}
        errors={{ street: fieldErrors.street || fieldErrors.address, unit: fieldErrors.unit, city: fieldErrors.city, province: fieldErrors.province, postal_code: fieldErrors.postal_code, country: fieldErrors.country }}
        disabled={isPending}
      />
      <SelectField
        placeholder="Blood type"
        options={BLOOD_TYPE_OPTIONS}
        value={bloodType}
        onChange={setBloodType}
        getLabel={(v) => BloodTypeLabel[v]}
        disabled={isPending}
      />
      <SelectField
        placeholder="Religion"
        options={RELIGION_OPTIONS}
        value={religion}
        onChange={setReligion}
        allowClear
        getLabel={(v) => ReligionLabel[v]}
        disabled={isPending}
      />
      <View className="mb-4 flex-row items-center justify-between">
        <ThemedText>No blood transfusion</ThemedText>
        <Switch value={noBloodTransfusion} onValueChange={setNoBloodTransfusion} disabled={isPending} />
      </View>

      <Pressable
        className="mb-2 flex-row items-start gap-3"
        onPress={() => {
          setAcceptedTerms((v) => !v);
          if (fieldErrors.terms) setFieldErrors((prev) => ({ ...prev, terms: '' }));
        }}
        disabled={isPending}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acceptedTerms }}
        style={isPending ? { opacity: 0.6 } : undefined}
      >
        <Ionicons
          name={acceptedTerms ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={22}
          color={acceptedTerms ? theme.primary : theme.mutedForeground}
          style={{ marginTop: 1 }}
        />
        <ThemedText type="body" color="mutedForeground" className="flex-1">
          I have read and agree to the{' '}
          <ThemedText
            type="linkPrimary"
            onPress={(e) => {
              if (isPending) return;
              e.stopPropagation?.();
              router.push('/terms');
            }}
            style={isPending ? { opacity: 0.6 } : undefined}
          >
            Terms of Service
          </ThemedText>
        </ThemedText>
      </Pressable>
      {fieldErrors.terms ? (
        <ThemedText type="small" color="destructive" className="mb-2 pl-8">
          {fieldErrors.terms}
        </ThemedText>
      ) : null}

      <FormError message={friendlyMessage} />
      <PrimaryButton label="Create account" loading={isPending} onPress={onSubmit} />
      <PrimaryButton label="Back" onPress={onBack} variant="ghost" />
    </>
  );
}

export default function RegisterScreen() {
  const { mutateAsync: register, isPending } = useRegister();
  const router = useRouter();
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

  const [bloodType, setBloodType] = useState<BloodType | undefined>(undefined);
  const [religion, setReligion] = useState<Religion | undefined>(undefined);
  const [medicalAddress, setMedicalAddress] = useState<MedicalInformationAddress>(EMPTY_ADDRESS);
  const [noBloodTransfusion, setNoBloodTransfusion] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const friendlyMessage = message ? 'Something went wrong. Please check your details and try again.' : null;

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
      blood_type: bloodType,
      religion,
      no_blood_transfusion: noBloodTransfusion,
    });
    if (!medicalResult.success) {
      setFieldErrors(parseFieldErrors(medicalResult.error.issues));
      setStep(1);
      return;
    }

    const addressResult = registrationAddressSchema.safeParse(medicalAddress);
    const termsError = !acceptedTerms ? 'You must accept the Terms of Service' : undefined;
    if (!addressResult.success || termsError) {
      setFieldErrors({
        ...parseFieldErrors(addressResult.success ? [] : addressResult.error.issues),
        ...(termsError ? { terms: termsError } : {}),
      });
      setStep(2);
      return;
    }

    try {
      let phoneNumber = '';
      if (phoneValue.phone && phoneValue.countryCode) {
        const dialCode = getCountryCallingCode(phoneValue.countryCode as CountryCode);
        const fullNumber = `+${dialCode}${phoneValue.phone}`;
        const parsed = parsePhoneNumberFromString(fullNumber);
        if (parsed?.isValid()) {
          phoneNumber = parsed.number;
        } else {
          setFieldErrors({ phone: 'Please enter a valid phone number' });
          setStep(1);
          return;
        }
      }

      const registerPayload = {
        email: step0Result.data.email,
        password: step0Result.data.password,
        password_confirmation: step0Result.data.passwordConfirmation,
        first_name: step0Result.data.firstName,
        middle_name: step0Result.data.middleName,
        last_name: step0Result.data.lastName,
        suffix: step0Result.data.suffix,
        dob: dateOfBirth,
        gender: medicalResult.data.gender,
        address: formatAddress(medicalAddress),
        phone_number: phoneNumber,
        phone_country_code: phoneValue.countryCode,
      };

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
        address: medicalAddress,
        blood_type: bloodType || undefined,
        religion: religion || undefined,
        no_blood_transfusion: noBloodTransfusion,
      };

      const result = await register({ payload: registerPayload, medicalInfo });
      if (result.pending) {
        router.replace('/registration-pending');
      } else {
        router.replace('/onboarding-tasks');
      }
    } catch (err) {
      setError(err);
      const apiErrors = getFieldErrors(err, { dob: 'date_of_birth', phone_number: 'phone' });
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...apiErrors }));
        const step2Keys = ['address'];
        const step1Keys = ['date_of_birth', 'gender', 'phone', 'phone_country_code'];
        const step0Keys = ['firstName', 'lastName', 'email', 'password', 'passwordConfirmation'];
        if (step2Keys.some((k) => k in apiErrors)) setStep(2);
        else if (step1Keys.some((k) => k in apiErrors)) setStep(1);
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

      <StepIndicator step={step} activeColor={theme.primary} inactiveColor={theme.muted} />

      <ThemedText type="caption" color="mutedForeground" className="mb-6 text-center">
        Step {step + 1} of 3
      </ThemedText>

      {step === 0 && (
        <Step0Content
          firstName={firstName} setFirstName={setFirstName}
          middleName={middleName} setMiddleName={setMiddleName}
          lastName={lastName} setLastName={setLastName}
          suffix={suffix} setSuffix={setSuffix}
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          passwordConfirmation={passwordConfirmation} setPasswordConfirmation={setPasswordConfirmation}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          friendlyMessage={friendlyMessage}
          onNext={onNext}
        />
      )}

      {step === 1 && (
        <Step1Content
          dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
          gender={gender} setGender={setGender}
          phoneValue={phoneValue} setPhoneValue={setPhoneValue}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          friendlyMessage={friendlyMessage}
          onNext={onNext}
          onBack={onBack}
        />
      )}

      {step === 2 && (
        <Step2Content
          medicalAddress={medicalAddress} setMedicalAddress={setMedicalAddress}
          bloodType={bloodType} setBloodType={setBloodType}
          religion={religion} setReligion={setReligion}
          noBloodTransfusion={noBloodTransfusion} setNoBloodTransfusion={setNoBloodTransfusion}
          acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          friendlyMessage={friendlyMessage}
          isPending={isPending}
          onSubmit={onSubmit}
          onBack={onBack}
          router={router}
          theme={theme}
        />
      )}

      <Link href="/" className="mt-6 self-center">
        <ThemedText type="link">Already have an account? Log in</ThemedText>
      </Link>
    </AuthLayout>
  );
}

