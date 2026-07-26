import { ScrollView, View, type ViewProps } from 'react-native';
import { AvoidSoftInputView } from 'react-native-avoid-softinput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

/**
 * Shared container for unauthenticated screens (login, register, forgot/reset password):
 * centers content vertically, adds consistent horizontal padding, and avoids the keyboard
 * covering inputs on smaller screens.
 */
export function AuthLayout({ children, className, ...rest }: ViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <AvoidSoftInputView style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled">
        <View className={cn('flex-1 justify-center gap-1 px-6', className)} {...rest}>
          {children}
        </View>
      </ScrollView>
    </AvoidSoftInputView>
  );
}
