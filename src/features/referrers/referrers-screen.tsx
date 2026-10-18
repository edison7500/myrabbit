import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsQueryIdentity, type AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { appendBreakdownPage, getBreakdown, type BreakdownItem } from '@/api/rybbit/breakdown';
import type { Site } from '@/api/rybbit/client';
import type { AnalyticsDateRange } from '@/api/rybbit/date-range';
import { AnalyticsControls } from '@/components/analytics-controls';
import { EmptyState, ErrorState, LoadingState } from '@/components/content-state';

import { siteHeading } from '@/features/overview/overview-state';
import { useSession } from '@/stores/session';
import { RankedList, RankedListMessage } from './ranked-list';

const pageSize = 25;
type BreakdownLoader = typeof getBreakdown;

export default function ReferrersScreen({ loadBreakdown = getBreakdown }: { loadBreakdown?: BreakdownLoader }) {
  const { site, dateRange, timeZone, analyticsContext, selectDateRange } = useSession();
  if (!site || !analyticsContext) return <Redirect href={site ? '/(tabs)/overview' : '/sites'} />;
  const identity = analyticsQueryIdentity(analyticsContext, 'metric', { limit: pageSize, page: 1, parameter: 'referrer' });
  return <ReferrerBreakdown key={identity} site={site} context={analyticsContext} dateRange={dateRange} timeZone={timeZone}
    selectDateRange={selectDateRange} loadBreakdown={loadBreakdown} />;
}

function ReferrerBreakdown({ site, context: analyticsContext, dateRange, timeZone, selectDateRange, loadBreakdown }: {
  site: Site;
  context: AnalyticsQueryContext;
  dateRange: AnalyticsDateRange;
  timeZone: string;
  selectDateRange: (range: AnalyticsDateRange) => void;
  loadBreakdown: BreakdownLoader;
}) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const initialRequest = useRef<AbortController | null>(null);
  const refreshRequest = useRef<AbortController | null>(null);
  const pageRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    initialRequest.current = controller;
    loadBreakdown({ context: analyticsContext, dimension: 'referrer', limit: pageSize }, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setItems(result.items);
        setTotalCount(result.totalCount);
        setNextPage(result.nextPage);
      })
      .catch(issue => {
        if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not load referrers.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          initialRequest.current = null;
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
      refreshRequest.current?.abort();
      pageRequest.current?.abort();
    };
  }, [analyticsContext, loadBreakdown]);

  async function refresh() {
    if (refreshRequest.current) return;
    initialRequest.current?.abort();
    pageRequest.current?.abort();
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setLoadingMore(false);
    setError('');
    setLoadMoreError('');
    try {
      const result = await loadBreakdown({ context: analyticsContext, dimension: 'referrer', limit: pageSize }, controller.signal);
      if (!controller.signal.aborted) {
        setItems(result.items);
        setTotalCount(result.totalCount);
        setNextPage(result.nextPage);
      }
    } catch (issue) {
      if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Could not refresh referrers.');
    } finally {
      if (!controller.signal.aborted) {
        refreshRequest.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function loadMore(force = false) {
    if (nextPage === null || loading || refreshing || loadingMore || pageRequest.current ||
      (loadMoreError && !force)) return;
    const controller = new AbortController();
    pageRequest.current = controller;
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const result = await loadBreakdown({ context: analyticsContext, dimension: 'referrer', page: nextPage, limit: pageSize }, controller.signal);
      if (!controller.signal.aborted) {
        setItems(current => appendBreakdownPage(current, result));
        setTotalCount(result.totalCount);
        setNextPage(result.nextPage);
      }
    } catch (issue) {
      if (!controller.signal.aborted) setLoadMoreError(issue instanceof Error ? issue.message : 'Could not load more referrers.');
    } finally {
      if (!controller.signal.aborted) {
        pageRequest.current = null;
        setLoadingMore(false);
      }
    }
  }

  function changeRange(nextRange: AnalyticsDateRange) {
    initialRequest.current?.abort();
    refreshRequest.current?.abort();
    pageRequest.current?.abort();
    selectDateRange(nextRange);
  }

  const header = <View style={styles.header}>
    <AnalyticsControls siteLabel={siteHeading(site)} range={dateRange} timeZone={timeZone}
      disabled={loading || refreshing} onRangeChange={changeRange} />
    <View style={styles.sectionHeading}>
      <View style={styles.sectionCopy}>
        <Text style={styles.description}>Where sessions came from for the selected range.</Text>
      </View>
      <Text style={styles.metric}>Sessions</Text>
    </View>
    {error && items.length ? <View accessibilityRole="alert" style={styles.inlineError}>
      <Text selectable style={styles.inlineErrorText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
    </View> : null}
  </View>;

  const empty = loading || (refreshing && !items.length)
    ? <LoadingState message="Loading referrers…" />
    : error
      ? <ErrorState message={error} onRetry={refresh} />
      : <EmptyState message="No attributed referrers were recorded for this range. Direct-only sessions are not included." />;

  const footer = items.length ? <View style={styles.footer}>
    {loadingMore ? <ActivityIndicator accessibilityLabel="Loading more referrers" color={colors.accent} /> : null}
    {loadMoreError ? <>
      <RankedListMessage>{loadMoreError}</RankedListMessage>
      <Pressable accessibilityRole="button" onPress={() => loadMore(true)} style={styles.retry}><Text style={styles.retryText}>Try loading more</Text></Pressable>
    </> : null}
    {!loadingMore && !loadMoreError ? <RankedListMessage>{`Showing ${items.length.toLocaleString()} of ${totalCount.toLocaleString()} referrers`}</RankedListMessage> : null}
  </View> : null;

  return <SafeAreaView style={styles.safe} edges={{ top: 'off', bottom: 'additive', left: 'additive', right: 'additive' }}>
    <RankedList items={items} getLabel={item => item.value} header={header} empty={empty} footer={footer}
      refreshing={refreshing} onRefresh={refresh} onEndReached={loadMore} />
  </SafeAreaView>;
}

const themedStyles = createThemedStyles(colors => ({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { gap: 22, paddingBottom: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  sectionCopy: { flex: 1, minWidth: 0, gap: 5 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  metric: { color: colors.muted, fontSize: 13, fontWeight: '600', paddingBottom: 3 },
  inlineError: { padding: 14, gap: 6, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.dangerSurface },
  inlineErrorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  retry: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  retryText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  footer: { minHeight: 70, paddingTop: 20, gap: 4, alignItems: 'center', justifyContent: 'center' },
}));
