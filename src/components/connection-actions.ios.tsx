import { useTheme } from '@/stores/theme';
import { Column, Host, ListItem } from '@expo/ui';
import { Divider } from '@expo/ui/swift-ui';
import { frame, padding } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, ChevronRight, KeyRound } from 'lucide-react-native';

import { radii } from '@/constants/theme';

const rowModifiers = [padding({ horizontal: 16, vertical: 14 }), frame({ minHeight: 52 })];

export function ConnectionActions() {
  const { colors, scheme } = useTheme();
  const router = useRouter();

  // The page owns scrolling. A SwiftUI List here creates a second scroll viewport
  // whose insets and fixed height can clip the rows above the privacy note.
  return (
    <Host colorScheme={scheme} seedColor={colors.accent} matchContents={{ vertical: true }} ignoreSafeArea="all" style={{ alignSelf: 'stretch' }}>
      <Column spacing={0} style={{ backgroundColor: colors.surface, borderRadius: radii.card }}>
        <ListItem onPress={() => router.push('/sites')} modifiers={rowModifiers}
          leading={<ArrowLeftRight size={20} color={colors.accent} accessible={false} />}
          trailing={<ChevronRight size={16} color={colors.muted} accessible={false} />}>Switch site</ListItem>
        <Divider modifiers={[padding({ leading: 48, trailing: 16 })]} />
        <ListItem onPress={() => router.push('/connect')} modifiers={rowModifiers}
          leading={<KeyRound size={20} color={colors.accent} accessible={false} />}
          trailing={<ChevronRight size={16} color={colors.muted} accessible={false} />}>Connection setup</ListItem>
      </Column>
    </Host>
  );
}
