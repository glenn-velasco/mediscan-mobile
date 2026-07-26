import { forwardRef, useImperativeHandle, useRef } from 'react';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type AvatarPreviewSheetHandle = { present: () => void; dismiss: () => void };

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

/** Tapping the header avatar shows this instead of navigating anywhere — just a bigger look at the same avatar, no settings link. */
export const AvatarPreviewSheet = forwardRef<AvatarPreviewSheetHandle, { name: string; imageUrl?: string | null }>(function AvatarPreviewSheet(
  { name, imageUrl },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useTheme();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
      handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView className="items-center gap-4 px-6 pb-10 pt-4">
        <Avatar name={name} imageUrl={imageUrl} size={128} />
        <ThemedText className="text-lg font-semibold">{name}</ThemedText>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
