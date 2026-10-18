import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { ArrowRight, ChevronDown, ChevronRight, Eye, Globe, Laptop, Link2, MousePointerClick, Rabbit, RefreshCw, Smartphone, Tablet } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { getRealtimeSessions, type RealtimeSession } from '@/api/rybbit/realtime';
import { EmptyState, ErrorState, LoadingState } from '@/components/content-state';
import { layout, radii } from '@/constants/theme';
import { useSession } from '@/stores/session';
import { countryFlag, referrerLabel, sessionDuration, sessionIsActive, visitorIdentity } from './session-presentation';

type Loader = typeof getRealtimeSessions;
export default function RealtimeScreen() {
  const { serverUrl, site } = useSession();
  return <RealtimeTable key={`${serverUrl}/${site?.id}`} />;
}

export function RealtimeTable({ loadSessions = getRealtimeSessions }: { loadSessions?: Loader }) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { serverUrl, site, timeZone } = useSession();
  const navigation = useNavigation('/');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width - insets.left - insets.right >= 1000;
  const [rows, setRows] = useState<RealtimeSession[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [expanded, setExpanded] = useState<string | null>(null);
  const refresh = useRef<(pull?: boolean) => void>(() => {});
  useFocusEffect(useCallback(() => {
    if (!serverUrl || !site) return;
    let active = true;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(pull = false) {
      clearTimeout(timer);
      controller?.abort();
      const next = new AbortController();
      controller = next;
      setBusy(true);
      setPullRefreshing(pull);
      setNow(Date.now());
      try {
        const result = await loadSessions(serverUrl!, site!.id, next.signal);
        if (active && !next.signal.aborted) { setRows(result); setError(''); setUpdated(Date.now()); }
      } catch (issue) {
        if (active && !next.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load sessions.');
      } finally {
        if (active && !next.signal.aborted) {
          setBusy(false);
          setPullRefreshing(false);
          setNow(Date.now());
          timer = setTimeout(() => { void poll(); }, 30_000);
        }
      }
    }
    function resume(pull = false) {
      if (AppState.currentState === 'active' || AppState.currentState === null) void poll(pull);
    }
    refresh.current = resume;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') resume();
      else { clearTimeout(timer); controller?.abort(); setBusy(false); setPullRefreshing(false); }
    });
    resume();
    return () => { active = false; clearTimeout(timer); controller?.abort(); subscription.remove(); refresh.current = () => {}; };
  }, [loadSessions, serverUrl, site]));
  useFocusEffect(useCallback(() => {
    const renderRefresh = () => <Pressable accessibilityRole="button" accessibilityLabel="Refresh realtime visits"
      accessibilityState={{ disabled: busy, busy }} disabled={busy}
      onPress={() => refresh.current()} style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.6 }]}>
      <RefreshIcon busy={busy} />
    </Pressable>;
    navigation.setOptions({
      headerRight: renderRefresh,
      unstable_headerRightItems: () => [{ type: 'custom', element: renderRefresh(), hidesSharedBackground: true }],
    });
    return () => navigation.setOptions({ headerRight: undefined, unstable_headerRightItems: undefined });
  }, [busy, navigation, styles.refresh]));
  const time = (date: string | number) => new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
  return <SafeAreaView edges={['left', 'right']} style={styles.root}>
    <FlatList data={rows ?? []} keyExtractor={row => row.session_id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: process.env.EXPO_OS === 'android' ? 24 : 110 + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => refresh.current(true)} tintColor={colors.accent} />}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.headingRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text selectable numberOfLines={1} style={styles.site}>{site?.name || site?.domain}</Text>
            <Text style={styles.secondary}>Last 30 minutes · Latest 100 sessions</Text>
          </View>
        </View>
        <View style={styles.headingRow}>
          <Text style={styles.count}>{rows === null ? 'Recent visits' : `${rows.length}${rows.length === 100 ? '+' : ''} recent sessions`}</Text>
          <Text style={styles.secondary}>{updated ? `Updated ${time(updated)}` : 'Connecting…'}</Text>
        </View>
        {error ? <ErrorState message={rows ? `${error} Showing the last successful update.` : error} onRetry={() => refresh.current()} /> : null}
      </View>}
      ListEmptyComponent={rows === null && !error ? <LoadingState variant="realtime" message="Loading recent visits…" /> : rows !== null ? <EmptyState message="No visits in the last 30 minutes. This table refreshes every 30 seconds." /> : null}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => <SessionRow session={item} wide={wide} active={sessionIsActive(item.session_end, now)}
        timestamp={time(item.session_start)} expanded={expanded === item.session_id}
        onPress={() => setExpanded(expanded === item.session_id ? null : item.session_id)} />}
      ListFooterComponent={rows?.length ? <Text style={styles.footer}>Refreshes every 30 seconds · Green dot: activity within 5 minutes</Text> : null}
    />
  </SafeAreaView>;
}

const refreshRotation = {
  from: { transform: [{ rotate: '0deg' }] },
  to: { transform: [{ rotate: '360deg' }] },
} as const;

