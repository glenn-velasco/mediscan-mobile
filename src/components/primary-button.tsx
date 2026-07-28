import { type PressableProps } from 'react-native';

import { Button } from '@/components/ui/button';

type PrimaryButtonProps = {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
} & Omit<PressableProps, 'children'>;

export function PrimaryButton({ label, loading, variant = 'primary', disabled, className, ...rest }: PrimaryButtonProps) {
  const rnrVariant = variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : 'ghost';

  return (
    <Button
      variant={rnrVariant}
      loading={loading}
      disabled={disabled}
      className={className}
      {...rest}
    >
      {label}
    </Button>
  );
}
