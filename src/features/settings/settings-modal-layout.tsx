import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { useNavigation, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { X } from 'lucide-react-native';
import { ActivityIndicator, Pressable } from 'react-native';

import { useSession } from '@/stores/session';

export default function SettingsModalLayout() {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const { ready, site } = useSession();
  const parent = useNavigation('/');
  const router = useRouter();
  if (!ready) return <ActivityIndicator accessibilityLabel="Loading connection" />;

  function close() {
    if (site && parent.canGoBack()) parent.goBack();
    else router.dismissTo('/');
  }

  return <>
    <Stack.Screen options={{ gestureEnabled: site !== null }} />
    <Stack screenOptions={{
      presentation: 'card',
      headerStyle: { backgroundColor: colors.background },
      contentStyle: { backgroundColor: colors.background },
      headerTintColor: colors.accent,
      headerTitleStyle: { color: colors.text },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Close settings"
        onPress={close} style={({ pressed }) => [styles.close, pressed && { opacity: 0.65 }]}>
        <X size={20} color={colors.muted} accessible={false} />
      </Pressable>,
    }}>
      <Stack.Screen name="connect" options={{ title: 'Connection setup' }} />
      <Stack.Screen name="connection-form" options={{ title: 'Connect to Rybbit' }} />
      <Stack.Screen name="sites" options={{ title: 'Sites' }} />
    </Stack>
  </>;
}

const themedStyles = createThemedStyles(colors => ({
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));
