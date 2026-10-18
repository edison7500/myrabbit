import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Host, Picker } from '@expo/ui';
import { ChartNoAxesColumn, FileText, Globe, Laptop, MousePointerClick } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useImperativeHandle, useMemo, useState, type ReactNode, type Ref } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AnalyticsQueryContext } from '@/api/rybbit/analytics-context';
import {
  getExploreRanking, getWeeklyTrend, weeklyHeatmap, weeklyMetrics,
  type HourlyPoint, type RankingKind, type RankingItem, type WeeklyMetric,
} from '@/api/rybbit/explore-charts';
import { SectionHeading, Surface } from '@/components/analytics-ui';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import type { ScreenSection } from '@/components/screen';

import { countryFlag } from '@/features/realtime/session-presentation';
import { useChartResource } from './use-chart-resource';

export type ExploreChartsHandle = { refresh: () => Promise<unknown> };
type Choice = { value: RankingKind; label: string };
const content: Choice[] = [
  { value: 'pathname', label: 'Pages' }, { value: 'page_title', label: 'Titles' },
  { value: 'entry_page', label: 'Entries' }, { value: 'exit_page', label: 'Exits' },
  { value: 'hostname', label: 'Hostnames' },
];
const devices: Choice[] = [
  { value: 'browser', label: 'Browsers' }, { value: 'device_type', label: 'Devices' },
  { value: 'operating_system', label: 'Operating Systems' }, { value: 'dimensions', label: 'Screen Dimensions' },
];
const locations: Choice[] = [
  { value: 'country', label: 'Countries' }, { value: 'region', label: 'Regions' }, { value: 'city', label: 'Cities' },
  { value: 'language', label: 'Languages' }, { value: 'timezone', label: 'Timezones' },
];
const events: Choice[] = [
  { value: 'custom', label: 'Custom Events' }, { value: 'outbound', label: 'Outbound' },
  { value: 'button_click', label: 'Buttons' }, { value: 'form_submit', label: 'Forms' }, { value: 'copy', label: 'Copies' },
];
export const rankingSections = {
  content: { title: 'Content', Icon: FileText, choices: content, eventCounts: false },
  technology: { title: 'Technology', Icon: Laptop, choices: devices, eventCounts: false },
  locations: { title: 'Locations', Icon: Globe, choices: locations, eventCounts: false },
  events: { title: 'Events', Icon: MousePointerClick, choices: events, eventCounts: true },
};
export type RankingSection = keyof typeof rankingSections;
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const countryNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const languageNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'language' }) : null;

export function rankingLabel(value: string, kind: RankingKind) {
  if (content.some(choice => choice.value === kind)) return kind === 'hostname' ? value : value || 'Other';
  if (!value || value === '-') return 'Unknown';
  try {
    if (kind === 'country' && countryFlag(value)) return countryNames?.of(value.toUpperCase()) || value;
    if (kind === 'language') return languageNames?.of(value) || value;
  } catch { /* Preserve unrecognized self-hosted values. */ }
  return value;
}

export function ExploreCharts({ context, ref, loadRanking = getExploreRanking, loadWeekly = getWeeklyTrend, children }: {
  context: AnalyticsQueryContext; ref?: Ref<ExploreChartsHandle>;
  loadRanking?: typeof getExploreRanking; loadWeekly?: typeof getWeeklyTrend;
  children?: (sections: ScreenSection[]) => ReactNode;
}) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const contentChart = useRankingSection('content', context, loadRanking);
  const deviceChart = useRankingSection('technology', context, loadRanking);
  const locationChart = useRankingSection('locations', context, loadRanking);
  const eventChart = useRankingSection('events', context, loadRanking);
  const weeklyChart = useWeeklySection(context, loadWeekly);
  const { reload: reloadDevices } = deviceChart;
  const { reload: reloadLocations } = locationChart;
  const { reload: reloadEvents } = eventChart;
  const { reload: reloadWeekly } = weeklyChart;
  const { reload: reloadContent } = contentChart;
  useImperativeHandle(ref, () => ({ refresh: () => Promise.allSettled([
    reloadContent(), reloadDevices(), reloadLocations(), reloadEvents(), reloadWeekly(),
  ]) }), [reloadContent, reloadDevices, reloadLocations, reloadEvents, reloadWeekly]);
  const sections = [contentChart.section, deviceChart.section, locationChart.section, eventChart.section, weeklyChart.section];
  return children ? children(sections) : <View style={styles.sections}>{sections.map(section => <View key={section.key} style={styles.section}>{section.header}{section.content}</View>)}</View>;
}

