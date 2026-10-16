import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useAuth } from '@/auth/useAuth';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import type { Suffix } from '@/constants/suffix';
import { useDeviceKey, useRotateDeviceKey } from '@/features/device-keys/useDeviceKey';
import { useMyProfessionalApplication } from '@/features/professional-application/useProfessionalApplication';
import { useTheme } from '@/hooks/use-theme';
import { buildFullName } from '@/lib/build-full-name';

export default function AccountScreen() {
  const { user, logout, refreshUser } = useAuth();
  const theme = useTheme();
  const { data: deviceKey } = useDeviceKey();
  const { mutate: rotateKey, isPending: isRotating } = useRotateDeviceKey();
  const { data: professionalApplication, isLoading: applicationLoading } = useMyProfessionalApplication();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // react-doctor-disable-next-line react-hooks-js/todo
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
        <Avatar
          name={
            user
              ? buildFullName({ first_name: user.first_name, middle_name: user.middle_name ?? undefined, last_name: user.last_name, suffix: (user.suffix as Suffix) ?? undefined })
              : '?'
          }
          size={72}
        />
        <ThemedText color="mutedForeground">{user?.email}</ThemedText>
        {user?.permissions?.includes('verified professional') ? (
          <View
            className="mt-1 flex-row items-center gap-1"
            style={{ backgroundColor: theme.primary + '20', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}
          >
            <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
            <ThemedText type="small" color="primary">
              Verified Professional
            </ThemedText>
          </View>
        ) : null}
      </View>

      {user?.permissions?.includes('admin') ? (
        <Card className="mb-4 p-0">
          <Link href={'/admin-verification' as Href} asChild><Pressable className="flex-row items-center justify-between px-4 py-3.5"><View className="flex-1 pr-3"><ThemedText className="font-semibold">Professional verification</ThemedText><ThemedText type="small" color="mutedForeground">Review PRC applications and manage admin access.</ThemedText></View><Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /></Pressable></Link>
        </Card>
      ) : null}

      {!applicationLoading ? (
        <Card className="mb-4 p-0">
          <Link
            href={professionalApplication
              ? { pathname: '/professional-application/[id]', params: { id: String(professionalApplication.id) } }
              : '/professional-application/create'}
            asChild
          >
            <Pressable className="flex-row items-center justify-between px-4 py-3.5" accessibilityRole="button">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: theme.primary + '15' }}>
                <Ionicons name="shield-checkmark-outline" size={21} color={theme.primary} />
              </View>
              <View className="flex-1 pr-3">
                <ThemedText className="font-semibold">
                  {professionalApplication ? 'Professional application' : 'Apply as a professional'}
                </ThemedText>
                <ThemedText type="small" color="mutedForeground">
                  {professionalApplication
                    ? `Status: ${professionalApplication.status.replaceAll('_', ' ')}`
                    : 'Submit your PRC ID and complete identity verification.'}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
            </Pressable>
          </Link>
        </Card>
      ) : null}

      <Card className="mb-4 p-0">
        <Link href={'/encounters' as Href} asChild><Pressable className="flex-row items-center justify-between px-4 py-3.5"><View className="flex-1 pr-3"><ThemedText className="font-semibold">Encounter reports</ThemedText><ThemedText type="small" color="mutedForeground">View vitals and notes shared by verified professionals.</ThemedText></View><Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /></Pressable></Link>
      </Card>

      <Card className="mb-4 p-0">
        <Link href="/profile/edit" asChild>
          <Pressable className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-1 pr-3">
              <ThemedText className="font-semibold">Edit profile</ThemedText>
              <ThemedText type="small" color="mutedForeground">Update your photo, identity, contact, and medical details.</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </Pressable>
        </Link>
      </Card>

      <Card className="mb-4 p-0">
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
              <ThemedText type="smallBold" color="primary">
                {isRotating ? 'Rotating…' : 'Rotate'}
              </ThemedText>
            </Pressable>
          ) : null}
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


