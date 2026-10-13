import { useMemo } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import type { MedicalInformationAddress } from '@/api/types';
import { getPhilippineBarangayOptions, PHILIPPINE_LOCATIONS } from '@/api/endpoints/ph-locations';

type AddressFieldsProps = {
  value: MedicalInformationAddress;
  onChange: (value: MedicalInformationAddress) => void;
  errors?: Partial<Record<keyof MedicalInformationAddress, string>>;
  disabled?: boolean;
};

/** Structured address input for `MedicalInformation.address` — mirrors the server's 6-field shape (see resources/js/components/address-input.tsx on the web). */
export function AddressFields({ value, onChange, errors, disabled }: AddressFieldsProps) {
  const isPhilippines = value.country?.trim().toLowerCase() === 'philippines';
  const cityOptions = useMemo(
    () => PHILIPPINE_LOCATIONS.cities.filter((city) => city.province === value.province).map((city) => city.name),
    [value.province],
  );
  const barangayOptions = useMemo(
    () => getPhilippineBarangayOptions(value.city, value.province),
    [value.city, value.province],
  );
  const setField = <K extends keyof MedicalInformationAddress>(key: K, v: string) => {
    onChange({
      ...value,
      [key]: v,
      ...(key === 'city' || key === 'province' ? { barangay: null } : {}),
    });
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
      {isPhilippines ? (
        <>
          <SelectField
            placeholder="Province"
            options={PHILIPPINE_LOCATIONS.provinces}
            value={value.province ?? undefined}
            onChange={(province) => onChange({ ...value, province: province ?? null, city: null, barangay: null, postal_code: null })}
            error={errors?.province}
            disabled={disabled}
          />
          <SelectField
            placeholder="City / municipality"
            options={cityOptions}
            value={value.city ?? undefined}
            onChange={(city) => {
              const selected = PHILIPPINE_LOCATIONS.cities.find((item) => item.province === value.province && item.name === city);
              onChange({ ...value, city: city ?? null, barangay: null, postal_code: selected?.postalCode ?? null });
            }}
            error={errors?.city}
            disabled={disabled || !value.province}
          />
          <SelectField
            placeholder="Barangay"
            options={barangayOptions}
            value={value.barangay ?? undefined}
            onChange={(barangay) => onChange({ ...value, barangay: barangay ?? null })}
            error={errors?.barangay}
            disabled={disabled || !value.city || barangayOptions.length === 0}
          />
        </>
      ) : (
        <>
          <TextField label="Province" value={value.province ?? ''} onChangeText={(v) => setField('province', v)} error={errors?.province} editable={!disabled} />
          <TextField label="City" value={value.city ?? ''} onChangeText={(v) => setField('city', v)} error={errors?.city} editable={!disabled} />
        </>
      )}
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
        onChangeText={(v) => onChange({ ...value, country: v, barangay: v === 'Philippines' ? value.barangay : null })}
        error={errors?.country}
        editable={!disabled}
      />
    </View>
  );
}

// react-doctor-disable-next-line react-doctor/only-export-components
export const EMPTY_ADDRESS: MedicalInformationAddress = {
  street: null,
  unit: null,
  barangay: null,
  city: null,
  province: null,
  postal_code: null,
  country: null,
};
