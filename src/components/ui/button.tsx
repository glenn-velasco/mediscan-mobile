import { forwardRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { buttonVariants, buttonTextVariants, type ButtonVariantProps } from '@/components/ui/button-variants';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariantProps['variant'];
  size?: ButtonVariantProps['size'];
  children?: ReactNode;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<View, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      children,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const theme = useTheme();

    return (
      <Pressable
        ref={ref}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'opacity-50',
          className
        )}
        style={style}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            color={
              variant === 'default' || variant === 'destructive'
                ? 'white'
                : theme.foreground
            }
          />
        ) : (
          <>
            {leftIcon ? <View>{leftIcon}</View> : null}
            {typeof children === 'string' ? (
              <Text className={cn(buttonTextVariants({ variant, size }))}>
                {children}
              </Text>
            ) : (
              children
            )}
            {rightIcon ? <View>{rightIcon}</View> : null}
          </>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
