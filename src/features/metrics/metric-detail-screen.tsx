import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Redirect, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Maximize2 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { analyticsBucket, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import { AnalyticsControls } from '@/components/analytics-controls';
import { EmptyState, ErrorState, LoadingState } from '@/components/content-state';
import { Screen } from '@/components/screen';
import { radii } from '@/constants/theme';
import { siteHeading } from '@/features/overview/overview-state';
import { TrendChart, type TrendSeries } from '@/features/overview/traffic-chart';
import { useSession } from '@/stores/session';
import { alignYesterdayByHour, loadMetricDetail, type MetricDetailData } from './metric-detail-data';
import { metricDefinitions, type MetricType } from './metric-types';
import { formatMetricValue } from './metric-format';
import { ExpandedChartContent, ExpandedMetricChart } from './expanded-metric-chart';

type DetailLoader = typeof loadMetricDetail;

export default function MetricDetailScreen({ metric, loadDetail = loadMetricDetail }: { metric: MetricType; loadDetail?: DetailLoader }) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { site, dateRange, timeZone, analyticsContext, selectDateRange } = useSession();
  const [data, setData] = useState<MetricDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [chartExpanded, setChartExpanded] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const landscape = process.env.EXPO_OS !== 'web' && width > height;
  const refreshRequest = useRef<AbortController | null>(null);
  const definition = metricDefinitions[metric];
  const series: TrendSeries[] = [{ metric: definition.apiMetric, fill: true }];
  const hasChart = !!data && (data.points.length > 0 || dateRange.preset === 'today');
  const showLandscapeChart = landscape && !loading && !error && hasChart;

  useFocusEffect(useCallback(() => {
    // Loading, empty and retry states retain the native back button in landscape.
    navigation.setOptions({ headerShown: !showLandscapeChart });
    return () => navigation.setOptions({ headerShown: true });
  }, [navigation, showLandscapeChart]));

  useEffect(() => {
    if (!analyticsContext || !definition.detailAvailable) return;
    const controller = new AbortController();
    loadDetail(metric, analyticsContext, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(issue => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load metric details.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); refreshRequest.current?.abort(); };
  }, [analyticsContext, definition.detailAvailable, loadDetail, metric]);

  async function refresh() {
    if (!analyticsContext || loading || refreshRequest.current) return;
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setError('');
    try {
      const result = await loadDetail(metric, analyticsContext, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (issue) {
      if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not refresh metric details.');
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
    setData(null);
    setError('');
    setLoading(true);
    setRefreshing(false);
    selectDateRange(range);
  }

  function closeChart() {
    setChartExpanded(false);
    // Landscape is already the full chart page; one close returns to the
    // previous portrait screen rather than revealing an identical chart.
    if (landscape) router.back();
  }

  if (!site || !definition.detailAvailable) return <Redirect href={site ? '/(tabs)/overview' : '/sites'} />;
  const comparisonValues = data?.yesterday && data.points.length ? alignYesterdayByHour(data.points, data.yesterday, definition.apiMetric) : undefined;
  const chart = data ? {
    interactive: true, points: data.points, bucket: analyticsBucket(dateRange), timeZone, series,
    fullDay: dateRange.preset === 'today', comparisonPoints: data.yesterday ?? undefined,
    comparisonValues, comparisonLabel: data.yesterday ? 'Yesterday' : undefined,
    accessibilityLabel: `Expanded ${definition.title.toLowerCase()} trend with ${data.points.length} time buckets`,
  } : null;
  return <>
  <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} hidden={chartExpanded || landscape} />
  {showLandscapeChart && chart ? <ExpandedChartContent title={definition.title} chart={chart} onClose={closeChart} /> :
  <Screen navigationHeader title={definition.title} description={
    <AnalyticsControls siteLabel={siteHeading(site)} range={dateRange} timeZone={timeZone} disabled={loading || refreshing} onRangeChange={changeRange} />
  } refreshing={refreshing} onRefresh={refresh}>
    {loading ? <LoadingState variant="summary" message={`Loading ${definition.title.toLowerCase()}…`} /> : null}
    {!loading && error ? <ErrorState message={error} onRetry={refresh} /> : null}
    {!loading && !error && data?.points.length === 0 ? <EmptyState message={`No ${definition.title.toLowerCase()} were recorded for this range.`} /> : null}
    {!loading && !error && data && (data.points.length > 0 || dateRange.preset === 'today') ? <>
      <View style={styles.summary}><Text selectable style={styles.total}>{formatMetricValue(data.total, definition.apiMetric)}</Text><Text style={styles.metric}>{definition.title}</Text></View>
      <View style={styles.chartCard}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Expand ${definition.title} chart`} onPress={() => setChartExpanded(true)} style={styles.expandButton}>
          <Maximize2 size={18} color={colors.muted} strokeWidth={2} accessible={false} />
        </Pressable>
        <TrendChart interactive points={data.points} bucket={analyticsBucket(dateRange)} timeZone={timeZone} series={series} height={160}
          fullDay={dateRange.preset === 'today'} comparisonPoints={data.yesterday ?? undefined}
          comparisonValues={comparisonValues}
          comparisonLabel={data.yesterday ? 'Yesterday' : undefined}
          accessibilityLabel={`${definition.title} trend with ${data.points.length} time buckets`} />
      </View>
      {data.comparisonError ? <Text style={styles.comparisonError}>{data.comparisonError}</Text> : null}
    </> : null}
  </Screen>}
  {chartExpanded && chart && hasChart ? <ExpandedMetricChart
    title={definition.title} onClose={closeChart}
    chart={chart} /> : null}
  </>;
}

const themedStyles = createThemedStyles(colors => ({
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  total: { color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  metric: { color: colors.muted, fontSize: 17, fontWeight: '600' },
  chartCard: { justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', padding: 14 },
  expandButton: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  comparisonError: { color: colors.muted, fontSize: 13 },
}));
