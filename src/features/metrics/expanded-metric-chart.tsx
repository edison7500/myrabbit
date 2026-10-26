import { useState, type ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { createThemedStyles } from '@/constants/themed-styles';
import { radii } from '@/constants/theme';
import { TrendChart } from '@/features/overview/traffic-chart';
import { useTheme } from '@/stores/theme';

type Props = { title: string; chart: ComponentProps<typeof TrendChart>; onClose: () => void };

export function ExpandedMetricChart(props: Props) {
  // Native presentation and device rotation animate on the platform UI thread.
  // A fade also keeps the transition gentle when Reduce Motion is enabled.
  return <Modal visible animationType="fade" presentationStyle="fullScreen" supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={props.onClose}>
    <SafeAreaProvider><ExpandedChartContent {...props} /></SafeAreaProvider>
  </Modal>;
}

export function ExpandedChartContent({ title, chart, onClose }: Props) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const [chartHeight, setChartHeight] = useState(0);
  const insets = useSafeAreaInsets();

  return <View style={styles.root}>
    <View style={[styles.panel, {
      paddingTop: insets.top + 8, paddingRight: insets.right + 16,
      paddingBottom: insets.bottom + 8, paddingLeft: insets.left + 16,
    }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title} trend</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close expanded chart" onPress={onClose}
          hitSlop={4} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <X size={24} color={colors.text} strokeWidth={2} accessible={false} />
        </Pressable>
      </View>
      <View style={styles.card}>
        <View style={styles.viewport} onLayout={({ nativeEvent: { layout } }) => setChartHeight(layout.height)}>
          <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.chartContent}>
            <TrendChart {...chart} availableHeight={chartHeight} />
          </ScrollView>
        </View>
      </View>
    </View>
  </View>;
}

const themedStyles = createThemedStyles(colors => ({
  root: { flex: 1, backgroundColor: colors.background },
  panel: { flex: 1, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 0, minHeight: 48 },
  title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderRadius: 24 },
  pressed: { opacity: 0.6 },
  card: { flex: 1, minHeight: 0, backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', padding: 12 },
  viewport: { flex: 1, minHeight: 0 },
  chartContent: { flexGrow: 1 },
}));
