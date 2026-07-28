import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

interface SkeletonProps extends ViewProps {
  className?: string;
}

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <View
      className={cn('animate-pulse rounded-md bg-muted', className)}
      style={[{ opacity: 0.5 }, style]}
      {...props}
    />
  );
}
