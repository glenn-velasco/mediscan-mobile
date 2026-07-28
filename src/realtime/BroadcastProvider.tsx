import { useQueryClient } from '@tanstack/react-query';
import type Pusher from 'pusher-js';
import { useEffect, useRef, type PropsWithChildren } from 'react';

import { useAuth } from '@/auth/useAuth';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { subscribeToPresenceChannel } from '@/realtime/channels/presence-channel';
import { subscribeToUserChannel } from '@/realtime/channels/user-channel';
import { createUserChannelHandlers } from '@/realtime/events/handlers';
import { createReverbClient } from '@/realtime/reverb-client';

export function BroadcastProvider({ children }: PropsWithChildren) {
  const { status, user, refreshUser, logout } = useAuth();
  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();
  const pusherRef = useRef<Pusher | null>(null);
  const logoutRef = useRef(logout);
  const refreshUserRef = useRef(refreshUser);

  useEffect(() => {
    logoutRef.current = logout;
    refreshUserRef.current = refreshUser;
  }, [logout, refreshUser]);

  useEffect(() => {
    if (status !== 'authenticated' || !user || !isConnected) {
      if (pusherRef.current) {
        console.log('[BroadcastProvider] disconnecting — offline or unauthenticated');
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
      return;
    }

    if (pusherRef.current) {
      console.log('[BroadcastProvider] disconnecting stale Pusher client before re-init');
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }

    let pusher: ReturnType<typeof createReverbClient>;
    try {
      pusher = createReverbClient();
    } catch (err) {
      console.error('[BroadcastProvider] createReverbClient FAILED', { error: String(err) });
      return;
    }

    pusher.connection.bind('state_change', ({ current }: { current: string }) => {
      console.log('[BroadcastProvider] connection state:', current);
    });

    console.log('[BroadcastProvider] Pusher client created, subscribing to channels');
    pusherRef.current = pusher;

    try {
      subscribeToUserChannel(pusher, user.id, createUserChannelHandlers({
        refreshUser: () => refreshUserRef.current(),
        logout: () => logoutRef.current(),
        queryClient,
      }));

      subscribeToPresenceChannel(pusher, 'family', {
        onHere: (members) => {
          console.log('[BroadcastProvider] presence:here', { count: members.length });
        },
        onJoining: (member) => {
          console.log('[BroadcastProvider] presence:joining', { name: member.name });
        },
        onLeaving: (member) => {
          console.log('[BroadcastProvider] presence:leaving', { name: member.name });
        },
      });
    } catch (err) {
      console.error('[BroadcastProvider] channel subscription FAILED', { error: String(err) });
      pusher.disconnect();
      pusherRef.current = null;
    }

    return () => {
      console.log('[BroadcastProvider] disconnecting');
      pusher.disconnect();
      pusherRef.current = null;
    };
  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  }, [status, user?.id, isConnected, queryClient]);

  return <>{children}</>;
}