function RefreshIcon({ busy }: { busy: boolean }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return <Animated.View accessible={false} style={busy && !reducedMotion ? {
    animationName: refreshRotation,
    animationDuration: 1000,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  } : { opacity: busy ? 0.5 : 1 }}>
    <RefreshCw color={colors.accent} size={22} accessible={false} />
  </Animated.View>;
}

function SessionRow({ session: row, wide, active, timestamp, expanded, onPress }: {
  session: RealtimeSession; wide: boolean; active: boolean; timestamp: string; expanded: boolean; onPress: () => void;
}) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const identity = visitorIdentity(row.user_id || row.session_id, colors);
  const name = row.identified_user_id || identity.name;
  const flag = countryFlag(row.country);
  const Device = row.device_type === 'mobile' ? Smartphone : row.device_type === 'tablet' ? Tablet : row.device_type === 'desktop' ? Laptop : Globe;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const route = <View style={[styles.route, wide && { flex: 1 }]}>
    <Text numberOfLines={1} style={[styles.path, { flex: 1 }]}>{row.entry_page || '—'}</Text>
    <ArrowRight size={14} color={colors.muted} accessible={false} />
    <Text numberOfLines={1} style={[styles.path, { flex: 1 }]}>{row.exit_page || '—'}</Text>
  </View>;
  const badges = <View style={[styles.badges, wide && { width: 290 }]}>
    <Device size={18} color={colors.muted} accessible={false} />
    <View style={styles.badge} accessibilityLabel={`${row.pageviews ?? 'Unknown'} pageviews`}><Eye color={colors.accent} size={16} accessible={false} /><Text style={styles.badgeText}>{row.pageviews ?? '—'}</Text></View>
    <View style={styles.badge} accessibilityLabel={`${row.events ?? 'Unknown'} events`}><MousePointerClick color={colors.warning} size={16} accessible={false} /><Text style={styles.badgeText}>{row.events ?? '—'}</Text></View>
    <View style={[styles.badge, { flexShrink: 1 }]}><Link2 size={15} color={colors.muted} accessible={false} /><Text numberOfLines={1} style={[styles.badgeText, { flexShrink: 1 }]}>{referrerLabel(row.referrer)}</Text></View>
  </View>;
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${row.country || 'Unknown country'}, ${row.pageviews ?? 'Unknown'} pageviews, ${active ? 'recently active' : 'inactive'}, show visit details`}
      accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}>
      <View style={[styles.summary, !wide && { flexWrap: 'wrap' }]}>
        <View style={[styles.identity, { width: wide ? 220 : undefined, flex: wide ? undefined : 1 }]}>
          <View style={[styles.avatar, { backgroundColor: `${identity.color}18` }]}>
            <Rabbit size={24} color={identity.color} accessible={false} />
            {active ? <View style={styles.dot} /> : null}
          </View>
          <Text numberOfLines={1} style={styles.name}>{name}</Text>
          <View style={styles.location}>
            {flag ? <Text accessible={false} style={styles.flag}>{flag}</Text> : null}
            <Text style={styles.country}>{row.country || '—'}</Text>
          </View>
        </View>
        {!wide ? <Chevron size={18} color={colors.muted} accessible={false} /> : null}
        {wide ? badges : null}{wide ? route : null}
        {wide ? <Text style={styles.timestamp}>{timestamp} · {sessionDuration(row.session_duration)}</Text> : null}
        {wide ? <Chevron size={18} color={colors.muted} accessible={false} /> : null}
      </View>
      {!wide ? <>{badges}{route}<Text style={styles.timestamp}>{timestamp} · {sessionDuration(row.session_duration)}</Text></> : null}
    </Pressable>
    {expanded ? <View style={styles.details}>{[
      ['Visitor ID', row.user_id || 'Unknown'], ['Session', row.session_id],
      ['Location', [row.city, row.region, row.country].filter(Boolean).join(', ') || 'Unknown'],
      ['Device', [row.browser, row.operating_system, row.device_type].filter(Boolean).join(' · ') || 'Unknown'],
      ['Source', row.referrer || 'Direct'], ['Entry page', row.entry_page || '—'], ['Latest page', row.exit_page || '—'],
    ].map(([label, value]) => <View key={label} style={{ gap: 4 }}><Text style={styles.secondary}>{label}</Text><Text selectable style={styles.detailText}>{value}</Text></View>)}</View> : null}
  </View>;
}
const themedStyles = createThemedStyles(colors => ({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, width: '100%', maxWidth: 1600, alignSelf: 'center' },
  header: { gap: 20, paddingBottom: 20, paddingTop: 6 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  site: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  secondary: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  refresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { color: colors.text, fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { padding: 16, gap: 12, minHeight: 70 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  avatar: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.positive, borderWidth: 2, borderColor: colors.surface },
  name: { color: colors.text, fontSize: 14, fontWeight: '500', flexShrink: 1 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  flag: { fontSize: 18, lineHeight: 24 },
  country: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: colors.secondarySurface },
  badgeText: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  route: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  path: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  timestamp: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  details: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16, gap: 14, backgroundColor: colors.secondarySurface },
  detailText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', paddingVertical: 20 },
}));
