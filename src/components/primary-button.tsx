import { type PressableProps } from 'react-native';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type PrimaryButtonProps = {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'ghost' | 'outline';
  leftIcon?: ReactNode;
} & Omit<PressableProps, 'children'>;

export function PrimaryButton({ label, loading, variant = 'primary', disabled, className, leftIcon, ...rest }: PrimaryButtonProps) {
  const rnrVariant = variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : variant;

  return (
    <Button
      variant={rnrVariant}
      loading={loading}
      disabled={disabled}
      className={className}
      leftIcon={leftIcon}
      {...rest}
    >
      {label}
    </Button>
  );
}
