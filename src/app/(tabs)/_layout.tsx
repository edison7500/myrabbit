import { Redirect, useSegments } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ActivityIndicator } from 'react-native';
import { MainTabs } from '@/components/main-tabs';
import { useSession } from '@/stores/session';

export default function MainLayout() {
  const segments = useSegments();
  const titles: Record<string, string> = { overview: 'Dashboard', realtime: 'Realtime', explore: 'Explore', settings: 'Settings' };
  const title = segments.reduce((current, segment) => titles[segment] ?? current, 'Dashboard');
  const { ready, serverUrl, site } = useSession();
  if (!ready) return <ActivityIndicator accessibilityLabel="Loading connection" />;
  if (!serverUrl) return <Redirect href="/connect" />;
  if (!site) return <Redirect href="/sites" />;
  return <>
    <Stack.Screen options={{ title }} />
    <MainTabs />
  </>;
}
