import { useTheme } from '@/stores/theme';
import { ChartNoAxesCombined, Compass, Radio, Settings2 } from 'lucide-react-native';
import { Redirect, Tabs, useSegments } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/stores/session';

import { TabBarBackground } from '@/components/tab-bar-background';

export default function MainLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const floatingTabs = process.env.EXPO_OS !== 'android';
  const tabBarInset = Math.max(20, insets.left + 12, insets.right + 12, (width - 440) / 2);
  const segments = useSegments();
  const titles: Record<string, string> = { overview: 'Dashboard', realtime: 'Realtime', explore: 'Explore', settings: 'Settings' };
  const title = titles[segments[segments.length - 1]] ?? 'Dashboard';
  const { ready, serverUrl, site } = useSession();
  if (!ready) return <ActivityIndicator accessibilityLabel="Loading connection" />;
  if (!serverUrl) return <Redirect href="/connect" />;
  if (!site) return <Redirect href="/sites" />;
  return (
    <>
    <Stack.Screen options={{ title }} />
    <Tabs screenOptions={{
      headerShown: false,
      animation: 'none',
      sceneStyle: { backgroundColor: colors.background },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarItemStyle: { paddingVertical: 5 },
      tabBarHideOnKeyboard: true,
      ...(floatingTabs ? {
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: 'absolute' as const,
          start: tabBarInset,
          end: tabBarInset,
          bottom: insets.bottom + 8,
          height: 66,
          borderTopWidth: 0,
          borderRadius: 34,
          backgroundColor: 'transparent',
          paddingBottom: 0,
        },
      } : {
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }),
    }}>
      <Tabs.Screen name="overview" options={{ title: 'Dashboard', tabBarIcon: ({ color, size, focused }) => <ChartNoAxesCombined color={color} size={size} strokeWidth={focused ? 2.2 : 1.8} accessible={false} /> }} />
      <Tabs.Screen name="realtime" options={{ title: 'Realtime', tabBarIcon: ({ color, size, focused }) => <Radio color={color} size={size} strokeWidth={focused ? 2.2 : 1.8} accessible={false} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color, size, focused }) => <Compass color={color} size={size} strokeWidth={focused ? 2.2 : 1.8} accessible={false} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size, focused }) => <Settings2 color={color} size={size} strokeWidth={focused ? 2.2 : 1.8} accessible={false} /> }} />
    </Tabs>
    </>
  );
}
