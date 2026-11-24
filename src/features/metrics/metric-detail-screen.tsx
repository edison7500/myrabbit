import { Redirect, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { Maximize2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, Text, useWindowDimensions, View, type LayoutChangeEvent, type ScrollView } from 'react-native';
import { analyticsQueryIdentity } from '@/api/rybbit/analytics-context';
import { analyticsBucket } from '@/api/rybbit/date-range';
import { AnalyticsControls } from '@/components/analytics-controls';
import { ErrorState, LoadingState } from '@/components/content-state';
import { Screen } from '@/components/screen';
import { radii, spacing } from '@/constants/theme';
import { createThemedStyles } from '@/constants/themed-styles';
import { siteHeading } from '@/features/overview/overview-state';
import { TrendChart } from '@/features/overview/traffic-chart';
import { useSession } from '@/stores/session';
import { useTheme } from '@/stores/theme';
import { ExpandedChartContent, ExpandedMetricChart } from './expanded-metric-chart';
import { loadMetricDetail, type MetricDetailData } from './metric-detail-data';
import { formatMetricValue } from './metric-format';
import { metricDefinitions, metricOrder, type MetricType } from './metric-types';

type DetailProps = { anchor: MetricType; loadDetail?: typeof loadMetricDetail };
type ChartProps = ComponentProps<typeof TrendChart>;
const title = 'Metric Trends';

export default function MetricDetailScreen(props: DetailProps) {
  const { analyticsContext } = useSession();
  if (!analyticsContext) return <Redirect href="/sites" />;
  return <MetricDetail key={analyticsQueryIdentity(analyticsContext, 'metric-detail')} {...props} />;
}

function MetricDetail({ anchor, loadDetail = loadMetricDetail }: DetailProps) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { site, dateRange, timeZone, analyticsContext, selectDateRange, selectFilters } = useSession();
  const [data, setData] = useState<MetricDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedMetric, setExpandedMetric] = useState<MetricType | null>(null);
  const router = useRouter();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const { width, height } = useWindowDimensions();
  const landscape = process.env.EXPO_OS !== 'web' && width > height;
  const refreshRequest = useRef<AbortController | null>(null);
  const scrollView = useRef<ScrollView | null>(null);
  const anchorFrame = useRef<number | null>(null);
  const didScrollToAnchor = useRef(false);
  const fullDay = dateRange.preset === 'today';
  const bucket = analyticsBucket(dateRange);

  const charts = data ? metricOrder.map(metric => {
    const { title: label, apiMetric } = metricDefinitions[metric];
    const total = data.overview[apiMetric];
    const missingPoints = data.points.some(point => point[apiMetric] === undefined);
    const yesterday = data.yesterday?.every(point => point[apiMetric] !== undefined) ? data.yesterday : undefined;
    const comparisonError = data.comparisonError ?? (data.yesterday && !yesterday ? 'Yesterday comparison unavailable.' : null);
    const empty = data.points.length === 0;
    const canChart = !missingPoints && (!empty || (fullDay && total !== undefined));
    const chart: ChartProps | null = canChart ? {
      interactive: true, points: data.points, bucket, timeZone, fullDay,
      series: [{ metric: apiMetric, label, fill: true }],
      comparisonPoints: yesterday,
      comparisonLabel: yesterday ? 'Yesterday' : undefined,
      accessibilityLabel: `${label} trend with ${data.points.length} time buckets`,
    } : null;
    return { metric, label, apiMetric, total, missingPoints, comparisonError, chart };
  }) : [];
  const focusedChart = charts.find(chart => chart.metric === (expandedMetric ?? anchor));
  const fullScreenChart = focusedChart?.chart && {
    ...focusedChart.chart,
    accessibilityLabel: `Expanded ${focusedChart.chart.accessibilityLabel}`,
  };
  const showLandscapeChart = landscape && !loading && !error && !!fullScreenChart;

  useFocusEffect(useCallback(() => {
    // Keep native back navigation visible for loading, empty and retry states.
    navigation.setOptions({ headerShown: !showLandscapeChart });
    return () => navigation.setOptions({ headerShown: true });
  }, [navigation, showLandscapeChart]));

  useEffect(() => {
    if (!analyticsContext) return;
    const controller = new AbortController();
    loadDetail(analyticsContext, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(issue => { if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load metric trends.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); refreshRequest.current?.abort(); };
  }, [analyticsContext, loadDetail]);

  const setScrollView = useCallback((view: ScrollView | null) => {
    if (anchorFrame.current !== null) cancelAnimationFrame(anchorFrame.current);
    anchorFrame.current = null;
    didScrollToAnchor.current = false;
    scrollView.current = view;
  }, []);

  function scrollToAnchor({ nativeEvent: { layout } }: LayoutChangeEvent) {
    if (didScrollToAnchor.current) return;
    if (anchorFrame.current !== null) cancelAnimationFrame(anchorFrame.current);
    // Wait for the scroll view to receive its content size. iOS lays out
    // content beneath the transparent navigation bar and applies a native inset.
    const topInset = process.env.EXPO_OS === 'ios' ? headerHeight : 0;
    const y = Math.max(0, layout.y - topInset - spacing.md);
    anchorFrame.current = requestAnimationFrame(() => {
      anchorFrame.current = null;
      if (!scrollView.current) return;
      scrollView.current.scrollTo({ y, animated: false });
      didScrollToAnchor.current = true;
    });
  }

  async function refresh() {
    if (!analyticsContext || loading || refreshRequest.current) return;
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setError('');
    try {
      const result = await loadDetail(analyticsContext, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (issue) {
      if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not refresh metric trends.');
    } finally {
      if (refreshRequest.current === controller) {
        refreshRequest.current = null;
        if (!controller.signal.aborted) setRefreshing(false);
      }
    }
  }

  function closeChart() {
    setExpandedMetric(null);
    // In landscape the route already displays a fullscreen chart.
    if (landscape) router.back();
  }

  return <>
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} hidden={!!expandedMetric || showLandscapeChart} />
    {showLandscapeChart && fullScreenChart ? (
      <ExpandedChartContent title={focusedChart.label} chart={fullScreenChart} onClose={closeChart} />
    ) : (
      <Screen navigationHeader title={title} scrollRef={setScrollView} description={
        <AnalyticsControls siteLabel={siteHeading(site)} range={dateRange} timeZone={timeZone} filters={analyticsContext?.filters}
          onFiltersChange={selectFilters} disabled={loading || refreshing} onRangeChange={selectDateRange} />
      } refreshing={refreshing} onRefresh={refresh}>
        {loading ? <LoadingState variant="summary" message="Loading metric trends…" /> : null}
        {error ? <ErrorState message={error} onRetry={refresh} /> : null}
        {charts.map(({ metric, label, apiMetric, total, missingPoints, comparisonError, chart }) => (
          <View key={metric} nativeID={`metric-${metric}`} style={styles.chartCard}
            onLayout={metric === anchor && metric !== metricOrder[0] ? scrollToAnchor : undefined}>
            <View style={styles.chartHeader}>
              <View style={styles.summary}>
                <Text accessibilityRole="header" style={styles.metric}>{label}</Text>
                {total !== undefined ? <Text selectable style={styles.total}>{formatMetricValue(total, apiMetric)}</Text> : null}
              </View>
              {chart ? <Pressable accessibilityRole="button" accessibilityLabel={`Expand ${label} chart`}
                onPress={() => setExpandedMetric(metric)} style={({ pressed }) => [styles.expandButton, pressed && { opacity: 0.6 }]}>
                <Maximize2 size={18} color={colors.muted} strokeWidth={2} accessible={false} />
              </Pressable> : null}
            </View>
            {chart ? <TrendChart {...chart} height={160} /> : (
              <Text style={styles.message}>{missingPoints
                ? 'This trend is unavailable from your Rybbit server.'
                : 'No data was recorded for this range.'}</Text>
            )}
            {chart && comparisonError ? <Text style={styles.message}>{comparisonError}</Text> : null}
          </View>
        ))}
      </Screen>
    )}
    {expandedMetric && fullScreenChart ? (
      <ExpandedMetricChart title={focusedChart.label} onClose={closeChart} chart={fullScreenChart} />
    ) : null}
  </>;
}

const themedStyles = createThemedStyles(colors => ({
  chartCard: { backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.md },
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  summary: { flex: 1, gap: spacing.xs },
  total: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  metric: { color: colors.text, fontSize: 17, fontWeight: '600' },
  expandButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  message: { color: colors.muted, fontSize: 13 },
}));
