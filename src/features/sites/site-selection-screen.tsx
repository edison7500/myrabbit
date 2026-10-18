import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Settings2 } from 'lucide-react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSites, type Site } from '@/api/rybbit/client';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { layout, spacing, typography } from '@/constants/theme';
import { useSession } from '@/stores/session';
import { SiteRow } from './site-row';

export default function SiteSelectionScreen() {
  const { ready, serverUrl } = useSession();
  if (!ready) return <ActivityIndicator accessibilityLabel="Loading connection" />;
  if (!serverUrl) return <Redirect href="/" />;
  return <ConnectedSiteSelection key={serverUrl} serverUrl={serverUrl} />;
}

function ConnectedSiteSelection({ serverUrl }: { serverUrl: string }) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { site, selectSite } = useSession();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const busy = useRef(false);
  const siteRequest = useRef<AbortController | null>(null);
  const refreshSites = useCallback(() => {
    siteRequest.current?.abort();
    const controller = new AbortController();
    siteRequest.current = controller;
    setLoading(true);
    setError('');
    getSites(controller.signal).then(result => {
      if (!controller.signal.aborted) setSites(result);
    }).catch(issue => {
      if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load sites.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => siteRequest.current?.abort();
  }, []);
  useFocusEffect(refreshSites);
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList data={loading || error ? [] : sites} keyExtractor={item => item.id} contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Select a site</Text>
          <Text style={styles.body}>Choose the site you want to explore.</Text>
        </View>}
        renderItem={({ item }) => <SiteRow site={item} current={site?.id === item.id}
          disabled={selectingId !== null} selecting={selectingId === item.id}
          onSelect={async () => {
            if (busy.current) return;
            busy.current = true;
            setSelectingId(item.id);
            setError('');
            try {
              await selectSite(item);
              router.dismissTo('/(tabs)/overview');
            } catch {
              setError('Could not remember this site. Please try again.');
              setSelectingId(null);
              busy.current = false;
            }
          }} />}
        ListEmptyComponent={<View style={styles.empty}>
          {loading ? <LoadingSkeleton variant="sites" label="Loading your sites…" /> :
            <><Text selectable accessibilityRole={error ? 'alert' : undefined} style={styles.body}>{error || 'No sites are available. Create a site in Rybbit or check your API key permissions, then refresh.'}</Text>
              <Pressable accessibilityRole="button" onPress={() => { refreshSites(); }} style={styles.action}><Text style={styles.link}>{error ? 'Try again' : 'Refresh sites'}</Text></Pressable></>}
        </View>}
        ListFooterComponent={<Pressable accessibilityRole="button" disabled={selectingId !== null} onPress={() => router.navigate('/connect')} style={styles.edit}><Settings2 size={18} color={colors.accent} accessible={false} /><Text style={styles.link}>Connection setup</Text></Pressable>} />
    </SafeAreaView>
  );
}

const themedStyles = createThemedStyles(colors => ({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', padding: layout.screenPadding, gap: spacing.md },
  header: { gap: 12, paddingTop: 12, paddingBottom: 12 },
  title: { ...typography.title, color: colors.text },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 },
  empty: { paddingVertical: 24, gap: 16 },
  action: { paddingVertical: 16 },
  link: { color: colors.accent, fontSize: 16, fontWeight: '600' },
}));
