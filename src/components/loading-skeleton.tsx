import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { radii } from '@/constants/theme';

type Variant = 'cards' | 'chart' | 'list' | 'realtime' | 'sites' | 'summary';

const pulse = { from: { opacity: 1 }, to: { opacity: 0.48 } } as const;

function Block({ width, height = 14, radius = 8 }: { width: number | `${number}%`; height?: number; radius?: number }) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <View style={[styles.block, { width, height, borderRadius: radius }]} />;
}

function Card() {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <View style={styles.card}>
    <Block width="65%" />
    <Block width="50%" height={32} />
    <Block width="40%" height={12} />
  </View>;
}

function Row({ site = false }: { site?: boolean }) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  return <View style={styles.row}>
    <Block width={site ? 44 : 32} height={site ? 44 : 32} radius={12} />
    <View style={styles.rowCopy}><Block width="64%" height={16} /><Block width="42%" height={11} /></View>
    <Block width={20} height={16} />
  </View>;
}

export function LoadingSkeleton({ variant = 'list', label = 'Loading content' }: { variant?: Variant; label?: string }) {
  const { scheme } = useTheme();
  const styles = themedStyles[scheme];
  const reducedMotion = useReducedMotion();
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.container}>
    <Animated.View accessible={false} importantForAccessibility="no-hide-descendants"
      style={[styles.content, !reducedMotion && {
        animationName: pulse,
        animationDuration: 1100,
        animationDirection: 'alternate',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
      }]}>
      {variant === 'cards' ? <View style={styles.grid}>{Array.from({ length: 6 }, (_, index) => <Card key={index} />)}</View> : null}
      {variant === 'summary' ? <><View style={styles.summary}><Block width="35%" height={38} /><Block width="24%" height={18} /></View><View style={styles.chartCard}><Block width="100%" height={160} radius={12} /></View></> : null}
      {variant === 'chart' ? <View style={styles.chartCard}><Block width="100%" height={210} radius={12} /><View style={styles.axis}><Block width="15%" height={11} /><Block width="15%" height={11} /></View></View> : null}
      {variant === 'list' || variant === 'realtime' || variant === 'sites' ? Array.from({ length: variant === 'sites' ? 3 : 5 }, (_, index) => <Row key={index} site={variant === 'sites'} />) : null}
    </Animated.View>
  </View>;
}

const themedStyles = createThemedStyles(colors => ({
  container: { width: '100%' },
  content: { gap: 10 },
  block: { backgroundColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: '45%', minWidth: 130, minHeight: 142, padding: 20, gap: 14, justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous' },
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  chartCard: { padding: 16, gap: 14, backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderRadius: 18, borderCurve: 'continuous' },
  rowCopy: { flex: 1, gap: 9 },
}));
