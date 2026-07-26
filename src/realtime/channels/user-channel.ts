import type Pusher from 'pusher-js';
import type { UserChannelEventHandlers, UserChannelEventMap } from '@/realtime/events/types';

export function subscribeToUserChannel(pusher: Pusher, userId: number, handlers: UserChannelEventHandlers) {
  const channelName = `private-App.Models.User.${userId}`;
  console.log('[UserChannel] subscribing to', { channelName, eventCount: Object.keys(handlers).length });
  const channel = pusher.subscribe(channelName);

  channel.bind('pusher:subscription_succeeded', () => {
    console.log('[UserChannel] subscription succeeded', { channelName });
  });

  channel.bind('pusher:subscription_error', (status: any) => {
    console.error('[UserChannel] subscription FAILED', { channelName, status });
  });

  for (const eventName of Object.keys(handlers) as (keyof UserChannelEventMap)[]) {
    const handler = handlers[eventName];
    if (!handler) continue;
    console.log('[UserChannel] listening for', eventName);
    channel.bind(eventName as string, (payload: any) => {
      console.log('[UserChannel] RECEIVED', eventName, payload);
      void handler(payload);
    });
  }

  return channel;
}
