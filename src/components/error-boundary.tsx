import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { View, Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { field, sheet } from '@/components/form/tokens';
import { useTheme } from '@/hooks/use-theme';

type ErrorBoundaryProps = PropsWithChildren<{
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}>;

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: sheet.paddingH,
      }}
    >
      <ThemedText type="title" style={{ marginBottom: 12 }}>
        Something went wrong
      </ThemedText>
      <ScrollView
        style={{
          maxHeight: 200,
          backgroundColor: theme.muted,
          borderRadius: sheet.rowRadius,
          padding: field.paddingV,
          marginBottom: 24,
          width: '100%',
        }}
      >
        <ThemedText type="small" color="mutedForeground" style={{ fontFamily: 'monospace' }}>
          {error.message}
        </ThemedText>
      </ScrollView>
      <Pressable
        onPress={reset}
        style={{
          backgroundColor: theme.primary,
          paddingHorizontal: sheet.paddingH,
          paddingVertical: field.paddingV,
          borderRadius: sheet.rowRadius,
        }}
      >
        <ThemedText color="primaryForeground">Try again</ThemedText>
      </Pressable>
    </View>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] caught error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
