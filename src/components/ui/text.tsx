import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { textVariants, type TextVariantProps } from '@/components/ui/text-variants';
import { cn } from '@/lib/cn';

interface TextProps extends RNTextProps {
  variant?: TextVariantProps['variant'];
  className?: string;
}

const Text = forwardRef<RNText, TextProps>(
  ({ className, variant = 'default', style, ...props }, ref) => {
    return (
      <RNText
        ref={ref}
        className={cn(textVariants({ variant }), className)}
        style={style}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
export type { TextProps };
