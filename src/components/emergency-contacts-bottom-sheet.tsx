import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UseFormReturn } from 'react-hook-form';
import { useForm, Controller, useFormState } from 'react-hook-form';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { PhoneInput } from '@/components/form/phone-input';
import { SelectField } from '@/components/form/select-field';
import { ThemedText } from '@/components/themed-text';
import { BottomSheetFormWrapper } from '@/components/bottom-sheet-form-wrapper';
import { BottomSheetField } from '@/components/form/bottom-sheet-field';
import { sheet } from '@/components/form/tokens';
import { PrimaryButton } from '@/components/primary-button';
import {
  useEmergencyContacts,
  useCreateEmergencyContact,
  useUpdateEmergencyContact,
  useDeleteEmergencyContact,
} from '@/features/emergency-contacts';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';
import { emergencyContactSchema, type EmergencyContactFormValues } from '@/lib/validation/emergency-contact-schema';
import { zodResolver } from '@/lib/zod-resolver';
import type { EmergencyContactRow } from '@/db/schema';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';

export type EmergencyContactsBottomSheetHandle = {
  present: () => void;
  presentAdd: () => void;
  presentView: (localUuid: string) => void;
  dismiss: () => void;
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type Mode = 'list' | 'add' | 'view';

function ContactSheetRow({ item, onPress, theme }: { item: EmergencyContactRow; onPress: (uuid: string) => void; theme: Record<string, string> }) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="py-3">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.destructive + '15' }}>
          <Ionicons name="person" size={18} color={theme.destructive} />
        </View>
        <View className="flex-1 shrink">
          <ThemedText className="font-semibold">{item.name}</ThemedText>
          {item.relationship ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: theme.muted }}>
                <ThemedText type="detail" color="mutedForeground">
                  {RELATION_TO_PATIENT_OPTIONS.includes(item.relationship as RelationToPatient)
                    ? RelationToPatientLabel[item.relationship as RelationToPatient]
                    : item.relationship}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>
        {item.phone ? (
          <ThemedText type="small" color="primary">
            {formatPhoneWithCountryCode(item.phone_country_code, item.phone)}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function ContactForm({ form, mode, isPending, isSaving, isDeleting, onSave, onDelete }: {
  form: UseFormReturn<EmergencyContactFormValues>;
  mode: Mode;
  isPending: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { isDirty } = useFormState({ control: form.control });

  return (
    <BottomSheetFormWrapper>
      <BottomSheetField control={form.control} name="name" label="Name *" placeholder="e.g. Juan Dela Cruz" />
      <Controller
        control={form.control}
        name="relationship"
        render={({ field, fieldState }) => (
          <SelectField
            placeholder="Relationship"
            options={RELATION_TO_PATIENT_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            getLabel={(v) => RelationToPatientLabel[v]}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneInput
            value={{ countryCode: form.getValues('phone_country_code') ?? 'PH', phone: field.value ?? '' }}
            onChange={(v) => { form.setValue('phone_country_code', v.countryCode, { shouldDirty: true }); form.setValue('phone', v.phone, { shouldDirty: true }); }}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="is_primary"
        render={({ field }) => (
          <View className="flex-row items-center justify-between">
            <ThemedText>Primary contact</ThemedText>
            <Switch value={field.value} onValueChange={field.onChange} />
          </View>
        )}
      />

      <PrimaryButton label="Save contact" loading={mode === 'view' ? isSaving : isPending} disabled={!isDirty} onPress={onSave} className="mt-4" />
      {mode === 'view' ? (
        <PrimaryButton label="Remove contact" variant="danger" loading={isDeleting} disabled={isSaving} onPress={onDelete} className="mt-2" />
      ) : null}
    </BottomSheetFormWrapper>
  );
}

export const EmergencyContactsBottomSheet = forwardRef<EmergencyContactsBottomSheetHandle>(
  function EmergencyContactsBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const { data: contacts = [], isLoading } = useEmergencyContacts();
    const { mutateAsync: createContact, isPending } = useCreateEmergencyContact();
    const { mutateAsync: updateContact, isPending: isSaving } = useUpdateEmergencyContact();
    const { mutateAsync: deleteContact, isPending: isDeleting } = useDeleteEmergencyContact();
    const [mode, setMode] = useState<Mode>('list');
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
    const [selectedServerId, setSelectedServerId] = useState<number | null>(null);

    const form = useForm<EmergencyContactFormValues>({
      resolver: zodResolver(emergencyContactSchema),
      defaultValues: { name: '', relationship: undefined, phone_country_code: 'PH', phone: '', is_primary: false },
    });

    const resetForm = () => form.reset({ name: '', relationship: undefined, phone_country_code: 'PH', phone: '', is_primary: false });

    const loadItem = (localUuid: string) => {
      const item = contacts.find((c) => c.local_uuid === localUuid);
      if (!item) return false;
      form.reset({
        name: item.name,
        relationship: (item.relationship as RelationToPatient | null) ?? undefined,
        phone_country_code: item.phone_country_code ?? 'PH',
        phone: item.phone ?? '',
        is_primary: !!item.is_primary,
      });
      setSelectedUuid(localUuid);
      setSelectedServerId(item.server_id);
      return true;
    };

    useImperativeHandle(ref, () => ({
      present: () => { setMode('list'); sheetRef.current?.present(); },
      presentAdd: () => { resetForm(); setMode('add'); sheetRef.current?.present(); },
      presentView: (localUuid: string) => { if (!loadItem(localUuid)) return; setMode('view'); sheetRef.current?.present(); },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handlePress = useGuardedPress((localUuid: string) => {
      if (!loadItem(localUuid)) return;
      setMode('view');
    });

    const handleAdd = () => { resetForm(); setMode('add'); };

    const handleSave = async () => {
      const isValid = await form.trigger();
      if (!isValid) return;
      const data = form.getValues();
      if (mode === 'view' && selectedUuid) {
        await updateContact({ localUuid: selectedUuid, serverId: selectedServerId, payload: data });
        setMode('list');
      } else {
        await createContact(data);
        sheetRef.current?.dismiss();
      }
    };

    const handleDelete = () => {
      if (!selectedUuid) return;
      Alert.alert('Remove contact', `Are you sure you want to remove ${form.getValues('name')}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => { await deleteContact(selectedUuid); setMode('list'); } },
      ]);
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['50%', '90%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: sheet.radius }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: sheet.handleWidth }}
        backdropComponent={renderBackdrop}
        onDismiss={() => setMode('list')}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {mode === 'list' ? (
          isLoading ? (
            <View className="items-center py-8"><ActivityIndicator size="large" color={theme.primary} /></View>
          ) : (
            <BottomSheetFlatList
              data={contacts}
              keyExtractor={(item) => item.local_uuid}
              contentContainerStyle={{ paddingHorizontal: sheet.paddingH, paddingBottom: 32 }}
              ListHeaderComponent={
                <View className="mb-4 flex-row items-center justify-between">
                  <ThemedText type="overline">Emergency contacts</ThemedText>
                  <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
                    <Ionicons name="close" size={20} color={theme.mutedForeground} />
                  </Pressable>
                </View>
              }
              ListEmptyComponent={
                <View className="items-center py-8">
                  <Ionicons name="people-outline" size={40} color={theme.mutedForeground} style={{ marginBottom: 12 }} />
                  <ThemedText color="mutedForeground">No emergency contacts yet.</ThemedText>
                </View>
              }
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
              renderItem={({ item }) => <ContactSheetRow item={item} onPress={handlePress} theme={theme} />}
              ListFooterComponent={
                <Pressable onPress={handleAdd} className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: theme.primary }}>
                  <Ionicons name="add" size={18} color={theme.primaryForeground} />
                  <ThemedText type="bodyBold" color="primaryForeground">Add contact</ThemedText>
                </Pressable>
              }
            />
          )
        ) : (
          <ContactForm form={form} mode={mode} isPending={isPending} isSaving={isSaving} isDeleting={isDeleting} onSave={() => void handleSave()} onDelete={handleDelete} />
        )}
      </BottomSheetModal>
    );
  },
);
