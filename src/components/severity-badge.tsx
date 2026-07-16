import { memo } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { AllergyRow } from '@/db/schema';

type SeverityColor = 'success' | 'warning' | 'destructive' | 'critical';

const SEVERITY_STYLE: Record<AllergyRow['severity'], { bgKey: SeverityColor; label: string }> = {
  mild: { bgKey: 'success', label: 'Mild' },
  moderate: { bgKey: 'warning', label: 'Moderate' },
  severe: { bgKey: 'destructive', label: 'Severe' },
  'life-threatening': { bgKey: 'critical', label: 'Life-threatening' },
};

const SEVERITY_ICON: Record<AllergyRow['severity'], { name: keyof typeof Ionicons.glyphMap; colorKey: SeverityColor }> = {
  mild: { name: 'leaf', colorKey: 'success' },
  moderate: { name: 'alert-circle', colorKey: 'warning' },
  severe: { name: 'warning', colorKey: 'destructive' },
  'life-threatening': { name: 'skull', colorKey: 'critical' },
};

export const SeverityBadge = memo(function SeverityBadge({ severity }: { severity: AllergyRow['severity'] }) {
  const theme = useTheme();
  const style = SEVERITY_STYLE[severity];
  const bgColor = theme[style.bgKey] + '20';
  const textColor = theme[style.bgKey];

  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: bgColor }}
      accessibilityRole="text"
      accessibilityLabel={`Severity: ${style.label}`}
    >
      <ThemedText type="detail" style={{ color: textColor }}>
        {style.label}
      </ThemedText>
    </View>
  );
});

export function SeverityIcon({ severity, size = 40 }: { severity: AllergyRow['severity']; size?: number }) {
  const theme = useTheme();
  const { name, colorKey } = SEVERITY_ICON[severity];
  const style = SEVERITY_STYLE[severity];
  const bgColor = theme[style.bgKey] + '20';

  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: size, height: size, borderRadius: size * 0.25, backgroundColor: bgColor }}
    >
      <Ionicons name={name} size={size * 0.45} color={theme[colorKey]} />
    </View>
  );
}
