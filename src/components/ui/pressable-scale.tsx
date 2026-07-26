import { useCallback, useRef } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = PressableProps & {
  /** Scale factor on press (default 0.97) */
  scale?: number;
  /** Animation duration in ms (default 100) */
  duration?: number;
};

/**
 * A Pressable that scales down on press for tactile feedback.
 */
export function PressableScale({
  scale = 0.97,
  duration = 100,
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const scaleValue = useSharedValue(1);
  const scaleValueRef = useRef(scaleValue);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      scaleValueRef.current.value = withTiming(scale, { duration });
      onPressIn?.(e);
    },
    [scale, duration, onPressIn]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scaleValueRef.current.value = withTiming(1, { duration });
      onPressOut?.(e);
    },
    [duration, onPressOut]
  );

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
