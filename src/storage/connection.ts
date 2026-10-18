import * as SecureStore from 'expo-secure-store';
import { CLOUD_URL, normalizeServerUrl, type ConnectionConfig } from './connection-config';
export { CLOUD_URL, normalizeServerUrl, type ConnectionConfig, type HostingMode } from './connection-config';
const STORAGE_KEY = 'myrabbit.connection.v1';

export async function loadConnection(): Promise<ConnectionConfig | null> {
  const value = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!value) return null;
  const config = JSON.parse(value) as ConnectionConfig;
  if (!['cloud', 'self-host'].includes(config.mode) || typeof config.baseUrl !== 'string' || typeof config.apiKey !== 'string') {
    throw new Error('Invalid saved connection.');
  }
  return { ...config, baseUrl: config.mode === 'cloud' ? CLOUD_URL : normalizeServerUrl(config.baseUrl) };
}

export async function saveConnection(config: ConnectionConfig): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(config));
}

export async function clearConnection(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
