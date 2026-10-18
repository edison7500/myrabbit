// Browser previews keep credentials in memory only, never in browser storage.
import type { ConnectionConfig } from './connection-config';
export { CLOUD_URL, normalizeServerUrl } from './connection-config';
export type { ConnectionConfig, HostingMode } from './connection-config';

let connection: ConnectionConfig | null = null;
export async function loadConnection(): Promise<ConnectionConfig | null> {
  return connection;
}
export async function saveConnection(config: ConnectionConfig): Promise<void> {
  connection = { ...config };
}

export async function clearConnection(): Promise<void> {
  connection = null;
}
