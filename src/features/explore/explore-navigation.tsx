import { useTheme } from '@/stores/theme';
import { BottomSheet, Host, RNHostView } from '@expo/ui';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { AnalyticsDateRange } from '@/api/rybbit/date-range';
import { SiteSwitcher } from '@/components/analytics-controls';
import { CustomDateRangeForm, DateRangeSelector } from '@/components/date-range-selector';

import { siteHeading } from '@/features/overview/overview-state';
import { useSession } from '@/stores/session';

export function ExploreNavigation({ disabled, onRangeChange }: { disabled: boolean; onRangeChange: (range: AnalyticsDateRange) => void }) {
  const { colors, scheme } = useTheme();
  const navigation = useNavigation('/');
  const { site, dateRange, timeZone } = useSession();
  const { width } = useWindowDimensions();
  const [customOpen, setCustomOpen] = useState(false);
  const label = siteHeading(site);
  useFocusEffect(useCallback(() => {
    const title = () => <SiteSwitcher siteLabel={label} navbar width={Math.min(260, Math.max(90, width - 184))} />;
    const date = () => <DateRangeSelector value={dateRange} timeZone={timeZone} disabled={disabled} navbar
      onCustomRequest={() => setCustomOpen(true)} onChange={onRangeChange} />;
    navigation.setOptions({ headerTitle: title, headerRight: date,
      unstable_headerRightItems: () => [{ type: 'custom', element: date(), hidesSharedBackground: true }],
    });
    return () => navigation.setOptions({ headerTitle: undefined, headerRight: undefined, unstable_headerRightItems: undefined });
  }, [dateRange, disabled, label, navigation, onRangeChange, timeZone, width]));

  return <Host colorScheme={scheme} seedColor={colors.accent} style={{ position: 'absolute' }}>
    <BottomSheet isPresented={customOpen} onDismiss={() => setCustomOpen(false)} snapPoints={['half', 'full']}
      containerColor={colors.background} contentPadding={20}>
      <RNHostView matchContents>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ width: Math.max(1, width - 40) }}>
          <View style={{ gap: 16, paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>Custom dates</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close custom dates" onPress={() => setCustomOpen(false)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>Done</Text>
              </Pressable>
            </View>
            {customOpen ? <CustomDateRangeForm value={dateRange} timeZone={timeZone} disabled={disabled}
              onChange={range => { setCustomOpen(false); onRangeChange(range); }} /> : null}
          </View>
        </ScrollView>
      </RNHostView>
    </BottomSheet>
  </Host>;
}
