import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

export function TabBarBackground() {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setReduceTransparency(value); }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  if (reduceTransparency || !isGlassEffectAPIAvailable() || !isLiquidGlassAvailable()) {
    return <View style={[StyleSheet.absoluteFill, styles.fallback]} />;
  }

  return <GlassView colorScheme={scheme} glassEffectStyle="regular" style={[StyleSheet.absoluteFill, styles.glass]} />;
}

const themedStyles = createThemedStyles(colors => ({
  fallback: { backgroundColor: colors.surface, borderRadius: 34, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  glass: { borderRadius: 34 },
}));
