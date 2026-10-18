import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { ShieldCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useSession } from '@/stores/session';
import { ConnectionActions } from '@/components/connection-actions';
import { Surface } from '@/components/analytics-ui';
import { Screen } from '@/components/screen';
import { spacing } from '@/constants/theme';
import { SiteIcon } from '@/features/settings/site-icon';
import { AppearanceSettings } from '@/features/settings/appearance-settings';

export default function SettingsScreen() {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { serverUrl, site } = useSession();
  return (
    <Screen tabScreen navigationHeader title="Settings" description="Your sites. Your connection. Your control.">
      <Surface style={styles.card}>
        <View style={styles.icon}><SiteIcon serverUrl={serverUrl} domain={site?.domain} /></View>
        <View style={styles.details}>
          <Text style={styles.title}>{site?.name ?? 'Rybbit connection'}</Text>
          <Text selectable style={styles.body}>{serverUrl}</Text>
        </View>
      </Surface>
      <View style={styles.group}>
        <Text style={styles.label}>CONNECTION</Text>
        <ConnectionActions />
      </View>
      <AppearanceSettings />
      <View style={styles.privacy}>
        <ShieldCheck size={20} color={colors.muted} accessible={false} />
        <Text style={[styles.body, { flex: 1 }]}>Your app connects directly to Rybbit. Your credentials and analytics never pass through a MyRabbit server.</Text>
      </View>
    </Screen>
  );
}

const themedStyles = createThemedStyles(colors => ({
  card: { padding: spacing.xl, gap: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 52, height: 52, backgroundColor: colors.accentSurface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 6 },
  title: { color: colors.text, fontSize: 20, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  group: { gap: 8 },
  label: { color: colors.muted, fontSize: 13, paddingHorizontal: 16 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16 },
}));
