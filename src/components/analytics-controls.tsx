import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Link } from 'expo-router';
import { ChevronDown, Globe } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import type { AnalyticsDateRange } from '@/api/rybbit/date-range';

import { DateRangeSelector } from './date-range-selector';

type Props = {
  siteLabel: string;
  range: AnalyticsDateRange;
  timeZone: string;
  disabled?: boolean;
  onRangeChange: (range: AnalyticsDateRange) => void;
};

export function SiteSwitcher({ siteLabel, navbar = false, width }: { siteLabel: string; navbar?: boolean; width?: number }) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <Link href="/sites" push asChild><Pressable accessibilityRole="button"
    accessibilityLabel={`Switch site. Current site: ${siteLabel}`} style={navbar ? { ...styles.siteButton, flex: 0, width } : styles.siteButton}>
    <Globe size={17} color={colors.accent} accessible={false} />
    <Text numberOfLines={1} style={[styles.siteText, navbar && { color: colors.text, fontWeight: '600' }]}>{siteLabel}</Text>
    <ChevronDown size={16} color={colors.muted} accessible={false} />
  </Pressable></Link>;
}

export function AnalyticsControls({ siteLabel, range, timeZone, disabled = false, onRangeChange }: Props) {
  const siteControl = <SiteSwitcher siteLabel={siteLabel} />;
  return <DateRangeSelector value={range} timeZone={timeZone} disabled={disabled} leadingControl={siteControl} onChange={onRangeChange} />;
}

const themedStyles = createThemedStyles(colors => ({
  siteButton: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 8, minHeight: 44 },
  siteText: { flexShrink: 1, color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
}));
