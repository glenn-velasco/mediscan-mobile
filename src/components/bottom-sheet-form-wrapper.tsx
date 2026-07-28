import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from 'react-native';

import { sheet } from '@/components/form/tokens';

type BottomSheetFormWrapperProps = {
  children: React.ReactNode;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
};

export function BottomSheetFormWrapper({ children, contentContainerStyle }: BottomSheetFormWrapperProps) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ paddingHorizontal: sheet.paddingH, paddingBottom: sheet.paddingB, paddingTop: sheet.paddingT }, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
