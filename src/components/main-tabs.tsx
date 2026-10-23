import { useTheme } from '@/stores/theme';
import { ChartNoAxesCombined, Compass, Radio, Settings2 } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarBackground } from '@/components/tab-bar-background';

// Android and web retain their existing tab bar implementation.
export function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const floatingTabs = process.env.EXPO_OS !== 'android';
  const tabBarInset = Math.max(20, insets.left + 12, insets.right + 12, (width - 440) / 2);
  return (
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
  );
}
