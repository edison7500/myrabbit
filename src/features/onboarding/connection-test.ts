import { ConnectionError, request } from '@/api/rybbit/request';
import { normalizeServerUrl, type ConnectionConfig } from '@/storage/connection-config';

export async function testConnection(input: ConnectionConfig, signal: AbortSignal) {
  let baseUrl: string;
  try { baseUrl = normalizeServerUrl(input.baseUrl); } catch { throw new ConnectionError('invalid-url'); }
  const config = { ...input, baseUrl, apiKey: input.apiKey.trim() };
  if (!config.apiKey) throw new ConnectionError('unauthorized');
  const data = await request(config, '/organizations', signal, 10000);
  if (!Array.isArray(data) || !data.every(org => org && typeof org === 'object' && typeof org.id === 'string' && org.id.length > 0)) {
    throw new ConnectionError('unexpected');
  }
  return { config, organizationCount: data.length };
}

/** Only a successful test of the current draft authorizes persistence. Never persists credentials itself. */
export class ConnectionTestGate {
  private revision = 0;
  private controller: AbortController | null = null;
  private validated: ConnectionConfig | null = null;
  invalidate() {
    this.revision++;
    this.controller?.abort();
    this.controller = null;
    this.validated = null;
  }
  async test(input: ConnectionConfig) {
    this.invalidate();
    const revision = this.revision;
    const controller = new AbortController();
    this.controller = controller;
    const result = await testConnection(input, controller.signal);
    if (revision !== this.revision) return null;
    this.validated = result.config;
    return result;
  }
  async save(input: ConnectionConfig, persist: (config: ConnectionConfig) => Promise<void>) {
    const valid = this.validated;
    if (!valid || valid.mode !== input.mode || valid.baseUrl !== normalizeServerUrl(input.baseUrl) || valid.apiKey !== input.apiKey.trim()) {
      throw new Error('Test this connection successfully before saving.');
    }
    await persist({ ...valid });
    return valid;
  }
}
