import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Link } from 'expo-router';
import { ArrowLeftRight, ChevronRight, KeyRound } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii } from '@/constants/theme';

// Expo UI's web ListItem uses system colors and omits interactive roles.
// Keep the app appearance and semantic links in the browser preview.
export function ConnectionActions() {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <View style={styles.group}>
    <Link href="/sites" push asChild><Pressable style={styles.row}>
      <ArrowLeftRight size={20} color={colors.accent} aria-hidden />
      <Text style={styles.label}>Switch site</Text><ChevronRight size={16} color={colors.muted} aria-hidden />
    </Pressable></Link>
    <View style={styles.separator} />
    <Link href="/connect" push asChild><Pressable style={styles.row}>
      <KeyRound size={20} color={colors.accent} aria-hidden />
      <Text style={styles.label}>Connection setup</Text><ChevronRight size={16} color={colors.muted} aria-hidden />
    </Pressable></Link>
  </View>;
}
const themedStyles = createThemedStyles(colors => ({
  group: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  label: { flex: 1, color: colors.text, fontSize: 17 },
  separator: { marginLeft: 50, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
}));
