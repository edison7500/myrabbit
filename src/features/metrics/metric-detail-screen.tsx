import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Maximize2, X } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { analyticsBucket, type AnalyticsDateRange } from '@/api/rybbit/date-range';
import { AnalyticsControls } from '@/components/analytics-controls';
import { EmptyState, ErrorState, LoadingState } from '@/components/content-state';
import { Screen } from '@/components/screen';
import { radii } from '@/constants/theme';
import { siteHeading } from '@/features/overview/overview-state';
import { TrendChart, visitorsSeries } from '@/features/overview/traffic-chart';
import { useSession } from '@/stores/session';
import { alignYesterdayByHour, loadMetricDetail, type MetricDetailData } from './metric-detail-data';
import { metricDefinitions, type MetricType } from './metric-types';

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const refreshRequest = useRef<AbortController | null>(null);
  const definition = metricDefinitions[metric];

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

  if (!site || !definition.detailAvailable) return <Redirect href={site ? '/(tabs)/overview' : '/sites'} />;
  const comparisonValues = data?.yesterday && data.points.length ? alignYesterdayByHour(data.points, data.yesterday) : undefined;
  const rotated = process.env.EXPO_OS !== 'web' && screenHeight > screenWidth;
  return <>
  <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} hidden={chartExpanded} />
  <Screen navigationHeader title={definition.title} description={
    <AnalyticsControls siteLabel={siteHeading(site)} range={dateRange} timeZone={timeZone} disabled={loading || refreshing} onRangeChange={changeRange} />
  } refreshing={refreshing} onRefresh={refresh}>
    {loading ? <LoadingState variant="summary" message={`Loading ${definition.title.toLowerCase()}…`} /> : null}
    {!loading && error ? <ErrorState message={error} onRetry={refresh} /> : null}
    {!loading && !error && data?.points.length === 0 ? <EmptyState message={`No ${definition.title.toLowerCase()} were recorded for this range.`} /> : null}
    {!loading && !error && data && (data.points.length > 0 || dateRange.preset === 'today') ? <>
      <View style={styles.summary}><Text selectable style={styles.total}>{data.total.toLocaleString()}</Text><Text style={styles.metric}>{definition.title}</Text></View>
      <View style={styles.chartCard}>
        <Pressable accessibilityRole="button" accessibilityLabel="Expand Visitors chart" onPress={() => setChartExpanded(true)} style={styles.expandButton}>
          <Maximize2 size={18} color={colors.muted} strokeWidth={2} accessible={false} />
        </Pressable>
        <TrendChart interactive points={data.points} bucket={analyticsBucket(dateRange)} timeZone={timeZone} series={visitorsSeries} height={160}
          fullDay={dateRange.preset === 'today'} comparisonPoints={data.yesterday ?? undefined}
          comparisonValues={comparisonValues}
          comparisonLabel={data.yesterday ? 'Yesterday' : undefined}
          accessibilityLabel={`${definition.title} trend with ${data.points.length} time buckets`} />
      </View>
      {data.comparisonError ? <Text style={styles.comparisonError}>{data.comparisonError}</Text> : null}
    </> : null}
  </Screen>
  {chartExpanded && data && (data.points.length > 0 || dateRange.preset === 'today') ? <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={() => setChartExpanded(false)}>
    <View style={styles.modalRoot}>
      <View style={[styles.landscapePanel, rotated ? {
        width: screenHeight,
        height: screenWidth,
        left: (screenWidth - screenHeight) / 2,
        top: (screenHeight - screenWidth) / 2,
        transform: [{ rotate: '-90deg' }],
      } : { width: screenWidth, height: screenHeight }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Visitors trend</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close expanded chart" onPress={() => setChartExpanded(false)} hitSlop={12}>
            <X size={24} color={colors.text} strokeWidth={2} accessible={false} />
          </Pressable>
        </View>
        <View style={styles.expandedChartCard}>
          <TrendChart interactive points={data.points} bucket={analyticsBucket(dateRange)} timeZone={timeZone} series={visitorsSeries}
            fullDay={dateRange.preset === 'today'} comparisonPoints={data.yesterday ?? undefined}
            height={Math.max(140, (rotated ? screenWidth : screenHeight) - 150)}
            comparisonValues={comparisonValues} comparisonLabel={data.yesterday ? 'Yesterday' : undefined}
            accessibilityLabel={`Expanded ${definition.title.toLowerCase()} trend with ${data.points.length} time buckets`} />
        </View>
      </View>
    </View>
  </Modal> : null}
  </>;
}

const themedStyles = createThemedStyles(colors => ({
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  total: { color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  metric: { color: colors.muted, fontSize: 17, fontWeight: '600' },
  chartCard: { justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', padding: 14 },
  expandButton: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  landscapePanel: { position: 'absolute', paddingHorizontal: 48, paddingVertical: 20, justifyContent: 'center', gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  expandedChartCard: { backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', padding: 16 },
  comparisonError: { color: colors.muted, fontSize: 13 },
}));