export function ChartStatus({ title, loading, error, empty, children, onRetry }: {
  title: string; loading: boolean; error: string; empty: boolean; children?: ReactNode; onRetry: () => void;
}) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <>
    {loading && empty ? <LoadingSkeleton variant="list" label={`Loading ${title.toLowerCase()}`} /> : null}
    {error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.secondary}>{error}</Text>
      {!empty ? <Text style={styles.secondary}>Showing the last successful update.</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${title}`} onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
    </View> : null}
    {!loading && !error && empty ? <Text style={styles.stateText}>No {title.toLowerCase()} data for this range.</Text> : null}
    {children}
  </>;
}

function useRankingSection(section: RankingSection, context: AnalyticsQueryContext, load: typeof getExploreRanking) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const router = useRouter();
  const { title, Icon, choices, eventCounts } = rankingSections[section];
  const [kind, setKind] = useState(choices[0].value);
  const resourceKey = useMemo(() => ({ context, kind }), [context, kind]);
  const loader = useCallback((signal: AbortSignal) => load(context, kind, signal), [context, kind, load]);
  const resource = useChartResource(loader, resourceKey);
  const items = resource.data?.items ?? [];
  const visible = items.slice(0, 5);
  const maximum = Math.max(1, ...items.map(item => item.count));
  const selectedLabel = choices.find(choice => choice.value === kind)!.label;
  const header = <SectionHeading title={title} icon={Icon} accessibilityLabel={`See all ${title}`}
    onPress={() => router.push({ pathname: '/explore/[section]', params: { section, kind } })} />;
  const content = <Surface style={styles.card}>
      <ScrollView horizontal accessibilityRole="tablist" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {choices.map(choice => <Pressable key={choice.value} accessibilityRole="tab" accessibilityLabel={`${title}: ${choice.label}`}
          accessibilityState={{ selected: choice.value === kind }} aria-selected={choice.value === kind}
          onPress={() => setKind(choice.value)}
          style={[styles.tab, choice.value === kind && styles.selectedTab]}>
          <Text style={[styles.tabText, choice.value === kind && styles.selectedTabText]}>{choice.label}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={styles.columnHeading}><Text style={styles.secondary}>{selectedLabel}</Text><Text style={styles.secondary}>{eventCounts ? 'Count' : 'Sessions'}</Text></View>
      <ChartStatus title={selectedLabel} loading={resource.loading} error={resource.error} empty={items.length === 0} onRetry={resource.reload}>
        {visible.map(item => <RankingBar key={item.value} item={item} kind={kind} maximum={maximum} firstPercentage={items[0]?.percentage} eventCounts={eventCounts} />)}
        {items.length ? <Text style={styles.caption}>Showing {visible.length} of {resource.data!.totalCount.toLocaleString()}{resource.loading ? ' · Updating…' : ''}</Text> : null}
      </ChartStatus>
    </Surface>;
  return { section: { key: title, header, content }, reload: resource.reload };
}

export function RankingBar({ item, kind, maximum, firstPercentage, eventCounts }: { item: RankingItem; kind: RankingKind; maximum: number; firstPercentage?: number; eventCounts: boolean }) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const label = rankingLabel(item.value, kind);
  const width = item.percentage !== undefined && firstPercentage !== undefined
    ? item.percentage * (firstPercentage ? 100 / firstPercentage : 1)
    : item.count / maximum * 100;
  const flag = kind === 'country' ? countryFlag(item.value) : kind === 'region' || kind === 'city' ? countryFlag(item.value.split('-')[0]) : null;
  return <View accessible accessibilityLabel={`${label}, ${item.count.toLocaleString()} ${eventCounts ? 'events' : 'sessions'}`} style={styles.rank}>
    <View accessible={false} style={[styles.rankFill, { width: `${Math.min(100, width)}%` }]} />
    {flag ? <Text accessible={false} style={styles.flag}>{flag}</Text> : null}
    <Text selectable numberOfLines={content.some(choice => choice.value === kind) ? 2 : 1} style={styles.rankLabel}>{label}</Text>
    <Text selectable style={styles.rankCount}>{item.count.toLocaleString()}</Text>
  </View>;
}

function useWeeklySection(context: AnalyticsQueryContext, load: typeof getWeeklyTrend) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const [metric, setMetric] = useState<WeeklyMetric>('users');
  const loader = useCallback((signal: AbortSignal) => load(context, signal), [context, load]);
  const resource = useChartResource(loader);
  const header = <SectionHeading title="Weekly Trends" icon={ChartNoAxesColumn} />;
  const content = <Surface style={styles.card}>
      <View accessibilityLabel="Weekly trend metric" style={styles.picker}>
        <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={colors.accent} style={{ flex: 1 }}>
          <Picker selectedValue={metric} onValueChange={setMetric}>
            {(Object.keys(weeklyMetrics) as WeeklyMetric[]).map(value => <Picker.Item key={value} value={value} label={weeklyMetrics[value]} />)}
          </Picker>
        </Host>
      </View>
      <Text style={styles.secondary}>Average per hourly bucket · {context.timeZone}</Text>
      <ChartStatus title="weekly trends" loading={resource.loading} error={resource.error} empty={!resource.data?.length} onRetry={resource.reload}>
        {resource.data?.length ? <WeeklyHeatmap key={metric} points={resource.data} metric={metric} /> : null}
      </ChartStatus>
    </Surface>;
  return { section: { key: 'weekly', header, content }, reload: resource.reload, loading: resource.loading };
}

function metricValue(value: number, metric: WeeklyMetric) {
  if (metric === 'bounce_rate') return `${value.toFixed(1)}%`;
  if (metric === 'session_duration') return `${Math.floor(Math.round(value) / 60)}m ${Math.round(value) % 60}s`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function WeeklyHeatmap({ points, metric }: { points: HourlyPoint[]; metric: WeeklyMetric }) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const grid = weeklyHeatmap(points, metric);
  const [selection, setSelection] = useState<{ day: number; hour: number } | null>(null);
  const maximum = Math.max(0, ...grid.flat().map(value => value ?? 0));
  const available = grid.some(day => day.some(value => value !== null));
  const selected = selection ? grid[selection.day][selection.hour] : null;
  return <View style={styles.heatmap}>
    {!available ? <Text style={styles.stateText}>This server did not return {weeklyMetrics[metric].toLowerCase()} for hourly buckets.</Text> : null}
    <View style={styles.heatRow}><View style={styles.hourLabel} />{dayNames.map(day => <Text key={day} style={styles.dayLabel}>{day}</Text>)}</View>
    {Array.from({ length: 24 }, (_, hour) => <View key={hour} style={styles.heatRow}>
      <Text style={styles.hourLabel}>{hour % 2 === 1 ? `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}` : ''}</Text>
      {grid.map((day, d) => {
        const value = day[hour];
        const label = `${dayNames[d]} ${String(hour).padStart(2, '0')}:00, ${value === null ? 'No hourly bucket' : `${metricValue(value, metric)} ${weeklyMetrics[metric]}`}`;
        return <Pressable key={d} accessibilityRole="button" accessibilityLabel={label}
          onPress={() => setSelection({ day: d, hour })} style={[styles.heatCell, selection?.day === d && selection.hour === hour && styles.selectedCell]}>
          {value !== null && value > 0 ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.heatFill, { opacity: 0.15 + value / maximum * 0.85 }]} /> : null}
        </Pressable>;
      })}
    </View>)}
    <Text accessibilityLiveRegion="polite" style={styles.selection}>{selection ? `${dayNames[selection.day]} ${String(selection.hour).padStart(2, '0')}:00 · ${selected === null ? 'No hourly bucket' : `${metricValue(selected, metric)} ${weeklyMetrics[metric]}`}` : 'Tap a cell to inspect its hourly average'}</Text>
    <View style={styles.scale}><Text style={styles.secondary}>Less</Text>{[0.15, 0.35, 0.55, 0.75, 1].map(opacity => <View key={opacity} style={[styles.scaleCell, { opacity }]} />)}<Text style={styles.secondary}>More</Text></View>
  </View>;
}

const themedStyles = createThemedStyles(colors => ({
  sections: { gap: 28 }, section: { gap: 12 },
  card: { gap: 12 },
  tabs: { gap: 20 }, tab: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  selectedTab: { borderColor: colors.accent }, tabText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  selectedTabText: { color: colors.accent, fontWeight: '600' },
  columnHeading: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  secondary: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  rank: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, overflow: 'hidden', borderRadius: 6 },
  rankFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accentSurface, borderRadius: 6 },
  rankLabel: { flex: 1, color: colors.text, fontSize: 14 },
  rankCount: { color: colors.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  flag: { fontSize: 18 }, caption: { color: colors.muted, fontSize: 11, paddingTop: 4 },
  state: { gap: 6, paddingVertical: 12 }, stateText: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 18 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, retryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  picker: { alignSelf: 'flex-end', width: 210, backgroundColor: colors.accentSurface, borderRadius: 12 },
  heatmap: { gap: 4 }, heatRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  hourLabel: { width: 28, color: colors.muted, fontSize: 10, textAlign: 'right', paddingRight: 4 },
  dayLabel: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 11, paddingVertical: 4 },
  heatCell: { flex: 1, height: 18, backgroundColor: colors.secondarySurface, borderRadius: 3, overflow: 'hidden' },
  selectedCell: { borderWidth: 1.5, borderColor: colors.text }, heatFill: { backgroundColor: colors.accent, borderRadius: 3 },
  selection: { minHeight: 36, color: colors.muted, fontSize: 12, lineHeight: 18, paddingTop: 8 },
  scale: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5 },
  scaleCell: { width: 12, height: 12, backgroundColor: colors.accent, borderRadius: 2 },
}));
