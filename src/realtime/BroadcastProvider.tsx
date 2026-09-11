import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';

import { useAuth } from '@/auth/useAuth';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { supabase } from '@/lib/supabase';

export function BroadcastProvider({ children }: PropsWithChildren) {
  const { status, user, refreshUser } = useAuth();
  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== 'authenticated' || !user || !isConnected) return;
    const refreshQueries = () => void queryClient.invalidateQueries();
    const channel = supabase
      .channel(`user:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => void refreshUser())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encrypted_envelopes', filter: `recipient_id=eq.${user.id}` }, refreshQueries)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refreshQueries)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professional_applications', filter: `user_id=eq.${user.id}` }, refreshQueries)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registration_matches', filter: `candidate_user_id=eq.${user.id}` }, refreshQueries)
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [isConnected, queryClient, refreshUser, status, user]);

  return <>{children}</>;
}
