import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { getTraffic, type TrafficPoint } from '@/api/rybbit/client';
import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { analyticsBucket, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import { AnalyticsControls } from '@/components/analytics-controls';
import { EmptyState, ErrorState, LoadingState } from '@/components/content-state';
import { Screen } from '@/components/screen';
import { radii } from '@/constants/theme';
import { useSession } from '@/stores/session';
import { siteHeading } from './overview-state';
import { TrendChart, trafficSeries } from './traffic-chart';

type TrafficLoader = (context: AnalyticsQueryContext, signal: AbortSignal) => Promise<TrafficPoint[]>;

export default function TrafficDetailScreen({ loadTraffic = getTraffic }: { loadTraffic?: TrafficLoader }) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { site, dateRange, timeZone, analyticsContext, selectDateRange } = useSession();
  const [points, setPoints] = useState<TrafficPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const refreshRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!analyticsContext) return;
    const controller = new AbortController();
    loadTraffic(analyticsContext, controller.signal)
      .then(result => { if (!controller.signal.aborted) setPoints(result); })
      .catch(issue => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load traffic.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); refreshRequest.current?.abort(); };
  }, [analyticsContext, loadTraffic]);

  async function refresh() {
    if (!analyticsContext || loading || refreshRequest.current) return;
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setError('');
    try {
      const result = await loadTraffic(analyticsContext, controller.signal);
      if (!controller.signal.aborted) setPoints(result);
    } catch (issue) {
      if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not refresh traffic.');
    } finally {
      if (!controller.signal.aborted) {
        refreshRequest.current = null;
        setRefreshing(false);
      }
    }
  }

  function changeRange(range: AnalyticsDateRange) {
    refreshRequest.current?.abort();
    refreshRequest.current = null;
    setPoints(null);
    setError('');
    setLoading(true);
    setRefreshing(false);
    selectDateRange(range);
  }

  if (!site || !analyticsContext) return <Redirect href={site ? '/(tabs)/overview' : '/sites'} />;
  return <Screen navigationHeader title="Traffic" description={
    <AnalyticsControls siteLabel={siteHeading(site)} range={dateRange} timeZone={timeZone}
      disabled={loading || refreshing} onRangeChange={changeRange} />
  } refreshing={refreshing} onRefresh={refresh}>
    <View style={styles.legend}>
      <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.accent }]} /><Text style={styles.legendText}>Visitors</Text></View>
      <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.chartSecondary }]} /><Text style={styles.legendText}>Pageviews</Text></View>
    </View>
    {loading ? <LoadingState variant="chart" message="Loading traffic…" /> : null}
    {!loading && error ? <ErrorState message={error} onRetry={refresh} /> : null}
    {!loading && !error && points?.length === 0 ? <EmptyState message="No traffic was recorded for this range." /> : null}
    {!loading && !error && points?.length ? <View style={styles.chartCard}>
      <TrendChart interactive points={points} bucket={analyticsBucket(dateRange)} series={trafficSeries} height={240}
        accessibilityLabel={`Traffic trend with ${points.length} time buckets`} />
    </View> : null}
  </Screen>;
}

const themedStyles = createThemedStyles(colors => ({
  legend: { flexDirection: 'row', gap: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 999 },
  legendText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chartCard: { backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', padding: 16 },
}));
