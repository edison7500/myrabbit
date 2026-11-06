import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import type { ReactElement, ReactNode } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import type { BreakdownItem } from '@/api/rybbit/breakdown';
import { AnalyticsItemIcon } from '@/components/analytics-item-icon';
import { layout, radii, spacing } from '@/constants/theme';

type Props = {
  items: readonly BreakdownItem[];
  getLabel: (item: BreakdownItem) => string;
  header: ReactElement;
  empty: ReactElement | null;
  footer: ReactElement | null;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  onSelect?: (value: string) => void;
};

export function RankedRow({ item, label, ratio, onSelect }: { item: BreakdownItem; label: string; ratio: number; onSelect?: (value: string) => void }) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const barWidth = Math.min(100, item.percentage * ratio);
  const Container = onSelect ? Pressable : View;
  return <Container accessible accessibilityRole={onSelect ? 'button' : undefined} accessibilityHint={onSelect ? 'Filter analytics by this source' : undefined}
    onPress={onSelect ? () => onSelect(item.value) : undefined} accessibilityLabel={`${label}, ${item.count.toLocaleString()} sessions`} style={styles.row}>
    <View style={styles.rowContent}>
      <AnalyticsItemIcon kind="referrer" value={item.value} />
      <Text selectable={!onSelect} numberOfLines={2} style={styles.label}>{label}</Text>
      <Text selectable={!onSelect} accessibilityLabel={`${item.count.toLocaleString()} sessions`} style={styles.count}>{item.count.toLocaleString()}</Text>
    </View>
    <View accessible={false} style={styles.barTrack}>
      <View accessible={false} style={[styles.bar, { width: `${barWidth}%` }]} />
    </View>
  </Container>;
}

export function RankedList({ items, getLabel, header, empty, footer, refreshing, onRefresh, onEndReached, onSelect }: Props) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const ratio = items[0]?.percentage ? 100 / items[0].percentage : 1;
  return <FlatList
    data={items}
    keyExtractor={item => item.value}
    renderItem={({ item }) => <RankedRow item={item} label={getLabel(item)} ratio={ratio} onSelect={onSelect} />}
    ItemSeparatorComponent={() => <View style={styles.separator} />}
    ListHeaderComponent={header}
    ListEmptyComponent={empty}
    ListFooterComponent={footer}
    refreshing={refreshing}
    onRefresh={onRefresh}
    onEndReached={onEndReached}
    onEndReachedThreshold={0.35}
    alwaysBounceVertical
    contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={styles.content}
  />;
}

export function RankedListMessage({ children }: { children: ReactNode }) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <Text selectable style={styles.message}>{children}</Text>;
}

const themedStyles = createThemedStyles(colors => ({
  content: { flexGrow: 1, width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', padding: layout.screenPadding, paddingBottom: 36 },
  row: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radii.card, borderCurve: 'continuous',
    backgroundColor: colors.surface, gap: 9 },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.accentSurface },
  bar: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
  label: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  count: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  separator: { height: spacing.md },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
}));
