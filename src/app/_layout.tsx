import { Stack } from 'expo-router/stack';
import { SessionProvider, useSession } from '@/stores/session';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTheme } from '@/stores/theme';
import { AppearanceProvider } from '@/stores/appearance';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Platform } from 'react-native';

// Register before the first render so restoration keeps the native brand screen visible.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Anchor the settings modal above the startup screen for cold starts and deep links.
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  return <AppearanceProvider><ThemedRoot /></AppearanceProvider>;
}

function ThemedRoot() {
  const { colors, scheme } = useTheme();
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...baseTheme, colors: { ...baseTheme.colors,
    primary: colors.accent, background: colors.background, card: colors.background,
    text: colors.text, border: colors.border, notification: colors.accent,
  } };
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
    <ThemeProvider value={navigationTheme}><SessionProvider><RootNavigator /></SessionProvider></ThemeProvider>
  </GestureHandlerRootView>;
}

function RootNavigator() {
  const { ready } = useSession();
  const { ready: appearanceReady, colors, scheme } = useTheme();
  useEffect(() => {
    if (ready && appearanceReady) SplashScreen.hide();
  }, [ready, appearanceReady]);

  if (!ready || !appearanceReady) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, orientation: 'portrait', contentStyle: { backgroundColor: colors.background },
        ...(process.env.EXPO_OS === 'ios' ? { headerTransparent: true,
          // iOS 26+ supplies scroll-edge glass; earlier versions need a blur backdrop.
          headerBlurEffect: Number.parseInt(String(Platform.Version), 10) >= 26 ? 'none' as const : 'systemChromeMaterial' as const,
        } : {}),
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(settings)" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="referrers" options={{
          title: 'Referrers',
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
        }} />
        <Stack.Screen name="explore/[section]" options={{
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
        }} />
        <Stack.Screen name="traffic" options={{
          title: 'Traffic',
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
        }} />
        <Stack.Screen name="metrics/[metric]" options={{
          title: 'Visitors',
          headerShown: true,
          orientation: 'portrait',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
        }} />
        <Stack.Screen name="(tabs)" options={{
          title: 'Dashboard',
          orientation: 'portrait',
          // Each iOS tab owns its native navbar, allowing UIKit to track its scroll view.
          headerShown: process.env.EXPO_OS !== 'ios',
          headerStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          headerBackVisible: false,
        }} />
      </Stack>
    </>
  );
}
