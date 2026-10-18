import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/screen';

import { useSession } from '@/stores/session';
import { ConnectionRow } from '@/features/sites/connection-row';
import { confirmConnectionRemoval } from '@/features/sites/confirm-connection-removal';

export default function ConnectionsScreen() {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { ready, serverUrl, disconnect } = useSession();
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function removeConnection() {
    if (busy.current || !serverUrl) return;
    busy.current = true;
    try {
      if (!await confirmConnectionRemoval(serverUrl) || !mounted.current) return;
      setRemoving(true);
      setError('');
      await disconnect();
      if (mounted.current) router.dismissTo('/');
    } catch {
      if (mounted.current) setError('Could not remove the saved connection from this device. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setRemoving(false);
    }
  }

  return <Screen navigationHeader title="Connection setup" description="Manage your Rybbit connection.">
    <View style={styles.connections}>
      {!ready ? <ActivityIndicator accessibilityLabel="Loading connection" /> : serverUrl ? <>
        <ConnectionRow serverUrl={serverUrl} disabled={removing} removing={removing}
          onEdit={() => { if (!busy.current) router.push('/connection-form'); }}
          onRemove={() => { void removeConnection(); }} />
        <Text style={styles.note}>Swipe left on the saved connection to remove its API URL and key from this device. Rybbit sites and data are kept.</Text>
      </> : <Text style={styles.note}>No saved connection yet. Add a connection to get started.</Text>}
      {error ? <Text selectable accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Add connection" disabled={!ready || removing}
      onPress={() => { if (!busy.current) router.push({ pathname: '/connection-form', params: { action: 'add' } }); }}
      style={({ pressed }) => [styles.add, { opacity: !ready || removing ? 0.4 : pressed ? 0.65 : 1 }]}>
      <Text style={styles.addLabel}>Add</Text><Plus size={20} color={colors.onAccent} accessible={false} />
    </Pressable>
  </Screen>;
}

const themedStyles = createThemedStyles(colors => ({
  connections: { flex: 1, gap: 12 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 22 },
  add: { minHeight: 54, borderRadius: 999, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addLabel: { color: colors.onAccent, fontSize: 17, fontWeight: '600' },
}));
