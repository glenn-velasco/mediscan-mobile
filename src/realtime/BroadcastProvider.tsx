import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type Pusher from 'pusher-js';

import { useAuth } from '@/auth/useAuth';
import { createReverbClient } from '@/realtime/reverb-client';
import { subscribeToUserChannel } from '@/realtime/channels/user-channel';
import { subscribeToPresenceChannel } from '@/realtime/channels/presence-channel';
import { createUserChannelHandlers } from '@/realtime/events/handlers';
import type { PresenceMember } from '@/realtime/events/types';

export function BroadcastProvider({ children }: PropsWithChildren) {
  const { status, user, refreshUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const pusherRef = useRef<Pusher | null>(null);
  const logoutRef = useRef(logout);
  const [presenceMembers, setPresenceMembers] = useState<PresenceMember[]>([]);

  useEffect(() => {
    logoutRef.current = logout;
  });

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      pusherRef.current?.disconnect();
      pusherRef.current = null;
      return;
    }

    let pusher: ReturnType<typeof createReverbClient>;
    try {
      pusher = createReverbClient();
    } catch (err) {
      console.error('[BroadcastProvider] createReverbClient FAILED', { error: String(err) });
      return;
    }

    console.log('[BroadcastProvider] Pusher client created, subscribing to channels');
    pusherRef.current = pusher;
    subscribeToUserChannel(pusher, user.id, createUserChannelHandlers({ refreshUser, logout: () => logoutRef.current(), queryClient }));

    subscribeToPresenceChannel(pusher, 'family', {
      onHere: (members) => {
        console.log('[BroadcastProvider] presence:here', { count: members.length });
        setPresenceMembers(members);
      },
      onJoining: (member) => {
        console.log('[BroadcastProvider] presence:joining', { name: member.name });
        setPresenceMembers((prev) => [...prev, member]);
      },
      onLeaving: (member) => {
        console.log('[BroadcastProvider] presence:leaving', { name: member.name });
        setPresenceMembers((prev) => prev.filter((m) => m.id !== member.id));
      },
    });

    return () => {
      console.log('[BroadcastProvider] disconnecting');
      pusher.disconnect();
      pusherRef.current = null;
      setPresenceMembers([]);
    };
    // Depend on user?.id rather than user: refreshUser() replaces user with a new object
    // on every periodic sync, and reconnecting on that no-op change caused a connect/disconnect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id, refreshUser]);

  return <>{children}</>;
}
