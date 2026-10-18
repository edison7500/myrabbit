import { useTheme } from '@/stores/theme';
import { Host, List, ListItem } from '@expo/ui';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, ChevronRight, KeyRound } from 'lucide-react-native';

export function ConnectionActions() {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  return <Host colorScheme={scheme} seedColor={colors.accent} style={{ alignSelf: 'stretch', marginHorizontal: process.env.EXPO_OS === 'ios' ? -16 : 0, height: 164 }}>
    <List>
      <ListItem onPress={() => router.push('/sites')}
        leading={<ArrowLeftRight size={20} color={colors.accent} accessible={false} />}
        trailing={<ChevronRight size={16} color={colors.muted} accessible={false} />}>Switch site</ListItem>
      <ListItem onPress={() => router.push('/connect')}
        leading={<KeyRound size={20} color={colors.accent} accessible={false} />}
        trailing={<ChevronRight size={16} color={colors.muted} accessible={false} />}>Connection setup</ListItem>
    </List>
  </Host>;
}
