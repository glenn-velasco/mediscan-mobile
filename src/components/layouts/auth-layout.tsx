import { Platform, ScrollView, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { KeyboardAwareLayout } from '@/components/layouts/keyboard-aware-layout';

/**
 * Shared container for unauthenticated screens (login, register, forgot/reset password):
 * centers content vertically, adds consistent horizontal padding, and avoids the keyboard
 * covering inputs on smaller screens.
 */
export function AuthLayout({ children, className, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAwareLayout keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, ...(Platform.OS !== 'ios' ? { paddingTop: insets.top } : {}) }}
        contentInset={Platform.OS === 'ios' ? { top: insets.top } : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className={cn('flex-1 justify-center gap-1 px-6', className)} {...rest}>
          {children}
        </View>
      </ScrollView>
    </KeyboardAwareLayout>
  );
}
