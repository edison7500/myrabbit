import { normalizeServerUrl } from '@/storage/connection-config';

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(bytes: Uint8Array) {
  // React Native does not provide the browser's btoa global on every runtime.
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    result += base64Alphabet[first >> 2] + base64Alphabet[((first & 3) << 4) | (second >> 4)]
      + (index + 1 < bytes.length ? base64Alphabet[((second & 15) << 2) | (third >> 6)] : '=')
      + (index + 2 < bytes.length ? base64Alphabet[third & 63] : '=');
  }
  return result;
}

// Public image endpoint, also used by Rybbit's web client. Older servers may return 404.
export async function getFavicon(serverUrl: string, domain: string, signal: AbortSignal) {
  return fetchFavicon(`${normalizeServerUrl(serverUrl)}/api/favicon?domain=${encodeURIComponent(domain)}`, signal);
}

export async function getWebsiteFavicon(domain: string, signal: AbortSignal) {
  // The site field is a hostname. Always use its public HTTPS favicon path.
  if (!domain || /[\s/\\@:#?%]/u.test(domain)) throw new Error('Favicon unavailable');
  const url = new URL(`https://${domain}/favicon.ico`);
  return fetchFavicon(url.href, signal);
}

async function fetchFavicon(url: string, signal: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const timeout = setTimeout(cancel, 10000);
  try {
    const response = await fetch(url, {
      credentials: 'omit', signal: controller.signal, headers: { Accept: 'image/*' },
    });
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!response.ok || !contentType?.startsWith('image/')) throw new Error('Favicon unavailable');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (controller.signal.aborted || !bytes.length || bytes.length > 1024 * 1024) throw new Error('Favicon unavailable');
    return `data:${contentType};base64,${encodeBase64(bytes)}`;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}
