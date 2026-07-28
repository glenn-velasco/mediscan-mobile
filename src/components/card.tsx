import { Card as RNCard } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

export function Card({ className, style, ...rest }: React.ComponentProps<typeof RNCard>) {
  const theme = useTheme();
  return (
    <RNCard
      className={cn(className)}
      style={[{ backgroundColor: theme.card, borderColor: theme.border }, style]}
      {...rest}
    />
  );
}
