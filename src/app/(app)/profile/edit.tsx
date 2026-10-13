import { useEffect, useRef } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller, useFormState, useWatch } from 'react-hook-form';

import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Avatar } from '@/components/avatar';
import { AvatarPreviewSheet, type AvatarPreviewSheetHandle } from '@/components/avatar-preview-sheet';
import { TextField } from '@/components/form/text-field';
import { DateField } from '@/components/form/date-field';
import { SelectField } from '@/components/form/select-field';
import { AddressFields, EMPTY_ADDRESS } from '@/components/form/address-fields';
import { PhoneInput } from '@/components/form/phone-input';
import { FormError } from '@/components/form/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useUpdateMedicalInformation } from '@/features/medical-information/useUpdateMedicalInformation';
import { useAuth } from '@/auth/useAuth';
import { useApiError } from '@/api/use-api-error';
import { getFieldErrors } from '@/api/errors';
import { GENDER_OPTIONS, GenderLabel, type Gender } from '@/constants/gender';
import { BLOOD_TYPE_OPTIONS, BloodTypeLabel, type BloodType } from '@/constants/blood-type';
import { SUFFIX_OPTIONS, SuffixLabel, type Suffix } from '@/constants/suffix';
import { RELIGION_OPTIONS, ReligionLabel, type Religion } from '@/constants/religion';
import { medicalInformationSchema } from '@/lib/validation/medical-information-schema';
import { parseStoredAddress } from '@/db/repositories/medical-information.repo';
import { normalizeLegacyPhilippineAddress } from '@/api/endpoints/ph-locations';
import type { MedicalInformationAddress, MedicalInformationPayload } from '@/api/types';
import { zodResolver } from '@/lib/zod-resolver';

