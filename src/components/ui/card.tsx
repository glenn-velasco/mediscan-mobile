import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

interface CardProps extends ViewProps {
  className?: string;
}

const Card = forwardRef<View, CardProps>(({ className, ...props }, ref) => {
  return (
    <View
      ref={ref}
      className={cn(
        'rounded-2xl border border-border bg-card p-4',
        className
      )}
      {...props}
    />
  );
});

Card.displayName = 'Card';

interface CardHeaderProps extends ViewProps {
  className?: string;
}

const CardHeader = forwardRef<View, CardHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn('flex-col gap-1.5 pb-3', className)}
        {...props}
      />
    );
  }
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

const CardTitle = forwardRef<View, CardTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <View ref={ref} className={cn(className)} {...props}>
        <Text variant="h3" className="text-card-foreground">
          {children}
        </Text>
      </View>
    );
  }
);

CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

const CardDescription = forwardRef<View, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <View ref={ref} className={cn(className)} {...props}>
        <Text variant="muted">{children}</Text>
      </View>
    );
  }
);

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends ViewProps {
  className?: string;
}

const CardContent = forwardRef<View, CardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <View ref={ref} className={cn('pt-0', className)} {...props} />
    );
  }
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends ViewProps {
  className?: string;
}

const CardFooter = forwardRef<View, CardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn('flex-row items-center pt-3', className)}
        {...props}
      />
    );
  }
);

CardFooter.displayName = 'CardFooter';

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
export type { CardProps };
