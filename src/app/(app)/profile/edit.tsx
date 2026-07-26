import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Avatar } from '@/components/avatar';
import { TextField } from '@/components/form/text-field';
import { DateField } from '@/components/form/date-field';
import { SelectField } from '@/components/form/select-field';
import { AddressFields, EMPTY_ADDRESS } from '@/components/form/address-fields';
import { PhoneInput, type PhoneInputValue } from '@/components/form/phone-input';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useUpdateMedicalInformation } from '@/features/medical-information/useUpdateMedicalInformation';
import { useMedicalInformationAvatar } from '@/features/medical-information/useMedicalInformationAvatar';
import { useAuth } from '@/auth/useAuth';
import { useApiError } from '@/api/use-api-error';
import { getFieldErrors } from '@/api/errors';
import { GENDER_OPTIONS, GenderLabel, type Gender } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS, BloodTypeLabel, type BloodType } from '@/constants/blood-type';
import { SUFFIX_OPTIONS, SuffixLabel, type Suffix } from '@/constants/suffix';
import { RELIGION_OPTIONS, ReligionLabel, type Religion } from '@/constants/religion';
import { medicalInformationSchema } from '@/lib/validation/medical-information-schema';
import { parseStoredAddress } from '@/db/repositories/medical-information.repo';
import type { MedicalInformationAddress, MedicalInformationPayload } from '@/api/types';

