import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type AppLayoutProps = ViewProps & {
  /** Renders a plain View instead of a ScrollView — use for screens with their own scrollable list (e.g. FlatList). */
  scrollable?: boolean;
  /** Optional pull-to-refresh callback. When provided, a RefreshControl is added to the ScrollView. */
  onRefresh?: () => Promise<void>;
  /** Caps content width on tablets — centers the content and sets a max-width (default: undefined = full width). */
  maxContentWidth?: number;
};

/**
 * Shared container for authenticated tab/stack screens: consistent screen padding and background.
 * Defaults to a scrolling container; pass `scrollable={false}` for screens that manage their own
 * scrolling (e.g. a FlatList list screen).
 */
export function AppLayout({ children, className, scrollable = true, onRefresh, maxContentWidth, ...rest }: AppLayoutProps) {
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

  const content = (
    <View style={maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : undefined}>
      {children}
    </View>
  );

  if (!scrollable) {
    return (
      <View className={cn('flex-grow px-5 py-4', className)} style={{ backgroundColor: theme.background }} {...rest}>
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      className="bg-background"
      contentContainerClassName={cn('flex-grow px-5 py-4', className)}
      style={{ backgroundColor: theme.background }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.foreground} colors={[theme.primary]} progressBackgroundColor={theme.background} /> : undefined}
      {...rest}
    >
      {content}
    </ScrollView>
  );
}
