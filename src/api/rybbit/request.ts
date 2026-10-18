import type { ConnectionConfig } from '@/storage/connection-config';

export type ConnectionErrorCode = 'invalid-url' | 'unauthorized' | 'forbidden' | 'unreachable' | 'timeout' | 'unexpected' | 'server' | 'unknown';
const messages: Record<ConnectionErrorCode, string> = {
  'invalid-url': 'Invalid server URL. Enter an HTTP or HTTPS URL without credentials, a query, or a fragment.',
  unauthorized: 'Invalid API key or unauthorized. Check your API key.',
  forbidden: 'Your API key does not have permission to access this resource.',
  unreachable: 'Unable to reach server. Check your network and server URL.',
  timeout: 'Connection timed out. Please try again.',
  unexpected: 'Unexpected server response. Check that the URL points to Rybbit.',
  server: 'The server could not complete the request. Please try again.',
  unknown: 'Unknown connection error. Please try again.',
};
export class ConnectionError extends Error {
  constructor(public code: ConnectionErrorCode) { super(messages[code]); this.name = 'ConnectionError'; }
}

export async function request(config: ConnectionConfig, path: string, signal: AbortSignal, timeoutMs = 20000): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const timeout = setTimeout(cancel, timeoutMs);
  try {
    if (signal.aborted) throw new Error('Cancelled');
    const response = await fetch(`${config.baseUrl}/api${path}`, {
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' },
      credentials: 'omit', signal: controller.signal,
    });
    if (response.status === 401) throw new ConnectionError('unauthorized');
    if (response.status === 403) throw new ConnectionError('forbidden');
    if (!response.ok) throw new ConnectionError(response.status >= 500 || response.status === 429 ? 'server' : 'unexpected');
    try { return await response.json(); } catch { throw new ConnectionError('unexpected'); }
  } catch (error) {
    if (signal.aborted) { const cancelled = new Error('Cancelled'); cancelled.name = 'AbortError'; throw cancelled; }
    if (controller.signal.aborted) throw new ConnectionError('timeout');
    if (error instanceof ConnectionError) throw error;
    throw new ConnectionError(error instanceof TypeError ? 'unreachable' : 'unknown');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}
