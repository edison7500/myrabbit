import { createThemedStyles } from '@/constants/themed-styles';
import { useSession } from '@/stores/session';
import { useTheme } from '@/stores/theme';
import { Link } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import type { AnalyticsFilter } from '@/api/rybbit/analytics-context';
import { AnalyticsFilterBar } from './analytics-filter-bar';
import type { AnalyticsDateRange } from '@/api/rybbit/date-range';

import { DateRangeSelector } from './date-range-selector';
import { SiteIcon } from './site-icon';

type Props = {
  siteLabel: string;
  range: AnalyticsDateRange;
  timeZone: string;
  disabled?: boolean;
  onRangeChange: (range: AnalyticsDateRange) => void;
  filters?: readonly AnalyticsFilter[];
  onFiltersChange?: (filters: readonly AnalyticsFilter[]) => void;
};

export function SiteSwitcher({ siteLabel, navbar = false, width }: { siteLabel: string; navbar?: boolean; width?: number }) {
  const { colors, scheme } = useTheme();
  const { serverUrl, site } = useSession();
  const styles = themedStyles[scheme];
  return <Link href="/sites" push asChild><Pressable accessibilityRole="button"
    accessibilityLabel={`Switch site. Current site: ${siteLabel}`} style={navbar ? { ...styles.siteButton, flex: 0, width } : styles.siteButton}>
    <SiteIcon serverUrl={serverUrl} domain={site?.domain} size={17} />
    <Text numberOfLines={1} style={[styles.siteText, navbar && { color: colors.text, fontWeight: '600' }]}>{siteLabel}</Text>
    <ChevronDown size={16} color={colors.muted} accessible={false} />
  </Pressable></Link>;
}

export function AnalyticsControls({ siteLabel, range, timeZone, disabled = false, onRangeChange, filters, onFiltersChange }: Props) {
  const siteControl = <SiteSwitcher siteLabel={siteLabel} />;
  return <View style={{ gap: 12 }}><DateRangeSelector value={range} timeZone={timeZone} disabled={disabled} leadingControl={siteControl} onChange={onRangeChange} />
    <AnalyticsFilterBar filters={filters} onChange={onFiltersChange} />
  </View>;
}

const themedStyles = createThemedStyles(colors => ({
  siteButton: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 8, minHeight: 44 },
  siteText: { flexShrink: 1, color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
}));
