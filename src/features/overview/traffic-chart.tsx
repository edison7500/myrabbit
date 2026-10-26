import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { useId, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AnalyticsBucket } from '@/api/rybbit/date-range';
import type { TrafficPoint, OverviewMetric } from '@/api/rybbit/client';
import { formatMetricValue, metricLabels } from '@/features/metrics/metric-format';
import { radii, spacing, typography } from '@/constants/theme';

const initialChartWidth = 320;
const defaultChartHeight = 132;
type TrendMetric = OverviewMetric;
export type TrendSeries = { metric: TrendMetric; color?: string; fill?: boolean };

function chartClock(timeZone: string, now: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  function localTime(date: Date) {
    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  }
  return {
    current: localTime(now),
    // SQL timestamps are wall-clock values in the analytics timezone; zoned ISO
    // timestamps represent instants and need conversion first.
    time: (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? localTime(new Date(value.replace(' ', 'T')))
      : value.replace('T', ' '),
  };
}

export function chartElapsedCount(points: TrafficPoint[], bucket: AnalyticsBucket, timeZone: string, now = new Date()) {
  const clock = chartClock(timeZone, now);
  const precision = bucket === 'month' ? 7 : bucket === 'day' || bucket === 'week' ? 10 : bucket === 'hour' ? 13 : 16;
  const current = clock.current.slice(0, precision);
  const firstIncomplete = points.findIndex(point => clock.time(point.time).slice(0, precision) >= current);
  return firstIncomplete < 0 ? points.length : firstIncomplete;
}

export function dailyChartData(points: TrafficPoint[], previous: TrafficPoint[] | undefined, timeZone: string, now = new Date(), metric: TrendMetric = 'users') {
  const clock = chartClock(timeZone, now);
  const date = clock.current.slice(0, 10);
  const currentHour = Number(clock.current.slice(11, 13));
  const today = new Map(points.map(point => [clock.time(point.time).slice(0, 13), point]));
  const yesterday = new Map(previous?.map(point => [clock.time(point.time).slice(11, 13), point[metric]]));
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  const hourlyValues = (metric: TrendMetric) => [0, ...hours.map(hour => today.get(`${date} ${hour}`)?.[metric] ?? 0)];
  // Plot each bucket at its END: the 21:00 bucket occupies 21:00–22:00.
  // The leading zero anchors midnight; future slots only reserve axis space.
  return {
    values: {
      users: hourlyValues('users'), pageviews: hourlyValues('pageviews'), sessions: hourlyValues('sessions'),
      pages_per_session: hourlyValues('pages_per_session'), bounce_rate: hourlyValues('bounce_rate'), session_duration: hourlyValues('session_duration'),
    },
    comparisonValues: [previous?.length ? 0 : null, ...hours.map(hour => yesterday.get(hour) ?? null)],
    elapsedCount: currentHour + 1,
  };
}

function coordinates(values: number[], maximum: number, width: number, height: number) {
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - (value / maximum) * (height - 16) - 8,
  }));
}

