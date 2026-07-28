import { Platform, useWindowDimensions, type TextProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'screenTitle' | 'authTitle' | 'subtitle' | 'heading' | 'body' | 'bodyBold' | 'label' | 'small' | 'smallBold' | 'detail' | 'caption' | 'overline' | 'link' | 'linkPrimary' | 'code';
  color?: ThemeColor;
};

const TYPE_CLASSNAME: Record<NonNullable<ThemedTextProps['type']>, string> = {
  default: 'text-base leading-6 font-normal',
  title: 'text-[28px] leading-[36px] font-bold',
  screenTitle: 'text-[20px] leading-[28px] font-semibold',
  authTitle: 'text-[24px] leading-[32px] font-semibold',
  subtitle: 'text-[22px] leading-[30px] font-semibold',
  heading: 'text-[17px] leading-[22px] font-semibold',
  body: 'text-[15px] leading-[22px] font-medium',
  bodyBold: 'text-[15px] leading-[22px] font-semibold',
  label: 'text-[14px] leading-[20px] font-medium',
  small: 'text-[13px] leading-[18px] font-medium',
  smallBold: 'text-[13px] leading-[18px] font-bold',
  detail: 'text-[13px] leading-[18px] font-medium',
  caption: 'text-[13px] leading-[18px] font-medium',
  overline: 'text-[12px] leading-[16px] font-semibold uppercase',
  link: 'text-[13px] leading-[22px]',
  linkPrimary: 'text-[13px] leading-[22px]',
  code: 'text-xs font-mono',
};

const TYPE_STYLE: Record<NonNullable<ThemedTextProps['type']>, { letterSpacing?: number }> = {
  default: { letterSpacing: 0.01 },
  title: { letterSpacing: -0.03 },
  screenTitle: { letterSpacing: -0.02 },
  authTitle: { letterSpacing: -0.02 },
  subtitle: { letterSpacing: -0.02 },
  heading: {},
  body: { letterSpacing: 0.01 },
  bodyBold: { letterSpacing: 0.01 },
  label: { letterSpacing: 0.01 },
  small: {},
  smallBold: {},
  detail: {},
  caption: {},
  overline: { letterSpacing: 0.12 },
  link: {},
  linkPrimary: {},
  code: {},
};

const BASE_FONT_SIZE: Record<NonNullable<ThemedTextProps['type']>, number> = {
  default: 16,
  title: 28,
  screenTitle: 20,
  authTitle: 24,
  subtitle: 22,
  heading: 17,
  body: 15,
  bodyBold: 15,
  label: 14,
  small: 13,
  smallBold: 13,
  detail: 13,
  caption: 13,
  overline: 12,
  link: 13,
  linkPrimary: 13,
  code: 14,
};

const FONT_FAMILY: Record<NonNullable<ThemedTextProps['type']>, string> = {
  default: 'Inter-Medium',
  title: 'PlusJakartaSans-Bold',
  screenTitle: 'PlusJakartaSans-SemiBold',
  authTitle: 'PlusJakartaSans-SemiBold',
  subtitle: 'PlusJakartaSans-SemiBold',
  heading: 'PlusJakartaSans-SemiBold',
  body: 'Inter-Medium',
  bodyBold: 'Inter-SemiBold',
  label: 'Inter-Medium',
  small: 'Inter-Medium',
  smallBold: 'Inter-Bold',
  detail: 'Inter-Medium',
  caption: 'Inter-Medium',
  overline: 'Inter-SemiBold',
  link: 'Inter-Regular',
  linkPrimary: 'Inter-Regular',
  code: 'Inter-Regular',
};

const TYPE_COLOR_KEY: Record<NonNullable<ThemedTextProps['type']>, ThemeColor> = {
  default: 'foreground',
  title: 'foreground',
  screenTitle: 'foreground',
  authTitle: 'foreground',
  subtitle: 'foreground',
  heading: 'foreground',
  body: 'foreground',
  bodyBold: 'foreground',
  label: 'mutedForeground',
  small: 'foreground',
  smallBold: 'foreground',
  detail: 'foreground',
  caption: 'mutedForeground',
  overline: 'mutedForeground',
  link: 'foreground',
  linkPrimary: 'primary',
  code: 'foreground',
};

function useFontScale(): number {
  const { width } = useWindowDimensions();
  if (width >= 900) return 1.18;
  if (width >= 600) return 1.10;
  return 1.0;
}

export function ThemedText({ className, type = 'default', color, style, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const scale = useFontScale();
  const resolvedColor = (color ? theme[color] : theme[TYPE_COLOR_KEY[type]]) as string;

  return (
    <Text
      allowFontScaling
      className={cn(TYPE_CLASSNAME[type], className)}
      style={[
        TYPE_STYLE[type],
        type === 'code' && { fontWeight: Platform.select({ android: 700 }) ?? 500 },
        { color: resolvedColor, fontFamily: FONT_FAMILY[type], fontSize: BASE_FONT_SIZE[type] * scale },
        style,
      ]}
      {...rest}
    />
  );
}
