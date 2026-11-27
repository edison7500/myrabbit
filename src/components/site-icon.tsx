import { getFavicon, getWebsiteFavicon } from '@/api/rybbit/favicon';
import { useTheme } from '@/stores/theme';
import { Image } from 'expo-image';
import { Globe } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

type Props = {
  serverUrl: string | null;
  domain?: string;
  size: number;
  fallbackSize?: number;
};

export function SiteIcon({ serverUrl, domain, ...sizes }: Props) {
  const hostname = domain?.trim();
  // A new server or domain remounts the loader so an old site's icon never flashes.
  return <Favicon key={`${serverUrl}\n${hostname}`} serverUrl={serverUrl} domain={hostname} {...sizes} />;
}

function Favicon({ serverUrl, domain, size, fallbackSize = size }: Props) {
  const { colors } = useTheme();
  const [useWebsite, setUseWebsite] = useState(!serverUrl);
  const [source, setSource] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!domain) return;
    const controller = new AbortController();
    const request = !useWebsite && serverUrl
      ? getFavicon(serverUrl, domain, controller.signal)
      : getWebsiteFavicon(domain, controller.signal);
    request.then(uri => {
      if (!controller.signal.aborted) setSource(uri);
    }).catch(() => {
      if (!controller.signal.aborted) setUseWebsite(true);
    });
    return () => controller.abort();
  }, [serverUrl, domain, useWebsite]);

  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
    {!loaded && <Globe size={fallbackSize} color={colors.accent} accessible={false} />}
    {source && <Image source={{ uri: source }}
      style={{ position: 'absolute', width: size, height: size, borderRadius: 6, opacity: loaded ? 1 : 0 }}
      contentFit="contain" accessible={false} onLoad={() => setLoaded(true)} onError={() => {
        setLoaded(false);
        setSource(null);
        setUseWebsite(true);
      }} />}
  </View>;
}
