import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { ChartSpline } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getOverview, getTraffic, type Overview, type TrafficPoint } from '@/api/rybbit/client';
import { getBreakdown, type BreakdownPage } from '@/api/rybbit/breakdown';
import { SectionHeading, Surface } from '@/components/analytics-ui';
import { Screen, type ScreenSection } from '@/components/screen';
import { LoadingState, ErrorState, EmptyState } from '@/components/content-state';

import { useSession } from '@/stores/session';
import { analyticsBucket, dateRangeLabel, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import { analyticsQueryIdentity, type AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { TrendChart, trafficSeries } from '@/features/overview/traffic-chart';
import { ReferrersHeading, ReferrersPreview } from '@/features/referrers/referrers-preview';
import { ExploreCharts, type ExploreChartsHandle } from './explore-charts';
import { ExploreNavigation } from './explore-navigation';

type OverviewLoader = (context: AnalyticsQueryContext, signal: AbortSignal) => Promise<Overview>;
type TrafficLoader = (context: AnalyticsQueryContext, signal: AbortSignal) => Promise<TrafficPoint[]>;
type ReferrersLoader = typeof getBreakdown;

function format(value: number | undefined, metric: keyof Overview) {
  if (value === undefined) return '—';
  if (metric === 'bounce_rate') return `${Math.round(value)}%`;
  if (metric === 'session_duration') return `${Math.floor(Math.round(value) / 60)}m ${Math.round(value) % 60}s`;
  if (metric === 'pages_per_session') return value.toFixed(1);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function ExploreScreen() {
  const { analyticsContext } = useSession();
  return <Explore key={analyticsContext ? analyticsQueryIdentity(analyticsContext, 'explore') : 'unavailable'} />;
}

export function Explore({ loadOverview = getOverview, loadTraffic = getTraffic, loadReferrers = getBreakdown }: {
  loadOverview?: OverviewLoader;
  loadTraffic?: TrafficLoader;
  loadReferrers?: ReferrersLoader;
}) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const router = useRouter();
  const { dateRange: range, analyticsContext, selectDateRange } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [traffic, setTraffic] = useState<TrafficPoint[] | null>(null);
  const [trafficError, setTrafficError] = useState('');
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [referrers, setReferrers] = useState<BreakdownPage | null>(null);
  const [referrersLoading, setReferrersLoading] = useState(true);
  const [referrersError, setReferrersError] = useState('');
  const refreshRequest = useRef<AbortController | null>(null);
  const trafficRetryRequest = useRef<AbortController | null>(null);
  const referrersRetryRequest = useRef<AbortController | null>(null);
  const charts = useRef<ExploreChartsHandle>(null);
  useEffect(() => {
    if (!analyticsContext) return;
    const controller = new AbortController();
    loadOverview(analyticsContext, controller.signal).then(data => { if (!controller.signal.aborted) setOverview(data); })
      .catch(issue => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load analytics.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); refreshRequest.current?.abort(); };
  }, [analyticsContext, loadOverview]);

  useEffect(() => {
    if (!analyticsContext) return;
    const controller = new AbortController();
    loadTraffic(analyticsContext, controller.signal).then(data => { if (!controller.signal.aborted) setTraffic(data); })
      .catch(issue => { if (!controller.signal.aborted) setTrafficError(issue instanceof Error ? issue.message : 'Could not load traffic.'); })
      .finally(() => { if (!controller.signal.aborted) setTrafficLoading(false); });
    return () => { controller.abort(); trafficRetryRequest.current?.abort(); };
  }, [analyticsContext, loadTraffic]);

  useEffect(() => {
    if (!analyticsContext) return;
    const controller = new AbortController();
    loadReferrers({ context: analyticsContext, dimension: 'referrer', limit: 5 }, controller.signal)
      .then(page => { if (!controller.signal.aborted) setReferrers(page); })
      .catch(issue => { if (!controller.signal.aborted) setReferrersError(issue instanceof Error ? issue.message : 'Could not load referrers.'); })
      .finally(() => { if (!controller.signal.aborted) setReferrersLoading(false); });
    return () => { controller.abort(); referrersRetryRequest.current?.abort(); };
  }, [analyticsContext, loadReferrers]);

  async function refresh() {
    if (loading || trafficLoading || referrersLoading || refreshRequest.current || !analyticsContext) return;
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setError('');
    setTrafficError('');
    setReferrersError('');
    const [overviewResult, trafficResult, referrersResult] = await Promise.allSettled([
      loadOverview(analyticsContext, controller.signal),
      loadTraffic(analyticsContext, controller.signal),
      loadReferrers({ context: analyticsContext, dimension: 'referrer', limit: 5 }, controller.signal),
      charts.current?.refresh(),
    ]);
    if (!controller.signal.aborted) {
      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value);
      }
      else setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : 'Could not refresh analytics.');
      if (trafficResult.status === 'fulfilled') setTraffic(trafficResult.value);
      else setTrafficError(trafficResult.reason instanceof Error ? trafficResult.reason.message : 'Could not refresh traffic.');
      if (referrersResult.status === 'fulfilled') setReferrers(referrersResult.value);
      else setReferrersError(referrersResult.reason instanceof Error ? referrersResult.reason.message : 'Could not refresh referrers.');
      refreshRequest.current = null;
      setRefreshing(false);
    }
  }

  async function retryTraffic() {
    if (refreshRequest.current || trafficLoading || trafficRetryRequest.current || !analyticsContext) return;
    const controller = new AbortController();
    trafficRetryRequest.current = controller;
    setTrafficLoading(true);
    setTrafficError('');
    try {
      const data = await loadTraffic(analyticsContext, controller.signal);
      if (!controller.signal.aborted) setTraffic(data);
    } catch (issue) {
      if (!controller.signal.aborted) setTrafficError(issue instanceof Error ? issue.message : 'Could not load traffic.');
    } finally {
      if (!controller.signal.aborted) {
        trafficRetryRequest.current = null;
        setTrafficLoading(false);
      }
    }
  }

  async function retryReferrers() {
    if (refreshRequest.current || referrersLoading || referrersRetryRequest.current || !analyticsContext) return;
    const controller = new AbortController();
    referrersRetryRequest.current = controller;
    setReferrersLoading(true);
    setReferrersError('');
    try {
      const page = await loadReferrers({ context: analyticsContext, dimension: 'referrer', limit: 5 }, controller.signal);
      if (!controller.signal.aborted) setReferrers(page);
    } catch (issue) {
      if (!controller.signal.aborted) setReferrersError(issue instanceof Error ? issue.message : 'Could not load referrers.');
    } finally {
      if (!controller.signal.aborted) {
        referrersRetryRequest.current = null;
        setReferrersLoading(false);
      }
    }
  }

  const changeRange = useCallback((nextRange: AnalyticsDateRange) => {
    refreshRequest.current?.abort();
    refreshRequest.current = null;
    trafficRetryRequest.current?.abort();
    trafficRetryRequest.current = null;
    referrersRetryRequest.current?.abort();
    referrersRetryRequest.current = null;
    setOverview(null);
    setTraffic(null);
    setReferrers(null);
    setError('');
    setTrafficError('');
    setReferrersError('');
    setLoading(true);
    setTrafficLoading(true);
    setReferrersLoading(true);
    setRefreshing(false);
    selectDateRange(nextRange);
  }, [selectDateRange]);

  const rangeName = dateRangeLabel(range);
  const trafficHeader = <SectionHeading title="Traffic" icon={ChartSpline} accessibilityLabel="Open Traffic details" onPress={() => router.push('/traffic')} />;
  const trafficContent = <View style={styles.trafficSection}>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.accent }]} /><View><Text style={styles.legendLabel}>Visitors</Text><Text selectable style={styles.legendValue}>{format(overview?.users, 'users')}</Text></View></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.chartSecondary }]} /><View><Text style={styles.legendLabel}>Pageviews</Text><Text selectable style={styles.legendValue}>{format(overview?.pageviews, 'pageviews')}</Text></View></View>
      </View>
      <Surface style={styles.chartCard}>
        {trafficLoading && !traffic ? <LoadingState variant="chart" message="Loading traffic…" /> : null}
        {!trafficLoading && trafficError ? <View style={styles.chartState}><Text accessibilityRole="alert" style={styles.chartStateTitle}>Unable to load traffic</Text><Text selectable style={styles.chartStateText}>{trafficError}</Text><Pressable accessibilityRole="button" onPress={retryTraffic} style={styles.retry}><Text style={styles.retryText}>Try chart again</Text></Pressable></View> : null}
        {!trafficLoading && !trafficError && traffic?.length === 0 ? <View style={styles.chartState}><Text style={styles.chartStateTitle}>No traffic yet</Text><Text style={styles.chartStateText}>No trend data was recorded for this range.</Text></View> : null}
        {!trafficError && traffic?.length ? <Pressable accessibilityRole="button" accessibilityLabel="Open full Traffic chart"
          onPress={() => router.push('/traffic')} style={({ pressed }) => pressed && styles.cardPressed}>
          <TrendChart points={traffic} bucket={analyticsBucket(range)} series={trafficSeries}
            accessibilityLabel={`Traffic trend with ${traffic.length} time buckets`} />
        </Pressable> : null}
      </Surface>
    </View>;
  const renderScreen = (chartSections: ScreenSection[]) => <Screen tabScreen navigationHeader title="Explore" description={null}
    refreshing={refreshing} onRefresh={refresh} sections={[
    { key: 'traffic', header: trafficHeader, content: trafficContent },
    { key: 'referrers', header: <ReferrersHeading onOpen={() => router.push('/referrers')} />,
      content: <ReferrersPreview page={referrers} loading={referrersLoading} error={referrersError}
        onRetry={retryReferrers} onOpen={() => router.push('/referrers')} showHeader={false} /> },
    ...chartSections,
  ]}>
    {loading ? <LoadingState variant="summary" message={`Loading ${rangeName.toLowerCase()} analytics…`} /> : null}
    {error ? <ErrorState message={error} onRetry={refreshing ? undefined : refresh} /> : null}
    {!loading && !error && !overview ? <EmptyState message={`No analytics were recorded for ${rangeName.toLowerCase()}.`} /> : null}
  </Screen>;
  return <><ExploreNavigation disabled={loading || refreshing} onRangeChange={changeRange} />{analyticsContext ? <ExploreCharts key={analyticsQueryIdentity(analyticsContext, 'charts')} context={analyticsContext} ref={charts}>
    {renderScreen}
  </ExploreCharts> : renderScreen([])}</>;
}

const themedStyles = createThemedStyles(colors => ({
  cardPressed: { opacity: 0.68 },
  trafficSection: { gap: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 9, height: 9, borderRadius: 999 },
  legendLabel: { color: colors.muted, fontSize: 12 },
  legendValue: { color: colors.text, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chartCard: { minHeight: 190, justifyContent: 'center' },
  chartState: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  chartStateTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  chartStateText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
}));
