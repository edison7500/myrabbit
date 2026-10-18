import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Pressable, Text } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { Surface } from '@/components/analytics-ui';

type Props = { message?: string; onRetry?: () => void };
function State({ title, message, onRetry }: Props & { title: string }) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <Surface style={styles.state}>
    <Text accessibilityRole={title === 'Unable to load data' ? 'alert' : 'header'} style={styles.title}>{title}</Text>
    {message ? <Text selectable style={styles.message}>{message}</Text> : null}
    {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
      <Text style={{ color: colors.accent, fontWeight: '600' }}>Try again</Text>
    </Pressable> : null}
  </Surface>;
}
export function LoadingState({ message, variant = 'list' }: { message?: string; variant?: 'cards' | 'chart' | 'list' | 'realtime' | 'sites' | 'summary' }) {
  return <LoadingSkeleton variant={variant} label={message || 'Loading content'} />;
}
export function ErrorState({ message, onRetry }: Props) { return <State title="Unable to load data" message={message} onRetry={onRetry} />; }
export function EmptyState({ message = 'No data is available yet.' }: Props) { return <State title="No data yet" message={message} />; }

const themedStyles = createThemedStyles(colors => ({
  state: { padding: spacing.xxl, gap: spacing.md, alignItems: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  message: { ...typography.label, color: colors.muted, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: colors.accentSurface, borderRadius: radii.pill },
}));
