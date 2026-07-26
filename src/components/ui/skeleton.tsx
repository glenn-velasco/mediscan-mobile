import { useEffect } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type SkeletonProps = ViewProps & {
  /** Width of the skeleton (default: '100%') */
  width?: number | string;
  /** Height of the skeleton (default: 20) */
  height?: number;
  /** Border radius (default: 6) */
  borderRadius?: number;
};

const AnimatedView = Animated.createAnimatedComponent(View);

function SkeletonPulse() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <AnimatedView style={animatedStyle} />;
}

/** A shimmer/pulse placeholder for loading states. */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 6,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const theme = useTheme();
  return (
    <View
      className={cn('overflow-hidden', className)}
      style={[{ width: width as any, height, borderRadius, backgroundColor: theme.muted }, style]}
      accessibilityRole="text"
      accessibilityLabel="Loading"
      {...rest}
    >
      <SkeletonPulse />
    </View>
  );
}

/** Pre-built skeleton layouts for common patterns. */
export function SkeletonCard({ className }: { className?: string }) {
  const theme = useTheme();
  return (
    <View className={cn('gap-3 rounded-xl p-4', className)} style={{ backgroundColor: theme.card }}>
      <Skeleton width={120} height={16} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="60%" height={14} />
    </View>
  );
}

export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <View className={cn('flex-row items-center gap-3 py-3', className)}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View className="flex-1 gap-2">
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} />
      </View>
    </View>
  );
}
