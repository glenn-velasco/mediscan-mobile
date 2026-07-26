import type { WhisperEventMap } from '@/realtime/events/types';

type WhisperChannel = {
  trigger: (eventName: string, data: unknown) => boolean;
};

export function sendWhisper<K extends keyof WhisperEventMap>(
  channel: WhisperChannel,
  eventName: K,
  data: WhisperEventMap[K],
): void {
  channel.trigger(`client-${eventName as string}`, data);
}
