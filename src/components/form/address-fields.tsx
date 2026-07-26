import { View } from 'react-native';

import { TextField } from '@/components/form/text-field';
import type { MedicalInformationAddress } from '@/api/types';

type AddressFieldsProps = {
  value: MedicalInformationAddress;
  onChange: (value: MedicalInformationAddress) => void;
  errors?: Partial<Record<keyof MedicalInformationAddress, string>>;
  disabled?: boolean;
};

/** Structured address input for `MedicalInformation.address` — mirrors the server's 6-field shape (see resources/js/components/address-input.tsx on the web). */
export function AddressFields({ value, onChange, errors, disabled }: AddressFieldsProps) {
  const setField = <K extends keyof MedicalInformationAddress>(key: K, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <View>
      <TextField
        label="Street"
        value={value.street ?? ''}
        onChangeText={(v) => setField('street', v)}
        error={errors?.street}
        autoComplete="street-address"
        editable={!disabled}
      />
      <TextField
        label="Unit/Building/House"
        value={value.unit ?? ''}
        onChangeText={(v) => setField('unit', v)}
        error={errors?.unit}
        editable={!disabled}
      />
      <TextField
        label="City"
        value={value.city ?? ''}
        onChangeText={(v) => setField('city', v)}
        error={errors?.city}
        autoComplete="address-line1"
        editable={!disabled}
      />
      <TextField
        label="Province"
        value={value.province ?? ''}
        onChangeText={(v) => setField('province', v)}
        error={errors?.province}
        editable={!disabled}
      />
      <TextField
        label="Postal code"
        value={value.postal_code ?? ''}
        onChangeText={(v) => setField('postal_code', v)}
        error={errors?.postal_code}
        autoComplete="postal-code"
        editable={!disabled}
      />
      <TextField
        label="Country"
        value={value.country ?? ''}
        onChangeText={(v) => setField('country', v)}
        error={errors?.country}
        editable={!disabled}
      />
    </View>
  );
}

export const EMPTY_ADDRESS: MedicalInformationAddress = {
  street: null,
  unit: null,
  city: null,
  province: null,
  postal_code: null,
  country: null,
};
