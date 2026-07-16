import { LinearGradient } from 'expo-linear-gradient';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type GradientHeaderProps = ViewProps & {
  edgeToEdge?: boolean;
  topInset?: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr},${lg},${lb})`;
}

function mixWith(hex: string, target: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(target);
  const mr = Math.round(r1 + (r2 - r1) * amount);
  const mg = Math.round(g1 + (g2 - g1) * amount);
  const mb = Math.round(b1 + (b2 - b1) * amount);
  return `rgb(${mr},${mg},${mb})`;
}

/**
 * Negative margins mirror AppLayout px-5 (20px) / py-4 (16px) to bleed edge-to-edge.
 * Keep these values in sync with the layout padding.
 */
const LAYOUT_PX = 20;
const LAYOUT_PY = 16;

export function GradientHeader({ className, children, edgeToEdge = false, topInset = 0, style, ...rest }: GradientHeaderProps) {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={[theme.primary, mixWith(theme.primary, '#e8ede9', 0.3), lighten(theme.primary, 0.45)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.6 }}
      style={
        edgeToEdge
          ? {
              marginHorizontal: -LAYOUT_PX,
              marginTop: -LAYOUT_PY,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }
          : { borderRadius: 20 }
      }
    >
      <View
        className={cn('p-6', className)}
        style={[edgeToEdge ? { paddingTop: LAYOUT_PX + topInset } : undefined, style]}
        {...rest}
      >
        {children}
      </View>
    </LinearGradient>
  );
}
