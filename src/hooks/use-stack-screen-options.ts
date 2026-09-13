import { useTheme } from '@/hooks/use-theme';
import { StackBackButton } from '@/components/stack-back-button';
import { createElement } from 'react';

/**
 * Shared Stack `screenOptions` for every authenticated-area layout (app, account, allergies,
 * profile) — one place for header colors/typography and `contentStyle`, so a screen that hides
 * its header (`headerShown: false`) doesn't reveal React Navigation's default white background.
 */
export function useStackScreenOptions() {
  const theme = useTheme();

  return {
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.foreground,
    headerShadowVisible: false,
    headerTitleStyle: { fontWeight: '600' as const, fontSize: 18 },
    headerLeft: () => createElement(StackBackButton),
    headerLeftContainerStyle: { width: 32, paddingLeft: 8, paddingRight: 0 },
    contentStyle: { backgroundColor: theme.background },
  };
}
