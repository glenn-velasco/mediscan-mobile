import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { getEmergencyCardStatus, resolveEmergencyCard } from '@/api/endpoints/emergency-wallet-card';
import { useAuth } from '@/auth/useAuth';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { getDynamicCard, markDynamicCardPending, removeDynamicCard, type LocalDynamicEmergencyCard } from '@/db/repositories/dynamic-emergency-card.repo';
import { useTheme } from '@/hooks/use-theme';
import type { Suffix } from '@/constants/suffix';
import { buildFullName } from '@/lib/build-full-name';
import {
  buildPrintableEmergencyCardQr,
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
  const [cardOnlineIssue, setCardOnlineIssue] = useState<'unpublished' | 'different-token' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<'create' | 'share' | 'publish' | 'replace' | 'revoke' | null>(null);
  const busy = activeAction !== null;

  const refresh = useCallback(async () => {
    if (!user) return;
    const local = await getDynamicCard(user.id);
    setCard(local);
    setCardOnlineIssue(null);
    try {
      const status = await getEmergencyCardStatus();
      setServerHasCard(status.active);
      if (!status.active && local) {
        await removeDynamicCard(user.id);
        setCard(null);
      } else if (status.active && local && !status.published_at) {
        if (!local.pendingPublish) await markDynamicCardPending(user.id);
        setCard({ ...local, pendingPublish: true });
        setCardOnlineIssue('unpublished');
      } else if (status.active && local && status.published_at) {
        try {
          await resolveEmergencyCard(local.token);
        } catch (error) {
          const code = error && typeof error === 'object' && 'status' in error ? Number(error.status) : null;
          if (code === 404) setCardOnlineIssue('different-token');
        }
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

  const run = async (action: NonNullable<typeof activeAction>, operation: () => Promise<unknown>) => {
    setActiveAction(action);
    try {
      await operation();
      await refresh();
    } catch (error) {
      Alert.alert('Unable to update wallet card', getErrorMessage(error, 'The wallet card update failed. Please try again.'));
    } finally {
      setActiveAction(null);
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
        <View style={{ flex: 1 }}><ThemedText type="heading">Wallet card</ThemedText><ThemedText selectable color="mutedForeground">The printed card shows a saved snapshot offline and checks for newer details online.</ThemedText></View>
      </View>
      <ThemedText selectable color="mutedForeground">Printed facts do not change. Reprint after important profile updates; old copies may still be read offline after revocation.</ThemedText>
      <ThemedText selectable color="mutedForeground">The printed QR contains readable medical details, birth date, phone numbers, and address. Anyone with a copy can decode them.</ThemedText>
    </Card>

    {card ? <Card style={{ gap: 8 }}>
      <ThemedText type="bodyBold">Wallet card status</ThemedText>
      <ThemedText selectable color={cardOnlineIssue || card.pendingPublish ? 'warning' : 'success'}>{cardOnlineIssue === 'different-token' ? 'This device’s QR no longer matches the published card' : cardOnlineIssue === 'unpublished' ? 'Online copy not published yet' : card.pendingPublish ? 'Printed card update pending' : 'Latest emergency snapshot published'}</ThemedText>
      <ThemedText selectable color="mutedForeground">Issued {new Date(card.issuedAt).toLocaleDateString()}</ThemedText>
      {card.lastPublishedAt ? <ThemedText selectable color="mutedForeground">Last published {new Date(card.lastPublishedAt).toLocaleString()}</ThemedText> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 4 }}>
        <Pressable testID="Share printable wallet card" accessibilityRole="button" accessibilityLabel="Share wallet card" accessibilityHint={cardOnlineIssue === 'different-token' ? 'Replace the outdated wallet card before sharing' : 'Creates a wallet-size PDF with an offline snapshot'} accessibilityState={{ disabled: busy || cardOnlineIssue === 'different-token', busy: activeAction === 'share' }} disabled={busy || cardOnlineIssue === 'different-token'} onPress={() => void run('share', async () => { const printable = await buildPrintableEmergencyCardQr(user.id, card.token); await shareEmergencyWalletCard(printable.payload, displayName, new Date().toISOString()); })} style={({ pressed, hovered }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? theme.primary + '18' : 'transparent', opacity: pressed ? 0.55 : cardOnlineIssue === 'different-token' || busy && activeAction !== 'share' ? 0.45 : 1, transform: [{ scale: pressed ? 0.9 : hovered ? 1.08 : 1 }] })}>
          {activeAction === 'share' ? <ActivityIndicator color={theme.primary} /> : <Ionicons name="share-outline" size={22} color={theme.primary} />}
        </Pressable>
        <Pressable testID="Replace lost or compromised card" accessibilityRole="button" accessibilityLabel="Replace lost or compromised card" accessibilityHint="Disables online lookup for the current card; printed offline facts remain readable" accessibilityState={{ disabled: busy, busy: activeAction === 'replace' }} disabled={busy} onPress={() => Alert.alert('Replace wallet card?', 'Online lookup for the old card will stop, but its printed offline facts can still be read. Destroy old copies and print the replacement.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace', style: 'destructive', onPress: () => void run('replace', () => replaceDynamicEmergencyCard(user.id)) }])} style={({ pressed, hovered }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? theme.muted : 'transparent', opacity: pressed ? 0.55 : busy && activeAction !== 'replace' ? 0.45 : 1, transform: [{ scale: pressed ? 0.9 : hovered ? 1.08 : 1 }] })}>
          {activeAction === 'replace' ? <ActivityIndicator color={theme.mutedForeground} /> : <Ionicons name="repeat-outline" size={22} color={theme.mutedForeground} />}
        </Pressable>
        <Pressable testID="Revoke wallet card" accessibilityRole="button" accessibilityLabel="Revoke wallet card" accessibilityHint="Permanently disables online lookup; printed offline facts remain readable" accessibilityState={{ disabled: busy, busy: activeAction === 'revoke' }} disabled={busy} onPress={() => Alert.alert('Revoke wallet card?', 'Online lookup will stop. Printed offline facts cannot be remotely erased; destroy old copies.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: () => void run('revoke', () => revokeDynamicEmergencyCard(user.id)) }])} style={({ pressed, hovered }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? theme.destructive + '12' : 'transparent', opacity: pressed ? 0.55 : busy && activeAction !== 'revoke' ? 0.45 : 1, transform: [{ scale: pressed ? 0.9 : hovered ? 1.08 : 1 }] })}>
          {activeAction === 'revoke' ? <ActivityIndicator color={theme.destructive} /> : <Ionicons name="trash-outline" size={22} color={theme.destructive} />}
        </Pressable>
      </View>
    </Card> : serverHasCard ? <Card style={{ gap: 8 }}><ThemedText type="bodyBold">Card token unavailable on this device</ThemedText><ThemedText selectable color="mutedForeground">The existing card remains active, but this device cannot recreate its QR. Replace it only if you need another printed copy.</ThemedText></Card> : null}

    {cardOnlineIssue === 'unpublished' ? <ThemedText selectable color="mutedForeground">This card has no published online copy yet. Its printed facts still work offline; publish the pending update to enable online details.</ThemedText> : null}
    {cardOnlineIssue === 'different-token' ? <Card style={{ gap: 8 }}><ThemedText type="bodyBold">Online lookup unavailable for this printout</ThemedText><ThemedText selectable color="mutedForeground">The server has a published card, but this device’s QR no longer resolves. Printed facts still work offline. Replace the card to make a new QR with online lookup.</ThemedText><PrimaryButton label="Replace wallet card" disabled={busy} loading={activeAction === 'replace'} variant="ghost" onPress={() => Alert.alert('Replace wallet card?', 'Online lookup for the old card will stop, but its printed offline facts can still be read. Destroy old copies and print the replacement.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace', style: 'destructive', onPress: () => void run('replace', () => replaceDynamicEmergencyCard(user.id)) }])} /></Card> : null}

    {!card && !serverHasCard ? <PrimaryButton loading={activeAction === 'create'} disabled={busy} label="Create wallet card" onPress={() => void run('create', () => createDynamicEmergencyCard(user.id))} /> : null}
    {card?.pendingPublish ? <View style={{ gap: 8 }}><ThemedText selectable color="mutedForeground">You can print the current local snapshot now. Publish pending changes when online so scans can retrieve the latest version.</ThemedText><PrimaryButton loading={activeAction === 'publish'} disabled={busy} label="Publish pending update" variant="ghost" onPress={() => void run('publish', () => publishDynamicEmergencyCard(user.id, { throwOnError: true }))} /></View> : null}
  </ScrollView>;
}
