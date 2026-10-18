import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Redirect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyticsQueryIdentity, type AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import { getCompleteRanking, getExploreRanking, type RankingKind } from '@/api/rybbit/explore-charts';
import { AnalyticsControls } from '@/components/analytics-controls';

import { siteHeading } from '@/features/overview/overview-state';
import { useSession } from '@/stores/session';
import { ChartStatus, RankingBar, rankingSections, type RankingSection } from './explore-charts';
import { useChartResource } from './use-chart-resource';

type Props = {
  section: RankingSection;
  kind?: RankingKind;
  loadRanking?: typeof getExploreRanking;
};

export default function ChartDetailScreen(props: Props) {
  const { analyticsContext } = useSession();
  if (!analyticsContext) return <Redirect href="/" />;
  const key = analyticsQueryIdentity(analyticsContext, props.section, { kind: props.kind ?? '' });
  return <RankingDetail key={key} context={analyticsContext} section={props.section} initialKind={props.kind} load={props.loadRanking ?? getExploreRanking} />;
}

function DetailControls() {
  const { site, dateRange, timeZone, selectDateRange } = useSession();
  return <AnalyticsControls siteLabel={siteHeading(site)} range={dateRange} timeZone={timeZone} onRangeChange={selectDateRange} />;
}

function RankingDetail({ context, section, initialKind, load }: {
  context: AnalyticsQueryContext; section: RankingSection; initialKind?: RankingKind; load: typeof getExploreRanking;
}) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { title, choices, eventCounts } = rankingSections[section];
  const [kind, setKind] = useState(choices.find(choice => choice.value === initialKind)?.value ?? choices[0].value);
  const resourceKey = useMemo(() => ({ context, kind }), [context, kind]);
  const loader = useCallback((signal: AbortSignal) => getCompleteRanking(context, kind, signal, load), [context, kind, load]);
  const resource = useChartResource(loader, resourceKey);
  const items = resource.data?.items ?? [];
  const maximum = items.reduce((max, item) => Math.max(max, item.count), 1);
  const selectedLabel = choices.find(choice => choice.value === kind)!.label;
  const header = <View style={styles.header}>
    <DetailControls />
    <ScrollView horizontal accessibilityRole="tablist" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {choices.map(choice => <Pressable key={choice.value} accessibilityRole="tab" accessibilityLabel={`${title}: ${choice.label}`}
        accessibilityState={{ selected: choice.value === kind }} aria-selected={choice.value === kind}
        onPress={() => setKind(choice.value)} style={[styles.tab, choice.value === kind && styles.selectedTab]}>
        <Text style={[styles.tabText, choice.value === kind && styles.selectedTabText]}>{choice.label}</Text>
      </Pressable>)}
    </ScrollView>
    <View style={styles.columns}><Text style={styles.secondary}>{selectedLabel}</Text><Text style={styles.secondary}>{eventCounts ? 'Count' : 'Sessions'}</Text></View>
    <ChartStatus title={selectedLabel} loading={resource.loading} error={resource.error} empty={!items.length} onRetry={resource.reload} />
  </View>;
  return <SafeAreaView style={styles.safe} edges={{ top: 'off', bottom: 'additive', left: 'additive', right: 'additive' }}>
    <FlatList data={items} keyExtractor={item => item.value} contentContainerStyle={styles.content}
      renderItem={({ item }) => <RankingBar item={item} kind={kind} maximum={maximum} firstPercentage={items[0]?.percentage} eventCounts={eventCounts} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={header}
      ListFooterComponent={items.length ? <Text style={styles.footer}>Showing {items.length.toLocaleString()} {selectedLabel.toLowerCase()}{resource.loading ? ' · Updating…' : ''}</Text> : null}
      refreshing={resource.loading && !!resource.data} onRefresh={resource.reload}
      alwaysBounceVertical contentInsetAdjustmentBehavior="automatic" />
  </SafeAreaView>;
}

const themedStyles = createThemedStyles(colors => ({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 36 },
  header: { gap: 16, paddingBottom: 12 },
  tabs: { gap: 20 }, tab: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  selectedTab: { borderColor: colors.accent }, tabText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  selectedTabText: { color: colors.text, fontWeight: '600' },
  columns: { flexDirection: 'row', justifyContent: 'space-between' },
  secondary: { color: colors.muted, fontSize: 13 },
  separator: { height: 10 }, footer: { color: colors.muted, fontSize: 13, paddingVertical: 24, textAlign: 'center' },
}));
