import { request } from './request';
import { normalizeSessionTimestamp } from './session-timestamp';
import { loadConnection } from '@/storage/connection';

export type RealtimeSession = {
  session_id: string; user_id: string; identified_user_id: string;
  country: string; city: string; region: string; browser: string; operating_system: string;
  device_type: string; referrer: string; entry_page: string; exit_page: string;
  pageviews: number | null; events: number | null; session_duration: number | null;
  session_start: string; session_end: string;
};
const textFields = ['user_id', 'identified_user_id', 'country', 'city', 'region', 'browser',
  'operating_system', 'device_type', 'referrer', 'entry_page', 'exit_page'] as const;
const numberFields = ['pageviews', 'events', 'session_duration'] as const;
const invalid = () => new Error('Unexpected session data. Check your Rybbit server version.');

export function parseRealtimeSessions(value: unknown): RealtimeSession[] {
  if (!value || typeof value !== 'object' || !('data' in value) || !Array.isArray(value.data)) throw invalid();
  const ids = new Set<string>();
  return value.data.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid();
    const row = item as Record<string, unknown>;
    if (typeof row.session_id !== 'string' || !row.session_id || ids.has(row.session_id)) throw invalid();
    ids.add(row.session_id);
    const result = { session_id: row.session_id } as RealtimeSession;
    for (const key of textFields) {
      if (row[key] != null && typeof row[key] !== 'string') throw invalid();
      result[key] = typeof row[key] === 'string' ? row[key] : '';
    }
    for (const key of numberFields) {
      const number = row[key];
      if (number != null && (typeof number !== 'number' || !Number.isFinite(number) || number < 0)) throw invalid();
      result[key] = typeof number === 'number' ? number : null;
    }
    for (const key of ['session_start', 'session_end'] as const) {
      result[key] = normalizeSessionTimestamp(row[key]);
    }
    return result;
  }).sort((a, b) => Date.parse(b.session_end) - Date.parse(a.session_end));
}

export async function getRealtimeSessions(serverUrl: string, siteId: string, signal: AbortSignal) {
  const config = await loadConnection();
  if (!config || config.baseUrl !== serverUrl) throw new Error('The connection changed. Try again.');
  const query = new URLSearchParams({ past_minutes_start: '30', past_minutes_end: '0', page: '1', limit: '100' });
  return parseRealtimeSessions(await request(config, `/sites/${encodeURIComponent(siteId)}/sessions?${query}`, signal));
}
