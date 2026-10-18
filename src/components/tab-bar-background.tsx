import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { StyleSheet, View } from 'react-native';

export function TabBarBackground() {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <View style={[StyleSheet.absoluteFill, styles.background]} />;
}

const themedStyles = createThemedStyles(colors => ({
  background: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderRadius: 34,
    borderWidth: 1,
  },
}));
