import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type AppLayoutProps = ViewProps & {
  /** Renders a plain View instead of a ScrollView — use for screens with their own scrollable list (e.g. FlatList). */
  scrollable?: boolean;
  /** Optional pull-to-refresh callback. When provided, a RefreshControl is added to the ScrollView. */
  onRefresh?: () => Promise<void>;
  /** Caps content width on tablets — centers the content and sets a max-width (default: undefined = full width). */
  maxContentWidth?: number;
  /** Additional styles for the ScrollView content container (ignored when scrollable=false). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Wraps the ScrollView in a KeyboardAvoidingView (like AuthLayout) — use for screens with text inputs. */
  avoidKeyboard?: boolean;
};

/**
 * Shared container for authenticated tab/stack screens: consistent screen padding and background.
 * Defaults to a scrolling container; pass `scrollable={false}` for screens that manage their own
 * scrolling (e.g. a FlatList list screen).
 */
export function AppLayout({ children, className, scrollable = true, onRefresh, maxContentWidth, contentContainerStyle, avoidKeyboard = false, ...rest }: AppLayoutProps) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const content = maxContentWidth ? (
    <View className="flex-1 items-center">
      <View style={{ maxWidth: maxContentWidth, width: '100%' }}>
        {children}
      </View>
    </View>
  ) : (
    <View className="flex-1">{children}</View>
  );

  if (!scrollable) {
    return (
      <View className={cn('flex-grow px-5 py-4', className)} style={{ backgroundColor: theme.background }} {...rest}>
        {content}
      </View>
    );
  }

  const scrollView = (
    <ScrollView
      className={cn('bg-background', className)}
      contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 16 }, contentContainerStyle]}
      style={{ backgroundColor: theme.background }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.foreground} colors={[theme.primary]} progressBackgroundColor={theme.background} /> : undefined}
      keyboardShouldPersistTaps={avoidKeyboard ? 'handled' : undefined}
      {...rest}
    >
      {content}
    </ScrollView>
  );

  if (avoidKeyboard) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
        {scrollView}
      </KeyboardAvoidingView>
    );
  }

  return scrollView;
}