type FormState = {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: Suffix | undefined;
  date_of_birth: string;
  gender: Gender | undefined;
  blood_type: BloodType | undefined;
  religion: Religion | undefined;
  phone_country_code: string;
  phone: string;
  address: MedicalInformationAddress;
  no_blood_transfusion: boolean;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: existing } = useMedicalInformation();
  const { mutateAsync: save, isPending } = useUpdateMedicalInformation();
  const { message, setError, clearErrors } = useApiError();

  const email = existing?.email ?? user?.email ?? '';

  const form = useForm<FormState>({
    resolver: zodResolver(medicalInformationSchema) as any,
    defaultValues: {
      first_name: '',
      middle_name: '',
      last_name: '',
      suffix: undefined,
      date_of_birth: '',
      gender: undefined,
      blood_type: undefined,
      religion: undefined,
      phone_country_code: 'PH',
      phone: '',
      address: EMPTY_ADDRESS,
      no_blood_transfusion: false,
    },
  });

  const { isDirty } = useFormState({ control: form.control });
  const phoneCountryCode = useWatch({ control: form.control, name: 'phone_country_code' });

  // react-doctor-disable-next-line react-hooks-js/exhaustive-deps
  useEffect(() => {
    if (!existing) return;
    form.reset({
      first_name: existing.first_name ?? '',
      middle_name: existing.middle_name ?? '',
      last_name: existing.last_name ?? '',
      suffix: existing.suffix ?? undefined,
      date_of_birth: existing.date_of_birth ?? '',
      gender: existing.gender ?? undefined,
      blood_type: existing.blood_type ?? undefined,
      religion: existing.religion ?? undefined,
      phone_country_code: existing.phone_country_code ?? 'PH',
      phone: existing.phone ?? '',
      address: normalizeLegacyPhilippineAddress(parseStoredAddress(existing.address ?? null) ?? EMPTY_ADDRESS),
      no_blood_transfusion: !!existing.no_blood_transfusion,
    });
  }, [existing, form.reset]);

  const onSubmit = async (data: FormState) => {
    clearErrors();
    form.clearErrors();

    try {
      const payload: MedicalInformationPayload = {
        email,
        first_name: data.first_name,
        middle_name: data.middle_name || undefined,
        last_name: data.last_name,
        suffix: data.suffix ?? undefined,
        date_of_birth: data.date_of_birth || undefined,
        gender: data.gender ?? undefined,
        blood_type: data.blood_type ?? undefined,
        religion: data.religion ?? undefined,
        phone_country_code: data.phone_country_code || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        no_blood_transfusion: data.no_blood_transfusion,
      };
      await save(payload);
      router.back();
    } catch (err) {
      setError(err);
      const apiErrors = getFieldErrors(err);
      for (const [key, msg] of Object.entries(apiErrors)) {
        form.setError(key as keyof FormState, { message: msg });
      }
    }
  };

  const avatarSheetRef = useRef<AvatarPreviewSheetHandle>(null);

  return (
    <AppLayout avoidKeyboard>
      <View className="mb-6 items-center gap-2">
        <Pressable onPress={() => avatarSheetRef.current?.present()}>
          <Avatar name={existing?.full_name || 'Unnamed'} size={80} />
        </Pressable>
        <Pressable onPress={() => avatarSheetRef.current?.present()}>
          <ThemedText type="linkPrimary">Change photo</ThemedText>
        </Pressable>
      </View>
      <AvatarPreviewSheet ref={avatarSheetRef} name={existing?.full_name || 'Unnamed'} />

      <ThemedText type="overline" className="mb-2">
        Identity
      </ThemedText>
      <Controller
        control={form.control}
        name="first_name"
        render={({ field, fieldState }) => (
          <TextField label="First name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
        )}
      />
      <Controller
        control={form.control}
        name="middle_name"
        render={({ field, fieldState }) => (
          <TextField label="Middle name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
        )}
      />
      <Controller
        control={form.control}
        name="last_name"
        render={({ field, fieldState }) => (
          <TextField label="Last name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
        )}
      />
      <Controller
        control={form.control}
        name="suffix"
        render={({ field }) => (
          <SelectField
            placeholder="Suffix"
            options={SUFFIX_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            allowClear
            getLabel={(v) => SuffixLabel[v]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="date_of_birth"
        render={({ field, fieldState }) => (
          <DateField
            label="Date of birth"
            value={field.value}
            onChange={field.onChange}
            maximumDate={new Date()}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="gender"
        render={({ field, fieldState }) => (
          <SelectField
            placeholder="Gender"
            options={GENDER_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            getLabel={(v) => GenderLabel[v]}
          />
        )}
      />
      <View className="my-5 border-t border-border" />

      <ThemedText type="overline" className="mb-2 mt-5">
        Contact
      </ThemedText>
      <Controller
        control={form.control}
        name="phone"
        render={({ field }) => {
          const phoneErr = form.formState.errors.phone?.message || form.formState.errors.phone_country_code?.message;
          return (
            <PhoneInput
              value={{ countryCode: phoneCountryCode, phone: field.value }}
              onChange={(v) => {
                form.setValue('phone_country_code', v.countryCode, { shouldDirty: true });
                form.setValue('phone', v.phone, { shouldDirty: true });
              }}
              error={phoneErr}
            />
          );
        }}
      />
      <Controller
        control={form.control}
        name="address"
        render={({ field }) => {
          const addrErrors = form.formState.errors.address;
          return (
            <AddressFields
              value={field.value}
              onChange={field.onChange}
              errors={{
                street: addrErrors?.street?.message,
                unit: addrErrors?.unit?.message,
                barangay: addrErrors?.barangay?.message,
                city: addrErrors?.city?.message,
                province: addrErrors?.province?.message,
                postal_code: addrErrors?.postal_code?.message,
                country: addrErrors?.country?.message,
              }}
            />
          );
        }}
      />
      <View className="my-5 border-t border-border" />

      <ThemedText type="overline" className="mb-2 mt-5">
        Medical details
      </ThemedText>
      <Controller
        control={form.control}
        name="blood_type"
        render={({ field, fieldState }) => (
          <SelectField
            placeholder="Blood type"
            options={BLOOD_TYPE_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            getLabel={(v) => BloodTypeLabel[v]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="religion"
        render={({ field }) => (
          <SelectField
            placeholder="Religion"
            options={RELIGION_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            allowClear
            getLabel={(v) => ReligionLabel[v]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="no_blood_transfusion"
        render={({ field }) => (
          <View className="flex-row items-center justify-between">
            <ThemedText>No blood transfusion</ThemedText>
            <Switch value={field.value} onValueChange={field.onChange} />
          </View>
        )}
      />
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
        onPress={() => void form.handleSubmit(onSubmit)()}
        disabled={!isDirty}
        className="mb-16"
      />
    </AppLayout>
  );
}
