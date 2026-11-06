import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { AnalyticsFilter } from '@/api/rybbit/analytics-context';
import { useTheme } from '@/stores/theme';

export function AnalyticsFilterBar({ filters = [], onChange }: {
  filters?: readonly AnalyticsFilter[];
  onChange?: (filters: readonly AnalyticsFilter[]) => void;
}) {
  const { colors } = useTheme();
  if (!filters.length) return null;
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Filters · applies to Dashboard and Explore</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {filters.map((filter, index) => {
        const label = `${filter.parameter === 'referrer' ? 'Source' : filter.parameter === 'browser' ? 'Browser' : filter.parameter}: ${filter.value.join(', ') || 'Empty'}`;
        return <Pressable key={`${filter.parameter}-${index}`} accessibilityRole="button" accessibilityLabel={`Remove filter ${label}`}
          disabled={!onChange} onPress={() => onChange?.(filters.filter((_, position) => position !== index))}
          style={{ minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.accentSurface }}>
          <Text numberOfLines={2} style={{ flexShrink: 1, color: colors.accent, fontSize: 13 }}>{label}</Text>
          <X size={14} color={colors.accent} accessible={false} />
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" disabled={!onChange} onPress={() => onChange?.([])}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}>
        <Text style={{ color: colors.accent, fontSize: 13 }}>Clear all</Text>
      </Pressable>
    </View>
  </View>;
}
