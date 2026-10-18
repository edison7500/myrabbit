import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { getSites } from '@/api/rybbit/client';
import { Screen } from '@/components/screen';

import { useSession } from '@/stores/session';

export default function StartupScreen() {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { ready, serverUrl, site, selectSite } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    request.current?.abort();
    if (!ready || !serverUrl || site) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    getSites(controller.signal).then(async sites => {
      if (!controller.signal.aborted && sites.length) await selectSite(sites[0]);
    }).catch(issue => {
      if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load sites. Please try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => request.current?.abort();
  }, [ready, serverUrl, site, selectSite]);
  useFocusEffect(refresh);

  if (!ready) return <ActivityIndicator accessibilityLabel="Loading connection" />;
  if (site && serverUrl) return <Redirect href="/(tabs)/overview" />;
  if (serverUrl && loading) return <ActivityIndicator accessibilityLabel="Opening your Dashboard" style={styles.loading} />;
  return <Screen title={error ? 'Could not open Dashboard' : serverUrl ? 'No sites yet' : 'MyRabbit'}
    description={error ? 'Your connection is saved. Retry loading your sites or check the connection settings.' : serverUrl ? 'Your connection is saved. Create a site in Rybbit or check your API key permissions, then try again.' : 'Add a Rybbit connection to view your analytics.'}>
    {serverUrl ? <Text selectable style={styles.server}>{serverUrl}</Text> : null}
    {error ? <Text accessibilityRole="alert" selectable style={styles.error}>{error}</Text> : null}
    {serverUrl ? <Pressable accessibilityRole="button" onPress={() => { refresh(); }} style={styles.secondary}>
      <Text style={styles.link}>{error ? 'Try again' : 'Refresh sites'}</Text>
    </Pressable> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push('/connect')}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.65 }]}>
      <Text style={styles.label}>Add a site</Text>
    </Pressable>
    {serverUrl ? <Pressable accessibilityRole="button" onPress={() => router.push('/sites')} style={styles.secondary}>
      <Text style={styles.link}>Manage sites</Text>
    </Pressable> : null}
  </Screen>;
}

const themedStyles = createThemedStyles(colors => ({
  loading: { flex: 1, backgroundColor: colors.background },
  button: { minHeight: 52, padding: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.accent },
  label: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
  server: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 22 },
  secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  link: { color: colors.accent, fontSize: 16, fontWeight: '600' },
}));
