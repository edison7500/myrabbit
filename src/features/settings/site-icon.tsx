import { useTheme } from '@/stores/theme';
import { Image } from 'expo-image';
import { Globe } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { getFavicon } from '@/api/rybbit/favicon';

export function SiteIcon({ serverUrl, domain }: { serverUrl: string | null; domain?: string }) {
  // A new server or domain remounts the loader so an old site's icon never flashes.
  return <Favicon key={`${serverUrl}\n${domain}`} serverUrl={serverUrl} domain={domain} />;
}

function Favicon({ serverUrl, domain }: { serverUrl: string | null; domain?: string }) {
  const { colors } = useTheme();
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    if (!serverUrl || !domain?.trim()) return;
    const controller = new AbortController();
    getFavicon(serverUrl, domain, controller.signal).then(uri => {
      if (!controller.signal.aborted) setSource(uri);
    }).catch(() => {});
    return () => controller.abort();
  }, [serverUrl, domain]);

  return source ? <Image source={{ uri: source }} style={{ width: 32, height: 32, borderRadius: 6 }}
    contentFit="contain" accessible={false} onError={() => setSource(null)} />
    : <Globe size={26} color={colors.accent} accessible={false} />;
}
