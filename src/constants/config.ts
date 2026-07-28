function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Check your .env file against .env.example.`);
  }
  return value;
}

const PER_PAGE = 15;

export const Config = {
  apiUrl: requireEnv('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  reverb: {
    appKey: process.env.EXPO_PUBLIC_REVERB_APP_KEY ?? '',
    host: process.env.EXPO_PUBLIC_REVERB_HOST ?? '',
    port: Number(process.env.EXPO_PUBLIC_REVERB_PORT ?? 0),
    scheme: (process.env.EXPO_PUBLIC_REVERB_SCHEME ?? '') as 'ws' | 'wss' | '',
  },
} as const;

export type ReverbConfig = { appKey: string; host: string; port: number; scheme: 'ws' | 'wss' };

export function getRequiredReverbConfig(): ReverbConfig {
  const { appKey, host, port, scheme } = Config.reverb;
  if (!appKey || !host || !port || !scheme) {
    throw new Error(
      'Realtime is not configured: set EXPO_PUBLIC_REVERB_APP_KEY, EXPO_PUBLIC_REVERB_HOST, EXPO_PUBLIC_REVERB_PORT, EXPO_PUBLIC_REVERB_SCHEME in .env.',
    );
  }
  return { appKey, host, port, scheme };
}
