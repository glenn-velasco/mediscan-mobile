import { KeyboardAvoidingView, Platform, type KeyboardAvoidingViewProps, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '@/hooks/use-theme';

type KeyboardAwareLayoutProps = KeyboardAvoidingViewProps & {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Keeps the area exposed by Android's resized soft keyboard consistent with the page theme. */
export function KeyboardAwareLayout({ children, contentStyle, behavior, keyboardVerticalOffset, style, ...rest }: KeyboardAwareLayoutProps) {
  const theme = useTheme();
  return (
    <KeyboardAvoidingView
      {...rest}
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height')}
      keyboardVerticalOffset={keyboardVerticalOffset ?? 0}
      style={[{ flex: 1, backgroundColor: theme.background }, style, contentStyle]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
