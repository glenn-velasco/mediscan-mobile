import { invokeFunction } from '@/api/supabase';
import type { EmergencyFieldChange } from '@/db/repositories/emergency-field-history.repo';

export async function pushEmergencyFieldHistory(events: EmergencyFieldChange[]): Promise<{ recorded: { id: string; server_recorded_at: string }[] }> {
  return invokeFunction('emergency-history-push', {
    events: events.map(({ id, field, value, changedAt }) => ({ id, field, value, changedAt })),
  });
}

export async function pullEmergencyFieldHistory(): Promise<EmergencyFieldChange[]> {
  const response = await invokeFunction<{ events: EmergencyFieldChange[] }>('emergency-history-pull');
  return response.events;
}
