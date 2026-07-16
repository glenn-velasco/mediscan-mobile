import type PusherType from 'pusher-js';
import type { ChannelAuthorizationData } from 'pusher-js/types/src/core/auth/options';

import { Config, getRequiredReverbConfig } from '@/constants/config';
import { getCachedToken } from '@/auth/token-storage';

// pusher-js v8.x react-native entry exports as module.exports.Pusher, not default.
const Pusher = require('pusher-js').Pusher as typeof PusherType;

const TAG = '[ReverbClient]';

export function createReverbClient() {
  const reverb = getRequiredReverbConfig();
  console.log(TAG, 'Creating Pusher/Reverb client', { host: reverb.host, port: reverb.port, scheme: reverb.scheme, key: reverb.appKey });

  const pusher = new Pusher(reverb.appKey, {
    wsHost: reverb.host,
    wsPort: Number(reverb.port),
    wssPort: Number(reverb.port),
    forceTLS: reverb.scheme === 'wss',
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    cluster: '',
    channelAuthorization: {
      customHandler: async (
        params: { socketId: string; channelName: string },
        callback: (error: Error | null, data: ChannelAuthorizationData | null) => void,
      ) => {
        try {
          const token = getCachedToken();
          const url = `${Config.apiUrl}/api/v1/broadcasting/auth`;
          console.log(TAG, 'Channel auth request', { url, channelName: params.channelName, hasToken: !!token });
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ socket_id: params.socketId, channel_name: params.channelName }),
          });
          console.log(TAG, 'Channel auth response', { status: response.status, ok: response.ok });
          if (!response.ok) {
            const body = await response.text().catch(() => '<unreadable>');
            console.error(TAG, 'Channel auth FAILED', { status: response.status, body });
            throw new Error(`Broadcasting auth failed with status ${response.status}`);
          }
          const data = (await response.json()) as ChannelAuthorizationData;
          console.log(TAG, 'Channel auth SUCCESS', { hasAuth: !!data.auth, hasChannelData: !!(data as any).channel_data });
          callback(null, data);
        } catch (error) {
          console.error(TAG, 'Channel auth ERROR', { error: String(error) });
          callback(error instanceof Error ? error : new Error(String(error)), null);
        }
      },
    },
  });

  console.log(TAG, 'Pusher client created successfully');
  return pusher;
}
