export const CLOUD_URL = 'https://app.rybbit.io';
export type HostingMode = 'cloud' | 'self-host';
export type ConnectionConfig = { mode: HostingMode; baseUrl: string; apiKey: string };

export function normalizeServerUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid URL, including https:// or http://.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTP or HTTPS server URL without credentials, a query, or a fragment.');
  }
  return url.toString().replace(/\/+$/, '');
}

