import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Pressable, Switch, View } from 'react-native';

import { BottomSheetFormWrapper } from '@/components/bottom-sheet-form-wrapper';
import { Card } from '@/components/card';
import { DiagnosisSeverityBadge, DiagnosisSeverityIcon } from '@/components/diagnosis-severity-badge';
import { AddressFields } from '@/components/form/address-fields';
import { DateField } from '@/components/form/date-field';
import { PhoneInput } from '@/components/form/phone-input';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { sheet } from '@/components/form/tokens';
import {
  ALLERGY_SEVERITIES,
  AllergySeverityLabel,
  BLOOD_TYPE_OPTIONS,
  BloodTypeLabel,
  DIAGNOSIS_SEVERITIES,
  DiagnosisSeverityLabel,
  formatPhoneWithCountryCode,
  GENDER_OPTIONS,
  GenderLabel,
  RELATION_TO_PATIENT_OPTIONS,
  RelationToPatientLabel,
  RELIGION_OPTIONS,
  ReligionLabel,
  SUFFIX_OPTIONS,
  SuffixLabel,
  type ManageAllergy,
  type ManageCondition,
  type ManageDiagnosis,
  type ManageEmergencyContact,
  type ManageMedication,
} from '@/components/manage-info-helpers';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge, SeverityIcon } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import { useManageInfo } from '@/components/use-manage-info';
import type { Gender } from '@/constants/gender';
import type { BloodType } from '@/constants/blood-type';
import type { Suffix } from '@/constants/suffix';
import type { Religion } from '@/constants/religion';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate } from '@/lib/format-date';

export type ManageInfoBottomSheetHandle = { present: (patientId: number, qrData: string) => void; dismiss: () => void };

type ThemeColors = ReturnType<typeof useTheme>;

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

