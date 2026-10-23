import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Host, Picker } from '@expo/ui';
import { CalendarDays } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import {
  analyticsDateLabels,
  analyticsDatePresets,
  dateRangeLabel,
  isValidCustomRange,
  type AnalyticsDateRange,
} from '@/api/rybbit/date-range';

type Props = { value: AnalyticsDateRange; timeZone: string; disabled?: boolean; leadingControl?: ReactNode; navbar?: boolean; onCustomRequest?: () => void; onChange: (range: AnalyticsDateRange) => void };

const compactLabels = {
  ...analyticsDateLabels,
  'last-30-minutes': 'Last 30m',
  'last-24-hours': 'Last 24h',
  'last-7-days': 'Last 7d',
  'last-30-days': 'Last 30d',
  custom: 'Custom',
};

function today(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function DateRangeSelector({ value, timeZone, disabled = false, leadingControl, navbar = false, onCustomRequest, onChange }: Props) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { width, height, fontScale } = useWindowDimensions();
  const landscape = width > height;
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const selection = customOpen ? 'custom' : value.preset;

  return <View style={styles.container}>
    <View style={[styles.toolbar, !navbar && fontScale > 1.3 && styles.stackedToolbar]}>
      {leadingControl}
      <View accessibilityLabel={`Date range: ${dateRangeLabel(value)}`} style={[styles.selector, !navbar && landscape && styles.landscapeSelector, navbar && styles.navbarSelector, navbar && process.env.EXPO_OS === 'ios' && { backgroundColor: 'transparent', minHeight: 44 }]}>
        <CalendarDays size={17} color={colors.accent} accessible={false} />
        <Host key={landscape ? 'landscape' : 'portrait'} matchContents={{ vertical: true }} colorScheme={scheme} seedColor={colors.accent} style={styles.host}>
          <Picker selectedValue={selection} enabled={!disabled} onValueChange={(preset: AnalyticsDateRange['preset']) => {
            if (preset === 'custom') { if (onCustomRequest) onCustomRequest(); else setCustomOpen(true); }
            else {
              setCustomOpen(false);
              onChange({ preset });
            }
          }}>
            {analyticsDatePresets.map(preset => <Picker.Item key={preset} label={compactLabels[preset]} value={preset} />)}
            <Picker.Item label={compactLabels.custom} value="custom" />
          </Picker>
        </Host>
      </View>
    </View>
    {customOpen && !onCustomRequest ? <CustomDateRangeForm value={value} timeZone={timeZone} disabled={disabled} onChange={onChange} /> : null}
  </View>;
}

export function CustomDateRangeForm({ value, timeZone, disabled = false, onChange }: Pick<Props, 'value' | 'timeZone' | 'disabled' | 'onChange'>) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { fontScale } = useWindowDimensions();
  const [startDate, setStartDate] = useState(value.preset === 'custom' ? value.startDate : today(timeZone));
  const [endDate, setEndDate] = useState(value.preset === 'custom' ? value.endDate : today(timeZone));
  const valid = isValidCustomRange(startDate, endDate);
  return <View style={styles.custom}>
      <Text style={styles.help}>Custom dates are inclusive and use your analytics timezone.</Text>
      <View style={[styles.dateRow, fontScale > 1.3 && styles.stackedDates]}>
        <View style={styles.field}><Text style={styles.label}>Start</Text><TextInput accessibilityLabel="Start date" value={startDate}
          onChangeText={setStartDate} editable={!disabled} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} selectionColor={colors.accent} keyboardAppearance={scheme} autoCapitalize="none" autoCorrect={false} style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.label}>End</Text><TextInput accessibilityLabel="End date" value={endDate}
          onChangeText={setEndDate} editable={!disabled} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} selectionColor={colors.accent} keyboardAppearance={scheme} autoCapitalize="none" autoCorrect={false} style={styles.input} /></View>
      </View>
      {!valid ? <Text accessibilityRole="alert" style={styles.error}>Enter valid dates with the start on or before the end.</Text> : null}
      <Pressable accessibilityRole="button" disabled={disabled || !valid} onPress={() => onChange({ preset: 'custom', startDate, endDate })}
        style={[styles.apply, (disabled || !valid) && { opacity: 0.4 }]}><Text style={styles.applyText}>Apply range</Text></Pressable>
    </View>;
}

const themedStyles = createThemedStyles(colors => ({
  container: { alignSelf: 'stretch', gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stackedToolbar: { flexDirection: 'column', alignItems: 'flex-start' },
  selector: { width: 154, minHeight: 44, flexDirection: 'row', alignItems: 'center', flexShrink: 0, paddingLeft: 12, backgroundColor: colors.accentSurface, borderRadius: 999 },
  landscapeSelector: { width: 190 },
  navbarSelector: { width: 136, minHeight: 40, paddingLeft: 8 },
  host: { flex: 1 },
  custom: { backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 16, gap: 12 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  dateRow: { flexDirection: 'row', gap: 12 },
  stackedDates: { flexDirection: 'column' },
  field: { flex: 1, gap: 6 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.secondarySurface, color: colors.text, fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  apply: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.accent },
  applyText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },
}));
