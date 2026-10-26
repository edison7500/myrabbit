import { Stack } from 'expo-router/stack';
import { Platform } from 'react-native';
import { useTheme } from '@/stores/theme';

export function TabStack({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Stack screenOptions={{
    orientation: 'portrait',
    title,
    headerLargeTitleEnabled: true,
    headerTransparent: true,
    headerStyle: { backgroundColor: 'transparent' },
    headerLargeStyle: { backgroundColor: 'transparent' },
    headerTitleStyle: { color: colors.text },
    headerLargeTitleStyle: { color: colors.text },
    headerTintColor: colors.accent,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBlurEffect: Number.parseInt(String(Platform.Version), 10) >= 26 ? 'none' : 'systemChromeMaterial',
    contentStyle: { backgroundColor: colors.background },
  }}>
    <Stack.Screen name="index" />
  </Stack>;
}
