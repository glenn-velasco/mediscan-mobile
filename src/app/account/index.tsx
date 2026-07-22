import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';

import { useAuth } from '@/auth/useAuth';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { useBleAdvertising } from '@/features/ble-sync/useBleAdvertising';
import { useDeviceKey, useRotateDeviceKey } from '@/features/device-keys/useDeviceKey';
import { ensureDndBypass, ensureNotificationPermission } from '@/features/qr-widget/qr-notification';
import { useQrWidgetToggle } from '@/features/qr-widget/useQrWidgetToggle';
import { useTheme } from '@/hooks/use-theme';

export default function AccountScreen() {
  const { user, logout, refreshUser } = useAuth();
  const theme = useTheme();
  const { data: deviceKey } = useDeviceKey();
  const { mutate: rotateKey, isPending: isRotating } = useRotateDeviceKey();
  const ble = useBleAdvertising();
  const { enabled: qrWidgetEnabled, loaded: qrWidgetLoaded, setEnabled: setQrWidgetEnabled } = useQrWidgetToggle();

  const handleQrWidgetToggle = async (next: boolean) => {
    await setQrWidgetEnabled(next);
    if (next) {
      // Prompt for notification + Do Not Disturb access at the moment of enabling.
      await ensureNotificationPermission();
      await ensureDndBypass();
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } catch {
      // ignore — user state stays as-is
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  return (
    <AppLayout>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
      <View className="mb-8 items-center gap-1">
        <Avatar name={user?.fullname ?? '?'} size={72} />
        <ThemedText color="mutedForeground">{user?.email}</ThemedText>
        {user?.permissions?.includes('verified professional') ? (
          <View
            className="mt-1 flex-row items-center gap-1"
            style={{ backgroundColor: theme.primary + '20', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}
          >
            <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>
              Verified Professional
            </ThemedText>
          </View>
        ) : null}
      </View>

      <Card className="mb-4 p-0">
        {!user?.permissions?.includes('verified professional') ? (
          <Link href="/professional-application/create" asChild>
            <Pressable className="flex-row items-center justify-between px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <ThemedText>Get verified as a professional</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
            </Pressable>
          </Link>
        ) : null}
        <Link href="/account/email" asChild>
          <Pressable className="flex-row items-center justify-between px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <ThemedText>Change email</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </Pressable>
        </Link>
        <Link href="/account/password" asChild>
          <Pressable className="flex-row items-center justify-between px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <ThemedText>Change password</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </Pressable>
        </Link>
      </Card>

      <Card className="mb-4 gap-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 shrink pr-3">
            <ThemedText className="font-semibold">Sync key</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              {deviceKey ? `Registered on this device${deviceKey.label ? ` as "${deviceKey.label}"` : ''}` : 'Not yet registered'}
            </ThemedText>
          </View>
          {deviceKey ? (
            <Pressable onPress={() => rotateKey()} disabled={isRotating} hitSlop={8}>
              <ThemedText type="small" color="primary" className="font-semibold">
                {isRotating ? 'Rotating…' : 'Rotate'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card className="mb-4 gap-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <ThemedText className="font-semibold">Bluetooth sync</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              Let a professional nearby submit an update directly to this device.
            </ThemedText>
          </View>
          <Switch
            value={ble.isAdvertising}
            onValueChange={(next) => void (next ? ble.start() : ble.stop())}
            disabled={ble.state === 'starting'}
          />
        </View>
        {ble.error ? (
          <ThemedText type="small" color="destructive">
            {ble.error}
          </ThemedText>
        ) : null}
      </Card>

      <Card className="mb-4 gap-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <ThemedText className="font-semibold">Emergency QR Widget</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              Show your QR code on your lock screen and home screen for quick access in an emergency.
            </ThemedText>
          </View>
          <Switch
            value={qrWidgetEnabled}
            onValueChange={(next) => void handleQrWidgetToggle(next)}
            disabled={!qrWidgetLoaded}
          />
        </View>
      </Card>

      <Card className="p-0">
        <Pressable onPress={() => void logout()} className="flex-row items-center justify-between px-4 py-3.5 active:bg-accent">
          <ThemedText color="destructive">Log out</ThemedText>
        </Pressable>
      </Card>
      </ScrollView>
    </AppLayout>
  );
}