function EmergencyContactsSection({
  items,
  itemErrors,
  theme,
  sending,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  onUpdate,
}: {
  items: ManageEmergencyContact[];
  itemErrors: Record<string, Record<string, string>>;
  theme: ThemeColors;
  sending: boolean;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onDelete: (key: string, label: string) => void;
  onSave: (key: string) => void;
  onCancel: (key: string) => void;
  onUpdate: (key: string, patch: Partial<ManageEmergencyContact>) => void;
}) {
  return (
    <View className="mb-6 gap-2">
      <View className="flex-row items-center justify-between">
        <ThemedText type="overline">Emergency contacts</ThemedText>
        <Pressable onPress={onAdd} hitSlop={8} disabled={sending}>
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
            <Ionicons name="add" size={16} color={theme.primaryForeground} />
          </View>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Card>
          <ThemedText type="label" color="mutedForeground">No emergency contacts recorded for this patient.</ThemedText>
        </Card>
      ) : (
        <Card className="p-0">
          {items.map((item, i) => (
            <View
              key={item.key}
              className="px-4 py-3"
              style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
            >
              {item.editing ? (
                <View className="gap-2">
                  <TextField
                    label="Contact name"
                    value={item.name}
                    onChangeText={(v) => onUpdate(item.key, { name: v })}
                    error={itemErrors[item.key]?.name}
                    placeholder="e.g. Juan Dela Cruz"
                    floatingLabelBackground={theme.card}
                  />
                  <SelectField placeholder="Relationship" options={RELATION_TO_PATIENT_OPTIONS} value={item.relationship} onChange={(v) => onUpdate(item.key, { relationship: v })} getLabel={(v) => RelationToPatientLabel[v]} />
                  <PhoneInput
                    value={{ countryCode: item.phone_country_code || 'PH', phone: item.phone }}
                    onChange={(v) => onUpdate(item.key, { phone_country_code: v.countryCode, phone: v.phone })}
                    error={itemErrors[item.key]?.phone}
                  />
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small">Primary contact</ThemedText>
                    <Switch value={item.is_primary} onValueChange={(v) => onUpdate(item.key, { is_primary: v })} />
                  </View>
                  <View className="flex-row gap-2">
                    <PrimaryButton label="Save" onPress={() => onSave(item.key)} className="flex-1" />
                    <PrimaryButton label="Cancel" variant="ghost" onPress={() => onCancel(item.key)} className="flex-1" />
                  </View>
                </View>
              ) : (
                <View className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.destructive + '15' }}>
                      <Ionicons name="person" size={18} color={theme.destructive} />
                    </View>
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{item.name}</ThemedText>
                      {item.relationship ? (
                        <ThemedText type="small" color="mutedForeground">{RelationToPatientLabel[item.relationship]}</ThemedText>
                      ) : null}
                    </View>
                    {item.phone ? (
                      <ThemedText type="small" color="primary">
                        {formatPhoneWithCountryCode(item.phone_country_code || undefined, item.phone)}
                      </ThemedText>
                    ) : null}
                    <Pressable onPress={() => onEdit(item.key)} hitSlop={6} disabled={sending}>
                      <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => onDelete(item.key, item.name)} hitSlop={6} disabled={sending}>
                      <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function MedicalInfoFormSection({ form }: { form: any }) {
  return (
    <View className="mb-6 gap-1">
      <ThemedText type="overline" className="mb-2">Medical information</ThemedText>
      <Controller control={form.control} name="first_name" render={({ field, fieldState }) => (
        <TextField label="First name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="middle_name" render={({ field }) => (
        <TextField label="Middle name" value={field.value} onChangeText={field.onChange} />
      )} />
      <Controller control={form.control} name="last_name" render={({ field, fieldState }) => (
        <TextField label="Last name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="suffix" render={({ field }) => (
        <SelectField placeholder="Suffix" options={SUFFIX_OPTIONS} value={field.value} onChange={field.onChange} allowClear getLabel={(v) => SuffixLabel[v as Suffix]} />
      )} />
      <Controller control={form.control} name="date_of_birth" render={({ field, fieldState }) => (
        <DateField label="Date of birth" value={field.value} onChange={field.onChange} maximumDate={new Date()} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="gender" render={({ field, fieldState }) => (
        <SelectField placeholder="Gender" options={GENDER_OPTIONS} value={field.value} onChange={field.onChange} getLabel={(v) => GenderLabel[v as Gender]} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="phone" render={({ field, fieldState }) => (
        <TextField label="Phone" value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" error={fieldState.error?.message} placeholder="Phone number" />
      )} />
      <Controller control={form.control} name="address" render={({ field }) => {
        const addrErrs = form.formState.errors.address;
        return (
          <AddressFields value={field.value} onChange={field.onChange} errors={{
            street: addrErrs?.street?.message,
            unit: addrErrs?.unit?.message,
            city: addrErrs?.city?.message,
            province: addrErrs?.province?.message,
            postal_code: addrErrs?.postal_code?.message,
            country: addrErrs?.country?.message,
          }} />
        );
      }} />
      <Controller control={form.control} name="blood_type" render={({ field, fieldState }) => (
        <SelectField placeholder="Blood type" options={BLOOD_TYPE_OPTIONS} value={field.value} onChange={field.onChange} getLabel={(v) => BloodTypeLabel[v as BloodType]} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="religion" render={({ field }) => (
        <SelectField placeholder="Religion" options={RELIGION_OPTIONS} value={field.value} onChange={field.onChange} allowClear getLabel={(v) => ReligionLabel[v as Religion]} />
      )} />
      <Controller control={form.control} name="no_blood_transfusion" render={({ field }) => (
        <View className="mb-4 flex-row items-center justify-between">
          <ThemedText>No blood transfusion</ThemedText>
          <Switch value={field.value} onValueChange={field.onChange} />
        </View>
      )} />
    </View>
  );
}

function AllergiesSection({
  items,
  itemErrors,
  theme,
  sending,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  onUpdate,
}: {
  items: ManageAllergy[];
  itemErrors: Record<string, Record<string, string>>;
  theme: ThemeColors;
  sending: boolean;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onDelete: (key: string, label: string) => void;
  onSave: (key: string) => void;
  onCancel: (key: string) => void;
  onUpdate: (key: string, patch: Partial<ManageAllergy>) => void;
}) {
  return (
    <View className="mb-6 gap-2">
      <View className="flex-row items-center justify-between">
        <ThemedText type="overline">Allergies</ThemedText>
        <Pressable onPress={onAdd} hitSlop={8} disabled={sending}>
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
            <Ionicons name="add" size={16} color={theme.primaryForeground} />
          </View>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Card>
          <ThemedText type="label" color="mutedForeground">No allergies recorded for this patient.</ThemedText>
        </Card>
      ) : (
        <Card className="p-0">
          {items.map((item, i) => (
            <View
              key={item.key}
              className="px-4 py-3"
              style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
            >
              {item.editing ? (
                <View className="gap-2">
                  {item.isNew ? (
                    <TextField
                      label="Allergen"
                      value={item.allergen}
                      onChangeText={(v) => onUpdate(item.key, { allergen: v })}
                      error={itemErrors[item.key]?.allergen}
                      placeholder="e.g. Peanuts"
                      floatingLabelBackground={theme.card}
                    />
                  ) : null}
                  <SelectField placeholder="Severity" options={ALLERGY_SEVERITIES} value={item.severity} onChange={(v) => v && onUpdate(item.key, { severity: v })} getLabel={(v) => AllergySeverityLabel[v]} />
                  <TextField
                    label="Reaction (optional)"
                    value={item.reaction}
                    onChangeText={(v) => onUpdate(item.key, { reaction: v })}
                    error={itemErrors[item.key]?.reaction}
                    placeholder="e.g. Hives"
                    floatingLabelBackground={theme.card}
                  />
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} />
                  </View>
                  <View className="flex-row gap-2">
                    <PrimaryButton label="Save" onPress={() => onSave(item.key)} className="flex-1" />
                    <PrimaryButton label="Cancel" variant="ghost" onPress={() => onCancel(item.key)} className="flex-1" />
                  </View>
                </View>
              ) : (
                <View className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <SeverityIcon severity={item.severity} size={36} />
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{item.allergen}</ThemedText>
                      {item.reaction ? <ThemedText type="small" color="mutedForeground">{item.reaction}</ThemedText> : null}
                    </View>
                    <SeverityBadge severity={item.severity} />
                    <Pressable onPress={() => onEdit(item.key)} hitSlop={6} disabled={sending}>
                      <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => onDelete(item.key, item.allergen)} hitSlop={6} disabled={sending}>
                      <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                    </Pressable>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small" color="mutedForeground">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} disabled={sending} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function ConditionsSection({
  items,
  itemErrors,
  theme,
  sending,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  onUpdate,
}: {
  items: ManageCondition[];
  itemErrors: Record<string, Record<string, string>>;
  theme: ThemeColors;
  sending: boolean;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onDelete: (key: string, label: string) => void;
  onSave: (key: string) => void;
  onCancel: (key: string) => void;
  onUpdate: (key: string, patch: Partial<ManageCondition>) => void;
}) {
  return (
    <View className="mb-6 gap-2">
      <View className="flex-row items-center justify-between">
        <ThemedText type="overline">Conditions</ThemedText>
        <Pressable onPress={onAdd} hitSlop={8} disabled={sending}>
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
            <Ionicons name="add" size={16} color={theme.primaryForeground} />
          </View>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Card>
          <ThemedText type="label" color="mutedForeground">No conditions recorded for this patient.</ThemedText>
        </Card>
      ) : (
        <Card className="p-0">
          {items.map((item, i) => (
            <View
              key={item.key}
              className="px-4 py-3"
              style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
            >
              {item.editing ? (
                <View className="gap-2">
                  {item.isNew ? (
                    <TextField
                      label="Description"
                      value={item.description}
                      onChangeText={(v) => onUpdate(item.key, { description: v })}
                      error={itemErrors[item.key]?.description}
                      placeholder="e.g. Occasional migraines"
                      multiline
                      floatingLabelBackground={theme.card}
                    />
                  ) : null}
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} />
                  </View>
                  <View className="flex-row gap-2">
                    <PrimaryButton label="Save" onPress={() => onSave(item.key)} className="flex-1" />
                    <PrimaryButton label="Cancel" variant="ghost" onPress={() => onCancel(item.key)} className="flex-1" />
                  </View>
                </View>
              ) : (
                <View className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{item.description}</ThemedText>
                    </View>
                    <Pressable onPress={() => onEdit(item.key)} hitSlop={6} disabled={sending}>
                      <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => onDelete(item.key, item.description)} hitSlop={6} disabled={sending}>
                      <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                    </Pressable>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small" color="mutedForeground">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} disabled={sending} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function DiagnosesSection({
  items,
  itemErrors,
  theme,
  sending,
  isVerifiedProfessional,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  onUpdate,
}: {
  items: ManageDiagnosis[];
  itemErrors: Record<string, Record<string, string>>;
  theme: ThemeColors;
  sending: boolean;
  isVerifiedProfessional: boolean;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onDelete: (key: string, label: string) => void;
  onSave: (key: string) => void;
  onCancel: (key: string) => void;
  onUpdate: (key: string, patch: Partial<ManageDiagnosis>) => void;
}) {
  return (
    <View className="mb-6 gap-2">
      <View className="flex-row items-center justify-between">
        <ThemedText type="overline">Diagnoses</ThemedText>
        <Pressable onPress={onAdd} hitSlop={8} disabled={sending}>
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
            <Ionicons name="add" size={16} color={theme.primaryForeground} />
          </View>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Card>
          <ThemedText type="label" color="mutedForeground">No diagnoses recorded for this patient.</ThemedText>
        </Card>
      ) : (
        <Card className="p-0">
          {items.map((item, i) => (
            <View
              key={item.key}
              className="px-4 py-3"
              style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
            >
              {item.editing ? (
                <View className="gap-2">
                  {item.isNew ? (
                    <TextField
                      label="Condition"
                      value={item.condition}
                      onChangeText={(v) => onUpdate(item.key, { condition: v })}
                      error={itemErrors[item.key]?.condition}
                      placeholder="e.g. Type 2 diabetes"
                      floatingLabelBackground={theme.card}
                    />
                  ) : null}
                  <SelectField placeholder="Severity" options={DIAGNOSIS_SEVERITIES} value={item.severity} onChange={(v) => v && onUpdate(item.key, { severity: v })} getLabel={(v) => DiagnosisSeverityLabel[v]} />
                  <TextField
                    label="Date of diagnosis (optional)"
                    value={item.dateOfDiagnosis}
                    onChangeText={(v) => onUpdate(item.key, { dateOfDiagnosis: v })}
                    error={itemErrors[item.key]?.date_of_diagnosis}
                    placeholder="YYYY-MM-DD"
                    floatingLabelBackground={theme.card}
                  />
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} />
                  </View>
                  <View className="flex-row gap-2">
                    <PrimaryButton label="Save" onPress={() => onSave(item.key)} className="flex-1" />
                    <PrimaryButton label="Cancel" variant="ghost" onPress={() => onCancel(item.key)} className="flex-1" />
                  </View>
                </View>
              ) : (
                <View className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <DiagnosisSeverityIcon severity={item.severity} size={36} />
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{item.condition}</ThemedText>
                      {item.dateOfDiagnosis ? <ThemedText type="small" color="mutedForeground">Diagnosed {formatIsoDate(item.dateOfDiagnosis)}</ThemedText> : null}
                    </View>
                    <DiagnosisSeverityBadge severity={item.severity} />
                    <Pressable onPress={() => onEdit(item.key)} hitSlop={6} disabled={sending}>
                      <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                    </Pressable>
                    {isVerifiedProfessional ? (
                      <Pressable onPress={() => onDelete(item.key, item.condition)} hitSlop={6} disabled={sending}>
                        <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small" color="mutedForeground">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} disabled={sending} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function MedicationsSection({
  items,
  itemErrors,
  theme,
  sending,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  onUpdate,
}: {
  items: ManageMedication[];
  itemErrors: Record<string, Record<string, string>>;
  theme: ThemeColors;
  sending: boolean;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onDelete: (key: string, label: string) => void;
  onSave: (key: string) => void;
  onCancel: (key: string) => void;
  onUpdate: (key: string, patch: Partial<ManageMedication>) => void;
}) {
  return (
    <View className="mb-6 gap-2">
      <View className="flex-row items-center justify-between">
        <ThemedText type="overline">Medications</ThemedText>
        <Pressable onPress={onAdd} hitSlop={8} disabled={sending}>
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
            <Ionicons name="add" size={16} color={theme.primaryForeground} />
          </View>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Card>
          <ThemedText type="label" color="mutedForeground">No medications recorded for this patient.</ThemedText>
        </Card>
      ) : (
        <Card className="p-0">
          {items.map((item, i) => (
            <View
              key={item.key}
              className="px-4 py-3"
              style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
            >
              {item.editing ? (
                <View className="gap-2">
                  {item.isNew ? (
                    <TextField
                      label="Name"
                      value={item.name}
                      onChangeText={(v) => onUpdate(item.key, { name: v })}
                      error={itemErrors[item.key]?.name}
                      placeholder="e.g. Metformin"
                      floatingLabelBackground={theme.card}
                    />
                  ) : null}
                  <TextField
                    label="Dosage"
                    value={item.dosage}
                    onChangeText={(v) => onUpdate(item.key, { dosage: v })}
                    error={itemErrors[item.key]?.dosage}
                    placeholder="e.g. 500mg"
                    floatingLabelBackground={theme.card}
                  />
                  <TextField
                    label="Frequency"
                    value={item.frequency}
                    onChangeText={(v) => onUpdate(item.key, { frequency: v })}
                    error={itemErrors[item.key]?.frequency}
                    placeholder="e.g. Twice daily"
                    floatingLabelBackground={theme.card}
                  />
                  <TextField
                    label="Notes (optional)"
                    value={item.notes}
                    onChangeText={(v) => onUpdate(item.key, { notes: v })}
                    error={itemErrors[item.key]?.notes}
                    placeholder="Any additional notes"
                    floatingLabelBackground={theme.card}
                  />
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} />
                  </View>
                  <View className="flex-row gap-2">
                    <PrimaryButton label="Save" onPress={() => onSave(item.key)} className="flex-1" />
                    <PrimaryButton label="Cancel" variant="ghost" onPress={() => onCancel(item.key)} className="flex-1" />
                  </View>
                </View>
              ) : (
                <View className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
                      <Ionicons name="medical" size={18} color={theme.primary} />
                    </View>
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{item.name}</ThemedText>
                      {item.dosage || item.frequency ? (
                        <ThemedText type="small" color="mutedForeground">
                          {[item.dosage, item.frequency].filter(Boolean).join(' · ')}
                        </ThemedText>
                      ) : null}
                    </View>
                    <Pressable onPress={() => onEdit(item.key)} hitSlop={6} disabled={sending}>
                      <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => onDelete(item.key, item.name)} hitSlop={6} disabled={sending}>
                      <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                    </Pressable>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <ThemedText type="small" color="mutedForeground">Mark as verified</ThemedText>
                    <Switch value={item.verifyToggle} onValueChange={(v) => onUpdate(item.key, { verifyToggle: v, verifyTouched: true })} disabled={sending} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function TransfusionWitnessSection({
  witnessed,
  note,
  onWitnessedChange,
  onNoteChange,
}: {
  witnessed: boolean;
  note: string;
  onWitnessedChange: (v: boolean) => void;
  onNoteChange: (v: string) => void;
}) {
  return (
    <View className="mb-6 gap-2">
      <ThemedText type="overline">Transfusion witness</ThemedText>
      <Card className="flex-row items-center justify-between">
        <ThemedText>Patient consents to transfusion</ThemedText>
        <Switch value={witnessed} onValueChange={onWitnessedChange} />
      </Card>
      <TextField label="Note (optional)" value={note} onChangeText={onNoteChange} multiline />
    </View>
  );
}

function GeneralNoteSection({
  note,
  onNoteChange,
}: {
  note: string;
  onNoteChange: (v: string) => void;
}) {
  return (
    <View className="mb-2 gap-2">
      <ThemedText type="overline">General note</ThemedText>
      <TextField label="Note (optional)" value={note} onChangeText={onNoteChange} multiline />
    </View>
  );
}

function SyncActionButtons({
  sendMode,
  sending,
  hasChanges,
  onSendBle,
  onSendInternet,
}: {
  sendMode: 'ble' | 'internet' | null;
  sending: boolean;
  hasChanges: boolean;
  onSendBle: () => void;
  onSendInternet: () => void;
}) {
  return (
    <View className="mt-2 gap-3">
      <PrimaryButton
        label={sendMode === 'ble' ? 'Syncing via Bluetooth…' : 'Send via Bluetooth'}
        loading={sendMode === 'ble'}
        disabled={sending || !hasChanges}
        onPress={onSendBle}
      />
      <PrimaryButton
        label={sendMode === 'internet' ? 'Sending via internet…' : 'Send via internet (beta)'}
        variant="ghost"
        loading={sendMode === 'internet'}
        disabled={sending || !hasChanges}
        onPress={onSendInternet}
      />
    </View>
  );
}

export const ManageInfoBottomSheet = forwardRef<ManageInfoBottomSheetHandle, { onSuccess?: () => void }>(function ManageInfoBottomSheet({ onSuccess }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useTheme();
  const state = useManageInfo();
  const pendingPresentRef = useRef(false);

  useLayoutEffect(() => {
    if (pendingPresentRef.current) {
      pendingPresentRef.current = false;
      sheetRef.current?.present();
    }
  });

  useImperativeHandle(ref, () => ({
    present: (pid: number, qrData: string) => {
      state.resetAll(pid, qrData);
      pendingPresentRef.current = true;
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleDismiss = () => {
    // No-op: allow natural dismiss
  };

  const body = state.parseError ? (
    <View className="items-center gap-4 py-8 px-6">
      <ThemedText className="text-center">Could not read the patient&apos;s QR data.</ThemedText>
    </View>
  ) : !state.info ? (
    <View className="items-center gap-4 py-8 px-6">
      <ThemedText className="text-center">Loading patient info…</ThemedText>
    </View>
  ) : state.sentSuccessfully ? (
    <View className="flex-1 items-center justify-center gap-3 px-6 py-12">
      <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary + '20' }}>
        <Ionicons name="checkmark-circle" size={36} color={theme.primary} />
      </View>
      <ThemedText type="heading" className="text-center">Update sent</ThemedText>
      <ThemedText type="caption" className="text-center">The patient will see this the next time their device syncs.</ThemedText>
    </View>
  ) : state.sending ? (
    <View className="flex-1 items-center justify-center gap-3 px-6 py-12">
      <ActivityIndicator size="large" color={theme.primary} />
      <ThemedText type="heading" className="text-center">
        {state.sendMode === 'ble' ? 'Sending via Bluetooth…' : 'Sending update…'}
      </ThemedText>
    </View>
  ) : (
    <BottomSheetFormWrapper>
      <Card className="mb-4 gap-1">
        <ThemedText className="text-lg font-semibold">{state.info.name}</ThemedText>
        <ThemedText type="small" color="mutedForeground">
          {formatIsoDate(state.info.dateOfBirth)} · {GENDER_OPTIONS.includes(state.info.gender as Gender) ? GenderLabel[state.info.gender as Gender] : state.info.gender}
        </ThemedText>
      </Card>

      {state.syncError ? (
        <Card className="mb-4" style={{ backgroundColor: theme.destructive + '15', borderColor: theme.destructive }}>
          <ThemedText type="small" color="destructive">{state.syncError}</ThemedText>
        </Card>
      ) : null}

      <EmergencyContactsSection
        items={state.visibleContacts}
        itemErrors={state.itemErrors}
        theme={theme}
        sending={state.sending}
        onAdd={state.handleAddContact}
        onEdit={(key) => state.handleEdit('contact', key)}
        onDelete={(key, label) => state.handleDelete('contact', key, label)}
        onSave={(key) => state.handleSaveEdit('contact', key)}
        onCancel={(key) => state.handleCancelEdit('contact', key)}
        onUpdate={(key, patch) => { state.setContact(key, patch); state.clearItemError(key); }}
      />

      <MedicalInfoFormSection form={state.medInfoForm} />

      <AllergiesSection
        items={state.visibleAllergies}
        itemErrors={state.itemErrors}
        theme={theme}
        sending={state.sending}
        onAdd={state.handleAddAllergy}
        onEdit={(key) => state.handleEdit('allergy', key)}
        onDelete={(key, label) => state.handleDelete('allergy', key, label)}
        onSave={(key) => state.handleSaveEdit('allergy', key)}
        onCancel={(key) => state.handleCancelEdit('allergy', key)}
        onUpdate={(key, patch) => { state.setAllergy(key, patch); state.clearItemError(key); }}
      />

      <ConditionsSection
        items={state.visibleConditions}
        itemErrors={state.itemErrors}
        theme={theme}
        sending={state.sending}
        onAdd={state.handleAddCondition}
        onEdit={(key) => state.handleEdit('condition', key)}
        onDelete={(key, label) => state.handleDelete('condition', key, label)}
        onSave={(key) => state.handleSaveEdit('condition', key)}
        onCancel={(key) => state.handleCancelEdit('condition', key)}
        onUpdate={(key, patch) => { state.setCondition(key, patch); state.clearItemError(key); }}
      />

      <DiagnosesSection
        items={state.visibleDiagnoses}
        itemErrors={state.itemErrors}
        theme={theme}
        sending={state.sending}
        isVerifiedProfessional={state.isVerifiedProfessional}
        onAdd={state.handleAddDiagnosis}
        onEdit={(key) => state.handleEdit('diagnosis', key)}
        onDelete={(key, label) => state.handleDelete('diagnosis', key, label)}
        onSave={(key) => state.handleSaveEdit('diagnosis', key)}
        onCancel={(key) => state.handleCancelEdit('diagnosis', key)}
        onUpdate={(key, patch) => { state.setDiagnosis(key, patch); state.clearItemError(key); }}
      />

      <MedicationsSection
        items={state.visibleMedications}
        itemErrors={state.itemErrors}
        theme={theme}
        sending={state.sending}
        onAdd={state.handleAddMedication}
        onEdit={(key) => state.handleEdit('medication', key)}
        onDelete={(key, label) => state.handleDelete('medication', key, label)}
        onSave={(key) => state.handleSaveEdit('medication', key)}
        onCancel={(key) => state.handleCancelEdit('medication', key)}
        onUpdate={(key, patch) => { state.setMedication(key, patch); state.clearItemError(key); }}
      />

      <TransfusionWitnessSection
        witnessed={state.transfusionWitnessed}
        note={state.transfusionNote}
        onWitnessedChange={(v) => { state.setTransfusionWitnessed(v); state.setTransfusionTouched(true); }}
        onNoteChange={state.setTransfusionNote}
      />

      <GeneralNoteSection note={state.generalNote} onNoteChange={state.setGeneralNote} />

      <SyncActionButtons
        sendMode={state.sendMode}
        sending={state.sending}
        hasChanges={state.hasFormChanges}
        onSendBle={() => void state.handleSendBle(sheetRef, onSuccess)}
        onSendInternet={() => void state.handleSendInternet(sheetRef, onSuccess)}
      />
    </BottomSheetFormWrapper>
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['50%', '90%']}
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: theme.background, borderRadius: sheet.radius }}
      handleIndicatorStyle={{ backgroundColor: theme.border, width: sheet.handleWidth }}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
    >
      {body}
    </BottomSheetModal>
  );
});
