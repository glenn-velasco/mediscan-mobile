import { forwardRef, useState } from 'react';
import { View, type ViewProps } from 'react-native';
import { Image, type ImageProps } from 'expo-image';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

interface AvatarProps extends ViewProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const avatarSizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const Avatar = forwardRef<View, AvatarProps>(
  ({ className, size = 'md', ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-full',
          avatarSizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Avatar.displayName = 'Avatar';

interface AvatarImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string };
  className?: string;
}

const AvatarImage = forwardRef<any, AvatarImageProps>(
  ({ className, source, ...props }, ref) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
      return null;
    }

    return (
      <Image
        ref={ref}
        source={source}
        className={cn('h-full w-full', className)}
        contentFit="cover"
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }
);

AvatarImage.displayName = 'AvatarImage';

interface AvatarFallbackProps extends ViewProps {
  className?: string;
  children?: React.ReactNode;
}

const AvatarFallback = forwardRef<View, AvatarFallbackProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn(
          'flex-1 items-center justify-center rounded-full bg-muted',
          className
        )}
        {...props}
      >
        {/* react-doctor-disable-next-line react-doctor/no-polymorphic-children */}
        {typeof children === 'string' ? (
          <Text className="font-medium text-muted-foreground">
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    );
  }
);

AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarFallback, AvatarImage };
export type { AvatarProps };
