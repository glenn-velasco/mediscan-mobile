import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';

import type { ProfessionalApplicationStatus } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { useNetworkStatus } from '@/hooks/use-network-status';
import {
  adminProfessionalApplicationsQueryKey,
  myProfessionalApplicationQueryKey,
  professionalApplicationBroadcastStatusQueryKey,
  professionalApplicationQueryKey,
  professionalEncountersQueryKey,
} from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

type ProfessionalApplicationChange = {
  id?: string;
  user_id?: string;
  status?: ProfessionalApplicationStatus;
};

type RealtimeChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

function logRealtime(message: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[Realtime] ${message}`, details ?? '');
}

export function BroadcastProvider({ children }: PropsWithChildren) {
  const { status, user, refreshUser } = useAuth();
  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== 'authenticated' || !user || !isConnected) {
      logRealtime('subscription skipped', { authStatus: status, hasUser: Boolean(user), isConnected });
      return;
    }
    const refreshQueries = () => void queryClient.invalidateQueries();
    const handleApplicationChange = (payload: { new: ProfessionalApplicationChange }) => {
      const application = payload.new;

      if (user.permissions.includes('admin')) {
        void queryClient.invalidateQueries({ queryKey: adminProfessionalApplicationsQueryKey });
      }

      if (application.user_id !== user.id) return;

      void queryClient.invalidateQueries({ queryKey: myProfessionalApplicationQueryKey });
      if (application.id) {
        void queryClient.invalidateQueries({ queryKey: [...professionalApplicationQueryKey, application.id] });
        if (application.status) {
          queryClient.setQueryData(
            [...professionalApplicationBroadcastStatusQueryKey, application.id],
            application.status,
          );
        }
      }

      if (application.status === 'approved' || application.status === 'denied' || application.status === 'auto_rejected') {
        void refreshUser();
      }
    };
    const handleProfileChange = (payload: RealtimeChange) => {
      logRealtime('profile change received', {
        event: payload.eventType,
        recordId: payload.new.id ?? payload.old.id,
        action: 'refresh authenticated user',
      });
      void refreshUser();
    };
    const handleEncounterChange = (payload: RealtimeChange) => {
      logRealtime('professional encounter change received', {
        event: payload.eventType,
        encounterId: payload.new.id ?? payload.old.id,
        patientId: payload.new.patient_id ?? payload.old.patient_id,
        professionalId: payload.new.professional_id ?? payload.old.professional_id,
        action: 'invalidate queries and refresh active screens',
      });
      void queryClient.refetchQueries({ queryKey: professionalEncountersQueryKey, type: 'active' }).then(() => {
        logRealtime('active encounter queries refreshed');
      });
    };

    let channel = supabase
      .channel(`user:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, handleProfileChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encrypted_envelopes', filter: `recipient_id=eq.${user.id}` }, refreshQueries)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encrypted_envelopes', filter: `sender_id=eq.${user.id}` }, refreshQueries)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professional_encounters', filter: `patient_id=eq.${user.id}` }, handleEncounterChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professional_encounters', filter: `professional_id=eq.${user.id}` }, handleEncounterChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refreshQueries)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registration_matches', filter: `candidate_user_id=eq.${user.id}` }, refreshQueries)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'professional_applications', filter: `user_id=eq.${user.id}` },
        handleApplicationChange,
      );

    if (user.permissions.includes('admin')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'professional_applications' },
        handleApplicationChange,
      );
    }

    channel.subscribe((subscriptionStatus, error) => {
      logRealtime('channel status', {
        channel: `user:${user.id}`,
        status: subscriptionStatus,
        error: error?.message,
      });
    });

    return () => {
      logRealtime('removing channel', { channel: `user:${user.id}` });
      void supabase.removeChannel(channel);
    };
  }, [isConnected, queryClient, refreshUser, status, user]);

  return <>{children}</>;
}
