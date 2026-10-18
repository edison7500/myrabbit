import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import type { PropsWithChildren, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';

export function Surface({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function SectionHeading({ title, icon: Icon, onPress, accessibilityLabel }: {
  title: string; icon?: LucideIcon; onPress?: () => void; accessibilityLabel?: string;
}) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const content = <>
    {Icon ? <Icon size={20} strokeWidth={1.8} color={colors.muted} accessible={false} /> : null}
    <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
    {onPress ? <ChevronRight size={18} color={colors.muted} accessible={false} /> : null}
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    onPress={onPress} style={({ pressed }) => [styles.heading, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={styles.heading}>{content}</View>;
}

export function MetricCard({ label, value, trend, onPress, accessibilityLabel, singleColumn = false }: {
  label: string; value: string; trend?: ReactNode; singleColumn?: boolean; onPress?: () => void; accessibilityLabel?: string;
}) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const content = <>
    <View style={styles.metricHeader}><Text style={styles.label}>{label}</Text>
      {onPress ? <ChevronRight size={16} color={colors.muted} accessible={false} /> : null}</View>
    <Text selectable style={styles.value}>{value}</Text>
    {trend}
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
    style={({ pressed }) => [styles.metric, singleColumn && styles.singleColumn, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={[styles.metric, singleColumn && styles.singleColumn]}>{content}</View>;
}

const themedStyles = createThemedStyles(colors => ({
  surface: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radii.card, borderCurve: 'continuous' },
  heading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionTitle: { ...typography.section, flex: 1, color: colors.text },
  pressed: { opacity: 0.7 },
  metric: { flexGrow: 1, flexBasis: '45%', minWidth: 130, minHeight: 142, backgroundColor: colors.surface,
    padding: spacing.lg, gap: spacing.md, borderRadius: radii.card, borderCurve: 'continuous' },
  singleColumn: { flexBasis: 'auto' },
  metricHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  label: { ...typography.label, flex: 1, color: colors.muted },
  value: { ...typography.metric, color: colors.text },
}));
