import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { Site } from '@/api/rybbit/client';
import { SiteIcon } from '@/components/site-icon';
import { radii, spacing, typography } from '@/constants/theme';

type Props = {
  site: Site;
  serverUrl: string;
  current: boolean;
  disabled: boolean;
  selecting: boolean;
  onSelect: () => void;
};

export function SiteRow({ site, serverUrl, current, disabled, selecting, onSelect }: Props) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open dashboard for ${site.name}`}
    disabled={disabled} onPress={onSelect} style={({ pressed }) => [styles.card, current && styles.currentCard, (pressed || disabled) && { opacity: 0.65 }]}>
    <View style={styles.siteIcon}><SiteIcon serverUrl={serverUrl} domain={site.domain} size={22} /></View>
    <View style={styles.details}>
      <Text style={styles.name}>{site.name}</Text>
      <Text style={styles.body}>{site.domain}</Text>
      <Text style={styles.body}>{site.organization}{current ? ' · Current site' : ''}</Text>
    </View>
    {selecting ? <ActivityIndicator color={colors.accent} accessibilityLabel="Opening site" /> : <ChevronRight size={20} color={colors.muted} accessible={false} />}
  </Pressable>;
}

const themedStyles = createThemedStyles(colors => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', borderWidth: 1, borderColor: 'transparent' },
  currentCard: { borderColor: colors.accent, backgroundColor: colors.accentSurface },
  details: { flex: 1, gap: 6 },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
  body: { ...typography.label, color: colors.muted },
  siteIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSurface, alignItems: 'center', justifyContent: 'center' },
}));
