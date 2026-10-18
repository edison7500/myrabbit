import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import type { ReactElement, ReactNode } from 'react';
import { Globe } from 'lucide-react-native';
import { FlatList, Text, View } from 'react-native';

import type { BreakdownItem } from '@/api/rybbit/breakdown';
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
};

export function RankedRow({ item, label, ratio }: { item: BreakdownItem; label: string; ratio: number }) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const barWidth = Math.min(100, item.percentage * ratio);
  return <View accessible accessibilityLabel={`${label}, ${item.count.toLocaleString()} sessions`} style={styles.row}>
    <View style={styles.rowContent}>
      <View accessible={false} style={styles.sourceIcon}><Globe size={17} strokeWidth={1.8} color={colors.accent} accessible={false} /></View>
      <Text selectable numberOfLines={2} style={styles.label}>{label}</Text>
      <Text selectable accessibilityLabel={`${item.count.toLocaleString()} sessions`} style={styles.count}>{item.count.toLocaleString()}</Text>
    </View>
    <View accessible={false} style={styles.barTrack}>
      <View accessible={false} style={[styles.bar, { width: `${barWidth}%` }]} />
    </View>
  </View>;
}

export function RankedList({ items, getLabel, header, empty, footer, refreshing, onRefresh, onEndReached }: Props) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const ratio = items[0]?.percentage ? 100 / items[0].percentage : 1;
  return <FlatList
    data={items}
    keyExtractor={item => item.value}
    renderItem={({ item }) => <RankedRow item={item} label={getLabel(item)} ratio={ratio} />}
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
  sourceIcon: { width: 32, height: 32, borderRadius: 10, borderCurve: 'continuous',
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSurface },
  barTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.accentSurface },
  bar: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
  label: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  count: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  separator: { height: spacing.md },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
}));
