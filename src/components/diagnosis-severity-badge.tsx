import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';

type SeverityColor = 'muted' | 'warning' | 'destructive' | 'critical';

const SEVERITY_STYLE: Record<DiagnosisSeverity, { bgKey: SeverityColor; label: string }> = {
  chronic: { bgKey: 'muted', label: 'Chronic' },
  ongoing: { bgKey: 'warning', label: 'Ongoing' },
  acute: { bgKey: 'destructive', label: 'Acute' },
  critical: { bgKey: 'critical', label: 'Critical' },
};

const SEVERITY_ICON: Record<DiagnosisSeverity, { name: keyof typeof Ionicons.glyphMap; colorKey: SeverityColor }> = {
  chronic: { name: 'time', colorKey: 'muted' },
  ongoing: { name: 'alert-circle', colorKey: 'warning' },
  acute: { name: 'flash', colorKey: 'destructive' },
  critical: { name: 'skull', colorKey: 'critical' },
};

export function DiagnosisSeverityBadge({ severity }: { severity: DiagnosisSeverity }) {
  const theme = useTheme();
  const style = SEVERITY_STYLE[severity];
  const bgColor = theme[style.bgKey] + '20';
  const textColor = style.bgKey === 'muted' ? theme.mutedForeground : theme[style.bgKey];

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
}

export function DiagnosisSeverityIcon({ severity, size = 40 }: { severity: DiagnosisSeverity; size?: number }) {
  const theme = useTheme();
  const { name, colorKey } = SEVERITY_ICON[severity];
  const style = SEVERITY_STYLE[severity];
  const bgColor = theme[style.bgKey] + '20';
  const iconColor = colorKey === 'muted' ? theme.mutedForeground : theme[colorKey];

  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: size, height: size, borderRadius: size * 0.25, backgroundColor: bgColor }}
    >
      <Ionicons name={name} size={size * 0.45} color={iconColor} />
    </View>
  );
}
