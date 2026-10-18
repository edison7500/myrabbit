import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Link2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import type { BreakdownPage } from '@/api/rybbit/breakdown';
import { LoadingSkeleton } from '@/components/loading-skeleton';

import { SectionHeading } from '@/components/analytics-ui';
import { RankedRow } from './ranked-list';

export function ReferrersHeading({ onOpen }: { onOpen: () => void }) {
  return <SectionHeading title="Referrers" icon={Link2} accessibilityLabel="See all referrers" onPress={onOpen} />;
}

export function ReferrersPreview({ page, loading, error, onRetry, onOpen, showHeader = true }: {
  page: BreakdownPage | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpen: () => void;
  showHeader?: boolean;
}) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const items = page?.items.slice(0, 5) ?? [];
  const ratio = items[0]?.percentage ? 100 / items[0].percentage : 1;
  return <View style={styles.section}>
    {showHeader ? <ReferrersHeading onOpen={onOpen} /> : null}
    <Text style={styles.description}>Where sessions came from</Text>
    {loading && !page ? <LoadingSkeleton variant="list" label="Loading referrers preview" /> : null}
    {error ? <View style={styles.state}>
      <Text accessibilityRole="alert" style={styles.stateText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try referrers again</Text></Pressable>
    </View> : null}
    {!loading && !error && page && items.length === 0 ? <Text style={styles.stateText}>No attributed referrers for this range.</Text> : null}
    {items.length ? <View style={styles.rows}>
      {items.map(item => <RankedRow key={item.value} item={item} label={item.value} ratio={ratio} />)}
    </View> : null}
  </View>;
}

const themedStyles = createThemedStyles(colors => ({
  section: { gap: 12 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  rows: { gap: 10 },
  state: { minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 4 },
  stateText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
}));
