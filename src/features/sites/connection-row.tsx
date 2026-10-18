import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Settings2, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

type Props = { serverUrl: string; disabled: boolean; removing: boolean; onEdit: () => void; onRemove: () => void };

export function ConnectionRow({ serverUrl, disabled, removing, onEdit, onRemove }: Props) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const row = useRef<SwipeableMethods>(null);
  const [open, setOpen] = useState(false);
  function remove() {
    row.current?.close();
    if (!disabled) onRemove();
  }
  return <Swipeable ref={row} enabled={!disabled} overshootRight={false} overshootLeft={false}
    enableTrackpadTwoFingerGesture rightThreshold={48} containerStyle={styles.container}
    onSwipeableWillOpen={() => setOpen(true)} onSwipeableClose={() => setOpen(false)}
    renderRightActions={() => <View accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
      <Pressable accessibilityRole="button" accessibilityLabel="Remove saved connection" disabled={disabled}
        onPress={remove} style={styles.remove}>
        <Trash2 size={22} color={colors.onDestructive} accessible={false} /><Text style={styles.removeLabel}>Remove</Text>
      </Pressable>
    </View>}>
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit saved connection for ${serverUrl}`}
        accessibilityHint="Swipe left to remove the saved API URL and API key from this device. Server data is kept."
        accessibilityActions={[{ name: 'delete', label: 'Remove saved connection' }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'delete') remove(); }}
        disabled={disabled} onPress={() => { if (open) row.current?.close(); else onEdit(); }} style={styles.main}>
        <Settings2 size={22} color={colors.accent} accessible={false} />
        <View style={styles.details}><Text style={styles.label}>Saved connection</Text><Text style={styles.url}>{serverUrl}</Text></View>
        {removing ? <ActivityIndicator color={colors.accent} accessibilityLabel="Removing connection" /> : null}
      </Pressable>
      {Platform.OS === 'web' ? <Pressable accessibilityRole="button" accessibilityLabel="Remove saved connection"
        disabled={disabled} onPress={remove} style={styles.webRemove}><Trash2 size={20} color={colors.danger} accessible={false} /></Pressable> : null}
    </View>
  </Swipeable>;
}

const themedStyles = createThemedStyles(colors => ({
  container: { borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 64 },
  details: { flex: 1, gap: 6 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  url: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  remove: { flex: 1, minWidth: 96, paddingHorizontal: 16, minHeight: 48, gap: 6, backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center' },
  removeLabel: { color: colors.onDestructive, fontSize: 15, fontWeight: '600' },
  webRemove: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
}));
