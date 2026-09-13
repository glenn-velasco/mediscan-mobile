import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import { getEmergencyCardStatus } from '@/api/endpoints/emergency-wallet-card';
import { useAuth } from '@/auth/useAuth';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { getDynamicCard, removeDynamicCard, type LocalDynamicEmergencyCard } from '@/db/repositories/dynamic-emergency-card.repo';
import { useTheme } from '@/hooks/use-theme';
import type { Suffix } from '@/constants/suffix';
import { buildFullName } from '@/lib/build-full-name';
import { buildEmergencyCardReference } from '@/lib/emergency-qr-reference';
import {
  createDynamicEmergencyCard,
  publishDynamicEmergencyCard,
  replaceDynamicEmergencyCard,
  revokeDynamicEmergencyCard,
} from '@/services/dynamic-emergency-card.service';
import { shareEmergencyWalletCard } from '@/services/wallet-card.service';
import { getErrorMessage } from '@/api/errors';

export default function EmergencyWalletCardScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const [card, setCard] = useState<LocalDynamicEmergencyCard | null>(null);
  const [serverHasCard, setServerHasCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const local = await getDynamicCard(user.id);
    setCard(local);
    try {
      const status = await getEmergencyCardStatus();
      setServerHasCard(status.active);
      if (!status.active && local) {
        await removeDynamicCard(user.id);
        setCard(null);
      }
    } catch {
      // Local state remains useful while offline.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  if (!user || loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.primary} /></View>;

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await operation();
      await refresh();
    } catch (error) {
      Alert.alert('Unable to update wallet card', getErrorMessage(error, 'The wallet-card update failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const displayName = buildFullName({
    first_name: user.first_name,
    middle_name: user.middle_name ?? undefined,
    last_name: user.last_name,
    suffix: (user.suffix as Suffix | null) ?? undefined,
  });

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="card-outline" size={30} color={theme.primary} />
        <View style={{ flex: 1 }}><ThemedText type="heading">Permanent dynamic card</ThemedText><ThemedText selectable color="mutedForeground">Print once. Profile changes update behind the same QR.</ThemedText></View>
      </View>
      <ThemedText selectable color="mutedForeground">The printed card requires internet. Your QR shown inside MediScan remains available offline.</ThemedText>
    </Card>

    {card ? <Card style={{ gap: 8 }}>
      <ThemedText type="bodyBold">Card active</ThemedText>
      <ThemedText selectable color={card.pendingPublish ? 'warning' : 'success'}>{card.pendingPublish ? 'Printed card update pending' : 'Latest emergency snapshot published'}</ThemedText>
      <ThemedText selectable color="mutedForeground">Issued {new Date(card.issuedAt).toLocaleDateString()}</ThemedText>
      {card.lastPublishedAt ? <ThemedText selectable color="mutedForeground">Last published {new Date(card.lastPublishedAt).toLocaleString()}</ThemedText> : null}
    </Card> : serverHasCard ? <Card style={{ gap: 8 }}><ThemedText type="bodyBold">Card token unavailable on this device</ThemedText><ThemedText selectable color="mutedForeground">The existing card remains active, but this device cannot recreate its QR. Replace it only if you need another printed copy.</ThemedText></Card> : null}

    {!card && !serverHasCard ? <PrimaryButton loading={busy} label="Create permanent wallet card" onPress={() => void run(() => createDynamicEmergencyCard(user.id))} /> : null}
    {card ? <>
      <PrimaryButton disabled={busy || card.pendingPublish || !card.lastPublishedAt} loading={busy} label="Share printable wallet card" onPress={() => void run(() => shareEmergencyWalletCard(buildEmergencyCardReference(card.token), displayName, card.issuedAt, card.lastPublishedAt))} />
      {card.pendingPublish ? <ThemedText selectable color="mutedForeground">Publish the latest emergency snapshot before sharing. The printed QR cannot resolve until a snapshot is published.</ThemedText> : null}
      {card.pendingPublish ? <PrimaryButton loading={busy} label="Publish pending update" variant="ghost" onPress={() => void run(() => publishDynamicEmergencyCard(user.id, { throwOnError: true }))} /> : null}
    </> : null}
    {(card || serverHasCard) ? <PrimaryButton loading={busy} label="Replace lost or compromised card" variant="ghost" onPress={() => Alert.alert('Replace wallet card?', 'The current printed QR will stop working. You must print the replacement card.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace', style: 'destructive', onPress: () => void run(() => replaceDynamicEmergencyCard(user.id)) }])} /> : null}
    {(card || serverHasCard) ? <PrimaryButton disabled={busy} label="Revoke wallet card" variant="danger" onPress={() => Alert.alert('Revoke wallet card?', 'The printed QR will permanently stop working.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: () => void run(() => revokeDynamicEmergencyCard(user.id)) }])} /> : null}
  </ScrollView>;
}
