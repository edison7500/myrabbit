import { normalizeServerUrl } from '@/storage/connection-config';

// Public image endpoint, also used by Rybbit's web client. Older servers may return 404.
export async function getFavicon(serverUrl: string, domain: string, signal: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const timeout = setTimeout(cancel, 10000);
  try {
    const response = await fetch(`${normalizeServerUrl(serverUrl)}/api/favicon?domain=${encodeURIComponent(domain)}`, {
      credentials: 'omit', signal: controller.signal, headers: { Accept: 'image/*' },
    });
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!response.ok || !contentType?.startsWith('image/')) throw new Error('Favicon unavailable');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (controller.signal.aborted || !bytes.length || bytes.length > 1024 * 1024) throw new Error('Favicon unavailable');
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}
