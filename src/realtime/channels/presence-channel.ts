import type Pusher from 'pusher-js';
import type { PresenceChannelHandlers, PresenceMember } from '@/realtime/events/types';

export function subscribeToPresenceChannel(
  pusher: Pusher,
  channelName: string,
  handlers: PresenceChannelHandlers,
) {
  const presence = pusher.subscribe(`presence-${channelName}`) as any;

  presence.bind('pusher:subscription_succeeded', (members: any) => {
    const memberList: PresenceMember[] = [];
    members.each((member: { id: string; info: any }) => {
      memberList.push({ id: Number(member.id), ...member.info });
    });
    void handlers.onHere(memberList);
  });

  presence.bind('pusher:member_added', (member: { id: string; info: any }) => {
    void handlers.onJoining({ id: Number(member.id), ...member.info });
  });

  presence.bind('pusher:member_removed', (member: { id: string; info: any }) => {
    void handlers.onLeaving({ id: Number(member.id), ...member.info });
  });

  return presence;
}