type FormState = {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: Suffix | undefined;
  date_of_birth: string;
  gender: Gender | undefined;
  blood_type: BloodType | undefined;
  religion: Religion | undefined;
  address: MedicalInformationAddress;
  no_blood_transfusion: boolean;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: existing } = useMedicalInformation();
  const { data: medicalInformationAvatar } = useMedicalInformationAvatar();
  const { mutateAsync: save, isPending } = useUpdateMedicalInformation();
  const { message, setError, clearErrors } = useApiError();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Email is intentionally not editable here — it's account identity and carries a server-side
  // uniqueness constraint that can't be validated offline, so it's handled by settings/email.tsx
  // (which requires a live connection) instead of this offline-queued profile form.
  const email = existing?.email ?? user?.email ?? '';

  const [form, setForm] = useState<FormState>({
    first_name: existing?.first_name ?? '',
    middle_name: existing?.middle_name ?? '',
    last_name: existing?.last_name ?? '',
    suffix: existing?.suffix ?? undefined,
    date_of_birth: existing?.date_of_birth ?? '',
    gender: existing?.gender ?? undefined,
    blood_type: existing?.blood_type ?? undefined,
    religion: existing?.religion ?? undefined,
    address: parseStoredAddress(existing?.address ?? null) ?? EMPTY_ADDRESS,
    no_blood_transfusion: !!existing?.no_blood_transfusion,
  });
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({
    countryCode: existing?.phone_country_code ?? 'PH',
    phone: existing?.phone ?? '',
  });

  const parseFieldErrors = (issues: readonly any[]) => {
    const errors: Record<string, string> = {};
    for (const issue of issues) {
      const path = issue.path as string[];
      if (path.length === 1) {
        const key = path[0];
        if (key && !errors[key]) errors[key] = issue.message;
      } else if (path.length >= 2 && path[0] === 'address') {
        const key = path[1];
        if (key && !errors[key]) errors[key] = issue.message;
      }
    }
    return errors;
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async () => {
    clearErrors();
    setFieldErrors({});

    const result = medicalInformationSchema.safeParse({
      ...form,
      phone_country_code: phoneValue.countryCode,
      phone: phoneValue.phone,
    });
    if (!result.success) {
      setFieldErrors(parseFieldErrors(result.error.issues));
      return;
    }

    try {
      const { blood_type, ...rest } = result.data;
      const payload: MedicalInformationPayload = { email, ...rest, ...(blood_type ? { blood_type } : {}) };
      await save(payload);
      router.back();
    } catch (err) {
      setError(err);
      setFieldErrors((prev) => ({ ...prev, ...getFieldErrors(err) }));
    }
  };

  return (
    <AppLayout avoidKeyboard>
      <View className="mb-6 items-center gap-2">
        <Avatar name={existing?.full_name || 'Unnamed'} imageUrl={medicalInformationAvatar?.avatar} size={80} />
        <Link href="/profile/avatar">
          <ThemedText type="linkPrimary">Change photo</ThemedText>
        </Link>
      </View>

      <ThemedText type="overline" className="mb-2">
        Identity
      </ThemedText>
      <TextField label="First name" value={form.first_name} onChangeText={(v) => setField('first_name', v)} error={fieldErrors.first_name} />
      <TextField label="Middle name" value={form.middle_name} onChangeText={(v) => setField('middle_name', v)} />
      <TextField label="Last name" value={form.last_name} onChangeText={(v) => setField('last_name', v)} error={fieldErrors.last_name} />
      <SelectField
        placeholder="Suffix"
        options={SUFFIX_OPTIONS}
        value={form.suffix}
        onChange={(v) => setField('suffix', v)}
        allowClear
        getLabel={(v) => SuffixLabel[v]}
      />
      <DateField
        label="Date of birth"
        value={form.date_of_birth}
        onChange={(v) => setField('date_of_birth', v)}
        maximumDate={new Date()}
        error={fieldErrors.date_of_birth}
      />
      <SelectField
        placeholder="Gender"
        options={GENDER_OPTIONS}
        value={form.gender}
        onChange={(v) => setField('gender', v)}
        error={fieldErrors.gender}
        getLabel={(v) => GenderLabel[v]}
      />
      <View className="my-5 border-t border-border" />

      <ThemedText type="overline" className="mb-2 mt-5">
        Contact
      </ThemedText>
      <PhoneInput value={phoneValue} onChange={setPhoneValue} error={fieldErrors.phone || fieldErrors.phone_country_code} />
      <AddressFields
        value={form.address}
        onChange={(v) => setField('address', v)}
        errors={{
          street: fieldErrors.street,
          unit: fieldErrors.unit,
          city: fieldErrors.city,
          province: fieldErrors.province,
          postal_code: fieldErrors.postal_code,
          country: fieldErrors.country,
        }}
      />
      <View className="my-5 border-t border-border" />

      <ThemedText type="overline" className="mb-2 mt-5">
        Medical details
      </ThemedText>
      <SelectField
        placeholder="Blood type"
        options={BLOOD_TYPE_OPTIONS}
        value={form.blood_type}
        onChange={(v) => setField('blood_type', v)}
        error={fieldErrors.blood_type}
        getLabel={(v) => BloodTypeLabel[v]}
      />
      <SelectField
        placeholder="Religion"
        options={RELIGION_OPTIONS}
        value={form.religion}
        onChange={(v) => setField('religion', v)}
        allowClear
        getLabel={(v) => ReligionLabel[v]}
      />
      <View className="flex-row items-center justify-between">
        <ThemedText>No blood transfusion</ThemedText>
        <Switch value={form.no_blood_transfusion} onValueChange={(v) => setField('no_blood_transfusion', v)} />
      </View>
      <View className="my-5 border-t border-border" />

      <View className="mb-4 flex-row items-center justify-between">
        <ThemedText type="small" color="mutedForeground">
          Email: {email}
        </ThemedText>
        <Link href="/account/email">
          <ThemedText type="linkPrimary">Change</ThemedText>
        </Link>
      </View>

      <FormError message={message} />

      <PrimaryButton
        label="Save"
        loading={isPending}
        onPress={onSubmit}
        disabled={!form.address.street?.trim() || !form.address.unit?.trim() || !form.address.city?.trim() || !form.address.province?.trim() || !form.address.postal_code?.trim() || !form.address.country?.trim()}
        className="mb-16"
      />
    </AppLayout>
  );
}