function path(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function comparisonPath(values: (number | null)[], maximum: number, width: number, height: number) {
  const positions = coordinates(values.map(value => value ?? 0), maximum, width, height);
  let drawing = false;
  return values.map((value, index) => {
    if (value === null) { drawing = false; return ''; }
    const position = positions[index];
    const command = drawing ? 'L' : 'M';
    drawing = true;
    return `${command} ${position.x.toFixed(2)} ${position.y.toFixed(2)}`;
  }).filter(Boolean).join(' ');
}

function timeLabel(value: string, bucket: AnalyticsBucket) {
  if (bucket === 'minute' || bucket === 'hour') return value.slice(11, 16);
  if (bucket === 'month') return value.slice(0, 7);
  return value.slice(5, 10);
}

export function chartTickIndexes(length: number, maximumTicks = 5) {
  if (length <= 0) return [];
  const count = Math.min(length, maximumTicks);
  return Array.from({ length: count }, (_, index) => Math.round(index * (length - 1) / (count - 1 || 1)));
}

export function TrendChart({ points, bucket, series, accessibilityLabel, height: requestedHeight = defaultChartHeight, availableHeight, comparisonValues, comparisonLabel, timeZone, fullDay = false, comparisonPoints, interactive = false }: {
  points: TrafficPoint[];
  bucket: AnalyticsBucket;
  series: TrendSeries[];
  accessibilityLabel: string;
  height?: number;
  availableHeight?: number;
  comparisonValues?: (number | null)[];
  comparisonLabel?: string;
  timeZone?: string;
  fullDay?: boolean;
  comparisonPoints?: TrafficPoint[];
  interactive?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const [width, setWidth] = useState(initialChartWidth);
  const [detailsHeight, setDetailsHeight] = useState(0);
  // Measure labels, legend and inspection content, including Dynamic Type and
  // the extra comparison row after selection, before allocating plot space.
  const height = availableHeight === undefined ? requestedHeight : Math.max(80, availableHeight - detailsHeight - spacing.sm);
  const [selection, setSelection] = useState<number | null>(null);
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const day = fullDay && timeZone && bucket === 'hour' ? dailyChartData(points, comparisonPoints, timeZone, new Date(), series[0]?.metric) : null;
  const count = day ? 25 : points.length;
  const elapsedCount = day?.elapsedCount ?? (timeZone ? chartElapsedCount(points, bucket, timeZone) : points.length);
  const previousValues = day?.comparisonValues ?? comparisonValues;
  const values = series.map(item => ({ ...item, color: item.color ?? (item.metric === 'pageviews' ? colors.chartSecondary : colors.accent), values: day?.values[item.metric] ?? points.map(point => point[item.metric] ?? 0) }));
  const maximum = Math.max(1, ...values.flatMap(line => line.values.slice(0, elapsedCount + 1)), ...(previousValues ?? []).filter((value): value is number => value !== null));
  const lines = values.map(item => ({ ...item, points: coordinates(item.values, maximum, width, height) }));
  const previousPath = previousValues?.length === count ? comparisonPath(previousValues, maximum, width, height) : '';
  const maximumTicks = Math.min(13, Math.max(2, Math.floor(width / 56)));
  const ticks = chartTickIndexes(count, day ? [13, 9, 7, 5, 4, 3, 2].find(value => value <= maximumTicks) : maximumTicks);
  const firstSelectable = day ? 1 : 0;
  const lastSelectable = Math.min(count - 1, elapsedCount);
  const canInspect = interactive && lastSelectable >= firstSelectable;
  const selectedIndex = selection === null || !Number.isFinite(selection) || !canInspect ? null : Math.max(firstSelectable, Math.min(lastSelectable, selection));
  const selectedTime = selectedIndex === null ? '' : day
    ? `${String(selectedIndex - 1).padStart(2, '0')}:00–${String(selectedIndex).padStart(2, '0')}:00`
    : points[selectedIndex].time.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  const selectedSummary = selectedIndex === null ? '' : `${selectedTime}${selectedIndex === elapsedCount ? ' · In progress' : ''}. ${lines.map(line => `${metricLabels[line.metric]}: ${formatMetricValue(line.values[selectedIndex], line.metric)}`).join('. ')}`;
  function moveSelection(direction: number) {
    setSelection(Math.max(firstSelectable, Math.min(lastSelectable, (selectedIndex ?? firstSelectable) + direction)));
  }
  const keyboardProps = process.env.EXPO_OS === 'web' ? {
    onKeyDown: (event: { key: string; preventDefault: () => void }) => {
      if (!canInspect) return;
      if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        moveSelection(event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1);
      }
    },
  } : {};
  const drawing = <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessible={false} pointerEvents="none">
      <Defs>{lines.filter(line => line.fill).map(line => <LinearGradient key={line.metric} id={`${gradientId}-${line.metric}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={line.color} stopOpacity={0.22} />
        <Stop offset="1" stopColor={line.color} stopOpacity={0} />
      </LinearGradient>)}</Defs>
      {[0.25, 0.5, 0.75].map(position => <Line key={position} x1="0" x2={width} y1={height * position} y2={height * position} stroke={colors.border} strokeOpacity={0.45} strokeWidth="1" strokeDasharray="3 5" />)}
      {lines.map(line => {
        const elapsed = line.points.slice(0, elapsedCount);
        const first = elapsed[0];
        const last = elapsed.at(-1);
        return line.fill && elapsed.length > 1 && first && last ? <Path key={line.metric}
          d={`${path(elapsed)} L ${last.x.toFixed(2)} ${height - 8} L ${first.x.toFixed(2)} ${height - 8} Z`}
          fill={`url(#${gradientId}-${line.metric})`} /> : null;
      })}
      {previousPath ? <Path d={previousPath} fill="none" stroke={colors.chartComparison} strokeOpacity={0.55} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {lines.map(line => <Path key={line.metric} d={path(line.points.slice(0, elapsedCount))} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
      {elapsedCount > 0 && elapsedCount < count ? lines.map(line => <Path key={line.metric}
        d={path(line.points.slice(elapsedCount - 1, elapsedCount + 1))} fill="none" stroke={line.color}
        strokeWidth="2.5" strokeDasharray="4 5" strokeLinecap="butt" strokeLinejoin="round" />) : null}
      {elapsedCount === 1 ? lines.map(line => <Circle key={line.metric} cx={line.points[0].x} cy={line.points[0].y} r="4" fill={line.color} />) : null}
      {selectedIndex !== null ? <>
        <Line x1={lines[0]?.points[selectedIndex].x} x2={lines[0]?.points[selectedIndex].x} y1={0} y2={height} stroke={colors.muted} strokeWidth={1} strokeDasharray="3 4" />
        {lines.map(line => <Circle key={line.metric} cx={line.points[selectedIndex].x} cy={line.points[selectedIndex].y} r={5} fill={line.color} stroke={colors.surface} strokeWidth={2} />)}
      </> : null}
    </Svg>;
  return <View {...keyboardProps} style={styles.chart}
    onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))}>
    {canInspect ? <Pressable accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel}
      accessibilityHint={process.env.EXPO_OS === 'web' ? 'Click the chart or use arrow keys to inspect a time bucket.' : 'Tap the chart to inspect a time bucket. Swipe up or down to move between buckets.'}
      accessibilityValue={{ min: firstSelectable, max: lastSelectable, now: selectedIndex ?? firstSelectable, text: selectedSummary || 'Choose a time bucket' }}
      aria-valuemin={firstSelectable} aria-valuemax={lastSelectable} aria-valuenow={selectedIndex ?? firstSelectable}
      aria-valuetext={selectedSummary || 'Choose a time bucket'}
      accessibilityActions={[{ name: 'increment', label: 'Next time bucket' }, { name: 'decrement', label: 'Previous time bucket' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment' || nativeEvent.actionName === 'decrement') {
          moveSelection(nativeEvent.actionName === 'increment' ? 1 : -1);
        }
      }}
      onPress={event => {
        // Web click/keyboard activation does not supply RN's locationX.
        // SVG ignores pointer events so offsetX uses the chart's own bounds.
        const nativeEvent = event.nativeEvent as { locationX?: number; offsetX?: number };
        const x = nativeEvent.locationX ?? nativeEvent.offsetX;
        setSelection(typeof x === 'number' && Number.isFinite(x)
          ? Math.max(firstSelectable, Math.min(lastSelectable, Math.round(x / width * (count - 1))))
          : selectedIndex ?? firstSelectable);
      }}>
      {drawing}
    </Pressable> : <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>{drawing}</View>}
    <View style={styles.details} onLayout={event => setDetailsHeight(event.nativeEvent.layout.height)}>
    <View style={styles.axis}>{ticks.map(index => <Text key={index} style={styles.axisText}>{day ? `${String(index).padStart(2, '0')}:00` : timeLabel(points[index].time, bucket)}</Text>)}</View>
    {comparisonLabel && previousPath ? <View style={styles.legend}>
      <View style={[styles.legendSolid, { borderColor: lines[0]?.color }]} /><Text style={styles.legendText}>Today</Text>
      <View style={styles.legendPrevious} /><Text style={styles.legendText}>{comparisonLabel}</Text>
    </View> : null}
    {canInspect ? <View style={styles.inspection}>
      <Text accessibilityLiveRegion="polite" style={styles.inspectionText}>{selectedSummary || 'Tap the chart to inspect a time bucket'}</Text>
      {selectedIndex !== null && previousPath && previousValues?.[selectedIndex] != null ? <Text style={styles.axisText}>{comparisonLabel}: {formatMetricValue(previousValues[selectedIndex], series[0].metric)}</Text> : null}
    </View> : null}
    </View>
  </View>;
}

export const trafficSeries: TrendSeries[] = [
  { metric: 'pageviews' },
  { metric: 'users', fill: true },
];
export const visitorsSeries: TrendSeries[] = [{ metric: 'users', fill: true }];

const themedStyles = createThemedStyles(colors => ({
  chart: { gap: spacing.sm },
  details: { gap: spacing.sm },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  legendSolid: { width: 22, borderTopWidth: 2, borderColor: colors.accent },
  legendPrevious: { width: 22, borderTopWidth: 2, borderColor: colors.chartComparison, opacity: 0.55 },
  legendText: { color: colors.muted, fontSize: 12 },
  inspection: { minHeight: 44, gap: spacing.xs, backgroundColor: colors.secondarySurface, borderRadius: radii.control, padding: spacing.md },
  inspectionText: { ...typography.caption, color: colors.text, fontVariant: ['tabular-nums'] },
}));
