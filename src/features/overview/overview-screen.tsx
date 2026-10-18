import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { getOverview, getPreviousOverview, type Overview } from '@/api/rybbit/client';
import { MetricCard } from '@/components/analytics-ui';
import { Screen } from '@/components/screen';
import { AnalyticsControls } from '@/components/analytics-controls';
import { LoadingState, ErrorState, EmptyState } from '@/components/content-state';
import { spacing } from '@/constants/theme';
import { useSession } from '@/stores/session';
import { dateRangeLabel, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import { analyticsQueryIdentity, type AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { hasOverviewData, metricChange, siteHeading } from './overview-state';

type OverviewLoader = (context: AnalyticsQueryContext, signal: AbortSignal) => Promise<Overview>;
type PreviousOverviewLoader = (context: AnalyticsQueryContext, signal: AbortSignal) => Promise<Overview | null>;

const metrics = [
  ['users', 'Unique Users'], ['sessions', 'Sessions'], ['pageviews', 'Pageviews'],
  ['pages_per_session', 'Pages per Session'], ['bounce_rate', 'Bounce Rate'], ['session_duration', 'Session Duration'],
] as const;

function format(value: number | undefined, metric: keyof Overview) {
  if (value === undefined) return '—';
  if (metric === 'bounce_rate') return `${Math.round(value)}%`;
  if (metric === 'session_duration') return `${Math.floor(Math.round(value) / 60)}m ${Math.round(value) % 60}s`;
  if (metric === 'pages_per_session') return value.toFixed(1);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function OverviewScreen() {
  const { analyticsContext } = useSession();
  return <Dashboard key={analyticsContext ? analyticsQueryIdentity(analyticsContext, 'overview') : 'unavailable'} />;
}

export function Dashboard({ loadOverview = getOverview, loadPreviousOverview = getPreviousOverview }: {
  loadOverview?: OverviewLoader;
  loadPreviousOverview?: PreviousOverviewLoader;
}) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { site, dateRange: range, timeZone, analyticsContext, selectDateRange } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [previousOverview, setPreviousOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRequest = useRef<AbortController | null>(null);
  const comparisonRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!analyticsContext) return;
    const controller = new AbortController();
    loadOverview(analyticsContext, controller.signal).then(data => { if (!controller.signal.aborted) setOverview(data); })
      .catch(issue => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load analytics.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); refreshRequest.current?.abort(); };
  }, [analyticsContext, loadOverview]);

  useEffect(() => {
    if (!analyticsContext || range.preset === 'all-time') return;
    const controller = new AbortController();
    comparisonRequest.current = controller;
    loadPreviousOverview(analyticsContext, controller.signal)
      .then(data => { if (!controller.signal.aborted) setPreviousOverview(data); })
      .catch(() => { if (!controller.signal.aborted) setPreviousOverview(null); });
    return () => { controller.abort(); comparisonRequest.current = null; };
  }, [analyticsContext, loadPreviousOverview, range.preset]);

  async function refresh() {
    if (loading || refreshRequest.current || !analyticsContext) return;
    comparisonRequest.current?.abort();
    comparisonRequest.current = null;
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setError('');
    const [overviewResult, comparisonResult] = await Promise.allSettled([
      loadOverview(analyticsContext, controller.signal),
      range.preset === 'all-time' ? Promise.resolve(null) : loadPreviousOverview(analyticsContext, controller.signal),
    ]);
    if (!controller.signal.aborted) {
      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value);
        setPreviousOverview(comparisonResult.status === 'fulfilled' ? comparisonResult.value : null);
      }
      else setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : 'Could not refresh analytics.');
      refreshRequest.current = null;
      setRefreshing(false);
    }
  }

  function changeRange(nextRange: AnalyticsDateRange) {
    refreshRequest.current?.abort();
    refreshRequest.current = null;
    comparisonRequest.current?.abort();
    comparisonRequest.current = null;
    setOverview(null);
    setPreviousOverview(null);
    setError('');
    setLoading(true);
    setRefreshing(false);
    selectDateRange(nextRange);
  }

  const rangeName = dateRangeLabel(range);
  return <Screen tabScreen navigationHeader title="Dashboard" description={
    <AnalyticsControls siteLabel={siteHeading(site)} range={range} timeZone={timeZone} disabled={loading || refreshing} onRangeChange={changeRange} />
  } refreshing={refreshing} onRefresh={refresh}>
    {loading ? <LoadingState variant="cards" message={`Loading ${rangeName.toLowerCase()} analytics…`} /> : null}
    {error ? <ErrorState message={error} onRetry={refreshing ? undefined : refresh} /> : null}
    {!loading && !error && !hasOverviewData(overview) ? <EmptyState message={`No analytics were recorded for ${rangeName.toLowerCase()}.`} /> : null}
    {hasOverviewData(overview) && overview ? <View style={[styles.grid, fontScale > 1.3 && styles.singleColumn]}>{metrics.map(([key, label]) => {
      const change = metricChange(overview[key], previousOverview?.[key], key);
      const changeColor = change?.tone === 'positive' ? colors.positive : change?.tone === 'negative' ? colors.danger : colors.muted;
      const trend = change ? <View style={styles.change} accessibilityLabel={`${change.direction === 'up' ? 'Up' : change.direction === 'down' ? 'Down' : 'No change'} ${change.percent.toFixed(1)} percent from previous period`}>
        {change.direction === 'up' ? <ArrowUp size={14} strokeWidth={2.4} color={changeColor} accessible={false} /> : null}
        {change.direction === 'down' ? <ArrowDown size={14} strokeWidth={2.4} color={changeColor} accessible={false} /> : null}
        <Text style={[styles.changeText, { color: changeColor }]}>{change.percent.toFixed(1)}%</Text>
        <Text style={styles.comparisonLabel}>vs prior</Text>
      </View> : null;
      return <MetricCard key={key} label={label} value={format(overview[key], key)} trend={trend}
        singleColumn={fontScale > 1.3}
        accessibilityLabel={key === 'users' ? 'Open Visitors details' : undefined}
        onPress={key === 'users' ? () => router.push('/metrics/visitors') : undefined} />;
    })}</View> : null}
  </Screen>;
}

const themedStyles = createThemedStyles(colors => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  singleColumn: { flexDirection: 'column' },
  change: { minHeight: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 },
  changeText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  comparisonLabel: { color: colors.muted, fontSize: 12, marginLeft: spacing.xs },
}));
