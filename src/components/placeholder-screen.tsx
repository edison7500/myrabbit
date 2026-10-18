import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { ChartNoAxesCombined } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { radii } from '@/constants/theme';

type Props = { title: string; description: string };

export function PlaceholderScreen({ title, description }: Props) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  return (
    <Screen tabScreen navigationHeader title={title} description={description}>
      <View style={styles.card}>
        <View style={styles.icon}><ChartNoAxesCombined size={28} color={colors.accent} accessible={false} /></View>
        <Text style={styles.title}>{title} is coming soon</Text>
        <Text style={styles.body}>More ways to understand your audience are on the way. Your daily metrics are available in Dashboard.</Text>
      </View>
    </Screen>
  );
}

const themedStyles = createThemedStyles(colors => ({
  card: { padding: 28, gap: 16, backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous' },
  icon: { backgroundColor: colors.accentSurface, width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted },
}));
