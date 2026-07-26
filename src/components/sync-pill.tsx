import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type SyncPillStatus = 'pending' | 'syncing' | 'conflict';

const LABEL: Record<SyncPillStatus, string> = {
  pending: 'Waiting to sync',
  syncing: 'Syncing...',
  conflict: 'Needs attention',
};

const ICON: Record<SyncPillStatus, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  syncing: 'sync-outline',
  conflict: 'alert-circle-outline',
};

export function SyncPill({ status, count, className }: { status: SyncPillStatus; count?: number; className?: string }) {
  const theme = useTheme();
  const isConflict = status === 'conflict';
  const bgColor = isConflict ? theme.destructive + '1a' : theme.warning + '1a';
  const textColor = isConflict ? theme.destructive : theme.warning;

  return (
    <View
      className="self-start flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: bgColor }}
    >
      <Ionicons name={ICON[status]} size={12} color={textColor} />
      <ThemedText type="detail" style={{ color: textColor }}>
        {LABEL[status]}
        {count ? ` (${count})` : ''}
      </ThemedText>
    </View>
  );
}
